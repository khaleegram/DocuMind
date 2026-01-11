
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
const f = createUploadthing({
    errorFormatter: (err) => {
      console.log("Error uploading file", err.message);
      return { message: err.message };
    },
});

const handleAuth = async ({ req }: { req: Request }) => {
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
    .middleware(async ({ req }) => {
        return handleAuth({ req });
    })
    .onUploadComplete(async ({ metadata, file }) => {
      console.log('Upload complete for userId:', metadata.userId);
      
      const docRef = db.collection('documents').doc();
      
      // Don't block the response. The client will get this and know to wait.
      const initialState = {
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
      };

      await docRef.set(initialState);
      
      // Start AI processing in the background, but don't await it here.
      processFileInBackground(docRef.id, file);

      // Return the initial data to the client immediately
      return { 
          docId: docRef.id 
      };
    }),
} satisfies FileRouter;


async function processFileInBackground(docId: string, file: { url: string, type: string }) {
    try {
        const response = await fetch(file.url);
        const blob = await response.blob();
        const buffer = Buffer.from(await blob.arrayBuffer());
        const dataUrl = `data:${file.type};base64,${buffer.toString('base64')}`;
        
        // Run AI extractions in parallel
        const [metadataResult, textResult] = await Promise.all([
            extractDocumentMetadata({ documentDataUrl: dataUrl }),
            extractTextFromImage({ documentDataUrl: dataUrl }),
        ]);

        const { text } = textResult;
        
        // Run keyword enhancement after text is extracted
        const { keywords } = await enhanceSearchWithKeywords({ documentText: text });

        // Update the document with all the extracted metadata
        await db.collection('documents').doc(docId).update({
            ...metadataResult,
            keywords,
            textContent: text,
            isProcessing: false, // Mark processing as complete
        });

        console.log(`Successfully processed and updated document ${docId}`);

    } catch (aiError: any) {
        console.error(`AI processing failed for document ${docId}:`, aiError);
        await db.collection('documents').doc(docId).update({
            isProcessing: false,
            type: 'Processing Failed',
            owner: 'Processing Failed',
            summary: `Error: ${aiError.message || 'Could not analyze the document.'}`,
        });
    }
}


export type OurFileRouter = typeof ourFileRouter;
