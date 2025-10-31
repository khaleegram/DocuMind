
'use server';

import { createUploadthing, type FileRouter } from 'uploadthing/next';
import { UploadThingError } from 'uploadthing/server';
import * as admin from 'firebase-admin';
import { enhanceSearchWithKeywords } from '@/ai/flows/enhance-search-with-keywords';
import { extractDocumentMetadata } from '@/ai/flows/extract-document-metadata';
import { extractTextFromImage } from '@/ai/flows/extract-text-from-image';

// Initialize Firebase Admin SDK directly in the API route
const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY
  ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)
  : undefined;

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const auth = admin.auth();
const db = admin.firestore();


const f = createUploadthing();

// Helper function to get user from bearer token
const getUser = async (authHeader: string | null) => {
  if (!authHeader) return null;
  const token = authHeader.split('Bearer ')[1];
  if (!token) return null;
  try {
    const decodedToken = await auth.verifyIdToken(token);
    return decodedToken;
  } catch (error) {
    console.error('Error verifying auth token:', error);
    return null;
  }
};

const processFileInBackground = async ({ fileUrl, fileKey, fileName, userId, mimeType }: { fileUrl: string; fileKey: string; fileName: string; userId: string, mimeType: string }) => {
  // 1. Create a placeholder document in Firestore
  const docRef = await db.collection('documents').add({
    userId,
    fileName,
    fileUrl,
    storagePath: fileKey, // Use fileKey as the storage path identifier for UploadThing
    mimeType,
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

  try {
    // 2. Fetch the file and convert to data URI for AI processing
    const response = await fetch(fileUrl);
    const blob = await response.blob();
    const reader = new FileReader();
    
    // Convert blob to Base64 data URI
    const dataUrl = await new Promise<string>((resolve, reject) => {
      // FileReader is a browser API, but we can polyfill it or use buffers on the server.
      // For this server-side context, we'll use a Buffer approach.
      const chunks: Buffer[] = [];
      const stream = blob.stream();
      const blobReader = stream.getReader();

      blobReader.read().then(function process({ done, value }) {
        if (done) {
          const buffer = Buffer.concat(chunks);
          resolve(`data:${mimeType};base64,${buffer.toString('base64')}`);
          return;
        }
        chunks.push(Buffer.from(value));
        blobReader.read().then(process).catch(reject);
      }).catch(reject);
    });

    // 3. Run AI processing flows
    const metadata = await extractDocumentMetadata({ documentDataUrl: dataUrl });
    const { text } = await extractTextFromImage({ documentDataUrl: dataUrl });
    const { keywords } = await enhanceSearchWithKeywords({ documentText: text });

    // 4. Update Firestore document with extracted data
    await docRef.update({
      ...metadata,
      keywords,
      textContent: text,
      isProcessing: false,
    });

  } catch (aiError) {
    console.error(`Failed to process ${fileName} with AI:`, aiError);
    // Update the document to reflect the processing failure
    await docRef.update({
      owner: fileName, // Use filename as a fallback owner
      type: 'Processing Failed',
      summary: 'Could not analyze this document.',
      isProcessing: false,
    });
  }
};


export const ourFileRouter = {
  documentUploader: f({
    image: { maxFileSize: '4MB', maxFileCount: 5 },
    pdf: { maxFileSize: '4MB', maxFileCount: 5 },
  })
    .middleware(async ({ req }) => {
      const user = await getUser(req.headers.get('authorization'));

      if (!user) throw new UploadThingError('Unauthorized');

      return { userId: user.uid };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      // This code RUNS ON YOUR SERVER after upload
      console.log('Upload complete for userId:', metadata.userId);
      console.log('file url', file.url);
      
      // We trigger the background processing but don't wait for it to finish
      // to make the client-side upload feel faster.
      processFileInBackground({
        fileUrl: file.url,
        fileKey: file.key,
        fileName: file.name,
        userId: metadata.userId,
        mimeType: file.type,
      }).catch(err => {
        // We should have robust logging here in a real app
        console.error("Error in background file processing:", err);
      });
      
      // This is returned to the client.
      return { uploadedBy: metadata.userId };
    }),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;
