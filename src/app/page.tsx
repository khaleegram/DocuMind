'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { GoogleIcon } from '@/components/icons/google-icon';
import { FileSearch } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();

  const handleLogin = () => {
    // In a real app, this would trigger Firebase Google Auth and request Drive scopes.
    // For this prototype, we'll just navigate to the dashboard.
    router.push('/dashboard');
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Card className="shadow-2xl rounded-xl border-0">
          <CardHeader className="text-center p-8">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 text-primary mb-6">
              <FileSearch className="h-10 w-10" />
            </div>
            <CardTitle className="text-4xl font-bold tracking-tight text-primary">DocuMind</CardTitle>
            <CardDescription className="text-lg mt-2 text-muted-foreground">Your intelligent document assistant.</CardDescription>
          </CardHeader>
          <CardContent className="p-8 pt-0">
            <Button onClick={handleLogin} className="w-full h-12 text-lg bg-accent hover:bg-accent/90 text-accent-foreground">
              <GoogleIcon className="mr-3 h-6 w-6" />
              Sign in with Google
            </Button>
            <p className="text-xs text-muted-foreground mt-4 text-center">
              By signing in, you agree to our Terms of Service.
            </p>
          </CardContent>
        </Card>
        <footer className="mt-8 text-center text-sm text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} DocuMind. All rights reserved.</p>
        </footer>
      </div>
    </main>
  );
}
