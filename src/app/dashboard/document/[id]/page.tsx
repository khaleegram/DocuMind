'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { useAuthState } from 'react-firebase-hooks/auth';
import type { Document as DocumentType } from '@/lib/types';
import { Loader2, ArrowLeft, Send, User, Bot } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import Link from 'next/link';
import { chatWithDocument } from '@/ai/flows/chat-with-document';

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
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isAnswering, setIsAnswering] = useState(false);
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
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
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

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !document || !document.textContent || document.isProcessing) return;

    const userMessage: Message = { sender: 'user', text: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsAnswering(true);

    try {
        const { answer } = await chatWithDocument({
            documentText: document.textContent,
            question: input,
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
  };

  if (isLoadingDoc || loadingAuth) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-16 w-16 animate-spin text-primary" />
      </div>
    );
  }

  if (!document) {
     return (
      <div className="flex h-screen items-center justify-center">
        <p>Document not found.</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col">
      <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-4 border-b bg-background/80 px-4 backdrop-blur-sm md:px-6">
        <Button asChild variant="ghost" size="icon" className="h-10 w-10">
          <Link href="/dashboard">
            <ArrowLeft />
            <span className="sr-only">Back to Dashboard</span>
          </Link>
        </Button>
        <div className="flex flex-col">
            <h1 className="text-lg font-semibold truncate">{document.owner}</h1>
            <p className="text-sm text-muted-foreground">{document.type}</p>
        </div>
      </header>

      <main className="flex-1 overflow-hidden">
        <div className="h-full flex">
          <div className="w-1/2 h-full overflow-y-auto border-r p-4">
             <iframe src={document.fileUrl} className="w-full h-full border-0" title={document.fileName} />
          </div>
          <div className="w-1/2 h-full flex flex-col">
            <Card className="flex-1 flex flex-col border-0 rounded-none">
              <CardHeader>
                <CardTitle>Chat with Document</CardTitle>
                <CardDescription>Ask questions and get answers based on the document's content.</CardDescription>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col overflow-hidden">
                <ScrollArea className="flex-1 pr-4" ref={scrollAreaRef}>
                  <div className="space-y-4">
                    {messages.map((message, index) => (
                      <div key={index} className={`flex items-start gap-3 ${message.sender === 'user' ? 'justify-end' : ''}`}>
                        {message.sender === 'ai' && <AvatarIcon><Bot /></AvatarIcon>}
                        <div className={`rounded-lg px-4 py-3 text-sm max-w-[80%] ${message.sender === 'ai' ? 'bg-muted' : 'bg-primary text-primary-foreground'}`}>
                          <p>{message.text}</p>
                        </div>
                        {message.sender === 'user' && <AvatarIcon><User /></AvatarIcon>}
                      </div>
                    ))}
                     {isAnswering && (
                        <div className="flex items-start gap-3">
                          <AvatarIcon><Bot /></AvatarIcon>
                          <div className="rounded-lg px-4 py-3 text-sm bg-muted flex items-center">
                            <Loader2 className="h-4 w-4 animate-spin" />
                          </div>
                        </div>
                      )}
                  </div>
                </ScrollArea>
                <div className="mt-4 border-t pt-4">
                  <form onSubmit={handleSendMessage} className="flex items-center gap-2">
                    <Input
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      placeholder="Ask a question about the document..."
                      autoComplete="off"
                      disabled={isAnswering || document.isProcessing}
                    />
                    <Button type="submit" disabled={!input.trim() || isAnswering || document.isProcessing}>
                      <Send className="h-4 w-4" />
                      <span className="sr-only">Send</span>
                    </Button>
                  </form>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}

function AvatarIcon({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
            {children}
        </div>
    );
}