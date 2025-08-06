
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
import { signInWithPopup, GoogleAuthProvider, reauthenticateWithRedirect } from 'firebase/auth';


const uploadSchema = z.object({
  files: z
    .any()
    .refine((files) => files?.length > 0, 'At least one file is required.')
    .refine((files) => Array.from(files).every((file: any) => file.size <= 5000000), `Max file size is 5MB per file.`)
    .refine(
      (files) => Array.from(files).every((file: any) => ["image/jpeg", "image/png", "application/pdf"].includes(file?.type)),
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
  const [fileNames, setFileNames] = useState<string[]>([]);
  const { toast } = useToast();
  const form = useForm<z.infer<typeof uploadSchema>>({
    resolver: zodResolver(uploadSchema),
    defaultValues: {
      files: undefined,
    }
  });

  const processFile = async (file: File, accessToken: string, user: any) => {
      const uniqueFileName = `${uuidv4()}-${file.name}`;
      
      const docuMindFolderId = await getDocuMindFolderId(accessToken);
      
      const readerForMetadata = new FileReader();
      readerForMetadata.readAsDataURL(file);
      const dataUrlForMetadata = await new Promise<string>((resolve, reject) => {
        readerForMetadata.onload = e => resolve(e.target?.result as string);
        readerForMetadata.onerror = e => reject(e);
      });
      const tempMetadata = await retryWithBackoff(() => extractDocumentMetadata({ documentDataUrl: dataUrlForMetadata }));
      const folderName = tempMetadata.company || tempMetadata.owner;
      
      const targetFolder = await getOrCreateFolder(accessToken, folderName, docuMindFolderId);
      
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
      if (!fileUrl) throw new Error("Could not get file URL from Google Drive.");

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
        country: null,
        isProcessing: true,
      });

      toast({ title: `Uploading ${file.name}`, description: 'Your document is now being organized by the AI.' });

      try {
        const [textExtraction] = await Promise.all([
          retryWithBackoff(() => extractTextFromImage({ documentDataUrl: dataUrlForMetadata })),
        ]);
        const { keywords } = await retryWithBackoff(() => enhanceSearchWithKeywords({ documentText: textExtraction.text }));
        await updateDoc(doc(db, 'documents', docRef.id), { ...tempMetadata, keywords, summary: tempMetadata.summary, textContent: textExtraction.text, isProcessing: false });
        toast({ title: `Processing Complete for ${file.name}!`, description: `Successfully analyzed and saved your ${tempMetadata.documentType}.` });
      } catch (aiError) {
        console.error(`Failed to process ${file.name} with AI:`, aiError);
        await updateDoc(doc(db, 'documents', docRef.id), { owner: file.name, type: 'Processing Failed', summary: 'Could not analyze this document.', isProcessing: false });
        toast({ variant: 'destructive', title: 'AI Processing Failed', description: `Could not extract metadata from ${file.name}.` });
      }
  };

  const onSubmit = async (values: z.infer<typeof uploadSchema>) => {
    setIsProcessing(true);
    const user = auth.currentUser;

    if (!user) {
      toast({ variant: 'destructive', title: 'Not Authenticated', description: 'You must be logged in to upload documents.' });
      setIsProcessing(false);
      return;
    }

    const files = Array.from(values.files) as File[];

    try {
      await reauthenticateWithRedirect(user, googleProvider);
      const result = await signInWithPopup(auth, googleProvider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (!credential || !credential.accessToken) {
        throw new Error("Could not retrieve a valid access token. Please sign in again.");
      }
      const accessToken = credential.accessToken;
      
      setIsOpen(false);
      form.reset();
      setFileNames([]);

      toast({
          title: `Starting upload of ${files.length} documents...`,
          description: 'You can continue to use the app while processing happens.',
      });

      for (const file of files) {
          try {
              await processFile(file, accessToken, user);
          } catch(fileError: any) {
               console.error(`Failed to upload file ${file.name}:`, fileError);
               toast({ variant: 'destructive', title: `Upload Failed for ${file.name}`, description: fileError.message || 'Could not upload this document.' });
          }
      }

    } catch (error: any) {
      console.error('Failed to upload document:', error);
      let description = 'Could not upload the document. Please try again.';
      if (error.code === 'auth/popup-closed-by-user') {
        description = 'The authentication popup was closed. Please try uploading again.';
      } else if (error.code === 'auth/cancelled-popup-request' || error.code === 'auth/popup-blocked') {
        description = 'The authentication popup was blocked or cancelled. Please allow popups for this site and try again.';
      } else if (error.message) {
        description = error.message;
      }
      toast({ variant: 'destructive', title: 'Upload Failed', description: description });
    } finally {
      setIsProcessing(false);
    }
  };

  const fileRef = form.register('files');

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!isProcessing) {
        setIsOpen(open);
        if (!open) {
          form.reset();
          setFileNames([]);
        }
      }
    }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Upload Document(s)</DialogTitle>
          <DialogDescription>
            Select one or more document files to upload. The system will automatically organize them for you.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="files"
              render={({ field }) => (
                <FormItem>
                  <FormLabel htmlFor="file-upload" className="sr-only">Document File</FormLabel>
                  <FormControl>
                    <div className="flex items-center justify-center w-full">
                        <label htmlFor="file-upload" className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-lg cursor-pointer bg-card hover:bg-muted/50">
                            <div className="flex flex-col items-center justify-center pt-5 pb-6 text-center">
                                <FileUp className="w-10 h-10 mb-3 text-muted-foreground" />
                                {fileNames.length > 0 ? (
                                    <div className="text-sm font-semibold text-primary px-2">
                                        {fileNames.length === 1 ? fileNames[0] : `${fileNames.length} files selected`}
                                        {fileNames.length > 1 && 
                                            <p className="text-xs text-muted-foreground font-normal mt-1 truncate max-w-xs">{fileNames.join(', ')}</p>
                                        }
                                    </div>
                                ) : (
                                  <>
                                    <p className="mb-2 text-sm text-muted-foreground"><span className="font-semibold">Click to upload</span> or drag and drop</p>
                                    <p className="text-xs text-muted-foreground">PDF, PNG, JPG, etc. (multi-select enabled)</p>
                                  </>
                                )}
                            </div>
                            <Input id="file-upload" type="file" multiple className="hidden" {...fileRef} onChange={(e) => {
                                field.onChange(e.target.files);
                                if (e.target.files && e.target.files.length > 0) {
                                    setFileNames(Array.from(e.target.files).map(f => f.name));
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
              <Button type="submit" disabled={isProcessing || fileNames.length === 0} className="bg-accent hover:bg-accent/90">
                {isProcessing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Uploading...
                  </>
                ) : `Upload ${fileNames.length > 0 ? fileNames.length : ''} file(s)`}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

    