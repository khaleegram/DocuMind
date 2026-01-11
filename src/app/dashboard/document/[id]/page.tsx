
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { useAuthState } from 'react-firebase-hooks/auth';
import type { Document as DocumentType } from '@/lib/types';
import { Loader2, ArrowLeft, Send, User, Bot, Sparkles, PanelLeft, FileWarning, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import Link from 'next/link';
import { chatWithDocument } from '@/ai/flows/chat-with-document';
import { generateSuggestedQuestions } from '@/ai/flows/generate-suggested-questions';
import { Skeleton } from '@/components/ui/skeleton';
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import Header from '@/components/dashboard/header';
import { UploadDialog } from '@/components/dashboard/upload-dialog';

type Message = {
  sender: 'user' | 'ai';
  text: string;
};

export default function DocumentChatPage() {
  const [user, loadingAuth] = useAuthState(auth);
  const router = useRouter();
  const params = useParams();
  const { id } = params;

  const [document, setDocument] = useState<DocumentType | null>(null);
  const [isLoadingDoc, setIsLoadingDoc] = useState(true);
  const [isUploadDialogOpen, setUploadDialogOpen] = useState(false);
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isAnswering, setIsAnswering] = useState(false);
  const [suggestedQuestions, setSuggestedQuestions] = useState<string[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  
  const scrollAreaRef = useRef<HTMLDivElement>(null);


  useEffect(() => {
    if (loadingAuth) return;
    if (!user) {
      router.push('/');
      return;
    }

    if (typeof id !== 'string') {
        router.push('/dashboard');
        return;
    }

    const docRef = doc(db, 'documents', id);
    const unsubscribe = onSnapshot(docRef, async (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        const docData = {
            id: docSnap.id,
            ...data,
            uploadedAt: data.uploadedAt?.toDate().toISOString() || new Date().toISOString(),
        } as DocumentType;

        if (docData.userId !== user.uid) {
            router.push('/dashboard');
            return;
        }

        setDocument(docData);

        if (docData.isProcessing) {
          setMessages([{ sender: 'ai', text: "Hello! I'm still analyzing this document. I'll be ready to chat once the processing is complete." }]);
        } else if (messages.length === 0) {
           setMessages([{ sender: 'ai', text: `Hello! I'm ready to answer questions about "${docData.owner}". What would you like to know?` }]);
           if (docData.textContent) {
              setIsLoadingSuggestions(true);
              try {
                const { questions } = await generateSuggestedQuestions({ documentText: docData.textContent });
                setSuggestedQuestions(questions);
              } catch (error) {
                console.error("Error generating suggested questions:", error);
                setSuggestedQuestions([]);
              } finally {
                setIsLoadingSuggestions(false);
              }
           }
        }

      } else {
        router.push('/dashboard');
      }
      setIsLoadingDoc(false);
    });

    return () => unsubscribe();
  }, [user, loadingAuth, router, id, messages.length]);

  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTo({
        top: scrollAreaRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, [messages]);

  const submitQuery = async (query: string) => {
    if (!query.trim() || !document || !document.textContent || document.isProcessing) return;

    const userMessage: Message = { sender: 'user', text: query };
    setMessages((prev) => [...prev, userMessage]);
    setSuggestedQuestions([]); // Hide suggestions after user asks a question
    setIsAnswering(true);

    try {
        const { answer } = await chatWithDocument({
            documentText: document.textContent,
            question: query,
        });
        const aiMessage: Message = { sender: 'ai', text: answer };
        setMessages((prev) => [...prev, aiMessage]);
    } catch (error) {
        console.error("Error chatting with document:", error);
        const errorMessage: Message = { sender: 'ai', text: "Sorry, I encountered an error. Please try again." };
        setMessages((prev) => [...prev, errorMessage]);
    } finally {
        setIsAnswering(false);
    }
  }

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    await submitQuery(input);
    setInput('');
  };

  const handleSuggestionClick = async (question: string) => {
    await submitQuery(question);
  }

  if (isLoadingDoc || loadingAuth) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#050505]">
        <Loader2 className="h-16 w-16 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!document) {
     return (
      <div className="flex h-screen items-center justify-center bg-[#050505]">
        <p>Document not found.</p>
      </div>
    );
  }
  
  const DocumentViewer = () => {
     if (document.mimeType === 'application/pdf') {
      return (
        <div className="w-full h-full p-8 flex flex-col items-center justify-center bg-[#0C0C0E] rounded-3xl border border-white/5">
            <Alert className="bg-[#111113] border-blue-500/20 text-blue-400">
                <FileWarning className="h-4 w-4 !text-blue-400" />
                <AlertTitle>PDF Preview Unavailable</AlertTitle>
                <AlertDescription className="text-blue-400/80">
                    Directly viewing PDFs is not supported. You can view the document by opening it in a new tab.
                </AlertDescription>
            </Alert>
             <Button asChild className="mt-4 bg-blue-600 hover:bg-blue-500 text-white font-bold">
                <a href={document.fileUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="mr-2" />
                  Open PDF in New Tab
                </a>
            </Button>
        </div>
      )
    }
    return <iframe src={document.fileUrl} className="w-full h-full border-0 rounded-3xl" title={document.fileName} />
  }

  const ChatPanel = () => (
     <div className="flex-1 flex flex-col h-full bg-[#0C0C0E] border border-white/5 rounded-3xl overflow-hidden">
        <div className="p-6 border-b border-white/5">
          <h2 className="text-xl font-black tracking-tight text-white">INTELLIGENCE AGENT</h2>
          <p className="text-sm text-zinc-500">Ask questions about this document.</p>
        </div>
        <div className="flex-1 flex flex-col overflow-hidden p-6">
          <ScrollArea className="flex-1 -mx-6 px-6" ref={scrollAreaRef}>
            <div className="space-y-6 pb-4">
              {messages.map((message, index) => (
                <div key={index} className={`flex items-start gap-3 ${message.sender === 'user' ? 'justify-end' : ''}`}>
                  {message.sender === 'ai' && (
                     <div className="w-8 h-8 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
                        <Bot size={16}/>
                     </div>
                  )}
                  <div className={`rounded-2xl px-4 py-3 text-sm max-w-[80%] ${message.sender === 'ai' ? 'bg-[#111113] border border-white/5 text-zinc-300' : 'bg-blue-600 text-white'}`}>
                    <p>{message.text}</p>
                  </div>
                  {message.sender === 'user' && (
                    <div className="w-8 h-8 rounded-full bg-zinc-800 border border-white/10 flex items-center justify-center text-zinc-400 shrink-0">
                        <User size={16} />
                     </div>
                  )}
                </div>
              ))}
               {isAnswering && (
                  <div className="flex items-start gap-3">
                     <div className="w-8 h-8 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
                        <Loader2 className="h-4 w-4 animate-spin" />
                     </div>
                    <div className="rounded-2xl px-4 py-3 text-sm bg-[#111113] border border-white/5 text-zinc-300 flex items-center">
                      Thinking...
                    </div>
                  </div>
                )}
            </div>
          </ScrollArea>
           {(isLoadingSuggestions || suggestedQuestions.length > 0) && (
            <div className="mt-4 border-t border-white/5 pt-4">
              <div className="flex items-center gap-2 mb-3">
                 <Sparkles size={14} className="text-blue-500" />
                 <h4 className="text-xs font-bold uppercase tracking-widest text-zinc-500">Suggestions</h4>
              </div>
              {isLoadingSuggestions ? (
                <div className="space-y-2">
                  <Skeleton className="h-9 w-full rounded-xl bg-white/5" />
                  <Skeleton className="h-9 w-2/3 rounded-xl bg-white/5" />
                  <Skeleton className="h-9 w-3/4 rounded-xl bg-white/5" />
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {suggestedQuestions.map((q, i) => (
                    <Button key={i} variant="outline" size="sm" onClick={() => handleSuggestionClick(q)} disabled={isAnswering} className="bg-white/5 border-white/10 hover:bg-white/10 rounded-lg text-zinc-300 hover:text-white">
                      {q}
                    </Button>
                  ))}
                </div>
              )}
            </div>
           )}
          <div className="mt-4 border-t border-white/5 pt-4">
            <form onSubmit={handleSendMessage} className="flex items-center gap-3">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask a question..."
                autoComplete="off"
                disabled={isAnswering || document.isProcessing}
                className="bg-[#111113] border-white/10 rounded-xl h-12 focus-visible:ring-blue-500"
              />
              <Button type="submit" size="icon" className="h-12 w-12 shrink-0 bg-blue-600 hover:bg-blue-500 rounded-xl" disabled={!input.trim() || isAnswering || document.isProcessing}>
                <Send className="h-5 w-5" />
                <span className="sr-only">Send</span>
              </Button>
            </form>
          </div>
        </div>
      </div>
  )

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans selection:bg-blue-500/40">
      <Header
        onUploadClick={() => setUploadDialogOpen(true)}
        title={document.owner}
        showSearch={false}
        showAiSearch={false}
      />
       <nav className="p-4 md:px-8">
         <div className="max-w-7xl mx-auto">
            <Button asChild variant="ghost" className="text-zinc-400 hover:text-white hover:bg-white/5 -ml-4">
              <Link href="/dashboard/documents">
                <ArrowLeft />
                <span>Back to All Documents</span>
              </Link>
            </Button>
         </div>
       </nav>

      <main className="flex-1 overflow-hidden px-4 md:px-8 pb-8">
        <div className="h-full hidden md:grid md:grid-cols-2 gap-6 max-w-7xl mx-auto">
          <div className="h-full overflow-hidden p-4 bg-[#0C0C0E] rounded-3xl border border-white/5">
             <DocumentViewer />
          </div>
          <div className="h-full flex flex-col">
            <ChatPanel />
          </div>
        </div>
         <div className="h-[calc(100vh-140px)] md:hidden flex flex-col">
            <ChatPanel />
         </div>
      </main>

       <div className="fixed bottom-6 right-6 z-50 md:hidden">
            <Sheet>
                <SheetTrigger asChild>
                    <Button variant="outline" size="icon" className="w-14 h-14 rounded-full bg-white/10 border-white/20 backdrop-blur-lg text-white">
                        <PanelLeft />
                        <span className="sr-only">View Document</span>
                    </Button>
                </SheetTrigger>
                <SheetContent side="bottom" className="h-[80vh] flex flex-col bg-[#050505] text-white border-t border-white/10 p-0">
                     <SheetHeader className="p-4 border-b border-white/10 text-left">
                        <SheetTitle className="text-white">Document Viewer</SheetTitle>
                        <SheetDescription className="text-zinc-400">
                            {document.fileName}
                        </SheetDescription>
                    </SheetHeader>
                    <div className="flex-1 overflow-y-auto p-4">
                        <div className="h-full">
                            <DocumentViewer />
                        </div>
                    </div>
                </SheetContent>
            </Sheet>
       </div>
      <UploadDialog isOpen={isUploadDialogOpen} setIsOpen={setUploadDialogOpen} />
    </div>
  );
}
