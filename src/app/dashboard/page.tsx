'use client';

import React, { useState, useMemo } from 'react';
import type { Document } from '@/lib/types';
import Header from '@/components/dashboard/header';
import DocumentList from '@/components/dashboard/document-list';
import { UploadDialog } from '@/components/dashboard/upload-dialog';
import { format } from 'date-fns';

const mockDocuments: Document[] = [
  {
    id: '1',
    fileId: 'gdrive_id_1',
    owner: 'John Doe',
    company: 'Nike',
    type: 'Passport',
    expiry: '2027-05-15',
    keywords: ['Nigeria', 'Passport', 'Visa'],
    uploadedAt: '2024-08-06',
    fileUrl: 'https://placehold.co/800x1100.png',
  },
  {
    id: '2',
    fileId: 'gdrive_id_2',
    owner: 'Jane Smith',
    company: 'Apple Inc.',
    type: 'Contract',
    expiry: null,
    keywords: ['Employment', 'NDA', 'Software Engineer'],
    uploadedAt: '2024-07-22',
    fileUrl: 'https://placehold.co/800x1100.png',
  },
  {
    id: '3',
    fileId: 'gdrive_id_3',
    owner: 'Project Alpha',
    company: 'Microsoft',
    type: 'Receipt',
    expiry: null,
    keywords: ['Software', 'License', 'Azure'],
    uploadedAt: '2024-08-01',
    fileUrl: 'https://placehold.co/800x1100.png',
  },
  {
    id: '4',
    fileId: 'gdrive_id_4',
    owner: 'John Doe',
    type: 'Visa',
    expiry: '2025-12-31',
    keywords: ['USA', 'Travel', 'B1/B2'],
    uploadedAt: '2024-06-15',
    fileUrl: 'https://placehold.co/800x1100.png',
  },
];


export default function DashboardPage() {
  const [documents, setDocuments] = useState<Document[]>(mockDocuments);
  const [searchQuery, setSearchQuery] = useState('');
  const [isUploadDialogOpen, setUploadDialogOpen] = useState(false);

  const filteredDocuments = useMemo(() => {
    if (!searchQuery) return documents;
    const lowercasedQuery = searchQuery.toLowerCase();
    return documents.filter(doc => 
        doc.owner.toLowerCase().includes(lowercasedQuery) ||
        (doc.company && doc.company.toLowerCase().includes(lowercasedQuery)) ||
        doc.type.toLowerCase().includes(lowercasedQuery) ||
        doc.keywords.some(k => k.toLowerCase().includes(lowercasedQuery))
    );
  }, [documents, searchQuery]);

  const handleAddDocument = (newDocData: Omit<Document, 'id' | 'fileId' | 'uploadedAt' | 'fileUrl'>) => {
    const newDoc: Document = {
      id: (documents.length + 1).toString(),
      fileId: `gdrive_id_${documents.length + 1}`,
      uploadedAt: format(new Date(), 'yyyy-MM-dd'),
      fileUrl: 'https://placehold.co/800x1100.png',
      ...newDocData
    };
    setDocuments(prev => [newDoc, ...prev]);
  };

  const handleDeleteDocument = (id: string) => {
    setDocuments(prev => prev.filter(doc => doc.id !== id));
  };


  return (
    <div className="flex flex-col h-screen">
      <Header 
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        onUploadClick={() => setUploadDialogOpen(true)}
      />
      <main className="flex-1 overflow-y-auto p-4 md:p-8">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight mb-6">My Documents</h1>
        <DocumentList documents={filteredDocuments} onDelete={handleDeleteDocument} />
      </main>
      <UploadDialog 
        isOpen={isUploadDialogOpen}
        setIsOpen={setUploadDialogOpen}
        onDocumentAdd={handleAddDocument}
      />
    </div>
  );
}
