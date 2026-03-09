# App Name: DocuMind

## Product Goal

DocuMind is a secure personal and business document vault that lets users upload files, auto-extract key metadata with AI, and quickly retrieve information through intelligent search and document chat.

## Core Features

- Secure Sign-In: Google sign-in through Firebase Authentication with local session persistence.
- Upload & Storage: Users upload PDF/image files to Firebase Storage under per-user paths.
- AI Processing Pipeline: Server-side processing extracts text, detects metadata (owner, category, expiry, tags, summary), and enriches search keywords.
- Metadata Vault: Parsed document metadata is stored in Firestore and linked to storage assets.
- Search & Retrieval:
  - Fuzzy metadata search for fast filtering.
  - AI-assisted semantic search over document metadata.
  - Direct open of original file from storage URL.
- Document Chat: Ask questions about extracted document text and receive grounded answers.

## Non-Functional Requirements

- Security:
  - Per-user Firestore and Storage access controls.
  - Authenticated backend API endpoints for AI workloads.
  - No client-side direct AI processing of uploaded file contents.
- Reliability:
  - Background-safe processing status fields (`isProcessing`, `processingError`).
  - Strict upload validation for MIME type and file size.
- Performance:
  - Indexed queries with ordering and pagination.
  - Capped payload size for AI search candidates.

## UX Guidelines

- Primary color: Deep Indigo (`#3F51B5`)
- Accent color: Teal (`#009688`)
- Surface style: Dark, high-contrast card UI
- Typography: Inter for body, Space Grotesk for headlines
