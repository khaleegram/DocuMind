
'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import type { Document as DocumentType } from '@/lib/types';
import Header from '@/components/dashboard/header';
import DocumentList from '@/components/dashboard/document-list';
import { UploadDialog } from '@/components/dashboard/upload-dialog';
import { auth, db, storage } from '@/lib/firebase';
import { useAuthState } from 'react-firebase-hooks/auth';
import { useRouter } from 'next/navigation';
import { collection, query, where, onSnapshot, deleteDoc, doc, getDoc } from 'firebase/firestore';
import { deleteObject, ref } from 'firebase/storage';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import FilterSidebar from '@/components/dashboard/filter-sidebar';
import Fuse from 'fuse.js';
import { EmptyState } from '@/components/dashboard/empty-state';
import { intelligentSearch } from '@/ai/flows/intelligent-search';

export type FilterCategory = 'category' | 'tags';

// Function to find the canonical name for a given value
const findCanonicalName = (value: string, existingNames: Set<string>): string => {
    if (existingNames.has(value)) {
        return value;
    }
    const fuse = new Fuse(Array.from(existingNames), { threshold: 0.2, ignoreLocation: true });
    const results = fuse.search(value);
    if (results.length > 0) {
        return results[0].item;
    }
    return value;
};


export default function AllDocumentsPage() {
  const [user, loading] = useAuthState(auth);
  const router = useRouter();
  const [documents, setDocuments] = useState<DocumentType[]>([]);
  const [isLoadingDocs, setIsLoadingDocs] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [submittedSearchQuery, setSubmittedSearchQuery] = useState('');
  const [isUploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [aiSearchResults, setAiSearchResults] = useState<DocumentType[] | null>(null);
  const [isAiSearching, setIsAiSearching] = useState(false);
  const [activeFilters, setActiveFilters] = useState<Record<FilterCategory, Set<string>>>({
    category: new Set(),
    tags: new Set(),
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
      category: new Set(),
      tags: new Set(),
    };
    documents.forEach(doc => {
      if (doc.category && doc.category !== 'Processing...') {
          const canonicalCategory = findCanonicalName(doc.category, options.category);
          options.category.add(canonicalCategory);
      }
      if (doc.tags && Array.isArray(doc.tags)) {
        doc.tags.forEach(tag => {
            const canonicalTag = findCanonicalName(tag, options.tags);
            options.tags.add(canonicalTag);
        });
      }
    });
    return {
        category: Array.from(options.category).sort(),
        tags: Array.from(options.tags).sort(),
    }
  }, [documents]);

  const handleFilterChange = useCallback((category: FilterCategory, value: string) => {
    setAiSearchResults(null); // Clear AI results when manual filters change
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

  const clearFilters = useCallback(() => {
    setActiveFilters({ category: new Set(), tags: new Set() });
    setAiSearchResults(null);
    setSearchQuery('');
    setSubmittedSearchQuery('');
  }, []);
  
 const handleAiSearch = useCallback(async (searchString: string) => {
    setIsAiSearching(true);
    // Clear manual filters and search to avoid confusion
    clearFilters();
    setSearchQuery(searchString); // Put the query in the search bar for context

    try {
      const documentsToSearch = documents.map(doc => ({
        id: doc.id,
        owner: doc.owner,
        category: doc.category,
        tags: doc.tags,
        summary: doc.summary ?? null,
        keywords: doc.keywords,
      }));

      const { documentIds } = await intelligentSearch({
        query: searchString,
        documents: documentsToSearch,
      });

      const resultsMap = new Map(documents.map(doc => [doc.id, doc]));
      const matchedDocs = documentIds.map(id => resultsMap.get(id)).filter(Boolean) as DocumentType[];
      setAiSearchResults(matchedDocs);

    } catch (error) {
        console.error("AI search failed:", error);
        toast({
            variant: 'destructive',
            title: 'AI Search Failed',
            description: 'Could not perform the intelligent search. Please try again later.'
        });
        setAiSearchResults([]); // Show empty state on error
    } finally {
        setIsAiSearching(false);
    }
  }, [documents, toast, clearFilters]);


  const handleDeleteDocument = async (docId: string) => {
    if (!user) return;
    
    try {
      const docRef = doc(db, 'documents', docId);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        throw new Error("Document not found in the database.");
      }
      const docToDelete = docSnap.data() as DocumentType;

      // Delete from Firebase Storage first
      if (docToDelete.storagePath) {
        const fileRef = ref(storage, docToDelete.storagePath);
        await deleteObject(fileRef);
      }

      // Then delete from Firestore
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


  const handleSearchSubmit = () => {
    setAiSearchResults(null); // Clear AI results on manual search
    setSubmittedSearchQuery(searchQuery);
  };
  
  const displayedDocuments = useMemo(() => {
    // If there are AI search results, show them.
    if (aiSearchResults !== null) {
      return aiSearchResults;
    }

    let filtered = documents;
    
    // Apply sidebar filters with fuzzy matching for document values
    const hasActiveFilters = Object.values(activeFilters).some(s => s.size > 0);

    if (hasActiveFilters) {
        filtered = filtered.filter(doc => {
            return Object.entries(activeFilters).every(([category, values]) => {
                if (values.size === 0) return true;
                const cat = category as FilterCategory;
                const docValue = doc[cat];
                
                if (cat === 'tags') {
                    if (!Array.isArray(docValue) || docValue.length === 0) return false;
                    // Check if any of the document's tags fuzzily match any of the selected filter tags
                    return Array.from(values).some(filterTag => {
                        const fuse = new Fuse(docValue, { threshold: 0.2, ignoreLocation: true });
                        return fuse.search(filterTag).length > 0;
                    });
                }

                if (!docValue) return false;

                // Check if the doc's value fuzzily matches any of the selected canonical filter values
                const fuse = new Fuse(Array.from(values), { threshold: 0.2, ignoreLocation: true });
                return fuse.search(docValue).length > 0;
            });
        });
    }

    // Apply fuzzy search on top of filters
    if (submittedSearchQuery) {
        const fuse = new Fuse(filtered, {
            keys: ['owner', 'category', 'tags', 'keywords', 'summary', 'textContent'],
            threshold: 0.4, 
            includeScore: true,
        });
        filtered = fuse.search(submittedSearchQuery).map(result => result.item);
    }

    return filtered;
  }, [documents, submittedSearchQuery, activeFilters, aiSearchResults]);


  if (loading || (!user && !loading)) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#050505]">
        <Loader2 className="h-16 w-16 animate-spin text-blue-600" />
      </div>
    );
  }
  
  const showLoader = isLoadingDocs || isAiSearching;
  const showEmptyState = (displayedDocuments.length === 0 && (submittedSearchQuery.length > 0 || aiSearchResults !== null)) || (documents.length === 0 && !isLoadingDocs);


  return (
    <div className="flex flex-col min-h-screen bg-[#050505] text-white font-sans selection:bg-blue-500/40">
      <Header 
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        onSearchSubmit={handleSearchSubmit}
        onUploadClick={() => setUploadDialogOpen(true)}
        onAiSearch={handleAiSearch}
        isAiSearching={isAiSearching}
        title="All Documents"
        showAiSearch={true}
      />
      <main className="flex-1 overflow-y-auto p-4 md:p-6 max-w-7xl mx-auto w-full">
          {showLoader ? (
            <div className="flex items-center justify-center pt-20">
              <Loader2 className="h-16 w-16 animate-spin text-blue-600" />
            </div>
          ) : (
             showEmptyState
             ? <EmptyState onClear={clearFilters} isFiltered={aiSearchResults !== null || submittedSearchQuery.length > 0}/> 
             : <DocumentList documents={displayedDocuments} onDelete={handleDeleteDocument} />
          )}
        </main>
      <FilterSidebar 
        filterOptions={filterOptions}
        activeFilters={activeFilters}
        onFilterChange={handleFilterChange}
        onClearFilters={clearFilters}
        isAiSearchActive={aiSearchResults !== null}
      />
      <UploadDialog 
        isOpen={isUploadDialogOpen}
        setIsOpen={setUploadDialogOpen}
      />
    </div>
  );
}
