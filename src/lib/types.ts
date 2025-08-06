export type Document = {
  id: string;
  fileId: string;
  owner: string;
  company?: string;
  type: string;
  expiry: string | null;
  keywords: string[];
  uploadedAt: string;
  fileUrl: string;
};
