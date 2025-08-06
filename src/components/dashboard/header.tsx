
'use client';

import { Search, Upload } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

type HeaderProps = {
  searchQuery?: string;
  setSearchQuery?: (query: string) => void;
  onSearchSubmit?: () => void;
  onUploadClick: () => void;
  title: string;
  showSearch?: boolean;
};

export default function Header({ 
    searchQuery, 
    setSearchQuery, 
    onSearchSubmit, 
    onUploadClick, 
    title,
    showSearch = true 
}: HeaderProps) {
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
      <div className="flex w-full items-center gap-4">
        <h1 className="flex-1 shrink-0 text-xl font-semibold md:text-2xl whitespace-nowrap">{title}</h1>
        <div className="ml-auto flex items-center gap-2">
            {showSearch && onSearchSubmit && setSearchQuery && (
                 <form onSubmit={handleFormSubmit} className="relative flex-1 ml-auto sm:flex-grow-0">
                    <Input
                        type="search"
                        placeholder="Search documents..."
                        className="pl-4 pr-10 w-full sm:w-[200px] lg:w-[320px] h-10"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={handleSearchKeyDown}
                        aria-label="Search"
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
            <Button onClick={onUploadClick} className="bg-accent hover:bg-accent/90 h-10">
            <Upload className="mr-0 sm:mr-2 h-4 w-4" /> 
            <span className="hidden sm:inline">Upload</span>
            </Button>
        </div>
      </div>
    </header>
  );
}
