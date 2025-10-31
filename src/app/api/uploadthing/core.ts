
'use server';

import { createUploadthing, type FileRouter } from 'uploadthing/next';
import { UploadThingError } from 'uploadthing/server';
import { getApps, initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { enhanceSearchWithKeywords } from '@/ai/flows/enhance-search-with-keywords';
import { extractDocumentMetadata } from '@/ai/flows/extract-document-metadata';
import { extractTextFromImage } from '@/ai/flows/extract-text-from-image';
import type { NextRequest } from 'next/server';

// Initialize Firebase Admin SDK
if (!getApps().length) {
  try {
    const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    if (!serviceAccount) throw new Error('Firebase service account key is not set.');
    initializeApp({
      credential: cert(JSON.parse(serviceAccount))
    });
  } catch (e) {
    console.error("Firebase Admin initialization error", e);
  }
}

const auth = getAuth();
const db = getFirestore();

const f = createUploadthing();

const handleAuth = async ({ req }: { req: NextRequest }) => {
    const authHeader = req.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw new UploadThingError("Unauthorized: No token provided");
    }
    const token = authHeader.split('Bearer ')[1];

    try {
        const decodedToken = await auth.verifyIdToken(token);
        return { userId: decodedToken.uid };
    } catch (error) {
        console.error("Firebase Auth Error", error);
        throw new UploadThingError("Unauthorized: Invalid token");
    }
}


const processFileInBackground = async ({ fileUrl, fileKey, fileName, userId, mimeType }: { fileUrl: string; fileKey: string; fileName: string; userId: string, mimeType: string }) => {
  const docRef = await db.collection('documents').add({
    userId,
    fileName,
    fileUrl,
    storagePath: fileKey,
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
    const response = await fetch(fileUrl);
    const blob = await response.blob();
    
    const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        // This is a browser API, but it's polyfilled in recent Node/serverless environments.
        // For server-side, Buffer is more common. Let's adapt if needed, but this is a common pattern.
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

    const [metadata, { text }] = await Promise.all([
        extractDocumentMetadata({ documentDataUrl: dataUrl }),
        extractTextFromImage({ documentDataUrl: dataUrl }),
    ]);
    
    const { keywords } = await enhanceSearchWithKeywords({ documentText: text });

    await docRef.update({
      ...metadata,
      keywords,
      textContent: text,
      isProcessing: false,
    });

  } catch (aiError) {
    console.error(`Failed to process ${fileName} with AI:`, aiError);
    await docRef.update({
      owner: fileName,
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
    .middleware(handleAuth)
    .onUploadComplete(async ({ metadata, file }) => {
      console.log('Upload complete for userId:', metadata.userId);
      console.log('file url', file.url);
      
      processFileInBackground({
        fileUrl: file.url,
        fileKey: file.key,
        fileName: file.name,
        userId: metadata.userId,
        mimeType: file.type,
      }).catch(err => {
        console.error("Error in background file processing:", err);
      });
      
      return { uploadedBy: metadata.userId };
    }),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;
