'use client';

import { useRouter } from 'next/navigation';
import { useState, useCallback, useMemo } from 'react';
import type { FirebaseError } from 'firebase/app';
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
import {
  ShieldCheck,
  CloudUpload,
  X,
  Lock,
  File,
  UploadCloud,
  Loader2,
  Files,
  Layers,
  Trash2,
} from 'lucide-react';
import { useDropzone, type FileRejection } from 'react-dropzone';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { v4 as uuidv4 } from 'uuid';
import {
  ALLOWED_UPLOAD_EXTENSIONS,
  ALLOWED_UPLOAD_MIME_TYPES,
  MAX_FILES_PER_UPLOAD,
  MAX_UPLOAD_BYTES,
  MAX_UPLOAD_SIZE_MB,
} from '@/lib/constants';
import { cn } from '@/lib/utils';

type UploadDialogProps = {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  onUploadComplete?: () => void;
};

type UploadMode = 'separate' | 'group';

type UploadedSourceFile = {
  fileName: string;
  fileUrl: string;
  mimeType: string;
  storagePath: string;
};

const PROCESSING_CONCURRENCY = 2;

const createUploadErrorMessage = (errorCode: string): string => {
  switch (errorCode) {
    case 'file-too-large':
      return `File exceeds ${MAX_UPLOAD_SIZE_MB}MB limit.`;
    case 'file-invalid-type':
      return `Unsupported file type. Allowed: ${ALLOWED_UPLOAD_EXTENSIONS.join(', ')}.`;
    case 'too-many-files':
      return `You can upload up to ${MAX_FILES_PER_UPLOAD} files at once.`;
    default:
      return 'Invalid file selection.';
  }
};

const createStorageUploadErrorMessage = (error: unknown): string => {
  const firebaseErrorCode = (error as FirebaseError | undefined)?.code;
  switch (firebaseErrorCode) {
    case 'storage/unauthorized':
      return 'You do not have permission to upload this file. Check Firebase Storage rules.';
    case 'storage/canceled':
      return 'Upload was canceled.';
    case 'storage/quota-exceeded':
      return 'Storage quota exceeded. Increase your Firebase Storage quota.';
    case 'storage/retry-limit-exceeded':
      return 'Upload timed out. Check your network and retry.';
    case 'storage/invalid-checksum':
      return 'Upload checksum mismatch. Please retry this file.';
    default:
      return 'Upload failed due to a network or storage error. Please try again.';
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

const uploadSingleFile = (
  file: File,
  userId: string,
  uploadMode: UploadMode,
  batchId: string,
  onProgress: (progress: number) => void
): Promise<UploadedSourceFile> =>
  new Promise((resolve, reject) => {
    const scopedPath =
      uploadMode === 'group'
        ? `documents/${userId}/groups/${batchId}/${uuidv4()}-${file.name}`
        : `documents/${userId}/${uuidv4()}-${file.name}`;

    const storageRef = ref(storage, scopedPath);
    const uploadTask = uploadBytesResumable(storageRef, file, { contentType: file.type });

    uploadTask.on(
      'state_changed',
      snapshot => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        onProgress(progress);
      },
      error => reject(error),
      async () => {
        try {
          const fileUrl = await getDownloadURL(uploadTask.snapshot.ref);
          resolve({
            fileName: file.name,
            fileUrl,
            mimeType: file.type,
            storagePath: scopedPath,
          });
        } catch (error) {
          reject(error);
        }
      }
    );
  });

const createInitialDocumentState = (params: {
  userId: string;
  uploadMode: UploadMode;
  sourceFiles: UploadedSourceFile[];
}): Record<string, unknown> => {
  const { userId, uploadMode, sourceFiles } = params;
  const primaryFile = sourceFiles[0];
  const isGrouped = uploadMode === 'group';
  const fileCount = sourceFiles.length;

  return {
    userId,
    displayName: isGrouped
      ? `Processing Group (${fileCount} files)...`
      : `Processing ${primaryFile.fileName}...`,
    documentType: 'Processing...',
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
    fileUrl: primaryFile.fileUrl,
    fileName: primaryFile.fileName,
    mimeType: primaryFile.mimeType,
    storagePath: primaryFile.storagePath,
    uploadMode: isGrouped ? 'group' : 'single',
    fileCount,
    sourceFiles,
    uploadedAt: new Date(),
  };
};

export function UploadDialog({ isOpen, setIsOpen, onUploadComplete }: UploadDialogProps) {
  const { toast } = useToast();
  const router = useRouter();
  const [files, setFiles] = useState<File[]>([]);
  const [uploadMode, setUploadMode] = useState<UploadMode>('separate');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState('');

  const filesSummary = useMemo(() => {
    const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
    return {
      count: files.length,
      totalSizeMb: (totalBytes / 1024 / 1024).toFixed(2),
    };
  }, [files]);

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
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
    },
    maxFiles: MAX_FILES_PER_UPLOAD,
    maxSize: MAX_UPLOAD_BYTES,
    multiple: true,
  });

  const closeDialog = () => {
    if (isUploading) return;
    setFiles([]);
    setUploadProgress(0);
    setUploadStatus('');
    setUploadMode('separate');
    setIsOpen(false);
  };

  const removeFile = (indexToRemove: number) => {
    if (isUploading) return;
    setFiles(prev => prev.filter((_, index) => index !== indexToRemove));
  };

  const handleUpload = async () => {
    if (files.length === 0 || isUploading) return;

    const user = auth.currentUser;
    if (!user) {
      toast({
        variant: 'destructive',
        title: 'AUTH_ERROR',
        description: 'You must be logged in to upload files.',
      });
      return;
    }

    const invalidTypeFile = files.find(
      file =>
        !ALLOWED_UPLOAD_MIME_TYPES.includes(
          file.type as (typeof ALLOWED_UPLOAD_MIME_TYPES)[number]
        )
    );
    if (invalidTypeFile) {
      toast({
        variant: 'destructive',
        title: 'UNSUPPORTED_FILE',
        description: `${invalidTypeFile.name} is not allowed. Allowed: ${ALLOWED_UPLOAD_EXTENSIONS.join(', ')}.`,
      });
      return;
    }

    const oversizedFile = files.find(file => file.size > MAX_UPLOAD_BYTES);
    if (oversizedFile) {
      toast({
        variant: 'destructive',
        title: 'FILE_TOO_LARGE',
        description: `${oversizedFile.name} exceeds ${MAX_UPLOAD_SIZE_MB}MB.`,
      });
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    setUploadStatus(`Uploading 1/${files.length}...`);

    try {
      const idToken = await user.getIdToken();
      const batchId = uuidv4();
      const uploadedFiles: UploadedSourceFile[] = [];

      for (let index = 0; index < files.length; index += 1) {
        const file = files[index];
        setUploadStatus(`Uploading ${index + 1}/${files.length}: ${file.name}`);

        const uploadedFile = await uploadSingleFile(file, user.uid, uploadMode, batchId, progress => {
          const overallProgress = ((index + progress / 100) / files.length) * 100;
          setUploadProgress(overallProgress);
        });
        uploadedFiles.push(uploadedFile);
      }

      const createdDocIds: string[] = [];

      if (uploadMode === 'group') {
        const groupedDoc = createInitialDocumentState({
          userId: user.uid,
          uploadMode,
          sourceFiles: uploadedFiles,
        });
        const docRef = await addDoc(collection(db, 'documents'), groupedDoc);
        createdDocIds.push(docRef.id);
      } else {
        for (const uploadedFile of uploadedFiles) {
          const singleDoc = createInitialDocumentState({
            userId: user.uid,
            uploadMode: 'separate',
            sourceFiles: [uploadedFile],
          });
          const docRef = await addDoc(collection(db, 'documents'), singleDoc);
          createdDocIds.push(docRef.id);
        }
      }

      toast({
        title: 'UPLOAD_COMPLETE',
        description:
          uploadMode === 'group'
            ? `${uploadedFiles.length} file(s) uploaded as one grouped document.`
            : `${uploadedFiles.length} file(s) uploaded as separate documents.`,
        className: 'bg-black border-blue-500/50 text-white rounded-2xl',
      });

      toast({
        title: 'PROCESSING_STARTED',
        description: 'AI processing is running in the background. You can keep using the app.',
      });

      const processInBackground = async () => {
        let processingFailures = 0;
        const queue = [...createdDocIds];

        const worker = async () => {
          while (queue.length > 0) {
            const nextDocId = queue.shift();
            if (!nextDocId) return;
            try {
              await triggerDocumentProcessing(nextDocId, idToken);
            } catch {
              processingFailures += 1;
            }
          }
        };

        const workerCount = Math.min(PROCESSING_CONCURRENCY, queue.length || 1);
        await Promise.all(Array.from({ length: workerCount }, () => worker()));

        if (processingFailures > 0) {
          toast({
            variant: 'destructive',
            title: 'PROCESSING_PARTIAL_FAILURE',
            description: `${processingFailures} document(s) failed to process. Please retry those files.`,
          });
        }

        router.refresh();
      };
      void processInBackground();

      setIsOpen(false);
      setFiles([]);
      setUploadStatus('');
      setUploadProgress(0);
      setUploadMode('separate');
      onUploadComplete?.();
      router.refresh();
    } catch (error) {
      console.error('Upload failed:', error);
      toast({
        variant: 'destructive',
        title: 'TRANSFER_ERROR',
        description: createStorageUploadErrorMessage(error),
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={open => (open ? setIsOpen(true) : closeDialog())}>
      <DialogContent className="w-[calc(100vw-1rem)] max-w-[560px] max-h-[92dvh] bg-[#050505] border-white/10 p-0 rounded-[2rem] sm:rounded-[2.5rem] overflow-hidden shadow-[0_0_80px_rgba(0,0,0,0.9)] outline-none ring-0 flex flex-col">
        <div className="h-1.5 w-full bg-gradient-to-r from-blue-600 via-indigo-500 to-blue-600" />

        <div className="relative flex-1 overflow-y-auto overscroll-contain p-5 sm:p-8">
          <div className="flex items-start justify-between mb-6 sm:mb-8">
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
              aria-label="Close upload dialog"
            >
              <X size={20} />
            </button>
          </div>

          <div className="mb-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setUploadMode('separate')}
              disabled={isUploading}
              aria-pressed={uploadMode === 'separate'}
              className={cn(
                'h-11 rounded-xl border text-sm font-bold transition-colors',
                uploadMode === 'separate'
                  ? 'bg-blue-600/20 border-blue-500/40 text-blue-300'
                  : 'bg-white/5 border-white/10 text-zinc-300 hover:bg-white/10'
              )}
            >
              <span className="inline-flex items-center gap-2">
                <Files className="h-4 w-4" />
                Save Separately
              </span>
            </button>
            <button
              type="button"
              onClick={() => setUploadMode('group')}
              disabled={isUploading}
              aria-pressed={uploadMode === 'group'}
              className={cn(
                'h-11 rounded-xl border text-sm font-bold transition-colors',
                uploadMode === 'group'
                  ? 'bg-blue-600/20 border-blue-500/40 text-blue-300'
                  : 'bg-white/5 border-white/10 text-zinc-300 hover:bg-white/10'
              )}
            >
              <span className="inline-flex items-center gap-2">
                <Layers className="h-4 w-4" />
                Group as One
              </span>
            </button>
          </div>

          <p className="mb-4 text-xs text-zinc-500">
            {uploadMode === 'group'
              ? 'All selected files will be saved as one grouped document.'
              : 'Each selected file will be saved as its own document.'}
          </p>

          <div className="relative rounded-[2rem] bg-white/[0.02] border border-white/5 p-2">
            <div
              {...getRootProps({
                className: cn(
                  'relative flex flex-col items-center justify-center p-6 sm:p-8 w-full h-44 sm:h-52 border-2 border-dashed border-white/10 rounded-[1.5rem] cursor-pointer transition-colors duration-200 ease-in-out',
                  isDragActive && 'border-blue-500 bg-blue-500/10'
                ),
              })}
            >
              <input {...getInputProps()} />
              {files.length === 0 && (
                <div className="text-center">
                  <UploadCloud className="mx-auto h-12 w-12 text-zinc-500" />
                  <p className="mt-2 text-sm font-bold text-zinc-300">
                    Drag and drop files or click to select
                  </p>
                  <p className="mt-1 text-xs text-zinc-600">
                    Up to {MAX_FILES_PER_UPLOAD} files, each max {MAX_UPLOAD_SIZE_MB}MB
                  </p>
                </div>
              )}
              {files.length > 0 && !isUploading && (
                <div className="text-center">
                  <File className="mx-auto h-12 w-12 text-blue-500" />
                  <p className="mt-2 text-sm font-bold text-zinc-300">
                    {filesSummary.count} file(s) selected
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">{filesSummary.totalSizeMb} MB total</p>
                </div>
              )}
              {isUploading && (
                <div className="w-full text-center">
                  <Loader2 className="mx-auto h-12 w-12 text-blue-500 animate-spin" />
                  <p className="mt-2 text-sm font-bold text-zinc-300">{uploadStatus || 'Uploading...'}</p>
                </div>
              )}
            </div>
          </div>

          {files.length > 0 && (
            <div className="mt-4 rounded-xl border border-white/10 bg-[#0C0C0E] p-3">
              <p className="mb-2 text-xs font-bold uppercase tracking-widest text-zinc-500">
                Selected Files
              </p>
              <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
                {files.map((file, index) => (
                  <div
                    key={`${file.name}-${index}`}
                    className="flex items-center justify-between gap-3 rounded-lg bg-white/[0.03] px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm text-zinc-300">{file.name}</p>
                      <p className="text-xs text-zinc-500">
                        {(file.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      disabled={isUploading}
                      onClick={() => removeFile(index)}
                      className="h-8 w-8 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg shrink-0"
                      aria-label={`Remove ${file.name}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {isUploading && (
            <div className="mt-4">
              <Progress value={uploadProgress} className="h-2 bg-white/10" />
            </div>
          )}

          {files.length > 0 && !isUploading && (
            <div className="mt-4 flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setFiles([])}
                className="w-full h-12 bg-white/5 border-white/10 text-zinc-300 hover:bg-white/10 rounded-xl"
              >
                Clear Selection
              </Button>
              <Button
                type="button"
                onClick={handleUpload}
                className="w-full h-12 bg-blue-600 hover:bg-blue-500 rounded-xl font-bold"
              >
                {uploadMode === 'group' ? 'Upload as Group' : 'Upload Files'}
              </Button>
            </div>
          )}

          <div className="mt-6 flex items-center justify-between px-2">
            <div className="flex items-center gap-2">
              <ShieldCheck size={14} className="text-blue-500" />
              <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest">
                Max: {MAX_UPLOAD_SIZE_MB}MB each
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
