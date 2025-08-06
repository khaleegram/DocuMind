
'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { GoogleIcon } from '@/components/icons/google-icon';
import { Loader2 } from 'lucide-react';
import { auth, googleProvider } from '@/lib/firebase';
import { signInWithPopup } from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';
import { useState, useEffect } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';

export default function LoginPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [user, loading] = useAuthState(auth);

  useEffect(() => {
    if (user && !loading) {
      router.push('/dashboard');
    }
  }, [user, loading, router]);

  if (loading || user) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-4">
        <Loader2 className="h-16 w-16 animate-spin text-primary" />
      </main>
    );
  }

  const handleLogin = async () => {
    setIsLoggingIn(true);
    try {
      await signInWithPopup(auth, googleProvider);
      router.push('/dashboard');
    } catch (error: any) {
      console.error("Authentication failed:", error);
      if (error.code === 'auth/popup-closed-by-user') {
        toast({
          variant: 'destructive',
          title: 'Login Cancelled',
          description: 'The sign-in popup was closed before authentication could complete.',
        });
      } else {
        toast({
          variant: 'destructive',
          title: 'Login Failed',
          description: 'Could not sign in with Google. Please try again.',
        });
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 bg-muted/40">
  <div className="w-full max-w-md">
    <Card className="shadow-2xl rounded-xl border-0">
      <CardHeader className="text-center p-8">
        <img
          src="/icon.png" // PNG in public folder
          alt="App Icon"
          className="mx-auto h-40 w-40 object-contain mb-6"
        />
            <CardTitle className="text-4xl font-bold tracking-tight text-primary">DocuMind</CardTitle>
            <CardDescription className="text-lg mt-2 text-muted-foreground">Your intelligent document assistant.</CardDescription>
          </CardHeader>
          <CardContent className="p-8 pt-0">
            <Button onClick={handleLogin} disabled={isLoggingIn} className="w-full h-12 text-lg bg-accent hover:bg-accent/90 text-accent-foreground">
              {isLoggingIn ? (
                <Loader2 className="mr-3 h-6 w-6 animate-spin" />
              ) : (
                <GoogleIcon className="mr-3 h-6 w-6" />
              )}
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
