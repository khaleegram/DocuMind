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
});
export type ExtractDocumentMetadataInput = z.infer<
  typeof ExtractDocumentMetadataInputSchema
>;

const ExtractDocumentMetadataOutputSchema = z.object({
  owner: z.string().describe('The full name of the primary person on the document. If no person is present, use the primary company name.'),
  company: z.string().nullable().describe('The name of the company or organization on the document, if any. Use null if not applicable.'),
  documentType: z.string().describe('The type of document (e.g., Passport, Drivers License, Contract, Receipt).'),
  expiryDate: z.string().nullable().describe('The expiration date of the document in YYYY-MM-DD format, or null if not found.'),
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
  prompt: `You are an AI assistant specialized in extracting key information from document images.
  Analyze the following document image and extract the required metadata.

  Image: {{media url=documentDataUrl}}

  - **Owner:** Identify the full name of the primary person on the document. If no person is clearly identified, use the primary company name as the owner.
  - **Company:** Identify the company or organization associated with the document. If no company is present, use null.
  - **Document Type:** Determine the type of document (e.g., Passport, Drivers License, Contract, Receipt, Invoice, Utility Bill).
  - **Expiry Date:** Find the expiration date and format it as YYYY-MM-DD. If no expiry date is present, use null.
  - **Keywords:** Generate 3-5 relevant keywords from the document's content that would be useful for a search (e.g., travel, medical, financial).
  - **Summary:** Provide a brief, one-to-two sentence summary of the document's main content.

  Return the extracted data in the specified JSON format.
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
