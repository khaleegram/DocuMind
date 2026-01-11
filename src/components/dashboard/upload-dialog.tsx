
'use client';

import { useState } from 'react';
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
                fetch: async (url, { body, headers }) => {
                    const user = auth.currentUser;
                    if (!user) {
                        throw new Error("You must be logged in to upload files.");
                    }
                    const token = await user.getIdToken();
                    return fetch(url, {
                        body,
                        headers: {
                            ...headers,
                            Authorization: `Bearer ${token}`,
                        }
                    })
                }
            }}
            onClientUploadComplete={(res) => {
                if (res) {
                    toast({
                        title: "Upload(s) Started!",
                        description: `Your file(s) are being processed. The list will update shortly.`,
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
