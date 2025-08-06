
'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Loader2, FileUp } from 'lucide-react';
import { extractDocumentMetadata } from '@/ai/flows/extract-document-metadata';
import { enhanceSearchWithKeywords } from '@/ai/flows/enhance-search-with-keywords';
import { extractTextFromImage } from '@/ai/flows/extract-text-from-image';
import { auth, db } from '@/lib/firebase';
import { v4 as uuidv4 } from 'uuid';
import { doc, addDoc, collection, serverTimestamp, updateDoc } from 'firebase/firestore';
import { GoogleAuthProvider, getAdditionalUserInfo, signInWithPopup } from 'firebase/auth';


const uploadSchema = z.object({
  file: z
    .any()
    .refine((files) => files?.length === 1, 'File is required.')
    .refine((files) => files?.[0]?.size <= 5000000, `Max file size is 5MB.`)
    .refine(
      (files) => ["image/jpeg", "image/png", "application/pdf"].includes(files?.[0]?.type),
      "Only .jpg, .png and .pdf files are accepted."
    ),
});

type UploadDialogProps = {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
};

export function UploadDialog({ isOpen, setIsOpen }: UploadDialogProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [fileName, setFileName] = useState('');
  const { toast } = useToast();
  const form = useForm<z.infer<typeof uploadSchema>>({
    resolver: zodResolver(uploadSchema),
  });

  const onSubmit = async (values: z.infer<typeof uploadSchema>) => {
    setIsProcessing(true);
    let user = auth.currentUser;

    if (!user) {
      toast({ variant: 'destructive', title: 'Not Authenticated', description: 'You must be logged in to upload documents.' });
      setIsProcessing(false);
      return;
    }
  
    const file = values.file[0];
    const uniqueFileName = `${uuidv4()}-${file.name}`;
  
    try {
      const provider = new GoogleAuthProvider();
      provider.addScope('https://www.googleapis.com/auth/drive.file');
      
      // We need to get the credential from the original sign-in.
      // A simple way is to re-trigger the popup, Firebase often caches this
      // and it happens instantly without user interaction.
      const result = await signInWithPopup(user, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);

      if (!credential || !credential.accessToken) {
        throw new Error("Could not retrieve a valid access token. Please sign in again.");
      }
      const accessToken = credential.accessToken;
      
      // 1. Upload file to Google Drive
      const driveResponse = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
        method: 'POST',
        headers: new Headers({ 
          'Authorization': 'Bearer ' + accessToken,
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify({
          name: uniqueFileName,
          mimeType: file.type,
        })
      });
      const driveFile = await driveResponse.json();

      if (driveFile.error) {
        throw new Error(driveFile.error.message);
      }

      await fetch(`https://www.googleapis.com/upload/drive/v3/files/${driveFile.id}?uploadType=media`, {
        method: 'PATCH',
        headers: new Headers({
            'Authorization': 'Bearer ' + accessToken,
            'Content-Type': file.type,
        }),
        body: file
      });
      
      const fileMetadata = await fetch(`https://www.googleapis.com/drive/v3/files/${driveFile.id}?fields=webViewLink`, {
          headers: new Headers({ 'Authorization': 'Bearer ' + accessToken })
      }).then(res => res.json());

      const fileUrl = fileMetadata.webViewLink;

      if (!fileUrl) {
        throw new Error("Could not get file URL from Google Drive.");
      }

      const isImage = file.type.startsWith('image/');

      // 2. Create a placeholder document in Firestore
      const docRef = await addDoc(collection(db, 'documents'), {
        userId: user.uid,
        fileName: uniqueFileName,
        fileUrl: fileUrl,
        uploadedAt: serverTimestamp(),
        owner: 'Processing...',
        type: 'Processing...',
        keywords: [],
        summary: 'Processing...',
        expiry: null,
        isProcessing: true,
      });

      // Close dialog and reset form immediately
      form.reset();
      setFileName('');
      setIsOpen(false);
      
      // Handle AI processing in the background
      if (isImage) {
        toast({
          title: 'Upload successful!',
          description: 'Your document is now being processed by the AI.',
        });
        const reader = new FileReader();
        reader.readAsDataURL(file);
        const dataUrl = await new Promise<string>((resolve, reject) => {
          reader.onload = e => resolve(e.target?.result as string);
          reader.onerror = e => reject(e);
        });
        
        try {
          const [metadata, textExtraction] = await Promise.all([
            extractDocumentMetadata({ documentDataUrl: dataUrl }),
            extractTextFromImage({ documentDataUrl: dataUrl }),
          ]);

          const { keywords } = await enhanceSearchWithKeywords({ documentText: textExtraction.text });
          
          await updateDoc(doc(db, 'documents', docRef.id), { ...metadata, keywords, summary: metadata.summary, isProcessing: false });

          toast({
            title: 'Processing Complete!',
            description: `Successfully analyzed and saved your ${metadata.documentType}.`,
          });
        } catch (aiError) {
          console.error('Failed to process document with AI:', aiError);
          await updateDoc(doc(db, 'documents', docRef.id), {
            owner: file.name,
            type: 'Processing Failed',
            summary: 'Could not analyze this document.',
            isProcessing: false,
          });
          toast({
            variant: 'destructive',
            title: 'AI Processing Failed',
            description: 'Could not extract metadata from the document.',
          });
        }
      } else {
        // For non-image files like PDFs, just update the placeholder
        await updateDoc(doc(db, 'documents', docRef.id), {
          owner: file.name,
          type: 'PDF Document',
          keywords: [file.name.split('.')[0]],
          summary: 'PDF content analysis is not yet supported.',
          isProcessing: false,
        });
        toast({
          title: 'Upload successful!',
          description: `${file.name} was saved. PDF analysis is not yet supported.`,
        });
      }
    } catch (error: any) {
      console.error('Failed to upload document:', error);
      let description = 'Could not upload the document. Please try again.';
      if (error.code === 'auth/popup-closed-by-user') {
        description = 'The authentication popup was closed. Please try uploading again.';
      } else if (error.message) {
        description = error.message;
      }
      
      toast({
        variant: 'destructive',
        title: 'Upload Failed',
        description: description,
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const fileRef = form.register('file');

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!isProcessing) {
        setIsOpen(open);
        if (!open) {
          form.reset();
          setFileName('');
        }
      }
    }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Upload Document</DialogTitle>
          <DialogDescription>
            Select a document file to upload. The system will automatically extract its content.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="file"
              render={({ field }) => (
                <FormItem>
                  <FormLabel htmlFor="file-upload" className="sr-only">Document File</FormLabel>
                  <FormControl>
                    <div className="flex items-center justify-center w-full">
                        <label htmlFor="file-upload" className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-lg cursor-pointer bg-card hover:bg-muted/50">
                            <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                <FileUp className="w-10 h-10 mb-3 text-muted-foreground" />
                                {fileName ? (
                                    <p className="font-semibold text-primary">{fileName}</p>
                                ) : (
                                  <>
                                    <p className="mb-2 text-sm text-muted-foreground"><span className="font-semibold">Click to upload</span> or drag and drop</p>
                                    <p className="text-xs text-muted-foreground">PDF, PNG, JPG, etc.</p>
                                  </>
                                )}
                            </div>
                            <Input id="file-upload" type="file" className="hidden" {...fileRef} onChange={(e) => {
                                field.onChange(e.target.files);
                                if (e.target.files && e.target.files.length > 0) {
                                    setFileName(e.target.files[0].name);
                                }
                            }} />
                        </label>
                    </div> 
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="secondary" disabled={isProcessing}>
                  Cancel
                </Button>
              </DialogClose>
              <Button type="submit" disabled={isProcessing} className="bg-accent hover:bg-accent/90">
                {isProcessing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Uploading...
                  </>
                ) : "Upload"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

    