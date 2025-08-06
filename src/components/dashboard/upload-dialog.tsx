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
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import type { Document } from '@/lib/types';
import { Loader2 } from 'lucide-react';
import { extractDocumentMetadata } from '@/ai/flows/extract-document-metadata';

const uploadSchema = z.object({
  file: z.instanceof(FileList).refine(files => files?.length === 1, 'File is required.'),
  documentText: z.string().min(1, 'Document text cannot be empty.').min(10, 'Document text must be at least 10 characters.'),
});

type UploadDialogProps = {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  onDocumentAdd: (newDocData: Omit<Document, 'id' | 'fileId' | 'uploadedAt' | 'fileUrl'>) => void;
};

export function UploadDialog({ isOpen, setIsOpen, onDocumentAdd }: UploadDialogProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();
  const form = useForm<z.infer<typeof uploadSchema>>({
    resolver: zodResolver(uploadSchema),
    defaultValues: {
      documentText: "",
    }
  });

  const onSubmit = async (values: z.infer<typeof uploadSchema>) => {
    setIsProcessing(true);
    try {
      // In a real app, you'd upload the file to a service like Google Drive,
      // then use an OCR service like Google Vision API on the backend to get the text.
      // Here, we simulate the AI processing step with the provided text.
      const metadata = await extractDocumentMetadata({ documentText: values.documentText });

      onDocumentAdd({
        owner: metadata.owner,
        company: metadata.documentType === 'Contract' || metadata.documentType === 'Receipt' ? metadata.owner : undefined,
        type: metadata.documentType,
        expiry: metadata.expiryDate,
        keywords: metadata.keywords,
      });

      toast({
        title: 'Document Processed!',
        description: `Successfully added "${metadata.documentType}" for ${metadata.owner}.`,
      });
      form.reset();
      setIsOpen(false);
    } catch (error) {
      console.error('Failed to process document:', error);
      toast({
        variant: 'destructive',
        title: 'Processing Failed',
        description: 'Could not extract metadata from the document text.',
      });
    } finally {
      setIsProcessing(false);
    }
  };
  
  const fileRef = form.register("file");

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Upload Document</DialogTitle>
          <DialogDescription>
            Select a file and provide its text content for AI processing.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="file"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Document File</FormLabel>
                  <FormControl>
                    <Input type="file" accept="application/pdf,image/*" {...fileRef} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="documentText"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Document Text (Simulated OCR)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Paste the text from your document here..."
                      className="resize-y min-h-[150px]"
                      {...field}
                    />
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
                {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Process Document
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
