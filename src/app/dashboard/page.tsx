'use client';

import React, { useState, useMemo, useEffect } from 'react';
import type { Document as DocumentType } from '@/lib/types';
import Header from '@/components/dashboard/header';
import DocumentList from '@/components/dashboard/document-list';
import { UploadDialog } from '@/components/dashboard/upload-dialog';
import { auth, db, storage } from '@/lib/firebase';
import { useAuthState } from 'react-firebase-hooks/auth';
import { useRouter } from 'next/navigation';
import { collection, query, where, onSnapshot, deleteDoc, doc } from 'firebase/firestore';
import { ref, deleteObject } from 'firebase/storage';
import { Loader2 } from 'lucide-react';

export default function DashboardPage() {
  const [user, loading] = useAuthState(auth);
  const router = useRouter();
  const [documents, setDocuments] = useState<DocumentType[]>([]);
  const [isLoadingDocs, setIsLoadingDocs] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isUploadDialogOpen, setUploadDialogOpen] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.push('/');
      return;
    }

    setIsLoadingDocs(true);
    const q = query(collection(db, 'documents'), where('userId', '==', user.uid));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const docs: DocumentType[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        docs.push({ 
          id: doc.id, 
          ...data,
          uploadedAt: data.uploadedAt?.toDate().toISOString() || new Date().toISOString(),
        } as DocumentType);
      });
      setDocuments(docs.sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()));
      setIsLoadingDocs(false);
    });

    return () => unsubscribe();
  }, [user, loading, router]);


  const filteredDocuments = useMemo(() => {
    if (!searchQuery) return documents;
    const lowercasedQuery = searchQuery.toLowerCase();
    return documents.filter(doc => 
        (doc.owner && doc.owner.toLowerCase().includes(lowercasedQuery)) ||
        (doc.company && doc.company.toLowerCase().includes(lowercasedQuery)) ||
        (doc.type && doc.type.toLowerCase().includes(lowercasedQuery)) ||
        (doc.keywords && doc.keywords.some(k => k.toLowerCase().includes(lowercasedQuery)))
    );
  }, [documents, searchQuery]);

  const handleDeleteDocument = async (docToDelete: DocumentType) => {
    if (!user) return;
    try {
      // Delete firestore document
      await deleteDoc(doc(db, 'documents', docToDelete.id));

      // Delete file from storage
      const fileRef = ref(storage, `documents/${user.uid}/${docToDelete.fileName}`);
      await deleteObject(fileRef);
    } catch (error) {
        console.error("Error deleting document: ", error);
    }
  };
  
  if (loading || (!user && !loading)) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-16 w-16 animate-spin text-primary" />
      </div>
    );
  }
  
  return (
    <div className="flex flex-col h-screen">
      <Header 
        user={user}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        onUploadClick={() => setUploadDialogOpen(true)}
      />
      <main className="flex-1 overflow-y-auto p-4 md:p-8">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight mb-6">My Documents</h1>
        {isLoadingDocs ? (
           <div className="flex h-screen items-center justify-center">
             <Loader2 className="h-16 w-16 animate-spin text-primary" />
           </div>
        ) : (
          <DocumentList documents={filteredDocuments} onDelete={handleDeleteDocument} />
        )}
      </main>
      <UploadDialog 
        isOpen={isUploadDialogOpen}
        setIsOpen={setUploadDialogOpen}
      />
    </div>
  );
}
