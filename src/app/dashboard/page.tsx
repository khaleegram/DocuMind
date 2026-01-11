
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { useRouter } from 'next/navigation';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import type { Document as DocumentType } from '@/lib/types';
import { 
  Loader2, 
  Files, 
  Plus, 
  ArrowRight,
  Search,
  Box,
  ChevronRight,
  Zap,
  FileText,
  Clock
} from 'lucide-react';
import Image from 'next/image';
import { UploadDialog } from '@/components/dashboard/upload-dialog';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';

export default function DashboardHomePage() {
  const [user, loadingAuth] = useAuthState(auth);
  const router = useRouter();
  const [documents, setDocuments] = useState<DocumentType[]>([]);
  const [isLoadingDocs, setIsLoadingDocs] = useState(true);
  const [isUploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [userName, setUserName] = useState('');
  const [quickSearchQuery, setQuickSearchQuery] = useState('');

  useEffect(() => {
    if (loadingAuth) return;
    if (!user) {
      router.push('/');
      return;
    }
    setUserName(user.displayName?.split(' ')[0] || 'User');
    
    const q = query(
      collection(db, 'documents'), 
      where('userId', '==', user.uid),
      orderBy('uploadedAt', 'desc')
    );

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
        setDocuments(docs);
        setIsLoadingDocs(false);
    }, (error) => {
      console.error("Firestore snapshot error:", error);
      // If there's an index error, try fetching without ordering
      const qWithoutOrder = query(collection(db, 'documents'), where('userId', '==', user.uid));
      const unsubscribeWithoutOrder = onSnapshot(qWithoutOrder, (snapshot) => {
        const docs: DocumentType[] = [];
        snapshot.forEach((doc) => {
            const data = doc.data();
            docs.push({
                id: doc.id,
                ...data,
                uploadedAt: data.uploadedAt?.toDate ? data.uploadedAt.toDate().toISOString() : new Date().toISOString(),
            } as DocumentType);
        });
        // Manual sort on the client
        docs.sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
        setDocuments(docs);
        setIsLoadingDocs(false);
      });
      return () => unsubscribeWithoutOrder();
    });

    return () => unsubscribe();
  }, [user, loadingAuth, router]);

  const topDocuments = useMemo(() => documents.slice(0, 5), [documents]);

  const handleQuickSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (quickSearchQuery.trim()) {
      router.push(`/dashboard/documents?q=${encodeURIComponent(quickSearchQuery)}`);
    }
  };


  if (loadingAuth || isLoadingDocs) {
    return (
      <div className="flex h-screen items-center justify-center bg-black">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans selection:bg-blue-500/40">
      
      {/* --- TRIPLE ISLAND HEADER --- */}
      <header className="fixed top-0 left-0 right-0 z-50 p-4 md:top-6 md:px-8">
        <div className="relative flex items-center justify-between gap-4 max-w-4xl mx-auto">
            {/* LEFT: BRAND */}
            <div className="pointer-events-auto bg-[#111113] border border-white/10 p-2 rounded-2xl shadow-2xl flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20 shrink-0">
                  <Image src="/icon.png" alt="DocuMind Logo" width={24} height={24} />
                </div>
                <div className="pr-3 hidden md:block">
                    <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 font-bold leading-none mb-1">Secure</p>
                    <p className="text-sm font-black tracking-tight leading-none">VAULT OS</p>
                </div>
            </div>

            {/* CENTER: ACTIONS (Desktop only) */}
            <div className="absolute left-1/2 -translate-x-1/2 pointer-events-auto छिपे हुए md:flex items-center bg-[#111113]/90 backdrop-blur-xl border border-white/10 p-1.5 rounded-[1.2rem] shadow-2xl">
              <button 
                onClick={() => setUploadDialogOpen(true)}
                className="flex items-center gap-2 bg-white text-black hover:bg-zinc-200 px-4 py-2 rounded-[0.9rem] text-xs font-bold transition-all active:scale-95 shadow-lg"
              >
                <Plus size={16} strokeWidth={3} />
                <span>Upload New</span>
              </button>
            </div>

            {/* RIGHT: SEARCH */}
            <form onSubmit={handleQuickSearchSubmit} className="pointer-events-auto flex items-center bg-[#111113]/90 backdrop-blur-xl border border-white/10 p-1.5 rounded-2xl shadow-[0_0_20px_rgba(37,99,235,0.1)] transition-all focus-within:shadow-[0_0_30px_rgba(37,99,235,0.25)] focus-within:border-blue-500/40 w-full max-w-xs sm:w-auto">
               <Search size={16} className="ml-3 text-zinc-600" />
               <input 
                  type="text" 
                  placeholder="Quick search..."
                  value={quickSearchQuery}
                  onChange={(e) => setQuickSearchQuery(e.target.value)}
                  className="bg-transparent border-none outline-none px-3 py-1.5 text-xs font-medium w-full placeholder:text-zinc-700"
               />
            </form>
        </div>
      </header>

      {/* --- FLOATING ACTION BUTTON (Mobile only) --- */}
      <div className="fixed bottom-6 right-6 z-50 md:hidden">
          <button 
            onClick={() => setUploadDialogOpen(true)}
            className="flex items-center justify-center w-14 h-14 bg-white rounded-full shadow-2xl shadow-black/40 text-black active:scale-95 transition-transform"
          >
            <Plus size={24} strokeWidth={3} />
          </button>
      </div>


      <main className="max-w-4xl mx-auto px-6 pt-32 md:pt-40 pb-20 space-y-8">
        
        {/* --- HERO --- */}
        <div className="mb-12 space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-bold uppercase tracking-widest">
                <Zap size={14} className="fill-blue-400" /> System Active
            </div>
            <h1 className="text-5xl md:text-6xl font-black tracking-tighter">
                Welcome, <br/>
                <span className="text-zinc-500">{userName}.</span>
            </h1>
        </div>

        {/* --- TOP 5 LIST --- */}
        <Card className="bg-[#0C0C0E] border-white/5 rounded-[2.5rem] overflow-hidden border-t-white/10 shadow-2xl">
          <CardHeader className="p-8 pb-4">
            <div className="flex items-center gap-3">
              <Clock className="text-blue-500" size={20} />
              <CardTitle className="text-xl font-black uppercase tracking-tight">Recent Intelligence</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="px-8 pb-8 space-y-2">
              {topDocuments.map((doc) => (
                <div 
                  key={doc.id}
                  onClick={() => router.push(`/dashboard/document/${doc.id}`)}
                  className="flex items-center justify-between p-4 rounded-2xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.05] transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-4 overflow-hidden">
                    <div className="text-zinc-600 group-hover:text-blue-500 transition-colors shrink-0">
                      {doc.isProcessing ? <Loader2 className="animate-spin"/> : <FileText size={20}/> }
                    </div>
                    <div className="overflow-hidden">
                      <p className="text-sm font-bold text-zinc-200 group-hover:text-white transition-colors truncate">{doc.owner || doc.fileName}</p>
                      <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest">
                        {doc.uploadedAt ? format(new Date(doc.uploadedAt), 'MMM dd, HH:mm') : 'Recently'}
                      </p>
                    </div>
                  </div>
                  <ChevronRight size={16} className="text-zinc-800 group-hover:text-white transition-all shrink-0 ml-2" />
                </div>
              ))}
          </CardContent>
        </Card>

        {/* --- VAULT CARD (RESTORED DESIGN) --- */}
        <div className="relative group">
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
                    
                    <div className="text-right shrink-0">
                        <p className="text-6xl font-black text-white tabular-nums leading-none tracking-tighter">{documents.length}</p>
                        <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-[0.2em] mt-2">Verified Files</p>
                    </div>
                </CardHeader>
                
                <CardContent className="p-10 pt-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
      </main>

      <UploadDialog isOpen={isUploadDialogOpen} setIsOpen={setUploadDialogOpen} />
    </div>
  );
}
