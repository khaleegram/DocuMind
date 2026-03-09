'use client';

import { useRouter } from 'next/navigation';
import { useState, useCallback } from 'react';
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
import { useDropzone, type FileRejection } from 'react-dropzone';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { v4 as uuidv4 } from 'uuid';
import {
  ALLOWED_UPLOAD_EXTENSIONS,
  ALLOWED_UPLOAD_MIME_TYPES,
  MAX_UPLOAD_BYTES,
  MAX_UPLOAD_SIZE_MB,
} from '@/lib/constants';
import { cn } from '@/lib/utils';

type UploadDialogProps = {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  onUploadComplete?: () => void;
};

const createUploadErrorMessage = (errorCode: string): string => {
  switch (errorCode) {
    case 'file-too-large':
      return `File exceeds ${MAX_UPLOAD_SIZE_MB}MB limit.`;
    case 'file-invalid-type':
      return `Unsupported file type. Allowed: ${ALLOWED_UPLOAD_EXTENSIONS.join(', ')}.`;
    case 'too-many-files':
      return 'Only one file can be uploaded at a time.';
    default:
      return 'Invalid file selection.';
  }
};

const triggerDocumentProcessing = async (docId: string, idToken: string): Promise<void> => {
  const response = await fetch('/api/documents/process', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ docId }),
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(payload.error || 'Failed to start document processing.');
  }
};

export function UploadDialog({ isOpen, setIsOpen, onUploadComplete }: UploadDialogProps) {
  const { toast } = useToast();
  const router = useRouter();
  const [files, setFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setFiles(acceptedFiles);
  }, []);

  const onDropRejected = useCallback(
    (rejections: readonly FileRejection[]) => {
      const firstCode = rejections[0]?.errors[0]?.code;
      toast({
        variant: 'destructive',
        title: 'UPLOAD_REJECTED',
        description: createUploadErrorMessage(firstCode || ''),
      });
    },
    [toast]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    onDropRejected,
    accept: {
      'image/jpeg': ['.jpeg', '.jpg'],
      'image/png': ['.png'],
      'image/gif': ['.gif'],
      'image/webp': ['.webp'],
      'application/pdf': ['.pdf'],
    },
    maxFiles: 1,
    maxSize: MAX_UPLOAD_BYTES,
    multiple: false,
  });

  const closeDialog = () => {
    if (isUploading) return;
    setFiles([]);
    setIsOpen(false);
  };

  const handleUpload = async () => {
    if (files.length === 0 || isUploading) return;

    const file = files[0];
    const user = auth.currentUser;
    if (!user) {
      toast({
        variant: 'destructive',
        title: 'AUTH_ERROR',
        description: 'You must be logged in to upload files.',
      });
      return;
    }

    if (
      !ALLOWED_UPLOAD_MIME_TYPES.includes(
        file.type as (typeof ALLOWED_UPLOAD_MIME_TYPES)[number]
      )
    ) {
      toast({
        variant: 'destructive',
        title: 'UNSUPPORTED_FILE',
        description: `Allowed file types: ${ALLOWED_UPLOAD_EXTENSIONS.join(', ')}.`,
      });
      return;
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      toast({
        variant: 'destructive',
        title: 'FILE_TOO_LARGE',
        description: `Maximum allowed size is ${MAX_UPLOAD_SIZE_MB}MB.`,
      });
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    const storagePath = `documents/${user.uid}/${uuidv4()}-${file.name}`;
    const storageRef = ref(storage, storagePath);
    const uploadTask = uploadBytesResumable(storageRef, file, { contentType: file.type });

    uploadTask.on(
      'state_changed',
      snapshot => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        setUploadProgress(progress);
      },
      error => {
        console.error('Upload failed:', error);
        setIsUploading(false);
        toast({
          variant: 'destructive',
          title: 'TRANSFER_ERROR',
          description: 'A network error occurred. Please try again.',
        });
      },
      async () => {
        try {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          const idToken = await user.getIdToken();

          const initialState = {
            userId: user.uid,
            fileName: file.name,
            fileUrl: downloadURL,
            storagePath,
            mimeType: file.type,
            uploadedAt: new Date(),
            owner: 'Processing...',
            category: 'Processing...',
            keywords: [],
            tags: [],
            summary: 'Processing...',
            textContent: '',
            expiry: null,
            thumbnailUrl: null,
            isProcessing: true,
            processingError: null,
          };

          const docRef = await addDoc(collection(db, 'documents'), initialState);

          toast({
            title: 'VAULT_SYNCHRONIZED',
            description: 'File uploaded. AI processing has started.',
            className: 'bg-black border-blue-500/50 text-white rounded-2xl',
          });

          setIsOpen(false);
          setFiles([]);
          onUploadComplete?.();
          router.refresh();

          void triggerDocumentProcessing(docRef.id, idToken).catch(error => {
            console.error('Failed to trigger processing:', error);
            toast({
              variant: 'destructive',
              title: 'PROCESSING_ERROR',
              description:
                error instanceof Error ? error.message : 'Could not start AI processing.',
            });
          });
        } catch (error) {
          console.error('Error creating document record:', error);
          toast({
            variant: 'destructive',
            title: 'DATABASE_ERROR',
            description: 'Could not save the document record. Please try again.',
          });
        } finally {
          setIsUploading(false);
        }
      }
    );
  };

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
                <DialogTitle className="text-xl font-black tracking-tight text-white uppercase">
                  Secure Ingestion
                </DialogTitle>
                <DialogDescription asChild>
                  <div className="flex items-center gap-1.5 text-zinc-500">
                    <Lock size={12} className="text-blue-500" />
                    <p className="text-xs font-bold tracking-widest uppercase">Encrypted At Rest</p>
                  </div>
                </DialogDescription>
              </div>
            </div>

            <button
              onClick={closeDialog}
              className="p-2 rounded-xl hover:bg-white/5 text-zinc-600 transition-colors"
              disabled={isUploading}
              aria-label="Close"
            >
              <X size={20} />
            </button>
          </div>

          <div className="relative rounded-[2rem] bg-white/[0.02] border border-white/5 p-2">
            <div
              {...getRootProps({
                className: cn(
                  'relative flex flex-col items-center justify-center p-8 w-full h-48 border-2 border-dashed border-white/10 rounded-[1.5rem] cursor-pointer transition-colors duration-200 ease-in-out',
                  isDragActive && 'border-blue-500 bg-blue-500/10'
                ),
              })}
            >
              <input {...getInputProps()} />
              {files.length === 0 && (
                <div className="text-center">
                  <UploadCloud className="mx-auto h-12 w-12 text-zinc-500" />
                  <p className="mt-2 text-sm font-bold text-zinc-300">
                    Drag and drop a file or click to select
                  </p>
                  <p className="mt-1 text-xs text-zinc-600">
                    PDF, JPG, PNG, GIF, WEBP up to {MAX_UPLOAD_SIZE_MB}MB
                  </p>
                </div>
              )}
              {files.length > 0 && !isUploading && (
                <div className="text-center">
                  <File className="mx-auto h-12 w-12 text-blue-500" />
                  <p className="mt-2 text-sm font-bold text-zinc-300 truncate max-w-full">
                    {files[0].name}
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">
                    {(files[0].size / 1024 / 1024).toFixed(2)} MB
                  </p>
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
                  <Button
                    variant="outline"
                    onClick={() => setFiles([])}
                    className="w-full h-12 bg-white/5 border-white/10 text-zinc-300 hover:bg-white/10 rounded-xl"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleUpload}
                    className="w-full h-12 bg-blue-600 hover:bg-blue-500 rounded-xl font-bold"
                  >
                    Upload File
                  </Button>
                </div>
              )}
            </div>
          )}

          <div className="mt-6 flex items-center justify-between px-2">
            <div className="flex items-center gap-2">
              <ShieldCheck size={14} className="text-blue-500" />
              <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">
                Max: {MAX_UPLOAD_SIZE_MB}MB
              </span>
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
