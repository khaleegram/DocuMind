
'use client';

import React, { useState, useMemo, useEffect } from 'react';
import type { Document as DocumentType } from '@/lib/types';
import Header from '@/components/dashboard/header';
import DocumentList from '@/components/dashboard/document-list';
import { UploadDialog } from '@/components/dashboard/upload-dialog';
import { auth, db, storage, googleProvider } from '@/lib/firebase';
import { useAuthState } from 'react-firebase-hooks/auth';
import { useRouter } from 'next/navigation';
import { collection, query, where, onSnapshot, deleteDoc, doc } from 'firebase/firestore';
import { ref, deleteObject } from 'firebase/storage';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';

export default function DashboardPage() {
  const [user, loading] = useAuthState(auth);
  const router = useRouter();
  const [documents, setDocuments] = useState<DocumentType[]>([]);
  const [isLoadingDocs, setIsLoadingDocs] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isUploadDialogOpen, setUploadDialogOpen] = useState(false);
  const { toast } = useToast();

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

    // If there's no driveFileId, it might be an older record.
    // Just delete it from Firestore.
    if (!docToDelete.driveFileId) {
      try {
        await deleteDoc(doc(db, 'documents', docToDelete.id));
        toast({
          title: 'Document Record Deleted',
          description: `Removed ${docToDelete.fileName} from your list. The file was not on Google Drive.`,
        });
      } catch (error: any) {
        console.error("Error deleting firestore document: ", error);
        toast({
            variant: 'destructive',
            title: 'Deletion Failed',
            description: 'Could not delete the document record from Firestore.',
        });
      }
      return;
    }
    
    try {
      // Re-authenticate to get a fresh access token for the Drive API call
      const result = await signInWithPopup(auth, googleProvider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (!credential || !credential.accessToken) {
        throw new Error("Could not get valid credentials to delete file.");
      }
      const accessToken = credential.accessToken;

      // Delete from Google Drive
      const driveResponse = await fetch(`https://www.googleapis.com/drive/v3/files/${docToDelete.driveFileId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': 'Bearer ' + accessToken
        }
      });

      if (!driveResponse.ok) {
        // Don't throw if file not found (it might have been deleted manually)
        if (driveResponse.status !== 404) {
          const errorData = await driveResponse.json().catch(() => ({error: {message: "Could not parse error from Google Drive."}}));
          console.error('Google Drive deletion error:', errorData);
          throw new Error(errorData.error.message || 'Failed to delete file from Google Drive.');
        }
      }

      // Delete firestore document
      await deleteDoc(doc(db, 'documents', docToDelete.id));

      toast({
        title: 'Document Deleted',
        description: `${docToDelete.fileName} has been removed.`,
      });
      
    } catch (error: any) {
        console.error("Error deleting document: ", error);
        toast({
            variant: 'destructive',
            title: 'Deletion Failed',
            description: error.message || 'Could not delete the document.',
        });
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
