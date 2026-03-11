'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { useAuthState } from 'react-firebase-hooks/auth';
import type { Document as DocumentType } from '@/lib/types';
import { parseDocumentFromFirestore } from '@/lib/types';
import {
  Loader2,
  ArrowLeft,
  Download,
  Send,
  User,
  Bot,
  Sparkles,
  ExternalLink,
  Image as ImageIcon,
  Files,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import Link from 'next/link';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import Header from '@/components/dashboard/header';
import { UploadDialog } from '@/components/dashboard/upload-dialog';
import Image from 'next/image';
import { useToast } from '@/hooks/use-toast';
import { downloadDocumentFile } from '@/lib/download-document';
import { PdfPlaceholder, type DocumentPlaceholderKind } from '@/components/dashboard/pdf-placeholder';
import { PdfInlineViewer } from '@/components/dashboard/pdf-inline-viewer';

type Message = {
  sender: 'user' | 'ai';
  text: string;
};

type ChatApiResponse = { answer: string };
type SuggestionsApiResponse = { questions: string[] };

const OFFICE_MIME_KIND_MAP: Record<string, DocumentPlaceholderKind> = {
  'application/pdf': 'pdf',
  'application/msword': 'docx',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.ms-excel': 'excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'excel',
  'application/vnd.ms-powerpoint': 'powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'powerpoint',
};

const inferPlaceholderKind = (mimeType: string, fileName: string): DocumentPlaceholderKind | null => {
  const mapped = OFFICE_MIME_KIND_MAP[mimeType];
  if (mapped) return mapped;

  const normalizedFileName = fileName.toLowerCase();
  if (normalizedFileName.endsWith('.pdf')) return 'pdf';
  if (normalizedFileName.endsWith('.doc') || normalizedFileName.endsWith('.docx')) return 'docx';
  if (normalizedFileName.endsWith('.xls') || normalizedFileName.endsWith('.xlsx')) return 'excel';
  if (normalizedFileName.endsWith('.ppt') || normalizedFileName.endsWith('.pptx')) return 'powerpoint';
  return null;
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
  const [mobileView, setMobileView] = useState<'chat' | 'review'>('chat');
  const [downloadingSourceIndex, setDownloadingSourceIndex] = useState<number | null>(null);
  const { toast } = useToast();

  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const initializedDocIdRef = useRef<string | null>(null);

  const authorizedPost = useCallback(
    async <T,>(url: string, payload: Record<string, unknown>): Promise<T> => {
      const activeUser = auth.currentUser;
      if (!activeUser) {
        throw new Error('You must be signed in.');
      }

      const idToken = await activeUser.getIdToken();
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify(payload),
      });

      const json = (await response.json().catch(() => ({}))) as T & { error?: string };
      if (!response.ok) {
        throw new Error(json.error || 'Request failed.');
      }

      return json;
    },
    []
  );

  const loadSuggestedQuestions = useCallback(
    async (documentId: string) => {
      setIsLoadingSuggestions(true);
      try {
        const result = await authorizedPost<SuggestionsApiResponse>('/api/ai/suggestions', {
          documentId,
        });
        setSuggestedQuestions(result.questions ?? []);
      } catch (error) {
        console.error('Error generating suggested questions:', error);
        setSuggestedQuestions([]);
      } finally {
        setIsLoadingSuggestions(false);
      }
    },
    [authorizedPost]
  );

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

    setIsLoadingDoc(true);

    const docRef = doc(db, 'documents', id);
    const unsubscribe = onSnapshot(docRef, docSnap => {
      if (!docSnap.exists()) {
        router.push('/dashboard');
        setIsLoadingDoc(false);
        return;
      }

      let docData: DocumentType;
      try {
        docData = parseDocumentFromFirestore(docSnap.id, docSnap.data() as Record<string, unknown>);
      } catch (error) {
        console.error(`Invalid document payload for ${docSnap.id}:`, error);
        router.push('/dashboard');
        setIsLoadingDoc(false);
        return;
      }

      if (docData.userId !== user.uid) {
        router.push('/dashboard');
        setIsLoadingDoc(false);
        return;
      }

      setDocument(docData);

      if (docData.isProcessing) {
        setMessages([
          {
            sender: 'ai',
            text: "Hello! I'm still analyzing this document. I'll be ready to chat once processing is complete.",
          },
        ]);
        setSuggestedQuestions([]);
        initializedDocIdRef.current = null;
      } else if (initializedDocIdRef.current !== docData.id) {
        initializedDocIdRef.current = docData.id;
        setMessages([
          {
            sender: 'ai',
            text: `Hello! I'm ready to answer questions about "${docData.displayName}". What would you like to know?`,
          },
        ]);
        if (docData.textContent.trim()) {
          void loadSuggestedQuestions(docData.id);
        } else {
          setSuggestedQuestions([]);
        }
      }

      setIsLoadingDoc(false);
    });

    return () => unsubscribe();
  }, [user, loadingAuth, router, id, loadSuggestedQuestions]);

  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTo({
        top: scrollAreaRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, [messages]);

  const submitQuery = async (queryText: string) => {
    if (!queryText.trim() || !document || !document.textContent || document.isProcessing) return;

    const userMessage: Message = { sender: 'user', text: queryText };
    setMessages(prev => [...prev, userMessage]);
    setSuggestedQuestions([]);
    setIsAnswering(true);

    try {
      const result = await authorizedPost<ChatApiResponse>('/api/ai/chat', {
        documentId: document.id,
        question: queryText,
      });
      const aiMessage: Message = { sender: 'ai', text: result.answer };
      setMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      console.error('Error chatting with document:', error);
      const errorMessage: Message = {
        sender: 'ai',
        text:
          error instanceof Error
            ? `Sorry, I encountered an error: ${error.message}`
            : 'Sorry, I encountered an error. Please try again.',
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsAnswering(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    await submitQuery(input);
    setInput('');
  };

  const handleSuggestionClick = async (question: string) => {
    await submitQuery(question);
  };

  if (isLoadingDoc || loadingAuth) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#050505]">
        <Loader2 className="h-16 w-16 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!document) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#050505] px-6">
        <div className="max-w-md text-center rounded-3xl border border-white/10 bg-[#0C0C0E] p-8">
          <p className="text-lg font-bold text-white">Document not found.</p>
          <p className="mt-2 text-sm text-zinc-400">
            The document may have been deleted or you may not have access.
          </p>
          <Button asChild className="mt-6 bg-blue-600 hover:bg-blue-500 text-white">
            <Link href="/dashboard/documents">Back to All Documents</Link>
          </Button>
        </div>
      </div>
    );
  }

  const sourceFiles =
    document.sourceFiles.length > 0
      ? document.sourceFiles
      : [
          {
            fileName: document.fileName,
            fileUrl: document.fileUrl,
            mimeType: document.mimeType,
            storagePath: document.storagePath,
          },
        ];
  const activeSource = sourceFiles[0];

  const handleDownloadSource = async (sourceIndex: number) => {
    if (!document) return;
    if (downloadingSourceIndex !== null) return;

    const targetFileName = sourceFiles[sourceIndex]?.fileName || document.fileName;
    setDownloadingSourceIndex(sourceIndex);
    try {
      await downloadDocumentFile({
        docId: document.id,
        sourceIndex,
        fallbackFileName: targetFileName,
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'DOWNLOAD_FAILED',
        description: error instanceof Error ? error.message : 'Could not download this file.',
      });
    } finally {
      setDownloadingSourceIndex(null);
    }
  };

  const SingleFileDownloadAction = () =>
    sourceFiles.length === 1 ? (
      <div className="mb-3 flex justify-end">
        <Button
          type="button"
          variant="outline"
          onClick={() => void handleDownloadSource(0)}
          disabled={downloadingSourceIndex !== null}
          className="bg-white/5 border-white/10 hover:bg-white/10 text-zinc-300 hover:text-white"
        >
          {downloadingSourceIndex === 0 ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Download className="mr-2 h-4 w-4" />
          )}
          Download
        </Button>
      </div>
    ) : null;

  const GroupedFileActions = () =>
    sourceFiles.length > 1 ? (
      <div className="mb-3 rounded-xl border border-white/10 bg-[#111113] px-3 py-2">
        <div className="flex items-center gap-2 text-xs text-zinc-400">
          <Files className="h-4 w-4 text-blue-400" />
          <span>{sourceFiles.length} files in this grouped document</span>
        </div>
        <div className="mt-2 space-y-2">
          {sourceFiles.map((file, index) => (
            <div key={`${file.storagePath}-${index}`} className="flex items-center justify-between gap-2 rounded-lg bg-white/[0.03] px-2 py-2">
              <span className="text-xs text-zinc-300 truncate">File {index + 1}</span>
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  asChild
                  size="sm"
                  variant="outline"
                  className="bg-white/5 border-white/10 hover:bg-white/10 text-zinc-300 hover:text-white"
                >
                  <a href={file.fileUrl} target="_blank" rel="noopener noreferrer">
                    Open
                  </a>
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => void handleDownloadSource(index)}
                  disabled={downloadingSourceIndex !== null}
                  className="bg-white/5 border-white/10 hover:bg-white/10 text-zinc-300 hover:text-white"
                >
                  {downloadingSourceIndex === index ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Download className="mr-1 h-4 w-4" />
                      Download
                    </>
                  )}
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    ) : null;

  const DocumentViewer = () => {
    if (activeSource.mimeType === 'application/pdf') {
      return (
        <div className="w-full h-full p-3 bg-[#0C0C0E] rounded-3xl border border-white/5">
          <SingleFileDownloadAction />
          <GroupedFileActions />
          <PdfInlineViewer fileUrl={activeSource.fileUrl} fileName={activeSource.fileName} />
        </div>
      );
    }

    if (activeSource.mimeType.startsWith('image/')) {
      return (
        <div className="w-full h-full p-3 rounded-3xl overflow-hidden border border-white/5 bg-[#0C0C0E]">
          <SingleFileDownloadAction />
          <GroupedFileActions />
          <div className="relative w-full h-full rounded-2xl overflow-hidden bg-[#111113]">
            <Image src={activeSource.fileUrl} alt={activeSource.fileName} fill className="object-contain" />
          </div>
        </div>
      );
    }

    const placeholderKind = inferPlaceholderKind(activeSource.mimeType, activeSource.fileName);

    return (
      <div className="w-full h-full p-8 flex flex-col items-center justify-center bg-[#0C0C0E] rounded-3xl border border-white/5">
        <SingleFileDownloadAction />
        <GroupedFileActions />
        {placeholderKind && (
          <div className="mb-4 w-full max-w-[260px]">
            <PdfPlaceholder
              kind={placeholderKind}
              pageCount={document.pageCount}
              className="w-full rounded-2xl"
            />
          </div>
        )}
        <Alert className="bg-[#111113] border-blue-500/20 text-blue-400">
          <ImageIcon className="h-4 w-4 !text-blue-400" />
          <AlertTitle>Preview Unavailable</AlertTitle>
          <AlertDescription className="text-blue-400/80">
            This file type cannot be previewed inline.
          </AlertDescription>
        </Alert>
        <Button asChild className="mt-4 bg-blue-600 hover:bg-blue-500 text-white font-bold">
          <a href={activeSource.fileUrl} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="mr-2" />
            Open Original File
          </a>
        </Button>
      </div>
    );
  };

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
              <div
                key={index}
                className={`flex items-start gap-3 ${message.sender === 'user' ? 'justify-end' : ''}`}
              >
                {message.sender === 'ai' && (
                  <div className="w-8 h-8 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
                    <Bot size={16} />
                  </div>
                )}
                <div
                  className={`rounded-2xl px-4 py-3 text-sm max-w-[80%] ${
                    message.sender === 'ai'
                      ? 'bg-[#111113] border border-white/5 text-zinc-300'
                      : 'bg-blue-600 text-white'
                  }`}
                >
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
                {suggestedQuestions.map((question, index) => (
                  <Button
                    key={index}
                    variant="outline"
                    size="sm"
                    onClick={() => handleSuggestionClick(question)}
                    disabled={isAnswering}
                    className="bg-white/5 border-white/10 hover:bg-white/10 rounded-lg text-zinc-300 hover:text-white"
                  >
                    {question}
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
              onChange={e => setInput(e.target.value)}
              placeholder="Ask a question..."
              autoComplete="off"
              disabled={isAnswering || document.isProcessing}
              className="bg-[#111113] border-white/10 rounded-xl h-12 focus-visible:ring-blue-500"
            />
            <Button
              type="submit"
              size="icon"
              className="h-12 w-12 shrink-0 bg-blue-600 hover:bg-blue-500 rounded-xl"
              disabled={!input.trim() || isAnswering || document.isProcessing}
            >
              <Send className="h-5 w-5" />
              <span className="sr-only">Send</span>
            </Button>
          </form>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans selection:bg-blue-500/40">
      <Header
        onUploadClick={() => setUploadDialogOpen(true)}
        title={document.displayName}
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
        <div className="md:hidden max-w-7xl mx-auto mb-4">
          <div className="grid grid-cols-2 gap-2 rounded-2xl border border-white/10 bg-[#0C0C0E] p-1">
            <button
              type="button"
              onClick={() => setMobileView('chat')}
              className={`h-10 rounded-xl text-sm font-bold transition-colors ${
                mobileView === 'chat'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white/5 text-zinc-300 hover:bg-white/10'
              }`}
            >
              Chat
            </button>
            <button
              type="button"
              onClick={() => setMobileView('review')}
              className={`h-10 rounded-xl text-sm font-bold transition-colors ${
                mobileView === 'review'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white/5 text-zinc-300 hover:bg-white/10'
              }`}
            >
              Document Review
            </button>
          </div>
        </div>
        <div className="h-[calc(100vh-200px)] md:hidden flex flex-col">
          {mobileView === 'chat' ? (
            <ChatPanel />
          ) : (
            <div className="h-full overflow-hidden p-1 bg-[#0C0C0E] rounded-3xl border border-white/5">
              <DocumentViewer />
            </div>
          )}
        </div>
      </main>
      <UploadDialog isOpen={isUploadDialogOpen} setIsOpen={setUploadDialogOpen} />
    </div>
  );
}
