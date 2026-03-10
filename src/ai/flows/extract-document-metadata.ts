
'use server';

/**
 * @fileOverview This file defines a Genkit flow for extracting document metadata using AI.
 *
 * - extractDocumentMetadata - A function that extracts metadata from a document.
 * - ExtractDocumentMetadataInput - The input type for the extractDocumentMetadata function.
 * - ExtractDocumentMetadataOutput - The output type for the extractDocumentMetadata function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ExtractDocumentMetadataInputSchema = z.object({
  documentDataUrl: z
    .string()
    .describe('A data URI of an image of the document.'),
  documentText: z
    .string()
    .optional()
    .describe('Optional OCR text extracted from one or more files in the same document set.'),
  fileNameHints: z
    .array(z.string())
    .optional()
    .describe('Optional original file names to help identify the document type.'),
  fileCount: z
    .number()
    .int()
    .positive()
    .optional()
    .describe('How many files are in this document set.'),
});
export type ExtractDocumentMetadataInput = z.infer<
  typeof ExtractDocumentMetadataInputSchema
>;

const ExtractDocumentMetadataOutputSchema = z.object({
  displayName: z
    .string()
    .describe(
      "A clean document title for UI display. Prefer format \"<Owner First Name>'s <Document Type>\" (e.g., \"Muhammad's Certificate\") when a person is known."
    ),
  documentType: z
    .string()
    .describe(
      'A specific document type label in Title Case (e.g., "Certificate", "PPA Letter", "Invoice", "Passport", "Transcript").'
    ),
  owner: z.string().describe('The full name of the primary person on the document, formatted as "Firstname Lastname". If no person is present, use the primary company name or a descriptive title, formatted in Title Case.'),
  category: z.string().describe('The general category of the document (e.g., "Personal ID", "Financial", "Work", "Legal", "Receipt"), formatted in Title Case.'),
  expiry: z.string().nullable().describe('The expiration date of the document in YYYY-MM-DD format, or null if not found.'),
  tags: z.array(z.string()).describe('A list of 2-4 specific, relevant tags for organization (e.g., "contract", "invoice", "bank-statement").'),
  keywords: z.array(z.string()).describe('A list of 3-5 relevant keywords for search.'),
  summary: z.string().describe("A concise, one-to-two sentence summary of the document's content."),
});
export type ExtractDocumentMetadataOutput = z.infer<
  typeof ExtractDocumentMetadataOutputSchema
>;

export async function extractDocumentMetadata(
  input: ExtractDocumentMetadataInput
): Promise<ExtractDocumentMetadataOutput> {
  return extractDocumentMetadataFlow(input);
}

const prompt = ai.definePrompt({
  name: 'extractDocumentMetadataPrompt',
  input: {schema: ExtractDocumentMetadataInputSchema},
  output: {schema: ExtractDocumentMetadataOutputSchema},
  prompt: `You are an AI assistant specialized in extracting and organizing information from various personal and business documents. Your goal is to categorize and tag these documents for a personal vault.

  Analyze the following document image and extract the required metadata.

  **CRITICAL NORMALIZATION RULES:**
  - **Document Type (Top Priority):** Infer the specific document type with the best short label. Examples: "Certificate", "PPA Letter", "Offer Letter", "Invoice", "Receipt", "Bank Statement", "Passport", "Driver License", "ID Card", "Transcript".
  - **Owner Field (Top Priority):** Scrutinize the document for a person's name. It could be labeled as "Name", "To", "For", etc. If a person's name and a company name are both present, the person's name MUST be used as the owner. You MUST reformat the name to "Firstname Lastname" order and apply Title Case. For example, if the document says "DOE, JOHN" or "john doe", you must return "John Doe". If, and only if, no person is clearly identified, use the primary company name or a descriptive title of the document as the owner, formatted in Title Case.
  - **Display Name:** Build a user-friendly title.
    - If owner is a person's name: format as "<FirstName>'s <DocumentType>".
    - If owner is an organization: format as "<Organization> <DocumentType>".
    - If owner is unknown: use "<DocumentType>" only.
    - Keep this concise, human-readable, and in Title Case.
  - **Category:** Determine a broad, general category for the document. Choose from options like "Personal ID", "Financial", "Work", "Legal", "Receipt", "Travel", "Medical", or "Credential".
  - **Tags:** Extract 2-4 specific, lowercase, single-word tags that describe the document's content. Examples: "invoice", "contract", "bank-statement", "boarding-pass", "prescription".
  - **Dates:** Find the expiration date and format it as YYYY-MM-DD. If no expiry date is present, use null.
  - **Null Values:** If a field like 'expiry' is not present on the document, you MUST return null. Do not guess or invent information.

  Image: {{media url=documentDataUrl}}

  OCR Text (if available): {{{documentText}}}
  File Name Hints: {{{json fileNameHints}}}
  File Count: {{{fileCount}}}

  Return the extracted and normalized data in the specified JSON format.
  `,
});


const extractDocumentMetadataFlow = ai.defineFlow(
  {
    name: 'extractDocumentMetadataFlow',
    inputSchema: ExtractDocumentMetadataInputSchema,
    outputSchema: ExtractDocumentMetadataOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
