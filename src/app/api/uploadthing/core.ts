
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

const authAdmin = getAuth();
const db = getFirestore();

const f = createUploadthing();

const handleAuth = async ({ req }: { req: NextRequest }) => {
    const authHeader = req.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw new UploadThingError("Unauthorized: No token provided");
    }
    const token = authHeader.split('Bearer ')[1];

    try {
        const decodedToken = await authAdmin.verifyIdToken(token);
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
    
    // Convert blob to a data URL
    const reader = new (await import('buffer')).Blob(
      [await blob.arrayBuffer()]
    ).stream().getReader();
    const chunks: Uint8Array[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
    const buffer = Buffer.concat(chunks);
    const dataUrl = `data:${mimeType};base64,${buffer.toString('base64')}`;

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

  } catch (aiError) -
