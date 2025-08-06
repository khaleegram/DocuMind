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
import type { Document } from '@/lib/types';
import { Loader2, FileUp } from 'lucide-react';
import { extractDocumentMetadata } from '@/ai/flows/extract-document-metadata';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { auth, db } from '@/lib/firebase';
import { v4 as uuidv4 } from 'uuid';
import { doc, addDoc, collection, serverTimestamp, updateDoc } from 'firebase/firestore';


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
  onDocumentAdd: (newDocData: Omit<Document, 'id' | 'userId' | 'uploadedAt'>) => void;
};

export function UploadDialog({ isOpen, setIsOpen }: Omit<UploadDialogProps, 'onDocumentAdd'>) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [fileName, setFileName] = useState('');
  const { toast } = useToast();
  const form = useForm<z.infer<typeof uploadSchema>>({
    resolver: zodResolver(uploadSchema),
  });

  const onSubmit = async (values: z.infer<typeof uploadSchema>) => {
    setIsProcessing(true);
    const user = auth.currentUser;
    if (!user) {
      toast({ variant: 'destructive', title: 'Not Authenticated', description: 'You must be logged in to upload documents.' });
      setIsProcessing(false);
      return;
    }
  
    const file = values.file[0];
    const uniqueFileName = `${uuidv4()}-${file.name}`;
  
    try {
      // 1. Upload file to Firebase Storage
      const storage = getStorage();
      const storageRef = ref(storage, `documents/${user.uid}/${uniqueFileName}`);
      const snapshot = await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(snapshot.ref);

      // 2. Create a placeholder document in Firestore
      const docRef = await addDoc(collection(db, 'documents'), {
        userId: user.uid,
        fileName: uniqueFileName,
        fileUrl: downloadURL,
        uploadedAt: serverTimestamp(),
        owner: 'Processing...',
        type: 'Processing...',
        keywords: [],
        expiry: null,
        isProcessing: true,
      });

      // Close dialog and reset form immediately
      form.reset();
      setFileName('');
      setIsOpen(false);
      toast({
        title: 'Upload Started!',
        description: 'Your document is being processed.',
      });
  
      // 3. Process with Genkit AI in the background
      let documentText = '';
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        const dataUrl = await new Promise<string>((resolve, reject) => {
          reader.onload = e => resolve(e.target?.result as string);
          reader.onerror = e => reject(e);
        });
        documentText = dataUrl;
      } else {
        documentText = "No text could be extracted from this file type.";
      }
      
      try {
        const metadata = await extractDocumentMetadata({ documentText });
    
        // 4. Update document with extracted metadata
        await updateDoc(doc(db, 'documents', docRef.id), {
          owner: metadata.owner,
          company: metadata.documentType === 'Contract' || metadata.documentType === 'Receipt' ? metadata.owner : undefined,
          type: metadata.documentType,
          expiry: metadata.expiryDate,
          keywords: metadata.keywords,
          isProcessing: false,
        });
    
        toast({
          title: 'Document Processed!',
          description: `Successfully processed and saved "${metadata.documentType}" for ${metadata.owner}.`,
        });
      } catch (aiError) {
        console.error('Failed to process document with AI:', aiError);
        await updateDoc(doc(db, 'documents', docRef.id), {
          owner: 'Processing Failed',
          type: 'Error',
          isProcessing: false,
        });
        toast({
          variant: 'destructive',
          title: 'Processing Failed',
          description: 'Could not extract metadata from the document.',
        });
      }

    } catch (error) {
      console.error('Failed to upload document:', error);
      toast({
        variant: 'destructive',
        title: 'Upload Failed',
        description: 'Could not upload the document. Please try again.',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const fileRef = form.register('file');

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      setIsOpen(open);
      if (!open) {
        form.reset();
        setFileName('');
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
