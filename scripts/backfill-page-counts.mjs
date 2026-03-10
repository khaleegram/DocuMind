import 'dotenv/config';
import { inflateRawSync } from 'node:zlib';
import { initializeApp, cert, applicationDefault, getApps, getApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

const SUPPORTED_MIME_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
]);

const ZIP_EOCD_SIGNATURE = 0x06054b50;
const ZIP_CENTRAL_DIRECTORY_SIGNATURE = 0x02014b50;
const ZIP_LOCAL_FILE_HEADER_SIGNATURE = 0x04034b50;
const ZIP_MAX_COMMENT_BYTES = 0xffff;

const args = process.argv.slice(2);
const hasFlag = flag => args.includes(flag);
const getArgValue = key => {
  const withEquals = args.find(item => item.startsWith(`${key}=`));
  if (withEquals) return withEquals.slice(key.length + 1).trim();

  const index = args.indexOf(key);
  if (index >= 0 && index + 1 < args.length) {
    const next = args[index + 1];
    if (!next.startsWith('--')) return next.trim();
  }

  return null;
};

if (hasFlag('--help')) {
  console.log(`Backfill document page/sheet/slide counts.

Usage:
  node scripts/backfill-page-counts.mjs [--dry-run] [--force] [--user=<uid>] [--limit=<n>]

Examples:
  node scripts/backfill-page-counts.mjs --dry-run
  node scripts/backfill-page-counts.mjs --force --limit=100
  node scripts/backfill-page-counts.mjs --user=abc123
`);
  process.exit(0);
}

const dryRun = hasFlag('--dry-run');
const force = hasFlag('--force');
const userFilter = getArgValue('--user');
const limitArgRaw = getArgValue('--limit');
const limitArg = limitArgRaw && limitArgRaw.length > 0 ? limitArgRaw : null;
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

const pickPrimarySourceFile = docData => {
  if (Array.isArray(docData.sourceFiles) && docData.sourceFiles.length > 0) {
    const firstValid = docData.sourceFiles.find(
      entry =>
        entry &&
        typeof entry === 'object' &&
        typeof entry.storagePath === 'string' &&
        entry.storagePath.trim().length > 0
    );

    if (firstValid) {
      return {
        storagePath: firstValid.storagePath,
        mimeType: typeof firstValid.mimeType === 'string' ? firstValid.mimeType : '',
        fileName: typeof firstValid.fileName === 'string' ? firstValid.fileName : '',
      };
    }
  }

  if (
    typeof docData.storagePath === 'string' &&
    docData.storagePath.trim().length > 0
  ) {
    return {
      storagePath: docData.storagePath,
      mimeType: typeof docData.mimeType === 'string' ? docData.mimeType : '',
      fileName: typeof docData.fileName === 'string' ? docData.fileName : '',
    };
  }

  return null;
};

const getExistingPositiveInt = value =>
  typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : null;

const findEndOfCentralDirectoryOffset = zipBuffer => {
  const minimumOffset = Math.max(0, zipBuffer.length - ZIP_MAX_COMMENT_BYTES - 22);
  for (let offset = zipBuffer.length - 22; offset >= minimumOffset; offset -= 1) {
    if (zipBuffer.readUInt32LE(offset) === ZIP_EOCD_SIGNATURE) {
      return offset;
    }
  }
  return -1;
};

const parseZipEntries = zipBuffer => {
  try {
    const eocdOffset = findEndOfCentralDirectoryOffset(zipBuffer);
    if (eocdOffset < 0) return [];

    const totalEntries = zipBuffer.readUInt16LE(eocdOffset + 10);
    const centralDirectorySize = zipBuffer.readUInt32LE(eocdOffset + 12);
    const centralDirectoryOffset = zipBuffer.readUInt32LE(eocdOffset + 16);
    if (centralDirectoryOffset + centralDirectorySize > zipBuffer.length) return [];

    const entries = [];
    let cursor = centralDirectoryOffset;

    for (let index = 0; index < totalEntries; index += 1) {
      if (cursor + 46 > zipBuffer.length) break;
      if (zipBuffer.readUInt32LE(cursor) !== ZIP_CENTRAL_DIRECTORY_SIGNATURE) break;

      const compressionMethod = zipBuffer.readUInt16LE(cursor + 10);
      const compressedSize = zipBuffer.readUInt32LE(cursor + 20);
      const fileNameLength = zipBuffer.readUInt16LE(cursor + 28);
      const extraFieldLength = zipBuffer.readUInt16LE(cursor + 30);
      const commentLength = zipBuffer.readUInt16LE(cursor + 32);
      const localHeaderOffset = zipBuffer.readUInt32LE(cursor + 42);

      const fileNameStart = cursor + 46;
      const fileNameEnd = fileNameStart + fileNameLength;
      if (fileNameEnd > zipBuffer.length) break;

      const name = zipBuffer.toString('utf8', fileNameStart, fileNameEnd);
      if (localHeaderOffset + 30 <= zipBuffer.length) {
        const localHeaderSignature = zipBuffer.readUInt32LE(localHeaderOffset);
        if (localHeaderSignature === ZIP_LOCAL_FILE_HEADER_SIGNATURE) {
          const localFileNameLength = zipBuffer.readUInt16LE(localHeaderOffset + 26);
          const localExtraFieldLength = zipBuffer.readUInt16LE(localHeaderOffset + 28);
          const dataOffset = localHeaderOffset + 30 + localFileNameLength + localExtraFieldLength;
          if (dataOffset + compressedSize <= zipBuffer.length) {
            entries.push({ name, compressionMethod, compressedSize, dataOffset });
          }
        }
      }

      cursor += 46 + fileNameLength + extraFieldLength + commentLength;
    }

    return entries;
  } catch {
    return [];
  }
};

const readZipEntryText = (zipBuffer, entries, entryName) => {
  const target = entryName.toLowerCase();
  const entry = entries.find(candidate => candidate.name.toLowerCase() === target);
  if (!entry) return null;

  try {
    const compressed = zipBuffer.subarray(entry.dataOffset, entry.dataOffset + entry.compressedSize);
    if (entry.compressionMethod === 0) return compressed.toString('utf8');
    if (entry.compressionMethod === 8) return inflateRawSync(compressed).toString('utf8');
    return null;
  } catch {
    return null;
  }
};

const extractTaggedCount = (xmlText, tagName) => {
  const match = xmlText.match(new RegExp(`<${tagName}>(\\d+)</${tagName}>`, 'i'));
  if (!match?.[1]) return null;

  const parsed = Number.parseInt(match[1], 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const extractPdfPageCount = fileBuffer => {
  try {
    const pdfText = fileBuffer.toString('latin1');
    const matches = pdfText.match(/\/Type\s*\/Page\b/g);
    if (!matches || matches.length === 0) return null;
    return matches.length;
  } catch {
    return null;
  }
};

const extractDocxPageCount = (fileBuffer, entries) => {
  const appXml = readZipEntryText(fileBuffer, entries, 'docProps/app.xml');
  if (appXml) {
    const appPages = extractTaggedCount(appXml, 'Pages');
    if (appPages) return appPages;
  }

  const documentXml = readZipEntryText(fileBuffer, entries, 'word/document.xml');
  if (!documentXml) return null;

  const renderedBreaks = documentXml.match(/<w:lastRenderedPageBreak\b/gi)?.length ?? 0;
  return renderedBreaks > 0 ? renderedBreaks + 1 : null;
};

const extractXlsxSheetCount = entries => {
  const sheetCount = entries.filter(entry => /^xl\/worksheets\/sheet\d+\.xml$/i.test(entry.name)).length;
  return sheetCount > 0 ? sheetCount : null;
};

const extractPptxSlideCount = entries => {
  const slideCount = entries.filter(entry => /^ppt\/slides\/slide\d+\.xml$/i.test(entry.name)).length;
  return slideCount > 0 ? slideCount : null;
};

const extractDocumentUnitCount = (fileBuffer, mimeType, fileName) => {
  if (mimeType === 'application/pdf') {
    return extractPdfPageCount(fileBuffer);
  }

  const normalizedFileName = (fileName || '').toLowerCase();
  const isDocx =
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    normalizedFileName.endsWith('.docx');
  const isXlsx =
    mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    normalizedFileName.endsWith('.xlsx');
  const isPptx =
    mimeType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
    normalizedFileName.endsWith('.pptx');

  if (!isDocx && !isXlsx && !isPptx) return null;

  const entries = parseZipEntries(fileBuffer);
  if (entries.length === 0) return null;

  if (isDocx) return extractDocxPageCount(fileBuffer, entries);
  if (isXlsx) return extractXlsxSheetCount(entries);
  if (isPptx) return extractPptxSlideCount(entries);
  return null;
};

const docsSnapshot = await db.collection('documents').get();
let docs = docsSnapshot.docs;
if (userFilter) {
  docs = docs.filter(doc => (doc.data()?.userId ?? '') === userFilter);
}

console.log(`Found ${docs.length} documents${userFilter ? ` for user ${userFilter}` : ''}.`);
console.log(
  `Mode: ${dryRun ? 'DRY RUN' : 'WRITE'}${force ? ' | FORCE RECOMPUTE' : ' | ONLY MISSING'}${
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

    const existingCount = getExistingPositiveInt(docData.pageCount);
    if (!force && existingCount !== null) {
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
    if (!SUPPORTED_MIME_TYPES.has(mimeType)) {
      skipped += 1;
      continue;
    }

    const [fileBuffer] = await fileHandle.download();
    const computedCount = extractDocumentUnitCount(fileBuffer, mimeType, source.fileName);
    if (computedCount === null) {
      skipped += 1;
      continue;
    }

    if (existingCount === computedCount) {
      skipped += 1;
      continue;
    }

    if (!dryRun) {
      await docSnap.ref.set(
        {
          pageCount: computedCount,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    }

    updated += 1;
    console.log(`[${dryRun ? 'DRY' : 'OK'}] ${docSnap.id} -> ${computedCount}`);
  } catch (error) {
    failed += 1;
    console.error(
      `[ERROR] ${docSnap.id}:`,
      error instanceof Error ? error.message : 'Unknown error'
    );
  }
}

console.log('\nPage count backfill complete');
console.log(`Processed: ${processed}`);
console.log(`Updated: ${updated}`);
console.log(`Skipped: ${skipped}`);
console.log(`Failed: ${failed}`);
