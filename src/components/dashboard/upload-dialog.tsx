'use client';

import { useState } from 'react';
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
import { OurFileRouter } from '@/app/api/uploadthing/core';
import '@uploadthing/react/styles.css';

type UploadDialogProps = {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
};

export function UploadDialog({ isOpen, setIsOpen }: UploadDialogProps) {
  const { toast } = useToast();

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Upload Document(s)</DialogTitle>
          <DialogDescription>
            Select one or more document files to upload. Processing will happen in the background.
          </DialogDescription>
        </DialogHeader>
        <UploadDropzone<OurFileRouter>
            endpoint="documentUploader"
            config={{
                appendOnPaste: true,
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
                // Do something with the response
                console.log("Files: ", res);
                toast({
                    title: "Upload(s) Started!",
                    description: `Your file(s) are being processed in the background.`,
                });
                setIsOpen(false);
            }}
            onUploadError={(error: Error) => {
                // Do something with the error.
                toast({
                    variant: 'destructive',
                    title: 'Upload Failed',
                    description: error.message,
                });
            }}
            onUploadBegin={(name) => {
                // Do something once upload begins
                console.log("Beginning upload of: ", name);
            }}
        />
      </DialogContent>
    </Dialog>
  );
}
