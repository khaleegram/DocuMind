
'use client';

import { useState, useMemo } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import type { FilterCategory } from '@/app/dashboard/documents/page';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Filter, Search, X, Sparkles, Loader2 } from 'lucide-react';
import Fuse from 'fuse.js';
import { intelligentSearch, type IntelligentSearchOutput } from '@/ai/flows/intelligent-search';
import { useToast } from '@/hooks/use-toast';

type FilterSidebarProps = {
  filterOptions: Record<FilterCategory, string[]>;
  activeFilters: Record<FilterCategory, Set<string>>;
  onFilterChange: (category: FilterCategory, value: string) => void;
  onClearFilters: () => void;
  onAiSearch: (criteria: IntelligentSearchOutput) => void;
};

const categoryDisplayNames: Record<FilterCategory, string> = {
  owner: 'Owners',
  company: 'Companies',
  type: 'Document Types',
  country: 'Countries',
};

function AiSearchAgent({ onAiSearch }: { onAiSearch: (criteria: IntelligentSearchOutput) => void }) {
    const [query, setQuery] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const { toast } = useToast();

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!query.trim()) return;

        setIsSearching(true);
        try {
            const result = await intelligentSearch({ query });
            onAiSearch(result);
        } catch (error) {
            console.error("AI search failed:", error);
            toast({
                variant: 'destructive',
                title: 'AI Search Failed',
                description: 'Could not perform the intelligent search. Please try a different query.'
            })
        } finally {
            setIsSearching(false);
        }
    }
    
    return (
        <div className="p-4 border-b">
            <form onSubmit={handleSearch}>
                <label className="text-sm font-semibold flex items-center gap-2 mb-2">
                    <Sparkles className="h-4 w-4 text-accent" />
                    AI Search Agent
                </label>
                 <div className="relative">
                    <Input 
                        placeholder="e.g., 'Danish visa for John Doe'"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        disabled={isSearching}
                        className="pr-10"
                    />
                    <Button 
                      type="submit" 
                      size="icon" 
                      variant="ghost" 
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
                      disabled={isSearching || !query.trim()}
                    >
                        {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                    </Button>
                </div>
            </form>
        </div>
    )
}

function FilterCategorySection({
    category,
    options,
    activeOptions,
    onFilterChange
}: {
    category: FilterCategory;
    options: string[];
    activeOptions: Set<string>;
    onFilterChange: (category: FilterCategory, value: string) => void;
}) {
    const [search, setSearch] = useState('');

    const filteredOptions = useMemo(() => {
        if (!search) return options;
        const fuse = new Fuse(options, { threshold: 0.3 });
        return fuse.search(search).map(result => result.item);
    }, [search, options]);

    if (options.length === 0) return null;

    return (
        <AccordionItem value={category} key={category}>
            <AccordionTrigger className="text-base font-semibold hover:no-underline">
                {categoryDisplayNames[category]}
            </AccordionTrigger>
            <AccordionContent>
                <div className="space-y-4 px-1">
                    <div className="relative">
                        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input 
                            placeholder={`Search ${categoryDisplayNames[category]}...`}
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-8 h-9"
                        />
                    </div>
                    <ScrollArea className="h-full max-h-48">
                        <div className="space-y-3 pr-4">
                            {filteredOptions.length > 0 ? filteredOptions.map((option) => (
                                <div key={option} className="flex items-center space-x-2">
                                    <Checkbox
                                        id={`${category}-${option}`}
                                        checked={activeOptions.has(option)}
                                        onCheckedChange={() => onFilterChange(category, option)}
                                    />
                                    <label htmlFor={`${category}-${option}`} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 flex-1 truncate">
                                        {option}
                                    </label>
                                </div>
                            )) : (
                                <p className="text-sm text-muted-foreground text-center py-4">No matches found.</p>
                            )}
                        </div>
                    </ScrollArea>
                </div>
            </AccordionContent>
        </AccordionItem>
    );
}

export default function FilterSidebar({ filterOptions, activeFilters, onFilterChange, onClearFilters, onAiSearch }: FilterSidebarProps) {
  const [isSheetOpen, setSheetOpen] = useState(false);
  const activeFilterCount = Object.values(activeFilters).reduce((acc, set) => acc + set.size, 0);

  const FilterContent = () => (
    <>
      <AiSearchAgent onAiSearch={onAiSearch} />
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <h2 className="text-lg font-semibold tracking-tight">Manual Filters</h2>
          {activeFilterCount > 0 && (
            <Button variant="link" className="p-0 h-auto text-sm text-destructive" onClick={onClearFilters}>
                Clear all ({activeFilterCount})
            </Button>
          )}
      </div>
      <ScrollArea className="h-full">
          <Accordion type="multiple" defaultValue={['owner', 'company', 'type', 'country']} className="w-full px-2">
              <FilterCategorySection category="owner" options={filterOptions.owner} activeOptions={activeFilters.owner} onFilterChange={onFilterChange} />
              <FilterCategorySection category="company" options={filterOptions.company} activeOptions={activeFilters.company} onFilterChange={onFilterChange} />
              <FilterCategorySection category="type" options={filterOptions.type} activeOptions={activeFilters.type} onFilterChange={onFilterChange} />
              <FilterCategorySection category="country" options={filterOptions.country} activeOptions={activeFilters.country} onFilterChange={onFilterChange} />
          </Accordion>
      </ScrollArea>
    </>
  )

  return (
    <>
        {/* Desktop Sidebar */}
        <aside className="hidden lg:flex flex-col w-[280px] border-r bg-background h-screen sticky top-0">
           <FilterContent />
        </aside>

        {/* Mobile Sheet Trigger */}
        <div className="fixed bottom-4 right-4 z-40 lg:hidden">
             <Sheet open={isSheetOpen} onOpenChange={setSheetOpen}>
                <SheetTrigger asChild>
                    <Button size="icon" className="rounded-full w-14 h-14 shadow-lg bg-primary hover:bg-primary/90">
                       <Filter className="h-6 w-6" />
                       <span className="sr-only">Open Filters</span>
                       {activeFilterCount > 0 && (
                            <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-xs font-bold text-destructive-foreground">
                                {activeFilterCount}
                            </span>
                        )}
                    </Button>
                </SheetTrigger>
                <SheetContent side="bottom" className="h-[80vh] flex flex-col p-0">
                    <SheetHeader className="p-4 border-b text-left">
                        <SheetTitle>Filter Documents</SheetTitle>
                    </SheetHeader>
                    <div className="flex-1 overflow-hidden">
                       <FilterContent />
                    </div>
                     <div className="p-4 border-t bg-background">
                        <Button onClick={() => setSheetOpen(false)} className="w-full">
                            View Results
                        </Button>
                    </div>
                </SheetContent>
            </Sheet>
        </div>
    </>
  );
}
