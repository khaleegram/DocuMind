
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
import { auth, db, googleProvider } from '@/lib/firebase';
import { v4 as uuidv4 } from 'uuid';
import { doc, addDoc, collection, serverTimestamp, updateDoc, query, where, getDocs, setDoc } from 'firebase/firestore';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';


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

// Helper function for retrying promises with exponential backoff
const retryWithBackoff = async <T,>(
  fn: () => Promise<T>,
  retries = 3,
  delay = 1000,
  backoff = 2
): Promise<T> => {
  try {
    return await fn();
  } catch (error: any) {
    if (retries > 0 && error.message?.includes('503')) {
      await new Promise(res => setTimeout(res, delay));
      return retryWithBackoff(fn, retries - 1, delay * backoff, backoff);
    } else {
      throw error;
    }
  }
};

const getOrCreateFolder = async (accessToken: string, folderName: string, parentFolderId: string) => {
    const foldersRef = collection(db, 'folders');
    const user = auth.currentUser;

    const q = query(foldersRef, where('userId', '==', user!.uid), where('name', '==', folderName));
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
        const folderDoc = querySnapshot.docs[0];
        return { id: folderDoc.id, driveFolderId: folderDoc.data().driveFolderId };
    }

    // If folder doesn't exist in Firestore, create it in Google Drive
    const driveMetadataResponse = await fetch('https://www.googleapis.com/drive/v3/files', {
        method: 'POST',
        headers: new Headers({ 
          'Authorization': 'Bearer ' + accessToken,
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify({
          name: folderName,
          mimeType: 'application/vnd.google-apps.folder',
          parents: [parentFolderId]
        })
      });
    
    if (!driveMetadataResponse.ok) {
        const errorBody = await driveMetadataResponse.json().catch(() => ({ error: { message: `Could not create folder "${folderName}" in Google Drive.` }}));
        throw new Error(errorBody.error.message);
    }
    const driveFolder = await driveMetadataResponse.json();

    // Create a new folder document in Firestore
    const newFolderRef = doc(foldersRef);
    await setDoc(newFolderRef, {
        userId: user!.uid,
        name: folderName,
        driveFolderId: driveFolder.id,
        createdAt: serverTimestamp(),
    });

    return { id: newFolderRef.id, driveFolderId: driveFolder.id };
}

const getDocuMindFolderId = async (accessToken: string) => {
    // Check if DocuMind folder exists
    const driveQuery = "mimeType='application/vnd.google-apps.folder' and name='DocuMind' and trashed=false";
    const driveSearchResponse = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(driveQuery)}&fields=files(id,name)`, {
        headers: new Headers({ 'Authorization': 'Bearer ' + accessToken })
    });

    if (!driveSearchResponse.ok) throw new Error("Could not search for DocuMind folder.");
    const searchResult = await driveSearchResponse.json();

    if (searchResult.files.length > 0) {
        return searchResult.files[0].id;
    }

    // Create DocuMind folder if it doesn't exist
    const driveMetadataResponse = await fetch('https://www.googleapis.com/drive/v3/files', {
        method: 'POST',
        headers: new Headers({ 
          'Authorization': 'Bearer ' + accessToken,
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify({
          name: 'DocuMind',
          mimeType: 'application/vnd.google-apps.folder',
        })
      });
    
    if (!driveMetadataResponse.ok) throw new Error("Could not create the main 'DocuMind' folder in Google Drive.");
    const driveFolder = await driveMetadataResponse.json();
    return driveFolder.id;
}


export function UploadDialog({ isOpen, setIsOpen }: UploadDialogProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [fileName, setFileName] = useState('');
  const { toast } = useToast();
  const form = useForm<z.infer<typeof uploadSchema>>({
    resolver: zodResolver(uploadSchema),
    defaultValues: {
      file: undefined,
    }
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
      
      const result = await signInWithPopup(auth, googleProvider);
      const credential = GoogleAuthProvider.credentialFromResult(result);

      if (!credential || !credential.accessToken) {
        throw new Error("Could not retrieve a valid access token. Please sign in again.");
      }
      const accessToken = credential.accessToken;
      
      // Get or create the main "DocuMind" folder
      const docuMindFolderId = await getDocuMindFolderId(accessToken);

      // Temporary placeholder metadata to decide folder name
      const readerForMetadata = new FileReader();
      readerForMetadata.readAsDataURL(file);
      const dataUrlForMetadata = await new Promise<string>((resolve, reject) => {
        readerForMetadata.onload = e => resolve(e.target?.result as string);
        readerForMetadata.onerror = e => reject(e);
      });
      const tempMetadata = await retryWithBackoff(() => extractDocumentMetadata({ documentDataUrl: dataUrlForMetadata }));
      const folderName = tempMetadata.company || tempMetadata.owner;
      
      // Get or create the specific person/org folder
      const targetFolder = await getOrCreateFolder(accessToken, folderName, docuMindFolderId);

      // 1. Upload file to Google Drive in the correct folder
      const driveMetadataResponse = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
        method: 'POST',
        headers: new Headers({ 
          'Authorization': 'Bearer ' + accessToken,
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify({
          name: uniqueFileName,
          mimeType: file.type,
          parents: [targetFolder.driveFolderId]
        })
      });

      if (!driveMetadataResponse.ok) {
        const errorBody = await driveMetadataResponse.json().catch(() => ({ error: { message: "Unknown error during Drive metadata creation." }}));
        throw new Error(errorBody.error.message);
      }
      const driveFile = await driveMetadataResponse.json();

      const mediaUploadResponse = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${driveFile.id}?uploadType=media`, {
        method: 'PATCH',
        headers: new Headers({
            'Authorization': 'Bearer ' + accessToken,
            'Content-Type': file.type,
        }),
        body: file
      });

      if (!mediaUploadResponse.ok) {
         const errorBody = await mediaUploadResponse.json().catch(() => ({ error: { message: "Unknown error during Drive media upload." }}));
         throw new Error(errorBody.error.message);
      }
      
      const fileMetadata = await fetch(`https://www.googleapis.com/drive/v3/files/${driveFile.id}?fields=webViewLink,thumbnailLink`, {
          headers: new Headers({ 'Authorization': 'Bearer ' + accessToken })
      }).then(res => res.json());

      const fileUrl = fileMetadata.webViewLink;
      const thumbnailUrl = fileMetadata.thumbnailLink || null;

      if (!fileUrl) {
        throw new Error("Could not get file URL from Google Drive.");
      }

      // 2. Create a placeholder document in Firestore
      const docRef = await addDoc(collection(db, 'documents'), {
        userId: user.uid,
        fileName: uniqueFileName,
        fileUrl: fileUrl,
        thumbnailUrl: thumbnailUrl,
        mimeType: file.type,
        uploadedAt: serverTimestamp(),
        driveFileId: driveFile.id,
        folderId: targetFolder.id,
        owner: 'Processing...',
        type: 'Processing...',
        keywords: [],
        summary: 'Processing...',
        textContent: '',
        expiry: null,
        company: null,
        isProcessing: true,
      });

      // Close dialog and reset form immediately
      form.reset();
      setFileName('');
      setIsOpen(false);
      
      // Handle AI processing in the background
      toast({
        title: 'Upload successful!',
        description: 'Your document is now being organized by the AI.',
      });
      
      try {
        const [textExtraction] = await Promise.all([
          // metadata already fetched as tempMetadata
          retryWithBackoff(() => extractTextFromImage({ documentDataUrl: dataUrlForMetadata })),
        ]);

        const { keywords } = await retryWithBackoff(() => enhanceSearchWithKeywords({ documentText: textExtraction.text }));

        await updateDoc(doc(db, 'documents', docRef.id), { ...tempMetadata, keywords, summary: tempMetadata.summary, textContent: textExtraction.text, isProcessing: false });

        toast({
          title: 'Processing Complete!',
          description: `Successfully analyzed and saved your ${tempMetadata.documentType}.`,
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
            Select a document file to upload. The system will automatically organize it for you.
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
