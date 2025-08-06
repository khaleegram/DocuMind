
'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
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
import FilterSidebar from '@/components/dashboard/filter-sidebar';
import Fuse from 'fuse.js';

export type FilterCategory = 'owner' | 'type' | 'company' | 'country';

export default function DashboardPage() {
  const [user, loading] = useAuthState(auth);
  const router = useRouter();
  const [documents, setDocuments] = useState<DocumentType[]>([]);
  const [isLoadingDocs, setIsLoadingDocs] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [submittedSearchQuery, setSubmittedSearchQuery] = useState('');
  const [isUploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [activeFilters, setActiveFilters] = useState<Record<FilterCategory, Set<string>>>({
    owner: new Set(),
    type: new Set(),
    company: new Set(),
    country: new Set(),
  });
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


  const filterOptions = useMemo(() => {
    const options: Record<FilterCategory, Set<string>> = {
      owner: new Set(),
      type: new Set(),
      company: new Set(),
      country: new Set(),
    };
    documents.forEach(doc => {
      if (doc.owner) options.owner.add(doc.owner);
      if (doc.type) options.type.add(doc.type);
      if (doc.company) options.company.add(doc.company);
      if (doc.country) options.country.add(doc.country);
    });
    return {
        owner: Array.from(options.owner).sort(),
        type: Array.from(options.type).sort(),
        company: Array.from(options.company).sort(),
        country: Array.from(options.country).sort(),
    }
  }, [documents]);

  const handleFilterChange = useCallback((category: FilterCategory, value: string) => {
    setActiveFilters(prev => {
        const newSet = new Set(prev[category]);
        if (newSet.has(value)) {
            newSet.delete(value);
        } else {
            newSet.add(value);
        }
        return { ...prev, [category]: newSet };
    });
  }, []);
  
  const filteredDocuments = useMemo(() => {
    let filtered = documents;
    
    // Apply sidebar filters
    Object.entries(activeFilters).forEach(([category, values]) => {
        if (values.size > 0) {
            filtered = filtered.filter(doc => {
                const cat = category as FilterCategory;
                const docValue = doc[cat];
                return docValue && values.has(docValue);
            });
        }
    });

    // Apply fuzzy search
    if (submittedSearchQuery) {
        const fuse = new Fuse(filtered, {
            keys: ['owner', 'company', 'type', 'keywords', 'summary', 'textContent'],
            threshold: 0.4, // Adjust for more or less fuzziness
            includeScore: true,
        });
        filtered = fuse.search(submittedSearchQuery).map(result => result.item);
    }

    return filtered;
  }, [documents, submittedSearchQuery, activeFilters]);

  const handleSearchSubmit = () => {
    setSubmittedSearchQuery(searchQuery);
  };

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
          await deleteDoc(docRef);
          toast({
            title: 'Document Record Deleted',
            description: `Removed ${docToDelete.fileName} from your list.`,
          });
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
    <div className="flex h-screen">
      <FilterSidebar 
        filterOptions={filterOptions}
        activeFilters={activeFilters}
        onFilterChange={handleFilterChange}
        onClearFilters={() => setActiveFilters({ owner: new Set(), type: new Set(), company: new Set(), country: new Set() })}
      />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Header 
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          onSearchSubmit={handleSearchSubmit}
          onUploadClick={() => setUploadDialogOpen(true)}
          title="My Documents"
        />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          {isLoadingDocs ? (
            <div className="flex items-center justify-center pt-20">
              <Loader2 className="h-16 w-16 animate-spin text-primary" />
            </div>
          ) : (
            <DocumentList documents={filteredDocuments} onDelete={handleDeleteDocument} />
          )}
        </main>
      </div>
      <UploadDialog 
        isOpen={isUploadDialogOpen}
        setIsOpen={setUploadDialogOpen}
      />
    </div>
  );
}
