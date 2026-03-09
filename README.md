# DocuMind

DocuMind is a Next.js + Firebase document vault with server-side AI processing, semantic search, and grounded document chat.

## Stack

- Next.js 14 (App Router, TypeScript)
- Firebase Auth + Firestore + Storage
- Genkit + Gemini (`googleai/gemini-2.0-flash`)
- Tailwind + Radix UI

## Key Improvements Implemented

- Unified document schema (`expiry` normalized, runtime parsing with Zod).
- Moved AI processing/search/chat/suggestions behind authenticated server APIs.
- Added upload MIME/size enforcement (16MB hard cap).
- Added paginated and ordered Firestore retrieval for scale.
- Removed build-time lint/type bypasses.
- Hardened preview behavior by removing unsafe iframe fallback.

## Environment Variables

Create `.env.local` with:

```bash
# Firebase Web SDK (client)
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=

# Genkit / Google AI
GOOGLE_API_KEY=

# Firebase Admin SDK (server routes)
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=
FIREBASE_STORAGE_BUCKET=
```

Notes:

- `FIREBASE_PRIVATE_KEY` must preserve newlines (replace line breaks with `\n` in `.env.local`).
- If running in a GCP/Firebase environment with workload identity, explicit Admin credentials can be omitted.

## Scripts

- `npm run dev`: Run local app.
- `npm run build`: Production build.
- `npm run lint`: ESLint checks.
- `npm run typecheck`: TypeScript checks.
- `npm run test`: Unit tests.
- `npm run check`: Lint + typecheck + tests.

## AI API Endpoints

- `POST /api/documents/process`
- `POST /api/documents/delete`
- `POST /api/ai/search`
- `POST /api/ai/chat`
- `POST /api/ai/suggestions`

All endpoints require `Authorization: Bearer <firebase-id-token>`.

## Security Files

- Firestore rules: `firestore.rules`
- Storage rules: `storage.rules`

## Local Run

```bash
npm install
npm run dev
```
