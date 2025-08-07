
'use client';

import { Search, Upload, Sparkles, Loader2, LogOut } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
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
        <form onSubmit={handleSearch} className="relative w-full sm:w-auto">
            <Sparkles className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-accent" />
            <Input 
                placeholder="AI Search: e.g., 'Danish visa for John Doe'"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                disabled={isSearching}
                className="pl-9 pr-10 w-full sm:w-[240px] lg:w-[380px] h-10"
                aria-label="AI Search"
            />
            <Button 
              type="submit" 
              size="icon" 
              variant="ghost" 
              className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
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
      setInitial(user.displayName?.charAt(0)?.toUpperCase() || '');
    }
  }, [user, loading]);

  const handleLogout = async () => {
    await auth.signOut();
    router.push('/');
  };

  return (
    <DropdownMenu>
        <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                 <Avatar className="h-10 w-10">
                    {user && <AvatarImage src={user.photoURL || ''} alt={user.displayName || 'User Avatar'} data-ai-hint="profile picture" />}
                    <AvatarFallback>
                       {loading || !initial ? <Skeleton className="h-10 w-10 rounded-full" /> : initial}
                    </AvatarFallback>
                </Avatar>
            </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56 mt-2">
            <DropdownMenuLabel>{user?.displayName || 'My Account'}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled>Profile</DropdownMenuItem>
            <DropdownMenuItem disabled>Settings</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout}>
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
  const [isMobileSearchFocused, setIsMobileSearchFocused] = useState(false);
  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      onSearchSubmit?.();
    }
  }

  const handleFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      onSearchSubmit?.();
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-4 border-b bg-background/95 px-4 backdrop-blur-sm sm:px-6">
      <div className="flex w-full items-center gap-2 sm:gap-4">
        <h1 className={`text-xl font-semibold md:text-2xl whitespace-nowrap ${isMobileSearchFocused ? 'hidden sm:block' : 'block'}`}>{title}</h1>
        
        <div className={`flex flex-1 items-center gap-2 justify-end ${isMobileSearchFocused ? 'w-full' : 'w-auto'}`}>
            {showAiSearch && onAiSearch && 
                <div className={`w-full sm:w-auto ${!isMobileSearchFocused && 'hidden sm:block'}`}>
                    <AiSearchAgent onAiSearch={onAiSearch} isSearching={isAiSearching} initialQuery={searchQuery} />
                </div>
            }
            {showSearch && onSearchSubmit && setSearchQuery && (
                 <form onSubmit={handleFormSubmit} className={`relative w-full sm:w-auto ${!isMobileSearchFocused && 'hidden sm:block'}`}>
                    <Input
                        type="search"
                        placeholder="Search keywords..."
                        className="pl-4 pr-10 w-full sm:w-[200px] lg:w-[240px] h-10"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={handleSearchKeyDown}
                        aria-label="Search"
                        onFocus={() => setIsMobileSearchFocused(true)}
                        onBlur={() => setIsMobileSearchFocused(false)}
                    />
                    <Button 
                        type="submit" 
                        size="icon" 
                        variant="ghost"
                        className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
                        aria-label="Submit search"
                        >
                        <Search className="h-4 w-4" />
                    </Button>
                </form>
            )}

            {(showAiSearch || showSearch) && (
              <Button 
                variant="ghost" 
                size="icon" 
                className="sm:hidden"
                onClick={() => setIsMobileSearchFocused(true)}
              >
                  <Search className="h-5 w-5" />
                  <span className="sr-only">Open Search</span>
              </Button>
            )}
            
            <div className={`${isMobileSearchFocused ? 'hidden sm:flex' : 'flex'} items-center gap-2`}>
                <Button onClick={onUploadClick} className="bg-accent hover:bg-accent/90 h-10">
                <Upload className="mr-0 sm:mr-2 h-4 w-4" /> 
                <span className="hidden sm:inline">Upload</span>
                </Button>
                <UserProfile />
            </div>
        </div>
      </div>
    </header>
  );
}
