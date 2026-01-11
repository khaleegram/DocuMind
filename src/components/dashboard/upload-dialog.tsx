
'use client';

import { useRouter } from 'next/navigation';
import { useState, useCallback, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { auth, db, storage } from '@/lib/firebase';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { collection, addDoc } from 'firebase/firestore';
import { ShieldCheck, CloudUpload, X, Lock, File, UploadCloud, Loader2 } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { v4 as uuidv4 } from 'uuid';
import { extractDocumentMetadata } from '@/ai/flows/extract-document-metadata';
import { extractTextFromImage } from '@/ai/flows/extract-text-from-image';
import { enhanceSearchWithKeywords } from '@/ai/flows/enhance-search-with-keywords';

type UploadDialogProps = {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
};

async function processFileInBackground(docId: string, fileUrl: string, mimeType: string) {
    try {
        const response = await fetch(fileUrl);
        const blob = await response.blob();
        const buffer = Buffer.from(await blob.arrayBuffer());
        const dataUrl = `data:${mimeType};base64,${buffer.toString('base64')}`;

        const [metadataResult, textResult] = await Promise.all([
            extractDocumentMetadata({ documentDataUrl: dataUrl }),
            extractTextFromImage({ documentDataUrl: dataUrl }),
        ]);

        const { text } = textResult;
        
        const { keywords } = text ? await enhanceSearchWithKeywords({ documentText: text }) : { keywords: [] };

        const { updateDoc } = await import('firebase/firestore');
        const { doc } = await import('firebase/firestore');

        await updateDoc(doc(db, 'documents', docId), {
            ...metadataResult,
            keywords: keywords || [],
            textContent: text,
            isProcessing: false,
        });

        console.log(`Successfully processed and updated document ${docId}`);

    } catch (aiError: any) {
        console.error(`AI processing failed for document ${docId}:`, aiError);
        const { updateDoc } = await import('firebase/firestore');
        const { doc } = await import('firebase/firestore');
        await updateDoc(doc(db, 'documents', docId),{
            isProcessing: false,
            category: 'Processing Failed',
            owner: 'Processing Failed',
            summary: `Error: ${aiError.message || 'Could not analyze the document.'}`,
        });
    }
}


export function UploadDialog({ isOpen, setIsOpen }: UploadDialogProps) {
  const { toast } = useToast();
  const router = useRouter();
  const [files, setFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setFiles(acceptedFiles);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.png', '.gif', '.webp'],
      'application/pdf': ['.pdf'],
    },
    maxFiles: 1
  });
  
  const handleUpload = async () => {
    if (files.length === 0 || isUploading) return;

    const file = files[0];
    const user = auth.currentUser;
    if (!user) {
        toast({ variant: 'destructive', title: 'Authentication Error', description: 'You must be logged in to upload files.' });
        return;
    }
    
    setIsUploading(true);
    setUploadProgress(0);

    const storagePath = `documents/${user.uid}/${uuidv4()}-${file.name}`;
    const storageRef = ref(storage, storagePath);
    const uploadTask = uploadBytesResumable(storageRef, file);

    uploadTask.on('state_changed',
        (snapshot) => {
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            setUploadProgress(progress);
        },
        (error) => {
            console.error("Upload failed:", error);
            setIsUploading(false);
            toast({
                variant: 'destructive',
                title: 'TRANSFER ERROR',
                description: 'A network error occurred. Please try again.',
            });
        },
        async () => {
            // Upload completed successfully
            try {
              const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);

              const initialState = {
                  userId: user.uid,
                  fileName: file.name,
                  fileUrl: downloadURL,
                  storagePath: storagePath,
                  mimeType: file.type,
                  uploadedAt: new Date(),
                  owner: 'Processing...',
                  category: 'Processing...',
                  keywords: [],
                  tags: [],
                  summary: 'Processing...',
                  textContent: '',
                  expiry: null,
                  isProcessing: true,
              };

              const docRef = await addDoc(collection(db, "documents"), initialState);
              
              toast({
                  title: "VAULT SYNCHRONIZED",
                  description: "Your assets have been securely stored and are being analyzed.",
                  className: "bg-black border-blue-500/50 text-white rounded-2xl",
              });

              setIsOpen(false);
              router.refresh();
              
              // Don't await this, let it run in the background
              processFileInBackground(docRef.id, downloadURL, file.type);
            
            } catch (error) {
                console.error("Error creating document record: ", error);
                 toast({
                    variant: 'destructive',
                    title: 'DATABASE ERROR',
                    description: 'Could not save the document record. Please try again.',
                });
            } finally {
               setIsUploading(false);
               setFiles([]);
            }
        }
    );
  };
  
  const baseStyle = 'relative flex flex-col items-center justify-center p-8 w-full h-48 border-2 border-dashed border-white/10 rounded-[1.5rem] cursor-pointer transition-colors duration-200 ease-in-out';
  const activeStyle = 'border-blue-500 bg-blue-500/10';
  const acceptStyle = 'border-green-500';
  const rejectStyle = 'border-red-500';

  const style = useMemo(() => ({
    ...({ ...baseStyle }),
    ...(isDragActive ? { ...activeStyle } : {})
  }), [isDragActive]);

  const closeDialog = () => {
    if (isUploading) return;
    setFiles([]);
    setIsOpen(false);
  }

  return (
    <Dialog open={isOpen} onOpenChange={closeDialog}>
      <DialogContent className="sm:max-w-[480px] bg-[#050505] border-white/10 p-0 rounded-[2.5rem] overflow-hidden shadow-[0_0_80px_rgba(0,0,0,0.9)] outline-none ring-0">
        
        <div className="h-1.5 w-full bg-gradient-to-r from-blue-600 via-indigo-500 to-blue-600" />

        <div className="relative p-8">
            <div className="flex items-start justify-between mb-8">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border-blue-500/20 flex items-center justify-center text-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.1)]">
                        <CloudUpload size={24} />
                    </div>
                    <div>
                        <DialogTitle className="text-xl font-black tracking-tight text-white uppercase">Secure Ingestion</DialogTitle>
                        <DialogDescription asChild>
                            <div className="flex items-center gap-1.5 text-zinc-500">
                                <Lock size={12} className="text-blue-500" />
                                <p className="text-xs font-bold tracking-widest uppercase">E2E Encrypted</p>
                            </div>
                        </DialogDescription>
                    </div>
                </div>
                
                <button 
                    onClick={closeDialog}
                    className="p-2 rounded-xl hover:bg-white/5 text-zinc-600 transition-colors"
                    disabled={isUploading}
                >
                    <X size={20} />
                </button>
            </div>

            <div className="relative rounded-[2rem] bg-white/[0.02] border border-white/5 p-2">
                 <div {...getRootProps({ style: style as any })}>
                    <input {...getInputProps()} />
                    {files.length === 0 && (
                        <div className="text-center">
                            <UploadCloud className="mx-auto h-12 w-12 text-zinc-500" />
                            <p className="mt-2 text-sm font-bold text-zinc-300">Drag & drop a file or click to select</p>
                            <p className="mt-1 text-xs text-zinc-600">PDF, JPG, PNG, GIF up to 16MB</p>
                        </div>
                    )}
                    {files.length > 0 && !isUploading && (
                        <div className="text-center">
                            <File className="mx-auto h-12 w-12 text-blue-500" />
                            <p className="mt-2 text-sm font-bold text-zinc-300 truncate max-w-full">{files[0].name}</p>
                            <p className="mt-1 text-xs text-zinc-500">{(files[0].size / 1024 / 1024).toFixed(2)} MB</p>
                        </div>
                    )}
                    {isUploading && (
                        <div className="w-full text-center">
                             <Loader2 className="mx-auto h-12 w-12 text-blue-500 animate-spin" />
                             <p className="mt-2 text-sm font-bold text-zinc-300">Uploading...</p>
                        </div>
                    )}
                 </div>
            </div>

            {files.length > 0 && (
                <div className="mt-4">
                    {isUploading ? (
                        <Progress value={uploadProgress} className="h-2 bg-white/10" />
                    ) : (
                        <div className="flex gap-2">
                           <Button variant="outline" onClick={() => setFiles([])} className="w-full h-12 bg-white/5 border-white/10 text-zinc-300 hover:bg-white/10 rounded-xl">Cancel</Button>
                           <Button onClick={handleUpload} className="w-full h-12 bg-blue-600 hover:bg-blue-500 rounded-xl font-bold">Upload File</Button>
                        </div>
                    )}
                </div>
            )}
            
            <div className="mt-6 flex items-center justify-between px-2">
                <div className="flex items-center gap-2">
                    <ShieldCheck size={14} className="text-blue-500" />
                    <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Protocol: AES-256</span>
                </div>
                <div className="flex gap-1">
                    <div className="w-1 h-1 rounded-full bg-blue-500 animate-pulse" />
                    <div className="w-1 h-1 rounded-full bg-blue-500 animate-pulse delay-75" />
                    <div className="w-1 h-1 rounded-full bg-blue-500 animate-pulse delay-150" />
                </div>
            </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
