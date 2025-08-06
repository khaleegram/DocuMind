
'use client';

import React, { useState, useMemo, useEffect } from 'react';
import type { Document as DocumentType } from '@/lib/types';
import Header from '@/components/dashboard/header';
import DocumentList from '@/components/dashboard/document-list';
import { UploadDialog } from '@/components/dashboard/upload-dialog';
import { auth, db } from '@/lib/firebase';
import { useAuthState } from 'react-firebase-hooks/auth';
import { useRouter } from 'next/navigation';
import { collection, query, where, onSnapshot, deleteDoc, doc, getDoc } from 'firebase/firestore';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { googleProvider } from '@/lib/firebase';

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
                uploadedAt: data.uploadedAt?.toDate ? data.uploadedAt.toDate().toISOString() : new Date().toISOString(),
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

 const handleDeleteDocument = async (docId: string) => {
    if (!user) return;
    try {
      const docRef = doc(db, 'documents', docId);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        throw new Error("Document not found in the database.");
      }
      const docToDelete = { id: docSnap.id, ...docSnap.data() } as DocumentType;

      if (!docToDelete.driveFileId) {
        try {
          await deleteDoc(docRef);
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
      
      const result = await signInWithPopup(auth, googleProvider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (!credential || !credential.accessToken) {
        throw new Error("Could not get valid credentials to delete file.");
      }
      const accessToken = credential.accessToken;

      const driveResponse = await fetch(`https://www.googleapis.com/drive/v3/files/${docToDelete.driveFileId}?supportsAllDrives=true`, {
        method: 'DELETE',
        headers: {
          'Authorization': 'Bearer ' + accessToken
        }
      });

      if (!driveResponse.ok) {
        if (driveResponse.status === 404) {
             console.warn('File not found on Google Drive during deletion, but proceeding as it might be orphaned.');
        } else {
            const errorData = await driveResponse.json().catch(() => ({error: {message: "Could not parse error from Google Drive."}}));
            console.error('Google Drive deletion error:', errorData);
            throw new Error(errorData.error.message || 'Failed to delete file from Google Drive.');
        }
      }

      await deleteDoc(docRef);

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
    <div className="flex flex-col h-screen overflow-hidden sm:overflow-auto">
      <Header 
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        onUploadClick={() => setUploadDialogOpen(true)}
        title="My Documents"
      />
      <main className="flex-1 overflow-y-auto p-4 md:p-0">
        {isLoadingDocs ? (
           <div className="flex items-center justify-center pt-20">
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

    