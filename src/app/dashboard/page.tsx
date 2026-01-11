
'use client';

import React, { useState, useEffect } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { useRouter } from 'next/navigation';
import { collection, query, where, onSnapshot, limit, orderBy } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import type { Document as DocumentType } from '@/lib/types';
import { 
  Loader2, 
  Files, 
  Plus, 
  ArrowRight,
  Search,
  Box,
  ChevronRight
} from 'lucide-react';
import Image from 'next/image';
import { UploadDialog } from '@/components/dashboard/upload-dialog';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import RecentDocuments from '@/components/dashboard/recent-documents';

export default function DashboardHomePage() {
  const [user, loadingAuth] = useAuthState(auth);
  const router = useRouter();
  const [documents, setDocuments] = useState<DocumentType[]>([]);
  const [recentDocuments, setRecentDocuments] = useState<DocumentType[]>([]);
  const [isLoadingDocs, setIsLoadingDocs] = useState(true);
  const [isUploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [userName, setUserName] = useState('');

  useEffect(() => {
    if (loadingAuth) return;
    if (!user) {
      router.push('/');
      return;
    }
    setUserName(user.displayName?.split(' ')[0] || 'User');
    
    // Query for all documents to get the total count
    const allDocsQuery = query(collection(db, 'documents'), where('userId', '==', user.uid));
    const unsubscribeAll = onSnapshot(allDocsQuery, (querySnapshot) => {
        const docs: DocumentType[] = [];
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            docs.push({ id: doc.id, ...data } as DocumentType);
        });
        setDocuments(docs);
        setIsLoadingDocs(false);
    });

    // Query for the 5 most recent documents
    const recentDocsQuery = query(
      collection(db, 'documents'), 
      where('userId', '==', user.uid),
      orderBy('uploadedAt', 'desc'),
      limit(5)
    );
    const unsubscribeRecent = onSnapshot(recentDocsQuery, (querySnapshot) => {
        const rDocs: DocumentType[] = [];
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            rDocs.push({
                id: doc.id,
                ...data,
                uploadedAt: data.uploadedAt?.toDate ? data.uploadedAt.toDate().toISOString() : new Date().toISOString(),
            } as DocumentType);
        });
        setRecentDocuments(rDocs);
    }, (error) => {
        // This is the error handler for the snapshot listener.
        // It's likely the composite index is missing.
        console.error("Firestore error fetching recent documents:", error);
        
        // As a fallback, fetch without ordering and sort on the client.
        const fallbackQuery = query(
            collection(db, 'documents'),
            where('userId', '==', user.uid),
            limit(5)
        );
        onSnapshot(fallbackQuery, (snapshot) => {
            const fallbackDocs: DocumentType[] = [];
            snapshot.forEach((doc) => {
                const data = doc.data();
                fallbackDocs.push({
                    id: doc.id,
                    ...data,
                    uploadedAt: data.uploadedAt?.toDate ? data.uploadedAt.toDate().toISOString() : new Date().toISOString(),
                } as DocumentType);
            });
            // Sort manually on the client
            fallbackDocs.sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
            setRecentDocuments(fallbackDocs);
        });
    });

    return () => {
      unsubscribeAll();
      unsubscribeRecent();
    }
  }, [user, loadingAuth, router]);

  if (loadingAuth || isLoadingDocs) {
    return (
      <div className="flex h-screen items-center justify-center bg-black">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans selection:bg-blue-500/40">
      
      {/* --- DUAL ISLAND SYSTEM --- */}
      <div className="fixed top-6 left-0 right-0 z-50 flex items-center justify-between px-8 pointer-events-none">
        
        {/* LEFT ISLAND: APP ICON */}
        <div className="pointer-events-auto bg-[#111113] border border-white/10 p-2 rounded-2xl shadow-2xl flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Image src="/icon.png" alt="DocuMind Logo" width={28} height={28} />
            </div>
            <div className="pr-3 hidden md:block">
                <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 font-bold leading-none mb-1">Secure</p>
                <p className="text-sm font-black tracking-tight leading-none">VAULT OS</p>
            </div>
        </div>

        {/* CENTER ISLAND: ACTIONS */}
        <div className="absolute left-1/2 -translate-x-1/2 pointer-events-auto flex items-center bg-[#111113]/90 backdrop-blur-xl border border-white/10 p-1.5 rounded-[1.2rem] shadow-2xl">
          <button 
            onClick={() => setUploadDialogOpen(true)}
            className="flex items-center gap-2 bg-white text-black hover:bg-zinc-200 px-4 py-2 rounded-[0.9rem] text-xs font-bold transition-all active:scale-95 shadow-lg"
          >
            <Plus size={16} strokeWidth={3} />
            <span>Upload New</span>
          </button>
        </div>

        {/* SPACER FOR SYMMETRY */}
        <div className="w-[120px] hidden md:block"></div>
      </div>

      <main className="max-w-4xl mx-auto px-6 pt-40 pb-20">
        
        {/* --- HEADER --- */}
        <div className="mb-16 space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-bold uppercase tracking-widest">
                <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                </span>
                System Active
            </div>
            <h1 className="text-6xl font-black tracking-tighter">
                Welcome, <br/>
                <span className="text-zinc-500">{userName}.</span>
            </h1>
        </div>

        {/* --- MAIN DASHBOARD CARD --- */}
        <div className="relative group mb-16">
            {/* Ambient Background Glow */}
            <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-[3rem] blur opacity-10 group-hover:opacity-20 transition duration-1000"></div>
            
            <Card className="relative bg-[#0C0C0E] border-white/5 rounded-[2.8rem] shadow-2xl overflow-hidden border-t-white/10">
                <CardHeader className="p-10 pb-6 flex flex-row items-end justify-between">
                    <div className="space-y-2">
                        <div className="p-3 bg-zinc-800/50 w-fit rounded-2xl border border-white/5 text-zinc-400">
                            <Box size={28} />
                        </div>
                        <CardTitle className="text-3xl font-black tracking-tight pt-4">Active Documents</CardTitle>
                        <CardDescription className="text-zinc-500 text-lg font-medium">
                            Encrypted and synced across your devices.
                        </CardDescription>
                    </div>
                    
                    <div className="text-right">
                        <p className="text-6xl font-black text-white tabular-nums leading-none tracking-tighter">{documents.length}</p>
                        <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-[0.2em] mt-2">Verified Files</p>
                    </div>
                </CardHeader>
                
                <CardContent className="p-10 pt-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Quick Nav 1 */}
                        <button 
                            onClick={() => router.push('/dashboard/documents')}
                            className="flex items-center justify-between p-6 bg-white/[0.03] border border-white/5 rounded-3xl hover:bg-white/[0.08] hover:border-white/10 transition-all group/btn"
                        >
                            <div className="flex items-center gap-4 text-left">
                                <div className="p-2 bg-blue-600/20 text-blue-500 rounded-xl">
                                    <Files size={24} />
                                </div>
                                <div>
                                    <p className="font-bold text-white">Full Library</p>
                                    <p className="text-xs text-zinc-500">Manage all records</p>
                                </div>
                            </div>
                            <ChevronRight className="text-zinc-700 group-hover/btn:text-white transition-colors" />
                        </button>

                        {/* Quick Nav 2 */}
                        <button 
                            onClick={() => router.push('/dashboard/documents')}
                            className="flex items-center justify-between p-6 bg-white/[0.03] border border-white/5 rounded-3xl hover:bg-white/[0.08] hover:border-white/10 transition-all group/btn"
                        >
                            <div className="flex items-center gap-4 text-left">
                                <div className="p-2 bg-zinc-800 text-zinc-400 rounded-xl">
                                    <Search size={24} />
                                </div>
                                <div>
                                    <p className="font-bold text-white">Advanced Filter</p>
                                    <p className="text-xs text-zinc-500">Locate by metadata</p>
                                </div>
                            </div>
                            <ChevronRight className="text-zinc-700 group-hover/btn:text-white transition-colors" />
                        </button>
                    </div>

                    <Button 
                        onClick={() => router.push('/dashboard/documents')}
                        className="w-full mt-8 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl h-16 text-lg font-black transition-all active:scale-[0.98]"
                    >
                        View All Vault Records
                        <ArrowRight className="ml-3 h-5 w-5" />
                    </Button>
                </CardContent>
            </Card>
        </div>

        {/* --- RECENT DOCUMENTS --- */}
        <RecentDocuments documents={recentDocuments} />

      </main>

      <UploadDialog 
        isOpen={isUploadDialogOpen}
        setIsOpen={setUploadDialogOpen}
      />
    </div>
  );
}

    

    