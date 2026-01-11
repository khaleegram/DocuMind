
'use client';

import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { auth } from '@/lib/firebase';
import { UploadDropzone } from '@uploadthing/react';
import type { OurFileRouter } from '@/app/api/uploadthing/core';
import '@uploadthing/react/styles.css';

type UploadDialogProps = {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
};

export function UploadDialog({ isOpen, setIsOpen }: UploadDialogProps) {
  const { toast } = useToast();
  const router = useRouter();

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Upload Document(s)</DialogTitle>
          <DialogDescription>
            Select document or image files. Processing will happen in the background.
          </DialogDescription>
        </DialogHeader>
        <UploadDropzone<OurFileRouter>
            endpoint="documentUploader"
            config={{
                mode: "auto",
                fetcher: {
                    // This is the key change to add the auth header
                    // @ts-ignore
                    getAuthorizationToken: async () => {
                        const user = auth.currentUser;
                        if (!user) return null;
                        return await user.getIdToken();
                    }
                }
            }}
            onClientUploadComplete={(res) => {
                if (res) {
                    toast({
                        title: "Upload(s) Complete!",
                        description: `Your file(s) are being processed and will appear shortly.`,
                    });
                    setIsOpen(false);
                    // Soft refresh the page to show the new "processing" document
                    router.refresh();
                }
            }}
            onUploadError={(error: Error) => {
                toast({
                    variant: 'destructive',
                    title: 'Upload Failed',
                    description: error.message,
                });
            }}
        />
      </DialogContent>
    </Dialog>
  );
}
