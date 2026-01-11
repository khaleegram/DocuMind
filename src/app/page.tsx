
'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { GoogleIcon } from '@/components/icons/google-icon';
import { Loader2, ShieldCheck, Lock, Zap } from 'lucide-react';
import { auth, googleProvider } from '@/lib/firebase';
import { signInWithPopup } from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';
import { useState, useEffect } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { motion } from 'framer-motion';

const FADE_UP_ANIMATION_VARIANTS = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', duration: 0.8 } },
};

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
      <main className="flex min-h-screen flex-col items-center justify-center bg-[#050505]">
        <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
      </main>
    );
  }

  const handleLogin = async () => {
    setIsLoggingIn(true);
    try {
      await signInWithPopup(auth, googleProvider);
      router.push('/dashboard');
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'AUTH_ERROR',
        description: 'Sign-in sequence interrupted.',
      });
    } finally {
      setIsLoggingIn(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 sm:p-6 bg-[#050505] text-white overflow-x-hidden">
      
      {/* Background Glows */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-5%] left-[-5%] w-[50%] h-[40%] bg-blue-600/10 blur-[100px] rounded-full" />
      </div>

      <motion.div
        initial="hidden" animate="show"
        variants={{ show: { transition: { staggerChildren: 0.1 } } }}
        className="w-full max-w-md relative z-10"
      >
        <motion.div variants={FADE_UP_ANIMATION_VARIANTS} className="flex flex-col items-center mb-8">
            <img
              src="/logo.png"
              alt="DocuMind Logo"
              className="h-28 w-28 sm:h-32 sm:w-32 object-contain filter drop-shadow-[0_0_15px_rgba(59,130,246,0.4)]"
            />
        </motion.div>

        <Card className="bg-[#0C0C0E] border-white/5 rounded-[2.5rem] sm:rounded-[3rem] shadow-2xl border-t-white/10 mx-auto">
          <CardHeader className="text-center p-6 sm:p-10 pb-4">
            <motion.div variants={FADE_UP_ANIMATION_VARIANTS} className="space-y-3">
              <div className="flex justify-center mb-2">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[9px] font-black uppercase tracking-widest">
                  <Zap size={10} className="fill-blue-400" /> Secure Access
                </div>
              </div>
              <CardTitle className="text-4xl sm:text-5xl font-black tracking-tighter text-white uppercase leading-none">
                Docu<span className="text-zinc-600">Mind</span>
              </CardTitle>
              <CardDescription className="text-zinc-500 text-base sm:text-lg font-medium leading-snug pt-2">
                Connect your account to manage <br className="hidden sm:block"/> your intelligent library.
              </CardDescription>
            </motion.div>
          </CardHeader>

          <CardContent className="p-6 sm:p-10 pt-6">
            <motion.div variants={FADE_UP_ANIMATION_VARIANTS} className="space-y-6">
              <Button 
                onClick={handleLogin} 
                disabled={isLoggingIn} 
                className="w-full h-14 sm:h-16 text-sm sm:text-base font-black rounded-2xl bg-white text-black hover:bg-zinc-200 transition-all active:scale-[0.98]"
              >
                {isLoggingIn ? (
                  <Loader2 className="h-6 w-6 animate-spin" />
                ) : (
                  <div className="flex items-center gap-3">
                    <GoogleIcon className="h-5 w-5 sm:h-6 sm:w-6" />
                    <span>CONTINUE WITH GOOGLE</span>
                  </div>
                )}
              </Button>
              
              <div className="flex items-center justify-center gap-4">
                <div className="flex items-center gap-1.5 text-[9px] font-bold text-zinc-600 uppercase tracking-widest">
                  <ShieldCheck size={12} className="text-blue-600" /> Encrypted
                </div>
                <div className="flex items-center gap-1.5 text-[9px] font-bold text-zinc-600 uppercase tracking-widest">
                  <Lock size={12} className="text-blue-600" /> AES-256
                </div>
              </div>
            </motion.div>
          </CardContent>
        </Card>

        <motion.footer variants={FADE_UP_ANIMATION_VARIANTS} className="mt-8 text-center px-4">
          <p className="text-[9px] font-black text-zinc-700 uppercase tracking-[0.2em]">
            &copy; {new Date().getFullYear()} DocuMind Intelligence
          </p>
        </motion.footer>
      </motion.div>
    </main>
  );
}
