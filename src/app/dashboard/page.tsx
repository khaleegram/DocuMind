'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { useRouter } from 'next/navigation';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import type { Document as DocumentType } from '@/lib/types';
import { Loader2, Files, Calendar, BarChart, AlertTriangle } from 'lucide-react';
import Header from '@/components/dashboard/header';
import { UploadDialog } from '@/components/dashboard/upload-dialog';
import { DocumentTypeChart, getChartData } from '@/components/dashboard/document-type-chart';
import ExpiringSoonList from '@/components/dashboard/expiring-soon-list';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { subDays, isAfter, isBefore, addDays } from 'date-fns';

export default function DashboardHomePage() {
  const [user, loadingAuth] = useAuthState(auth);
  const router = useRouter();
  const [documents, setDocuments] = useState<DocumentType[]>([]);
  const [isLoadingDocs, setIsLoadingDocs] = useState(true);
  const [isUploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [userName, setUserName] = useState('');

  useEffect(() => {
    if (loadingAuth) return;
    if (!user) {
      router.push('/');
      return;
    }
    setUserName(user.displayName?.split(' ')[0] || 'there');
    
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
        setDocuments(docs);
        setIsLoadingDocs(false);
    });

    return () => unsubscribe();
  }, [user, loadingAuth, router]);

  const expiringSoonDocs = useMemo(() => {
    const today = new Date();
    const ninetyDaysFromNow = addDays(today, 90);
    return documents
      .filter(doc => {
        if (!doc.expiry) return false;
        try {
          const expiryDate = new Date(doc.expiry);
          return isAfter(expiryDate, today) && isBefore(expiryDate, ninetyDaysFromNow);
        } catch {
          return false;
        }
      })
      .sort((a, b) => new Date(a.expiry!).getTime() - new Date(b.expiry!).getTime());
  }, [documents]);

  const documentTypeChartData = useMemo(() => getChartData(documents), [documents]);

  if (loadingAuth || isLoadingDocs) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-16 w-16 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 h-screen overflow-hidden">
      <Header 
        onUploadClick={() => setUploadDialogOpen(true)}
        title={`Welcome Back, ${userName}!`}
        showSearch={false}
      />
      <main className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <Card className="lg:col-span-2">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <AlertTriangle className="text-destructive" />
                        Expiring Soon
                    </CardTitle>
                    <CardDescription>
                        These documents require your attention within the next 90 days.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <ExpiringSoonList documents={expiringSoonDocs} />
                </CardContent>
            </Card>
            <Card>
                <CardHeader>
                     <CardTitle className="flex items-center gap-2">
                        <BarChart />
                        Document Overview
                    </CardTitle>
                    <CardDescription>
                        A breakdown of all your uploaded documents by type.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <DocumentTypeChart chartData={documentTypeChartData} />
                </CardContent>
            </Card>
        </div>
        
        <Card>
            <CardHeader>
                <CardTitle>Need to find something specific?</CardTitle>
                <CardDescription>
                    Go to the All Documents view to search, filter, and manage all your files.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Button asChild>
                    <a href="/dashboard/documents">
                        <Files className="mr-2 h-4 w-4" />
                        View All Documents
                    </a>
                </Button>
            </CardContent>
        </Card>

      </main>
      <UploadDialog 
        isOpen={isUploadDialogOpen}
        setIsOpen={setUploadDialogOpen}
      />
    </div>
  );
}
