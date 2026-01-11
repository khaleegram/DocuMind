
'use client';

import { Search, Upload, Sparkles, Loader2, LogOut } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useState, useEffect } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '@/lib/firebase';
import { useRouter } from 'next/navigation';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import Image from 'next/image';

type HeaderProps = {
  searchQuery?: string;
  setSearchQuery?: (query: string) => void;
  onSearchSubmit?: () => void;
  onUploadClick: () => void;
  onAiSearch?: (query: string) => void;
  isAiSearching?: boolean;
  title: string;
  showSearch?: boolean;
  showAiSearch?: boolean;
};

function AiSearchAgent({ onAiSearch, isSearching, initialQuery }: { onAiSearch: (query: string) => void, isSearching: boolean, initialQuery?: string }) {
    const [query, setQuery] = useState(initialQuery || '');
    
    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!query.trim() || isSearching) return;
        onAiSearch(query);
    }

     useEffect(() => {
        setQuery(initialQuery || '');
    }, [initialQuery]);
    
    return (
        <form onSubmit={handleSearch} className="relative w-full">
             <Input 
                placeholder="AI Search: e.g., 'Danish visa for John Doe'"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                disabled={isSearching}
                className="pl-4 pr-10 w-full h-12 bg-[#111113] border-white/10 rounded-xl focus-visible:ring-blue-500"
                aria-label="AI Search"
            />
            <Button 
              type="submit" 
              size="icon" 
              variant="ghost" 
              className="absolute right-2 top-1/2 -translate-y-1/2 h-9 w-9 text-zinc-400 hover:text-white hover:bg-white/10"
              disabled={isSearching || !query.trim()}
              aria-label="Submit AI Search"
            >
                {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            </Button>
        </form>
    )
}

function UserProfile() {
  const [user, loading] = useAuthState(auth);
  const router = useRouter();
  const [initial, setInitial] = useState('');

  useEffect(() => {
    if (user && !loading) {
      setInitial(user.displayName?.charAt(0)?.toUpperCase() || 'U');
    }
  }, [user, loading]);

  const handleLogout = async () => {
    await auth.signOut();
    router.push('/');
  };

  return (
    <DropdownMenu>
        <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-12 w-12 rounded-full p-0">
                 <Avatar className="h-12 w-12 border-2 border-white/10">
                    {loading ? (
                        <Skeleton className="h-12 w-12 rounded-full bg-white/10" />
                    ) : (
                        <>
                         {user?.photoURL && <AvatarImage src={user.photoURL} alt={user.displayName || 'User Avatar'} data-ai-hint="profile picture" />}
                         <AvatarFallback className="bg-zinc-800 text-zinc-400 font-bold">{initial}</AvatarFallback>
                        </>
                    )}
                </Avatar>
            </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56 mt-2 bg-[#111113] border-white/10 text-zinc-300">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none text-white">{user?.displayName}</p>
                <p className="text-xs leading-none text-zinc-500">{user?.email}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-white/10"/>
            <DropdownMenuItem disabled className="focus:bg-white/5 focus:text-white">Profile</DropdownMenuItem>
            <DropdownMenuItem disabled className="focus:bg-white/5 focus:text-white">Settings</DropdownMenuItem>
            <DropdownMenuSeparator className="bg-white/10"/>
            <DropdownMenuItem onClick={handleLogout} className="focus:bg-red-500/10 focus:text-red-400">
              <LogOut className="mr-2 h-4 w-4" />
              <span>Log out</span>
            </DropdownMenuItem>
        </DropdownMenuContent>
    </DropdownMenu>
  );
}


export default function Header({ 
    searchQuery, 
    setSearchQuery, 
    onSearchSubmit, 
    onUploadClick, 
    onAiSearch,
    isAiSearching = false,
    title,
    showSearch = true,
    showAiSearch = false
}: HeaderProps) {
  const [isMobileSearchOpen, setMobileSearchOpen] = useState(false);
  const router = useRouter();

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      onSearchSubmit?.();
    }
  }

  const handleFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      onSearchSubmit?.();
  }

  const LeftContent = () => (
      <div className="flex items-center gap-4">
        <div 
          className="pointer-events-auto bg-[#111113] border border-white/10 p-2 rounded-2xl shadow-2xl flex items-center gap-3 cursor-pointer"
          onClick={() => router.push('/dashboard')}
        >
          <div className="w-10 h-10 flex items-center justify-center shrink-0">
            <Image src="/logo.png" alt="DocuMind Logo" width={40} height={40} />
          </div>
          <div className="pr-3 hidden md:block">
              <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 font-bold leading-none mb-1">DocuMind</p>
              <p className="text-sm font-black tracking-tight leading-none">VAULT OS</p>
          </div>
        </div>
        <h1 className="text-2xl font-black tracking-tighter text-white hidden lg:block">{title}</h1>
      </div>
  );

  const RightContent = () => (
    <div className="flex items-center gap-2 md:gap-4">
       {showSearch && onSearchSubmit && setSearchQuery && (
         <form onSubmit={handleFormSubmit} className="relative hidden md:block">
            <Input
                type="search"
                placeholder="Keywords..."
                className="pl-4 pr-10 w-[240px] h-12 bg-[#111113] border-white/10 rounded-xl focus-visible:ring-blue-500"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                aria-label="Search"
            />
            <Button 
                type="submit" 
                size="icon" 
                variant="ghost"
                className="absolute right-2 top-1/2 -translate-y-1/2 h-9 w-9 text-zinc-400 hover:text-white hover:bg-white/10"
                aria-label="Submit search"
            >
                <Search className="h-4 w-4" />
            </Button>
        </form>
      )}

      <button 
        onClick={() => setMobileSearchOpen(p => !p)}
        className="md:hidden flex items-center justify-center w-12 h-12 bg-[#111113] border border-white/10 rounded-2xl text-zinc-400 hover:text-white hover:bg-white/20 transition-colors"
      >
        <Search size={20} />
      </button>

      <button 
        onClick={onUploadClick}
        className="hidden md:flex items-center justify-center w-12 h-12 bg-white text-black rounded-2xl shadow-lg hover:bg-zinc-200 transition-all active:scale-95"
      >
        <Upload size={20} strokeWidth={3} />
      </button>

      <UserProfile />
    </div>
  );

  return (
    <header className="sticky top-0 z-30 p-4 md:px-8">
      <div className={`relative flex items-center justify-between gap-4 max-w-7xl mx-auto transition-all duration-300 ${isMobileSearchOpen ? 'opacity-0' : 'opacity-100'}`}>
          <LeftContent />
          <RightContent />
      </div>

       {/* Mobile Search Overlay */}
      <div className={`absolute inset-0 bg-[#050505] p-4 md:px-8 transition-all duration-300 ${isMobileSearchOpen ? 'opacity-100 z-30' : 'opacity-0 -z-10'}`}>
         <div className="flex items-center gap-2 max-w-7xl mx-auto h-full">
            {showAiSearch && onAiSearch ? (
              <AiSearchAgent onAiSearch={(q) => { onAiSearch(q); setMobileSearchOpen(false); }} isSearching={isAiSearching} initialQuery={searchQuery} />
            ) : showSearch && onSearchSubmit && setSearchQuery ? (
               <form onSubmit={(e) => { handleFormSubmit(e); setMobileSearchOpen(false); }} className="relative w-full">
                  <Input
                      type="search"
                      placeholder="Search keywords..."
                      className="pl-4 pr-10 w-full h-12 bg-[#111113] border-white/10 rounded-xl focus-visible:ring-blue-500"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={(e) => { if(e.key === 'Enter') { onSearchSubmit(); setMobileSearchOpen(false); }}}
                      aria-label="Search"
                      autoFocus
                  />
                  <Button 
                      type="submit" 
                      size="icon" 
                      variant="ghost"
                      className="absolute right-2 top-1/2 -translate-y-1/2 h-9 w-9 text-zinc-400 hover:text-white hover:bg-white/10"
                      aria-label="Submit search"
                  >
                      <Search className="h-4 w-4" />
                  </Button>
              </form>
            ) : null}
             <button onClick={() => setMobileSearchOpen(false)} className="w-12 h-12 flex items-center justify-center text-zinc-400">Cancel</button>
         </div>
      </div>
    </header>
  );
}
