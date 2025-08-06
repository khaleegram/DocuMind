
'use client';

import React, { useState, useMemo, useEffect } from 'react';
import type { Folder, Document as DocumentType } from '@/lib/types';
import Header from '@/components/dashboard/header';
import FolderList from '@/components/dashboard/folder-list';
import { UploadDialog } from '@/components/dashboard/upload-dialog';
import { auth, db } from '@/lib/firebase';
import { useAuthState } from 'react-firebase-hooks/auth';
import { useRouter } from 'next/navigation';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { Loader2 } from 'lucide-react';

export default function FoldersPage() {
  const [user, loading] = useAuthState(auth);
  const router = useRouter();
  const [folders, setFolders] = useState<Folder[]>([]);
  const [documents, setDocuments] = useState<DocumentType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isUploadDialogOpen, setUploadDialogOpen] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.push('/');
      return;
    }

    setIsLoading(true);
    const foldersQuery = query(collection(db, 'folders'), where('userId', '==', user.uid));
    const docsQuery = query(collection(db, 'documents'), where('userId', '==', user.uid));

    const unsubscribeFolders = onSnapshot(foldersQuery, (snapshot) => {
      const folderData: Folder[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        folderData.push({
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : new Date().toISOString(),
        } as Folder);
      });
      setFolders(folderData.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
      if(!snapshot.metadata.fromCache) setIsLoading(false);
    });

    const unsubscribeDocs = onSnapshot(docsQuery, (snapshot) => {
      const docData: DocumentType[] = [];
      snapshot.forEach((doc) => {
          docData.push({ id: doc.id, ...doc.data() } as DocumentType);
      });
      setDocuments(docData);
    });


    return () => {
      unsubscribeFolders();
      unsubscribeDocs();
    };
  }, [user, loading, router]);


  const filteredFolders = useMemo(() => {
    if (!searchQuery) return folders;
    return folders.filter(folder =>
      folder.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [folders, searchQuery]);
  
  if (loading || (!user && !loading)) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-16 w-16 animate-spin text-primary" />
      </div>
    );
  }
  
  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <Header 
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        onUploadClick={() => setUploadDialogOpen(true)}
        title="Folders"
      />
      <main className="flex-1 overflow-y-auto p-4 md:p-6">
        {isLoading ? (
           <div className="flex items-center justify-center pt-20">
             <Loader2 className="h-16 w-16 animate-spin text-primary" />
           </div>
        ) : (
          <FolderList folders={filteredFolders} documents={documents} />
        )}
      </main>
      <UploadDialog 
        isOpen={isUploadDialogOpen}
        setIsOpen={setUploadDialogOpen}
      />
    </div>
  );
}
