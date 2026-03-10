import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { initializeApp, cert, applicationDefault, getApps, getApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getStorage, getDownloadURL } from 'firebase-admin/storage';
import sharp from 'sharp';

const THUMBNAIL_WIDTH = 640;
const THUMBNAIL_HEIGHT = 480;
const ALLOWED_THUMBNAIL_MIME_TYPES = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/gif', 'image/webp']);
const PDF_THUMBNAIL_BACKGROUND = '#1f2937';
const PDF_THUMBNAIL_BORDER = '#334155';
const PDF_THUMBNAIL_ACCENT = '#ef4444';

const args = process.argv.slice(2);
const hasFlag = flag => args.includes(flag);
const getArgValue = key => {
  const found = args.find(item => item.startsWith(`${key}=`));
  if (!found) return null;
  return found.slice(key.length + 1);
};

const dryRun = hasFlag('--dry-run');
const force = hasFlag('--force');
const userFilter = getArgValue('--user');
const limitArg = getArgValue('--limit');
const limit = limitArg ? Number.parseInt(limitArg, 10) : Number.POSITIVE_INFINITY;
if (limitArg !== null && (!Number.isFinite(limit) || limit <= 0)) {
  throw new Error('Invalid --limit value. Use a positive integer.');
}

const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const storageBucket = process.env.FIREBASE_STORAGE_BUCKET || process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

if (!storageBucket) {
  throw new Error('Missing FIREBASE_STORAGE_BUCKET or NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET in env.');
}

const app =
  getApps().length > 0
    ? getApp()
    : initializeApp({
        credential:
          projectId && clientEmail && privateKey
            ? cert({
                projectId,
                clientEmail,
                privateKey,
              })
            : applicationDefault(),
        projectId,
        storageBucket,
      });

const db = getFirestore(app);
const storage = getStorage(app);
const bucket = storage.bucket();

const buildFallbackDownloadUrl = (bucketName, objectPath, token) =>
  `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(
    objectPath
  )}?alt=media&token=${token}`;

const escapeXml = input =>
  input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

const truncateText = (input, maxLength) =>
  input.length > maxLength ? `${input.slice(0, Math.max(0, maxLength - 1))}\u2026` : input;

const createPdfPlaceholderThumbnail = async fileName => {
  const safeName = truncateText(fileName || 'PDF Document', 48);
  const svg = `
    <svg width="${THUMBNAIL_WIDTH}" height="${THUMBNAIL_HEIGHT}" viewBox="0 0 ${THUMBNAIL_WIDTH} ${THUMBNAIL_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${THUMBNAIL_WIDTH}" height="${THUMBNAIL_HEIGHT}" fill="${PDF_THUMBNAIL_BACKGROUND}" />
      <rect x="16" y="16" width="${THUMBNAIL_WIDTH - 32}" height="${THUMBNAIL_HEIGHT - 32}" rx="18" fill="none" stroke="${PDF_THUMBNAIL_BORDER}" stroke-width="2" />
      <rect x="32" y="36" width="96" height="40" rx="10" fill="${PDF_THUMBNAIL_ACCENT}" />
      <text x="80" y="62" text-anchor="middle" font-size="20" font-family="Arial, sans-serif" font-weight="700" fill="#ffffff">PDF</text>
      <text x="32" y="130" font-size="22" font-family="Arial, sans-serif" font-weight="700" fill="#f8fafc">${escapeXml(safeName)}</text>
      <text x="32" y="168" font-size="16" font-family="Arial, sans-serif" fill="#94a3b8">Preview generated placeholder</text>
    </svg>
  `;

  return await sharp(Buffer.from(svg)).webp({ quality: 84 }).toBuffer();
};

const isSkippableByThumbnail = (docData, forceMode) => {
  if (forceMode) return false;
  return typeof docData.thumbnailUrl === 'string' && docData.thumbnailUrl.trim().length > 0;
};

const pickPrimarySourceFile = docData => {
  if (Array.isArray(docData.sourceFiles) && docData.sourceFiles.length > 0) {
    const firstValid = docData.sourceFiles.find(
      entry =>
        entry &&
        typeof entry === 'object' &&
        typeof entry.storagePath === 'string' &&
        entry.storagePath.trim().length > 0 &&
        typeof entry.mimeType === 'string' &&
        entry.mimeType.trim().length > 0
    );

    if (firstValid) {
      return {
        storagePath: firstValid.storagePath,
        mimeType: firstValid.mimeType,
      };
    }
  }

  if (
    typeof docData.storagePath === 'string' &&
    docData.storagePath.trim().length > 0 &&
    typeof docData.mimeType === 'string' &&
    docData.mimeType.trim().length > 0
  ) {
    return {
      storagePath: docData.storagePath,
      mimeType: docData.mimeType,
    };
  }

  return null;
};

const createThumbnailBuffer = async (fileBuffer, mimeType) => {
  const isPdf = mimeType === 'application/pdf';
  const isImage = mimeType.startsWith('image/');
  const canDecodePdf = Boolean(sharp.format.pdf?.input?.buffer);

  if (!isPdf && !isImage) return null;

  if (isPdf && !canDecodePdf) {
    return createPdfPlaceholderThumbnail('PDF Document');
  }

  try {
    const pipeline = isPdf
      ? sharp(fileBuffer, { density: 192, page: 0 })
      : sharp(fileBuffer).rotate();

    return await pipeline
      .resize({
        width: THUMBNAIL_WIDTH,
        height: THUMBNAIL_HEIGHT,
        fit: 'cover',
        position: 'center',
        withoutEnlargement: true,
      })
      .webp({ quality: 78 })
      .toBuffer();
  } catch {
    if (isPdf) {
      return createPdfPlaceholderThumbnail('PDF Document');
    }
    return null;
  }
};

const docsSnapshot = await db.collection('documents').get();
let docs = docsSnapshot.docs;
if (userFilter) {
  docs = docs.filter(doc => (doc.data()?.userId ?? '') === userFilter);
}

console.log(`Found ${docs.length} documents${userFilter ? ` for user ${userFilter}` : ''}.`);
console.log(
  `Mode: ${dryRun ? 'DRY RUN' : 'WRITE'}${force ? ' | FORCE REGENERATE' : ' | ONLY MISSING'}${
    Number.isFinite(limit) ? ` | LIMIT ${limit}` : ''
  }`
);

let processed = 0;
let updated = 0;
let skipped = 0;
let failed = 0;

for (const docSnap of docs) {
  if (processed >= limit) break;
  processed += 1;

  const docData = docSnap.data() ?? {};

  try {
    if (docData.isProcessing === true) {
      skipped += 1;
      continue;
    }

    if (isSkippableByThumbnail(docData, force)) {
      skipped += 1;
      continue;
    }

    const source = pickPrimarySourceFile(docData);
    if (!source) {
      skipped += 1;
      continue;
    }

    const fileHandle = bucket.file(source.storagePath);
    const [metadata] = await fileHandle.getMetadata();
    const mimeType = (metadata.contentType || source.mimeType || '').trim();
    if (!ALLOWED_THUMBNAIL_MIME_TYPES.has(mimeType)) {
      skipped += 1;
      continue;
    }

    const [fileBuffer] = await fileHandle.download();
    const fileNameHint =
      (Array.isArray(docData.sourceFiles) &&
        docData.sourceFiles[0] &&
        typeof docData.sourceFiles[0].fileName === 'string' &&
        docData.sourceFiles[0].fileName) ||
      (typeof docData.fileName === 'string' ? docData.fileName : 'PDF Document');
    const thumbnailBuffer =
      mimeType === 'application/pdf'
        ? await createPdfPlaceholderThumbnail(fileNameHint)
        : await createThumbnailBuffer(fileBuffer, mimeType);
    if (!thumbnailBuffer) {
      skipped += 1;
      continue;
    }

    const userId = typeof docData.userId === 'string' && docData.userId.trim().length > 0 ? docData.userId : 'unknown';
    const thumbnailPath = `documents/${userId}/thumbnails/${docSnap.id}-${Date.now()}-${randomUUID()}.webp`;
    const token = randomUUID();
    const thumbnailFile = bucket.file(thumbnailPath);

    if (!dryRun) {
      await thumbnailFile.save(thumbnailBuffer, {
        resumable: false,
        metadata: {
          contentType: 'image/webp',
          cacheControl: 'public,max-age=31536000,immutable',
          metadata: {
            firebaseStorageDownloadTokens: token,
          },
        },
      });

      let thumbnailUrl;
      try {
        thumbnailUrl = await getDownloadURL(thumbnailFile);
      } catch {
        thumbnailUrl = buildFallbackDownloadUrl(bucket.name, thumbnailPath, token);
      }

      await docSnap.ref.set(
        {
          thumbnailUrl,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    }

    updated += 1;
    console.log(`[${dryRun ? 'DRY' : 'OK'}] ${docSnap.id}`);
  } catch (error) {
    failed += 1;
    console.error(
      `[ERROR] ${docSnap.id}:`,
      error instanceof Error ? error.message : 'Unknown error'
    );
  }
}

console.log('\nBackfill complete');
console.log(`Processed: ${processed}`);
console.log(`Updated: ${updated}`);
console.log(`Skipped: ${skipped}`);
console.log(`Failed: ${failed}`);
