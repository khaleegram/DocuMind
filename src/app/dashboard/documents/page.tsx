'use client';

import React, { Suspense, useState, useMemo, useEffect, useCallback } from 'react';
import type { Document as DocumentType } from '@/lib/types';
import { parseDocumentFromFirestore } from '@/lib/types';
import Header from '@/components/dashboard/header';
import DocumentList from '@/components/dashboard/document-list';
import { UploadDialog } from '@/components/dashboard/upload-dialog';
import { auth, db } from '@/lib/firebase';
import { useAuthState } from 'react-firebase-hooks/auth';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  collection,
  query,
  where,
  getDocs,
  orderBy,
  limit,
  startAfter,
  type QueryConstraint,
  type QueryDocumentSnapshot,
  type DocumentData,
} from 'firebase/firestore';
import { Loader2, RotateCcw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import FilterSidebar from '@/components/dashboard/filter-sidebar';
import Fuse from 'fuse.js';
import { EmptyState } from '@/components/dashboard/empty-state';
import { Button } from '@/components/ui/button';
import { AI_SEARCH_MAX_DOCUMENTS, DEFAULT_PAGE_SIZE } from '@/lib/constants';

export type FilterCategory = 'category' | 'tags';
const PROCESSING_STALE_THRESHOLD_MS = 10 * 60 * 1000;
const PROCESSING_RETRY_CONCURRENCY = 2;

const FullScreenLoader = () => (
  <div className="flex h-screen items-center justify-center bg-[#050505]">
    <Loader2 className="h-16 w-16 animate-spin text-blue-600" />
  </div>
);

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

const dedupeDocumentsById = (docs: DocumentType[]): DocumentType[] => {
  const map = new Map<string, DocumentType>();
  docs.forEach(item => map.set(item.id, item));
  return Array.from(map.values()).sort(
    (a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
  );
};

function AllDocumentsPageContent() {
  const [user, loading] = useAuthState(auth);
  const router = useRouter();
  const searchParams = useSearchParams();
  const [documents, setDocuments] = useState<DocumentType[]>([]);
  const [isLoadingDocs, setIsLoadingDocs] = useState(true);
  const [isLoadingMoreDocs, setIsLoadingMoreDocs] = useState(false);
  const [hasMoreDocs, setHasMoreDocs] = useState(false);
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [submittedSearchQuery, setSubmittedSearchQuery] = useState('');
  const [isUploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [aiSearchResults, setAiSearchResults] = useState<DocumentType[] | null>(null);
  const [isAiSearching, setIsAiSearching] = useState(false);
  const [retryingDocIds, setRetryingDocIds] = useState<Set<string>>(new Set());
  const [isRetryingBatch, setIsRetryingBatch] = useState(false);
  const [activeFilters, setActiveFilters] = useState<Record<FilterCategory, Set<string>>>({
    category: new Set(),
    tags: new Set(),
  });
  const { toast } = useToast();

  const fetchDocumentsPage = useCallback(
    async (options: {
      reset: boolean;
      cursor?: QueryDocumentSnapshot<DocumentData> | null;
    }) => {
      if (!user) return;

      if (options.reset) {
        setIsLoadingDocs(true);
      } else {
        setIsLoadingMoreDocs(true);
      }

      try {
        const constraints: QueryConstraint[] = [
          where('userId', '==', user.uid),
          orderBy('uploadedAt', 'desc'),
          limit(DEFAULT_PAGE_SIZE),
        ];

        if (!options.reset && options.cursor) {
          constraints.push(startAfter(options.cursor));
        }

        const q = query(collection(db, 'documents'), ...constraints);
        const snapshot = await getDocs(q);

        const parsedDocuments = snapshot.docs.flatMap(item => {
          try {
            return [parseDocumentFromFirestore(item.id, item.data() as Record<string, unknown>)];
          } catch (error) {
            console.error(`Skipping invalid document ${item.id}:`, error);
            return [];
          }
        });

        setDocuments(prev =>
          options.reset ? dedupeDocumentsById(parsedDocuments) : dedupeDocumentsById([...prev, ...parsedDocuments])
        );
        setLastDoc(snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1] : null);
        setHasMoreDocs(snapshot.docs.length === DEFAULT_PAGE_SIZE);
      } catch (error) {
        console.error('Error fetching documents:', error);
        toast({
          variant: 'destructive',
          title: 'LOAD_FAILED',
          description: 'Could not fetch documents. Please retry.',
        });
      } finally {
        setIsLoadingDocs(false);
        setIsLoadingMoreDocs(false);
      }
    },
    [user, toast]
  );

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.push('/');
      return;
    }

    void fetchDocumentsPage({ reset: true });
  }, [user, loading, router, fetchDocumentsPage]);

  useEffect(() => {
    const queryFromUrl = (searchParams.get('q') ?? '').trim();
    setSearchQuery(queryFromUrl);
    setSubmittedSearchQuery(queryFromUrl);
  }, [searchParams]);

  const filterOptions = useMemo(() => {
    const options: Record<FilterCategory, Set<string>> = {
      category: new Set(),
      tags: new Set(),
    };
    documents.forEach(docItem => {
      if (docItem.category && docItem.category !== 'Processing...') {
        const canonicalCategory = findCanonicalName(docItem.category, options.category);
        options.category.add(canonicalCategory);
      }
      if (docItem.tags && Array.isArray(docItem.tags)) {
        docItem.tags.forEach(tag => {
          const canonicalTag = findCanonicalName(tag, options.tags);
          options.tags.add(canonicalTag);
        });
      }
    });
    return {
      category: Array.from(options.category).sort(),
      tags: Array.from(options.tags).sort(),
    };
  }, [documents]);

  const handleFilterChange = useCallback((category: FilterCategory, value: string) => {
    setAiSearchResults(null);
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
    router.replace('/dashboard/documents');
  }, [router]);

  const handleAiSearch = useCallback(
    async (searchString: string) => {
      if (!user) return;

      setIsAiSearching(true);
      setSearchQuery(searchString);
      setSubmittedSearchQuery(searchString.trim());
      const nextParams = new URLSearchParams(searchParams.toString());
      nextParams.set('q', searchString.trim());
      router.replace(`/dashboard/documents?${nextParams.toString()}`);

      try {
        const idToken = await user.getIdToken();

        let candidateDocuments = documents;
        if (documents.length > AI_SEARCH_MAX_DOCUMENTS) {
          const preFilter = new Fuse(documents, {
            keys: ['displayName', 'documentType', 'owner', 'category', 'tags', 'keywords', 'summary'],
            threshold: 0.5,
            ignoreLocation: true,
          });
          const ranked = preFilter.search(searchString, { limit: AI_SEARCH_MAX_DOCUMENTS }).map(item => item.item);
          candidateDocuments = ranked.length > 0 ? ranked : documents.slice(0, AI_SEARCH_MAX_DOCUMENTS);
        }

        const documentsToSearch = candidateDocuments.map(docItem => ({
          id: docItem.id,
          displayName: docItem.displayName,
          documentType: docItem.documentType,
          owner: docItem.owner,
          category: docItem.category,
          tags: docItem.tags,
          summary: docItem.summary ?? null,
          keywords: docItem.keywords,
        }));

        const response = await fetch('/api/ai/search', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({
            query: searchString,
            documents: documentsToSearch,
          }),
        });

        if (!response.ok) {
          const payload = (await response.json().catch(() => ({}))) as { error?: string };
          throw new Error(payload.error || 'AI search request failed.');
        }

        const { documentIds } = (await response.json()) as { documentIds: string[] };
        const resultsMap = new Map(documents.map(docItem => [docItem.id, docItem]));
        const matchedDocs = documentIds
          .map(id => resultsMap.get(id))
          .filter((item): item is DocumentType => Boolean(item));
        setAiSearchResults(matchedDocs);
      } catch (error) {
        console.error('AI search failed:', error);
        toast({
          variant: 'destructive',
          title: 'AI_SEARCH_FAILED',
          description: error instanceof Error ? error.message : 'Could not perform AI search.',
        });
        setAiSearchResults([]);
      } finally {
        setIsAiSearching(false);
      }
    },
    [user, documents, toast, router, searchParams]
  );

  const handleDeleteDocument = async (docId: string) => {
    if (!user) return;

    try {
      const idToken = await user.getIdToken();
      const response = await fetch('/api/documents/delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ docId }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error || 'Delete request failed.');
      }

      const docToDelete = documents.find(item => item.id === docId);
      setDocuments(prev => prev.filter(item => item.id !== docId));
      setAiSearchResults(prev => (prev ? prev.filter(item => item.id !== docId) : prev));

      toast({
        title: 'DOCUMENT_DELETED',
        description: `${docToDelete?.fileName || 'Document'} has been removed.`,
      });
    } catch (error) {
      console.error('Error deleting document:', error);
      toast({
        variant: 'destructive',
        title: 'DELETION_FAILED',
        description: error instanceof Error ? error.message : 'Could not delete the document.',
      });
    }
  };

  const isRetryableDocument = useCallback((docItem: DocumentType) => {
    if (
      docItem.processingError ||
      docItem.category === 'Processing Failed' ||
      docItem.displayName === 'Processing Failed'
    ) {
      return true;
    }
    if (!docItem.isProcessing) return false;

    const uploadedAtMs = new Date(docItem.uploadedAt).getTime();
    if (!Number.isFinite(uploadedAtMs)) return false;

    return Date.now() - uploadedAtMs > PROCESSING_STALE_THRESHOLD_MS;
  }, []);

  const triggerDocumentProcessing = useCallback(
    async (docId: string, idToken: string) => {
      const response = await fetch('/api/documents/process', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ docId }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error || 'Failed to retry processing.');
      }
    },
    []
  );

  const retryProcessingForDocuments = useCallback(
    (docIds: string[]) => {
      if (!user) return;

      const uniqueDocIds = Array.from(
        new Set(docIds.filter(docId => docId && !retryingDocIds.has(docId)))
      );
      if (uniqueDocIds.length === 0) return;

      setRetryingDocIds(prev => {
        const next = new Set(prev);
        uniqueDocIds.forEach(docId => next.add(docId));
        return next;
      });
      if (uniqueDocIds.length > 1) {
        setIsRetryingBatch(true);
      }

      toast({
        title: 'RETRY_STARTED',
        description: `Retrying processing for ${uniqueDocIds.length} document(s).`,
      });

      void (async () => {
        let failures = 0;

        try {
          const idToken = await user.getIdToken();
          const queue = [...uniqueDocIds];

          const worker = async () => {
            while (queue.length > 0) {
              const nextDocId = queue.shift();
              if (!nextDocId) return;
              try {
                await triggerDocumentProcessing(nextDocId, idToken);
              } catch {
                failures += 1;
              }
            }
          };

          const workerCount = Math.min(PROCESSING_RETRY_CONCURRENCY, queue.length || 1);
          await Promise.all(Array.from({ length: workerCount }, () => worker()));
        } catch {
          failures = uniqueDocIds.length;
        } finally {
          setRetryingDocIds(prev => {
            const next = new Set(prev);
            uniqueDocIds.forEach(docId => next.delete(docId));
            return next;
          });
          setIsRetryingBatch(false);
        }

        if (failures > 0) {
          toast({
            variant: 'destructive',
            title: 'RETRY_PARTIAL_FAILURE',
            description: `${failures} document(s) failed to restart processing.`,
          });
        } else {
          toast({
            title: 'RETRY_COMPLETE',
            description: 'Processing retry finished for selected documents.',
          });
        }

        void fetchDocumentsPage({ reset: true });
      })();
    },
    [user, retryingDocIds, toast, triggerDocumentProcessing, fetchDocumentsPage]
  );

  const handleSearchSubmit = () => {
    const queryValue = searchQuery.trim();
    setSubmittedSearchQuery(queryValue);

    const nextParams = new URLSearchParams(searchParams.toString());
    if (queryValue) {
      nextParams.set('q', queryValue);
    } else {
      nextParams.delete('q');
    }
    const nextUrl = nextParams.size > 0 ? `/dashboard/documents?${nextParams.toString()}` : '/dashboard/documents';
    router.replace(nextUrl);
  };

  const displayedDocuments = useMemo(() => {
    let filtered = aiSearchResults ?? documents;
    const hasActiveFilters = Object.values(activeFilters).some(filterSet => filterSet.size > 0);

    if (hasActiveFilters) {
      filtered = filtered.filter(docItem =>
        Object.entries(activeFilters).every(([category, values]) => {
          if (values.size === 0) return true;
          const cat = category as FilterCategory;
          const docValue = docItem[cat];

          if (cat === 'tags') {
            if (!Array.isArray(docValue) || docValue.length === 0) return false;
            return Array.from(values).some(filterTag => {
              const fuse = new Fuse(docValue, { threshold: 0.2, ignoreLocation: true });
              return fuse.search(filterTag).length > 0;
            });
          }

          if (!docValue) return false;
          if (typeof docValue !== 'string') return false;
          const fuse = new Fuse(Array.from(values), { threshold: 0.2, ignoreLocation: true });
          return fuse.search(docValue).length > 0;
        })
      );
    }

    if (submittedSearchQuery) {
      const fuse = new Fuse(filtered, {
        keys: ['displayName', 'documentType', 'owner', 'category', 'tags', 'keywords', 'summary', 'fileName'],
        threshold: 0.4,
        includeScore: true,
      });
      filtered = fuse.search(submittedSearchQuery).map(result => result.item);
    }

    return filtered;
  }, [documents, submittedSearchQuery, activeFilters, aiSearchResults]);
  const retryableDocumentIds = useMemo(
    () => documents.filter(isRetryableDocument).map(docItem => docItem.id),
    [documents, isRetryableDocument]
  );

  if (loading || (!user && !loading)) return <FullScreenLoader />;

  const showLoader = isLoadingDocs || isAiSearching;
  const hasActiveManualFilters = Object.values(activeFilters).some(filterSet => filterSet.size > 0);
  const hasActiveSearchContext =
    hasActiveManualFilters || aiSearchResults !== null || submittedSearchQuery.length > 0;
  const showEmptyState =
    (displayedDocuments.length === 0 && hasActiveSearchContext) ||
    (documents.length === 0 && !isLoadingDocs);
  const shouldShowLoadMore =
    hasMoreDocs &&
    !showLoader &&
    !hasActiveManualFilters &&
    aiSearchResults === null &&
    submittedSearchQuery.length === 0;

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
        {retryableDocumentIds.length > 0 && (
          <div className="mb-4 flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[#0C0C0E] p-4">
            <div>
              <p className="text-sm font-semibold text-white">
                {retryableDocumentIds.length} document(s) are stuck or failed.
              </p>
              <p className="text-xs text-zinc-400">Run retry processing to recover them.</p>
            </div>
            <Button
              type="button"
              variant="outline"
              disabled={isRetryingBatch}
              onClick={() => retryProcessingForDocuments(retryableDocumentIds)}
              className="bg-white/5 border-white/10 hover:bg-white/10 text-zinc-300 hover:text-white rounded-xl"
            >
              {isRetryingBatch ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RotateCcw className="mr-2 h-4 w-4" />
              )}
              Retry Processing
            </Button>
          </div>
        )}
        {showLoader ? (
          <div className="flex items-center justify-center pt-20">
            <Loader2 className="h-16 w-16 animate-spin text-blue-600" />
          </div>
        ) : showEmptyState ? (
          <EmptyState
            onClear={clearFilters}
            isFiltered={aiSearchResults !== null || submittedSearchQuery.length > 0}
          />
        ) : (
          <>
            <DocumentList
              documents={displayedDocuments}
              onDelete={handleDeleteDocument}
              onRetryProcessing={docId => retryProcessingForDocuments([docId])}
              retryingDocIds={retryingDocIds}
            />
            {shouldShowLoadMore && (
              <div className="mt-8 flex justify-center">
                <Button
                  onClick={() => void fetchDocumentsPage({ reset: false, cursor: lastDoc })}
                  disabled={isLoadingMoreDocs}
                  variant="outline"
                  className="bg-white/5 border-white/10 hover:bg-white/10 text-zinc-300 hover:text-white rounded-xl"
                >
                  {isLoadingMoreDocs ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    'Load More Documents'
                  )}
                </Button>
              </div>
            )}
          </>
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
        onUploadComplete={() => {
          void fetchDocumentsPage({ reset: true });
        }}
      />
    </div>
  );
}

export default function AllDocumentsPage() {
  return (
    <Suspense fallback={<FullScreenLoader />}>
      <AllDocumentsPageContent />
    </Suspense>
  );
}
