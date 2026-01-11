
'use server';

import { createUploadthing, type FileRouter } from 'uploadthing/next';
import { UploadThingError } from 'uploadthing/server';
import admin from '@/lib/firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import { enhanceSearchWithKeywords } from '@/ai/flows/enhance-search-with-keywords';
import { extractDocumentMetadata } from '@/ai/flows/extract-document-metadata';
import { extractTextFromImage } from '@/ai/flows/extract-text-from-image';
import type { NextRequest } from 'next/server';

const db = getFirestore(admin.apps[0]!);
const f = createUploadthing();

const handleAuth = async ({ req }: { req: NextRequest }) => {
    const authHeader = req.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw new UploadThingError("Unauthorized: No token provided");
    }
    const token = authHeader.split('Bearer ')[1];

    try {
        const decodedToken = await admin.auth().verifyIdToken(token);
        return { userId: decodedToken.uid };
    } catch (error) {
        console.error("Firebase Auth Error", error);
        throw new UploadThingError("Unauthorized: Invalid token");
    }
}


export const ourFileRouter = {
  documentUploader: f({ 
    pdf: { maxFileSize: "16MB" },
    image: { maxFileSize: "4MB" } 
  })
    .middleware(handleAuth)
    .onUploadComplete(async ({ metadata, file }) => {
      console.log('Upload complete for userId:', metadata.userId);
      console.log('file url', file.url);
      console.log('file key', file.key);

      // Create a temporary document to show the user it's processing
      const docRef = db.collection('documents').doc();
      await docRef.set({
        userId: metadata.userId,
        fileName: file.name,
        fileUrl: file.url,
        storagePath: file.key,
        mimeType: file.type,
        uploadedAt: new Date(),
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

      // AI processing in the background - don't await this on the server
      processFileInBackground(docRef.id, file.url, file.type);

      return { uploadedBy: metadata.userId };
    }),
} satisfies FileRouter;


async function processFileInBackground(docId: string, fileUrl: string, mimeType: string) {
    try {
        const response = await fetch(fileUrl);
        const blob = await response.blob();
        const buffer = Buffer.from(await blob.arrayBuffer());
        const dataUrl = `data:${mimeType};base64,${buffer.toString('base64')}`;
        
        // Run AI extractions in parallel
        const [metadataResult, textResult] = await Promise.all([
            extractDocumentMetadata({ documentDataUrl: dataUrl }),
            extractTextFromImage({ documentDataUrl: dataUrl }),
        ]);

        const { text } = textResult;
        
        // Generate keywords based on extracted text
        const { keywords } = await enhanceSearchWithKeywords({ documentText: text });

        // Update the document in Firestore with the extracted data
        await db.collection('documents').doc(docId).update({
            ...metadataResult,
            keywords,
            textContent: text,
            isProcessing: false,
        });

        console.log(`Successfully processed and updated document ${docId}`);

    } catch (aiError: any) {
        console.error(`AI processing failed for document ${docId}:`, aiError);
        // Update the document to reflect the error state
        await db.collection('documents').doc(docId).update({
            isProcessing: false,
            type: 'Processing Failed',
            summary: `Error: ${aiError.message || 'Could not analyze the document.'}`,
        });
    }
}


export type OurFileRouter = typeof ourFileRouter;
