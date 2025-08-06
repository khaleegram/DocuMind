export type Document = {
  id: string;
  userId: string;
  owner: string;
  company?: string;
  type: string;
  expiry: string | null;
  keywords: string[];
  uploadedAt: string;
  fileUrl: string;
  fileName: string;
};
