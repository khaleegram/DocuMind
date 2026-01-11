
'use client';

import { useState, useMemo } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import type { FilterCategory } from '@/app/dashboard/documents/page';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Filter, Search, X } from 'lucide-react';
import Fuse from 'fuse.js';

type FilterSidebarProps = {
  filterOptions: Record<FilterCategory, string[]>;
  activeFilters: Record<FilterCategory, Set<string>>;
  onFilterChange: (category: FilterCategory, value: string) => void;
  onClearFilters: () => void;
  isAiSearchActive: boolean;
};

const categoryDisplayNames: Record<FilterCategory, string> = {
  owner: 'Owners',
  company: 'Companies',
  type: 'Document Types',
  country: 'Countries',
};

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
        <AccordionItem value={category} key={category} className="border-b-white/5">
            <AccordionTrigger className="text-sm font-bold uppercase tracking-wider text-zinc-400 hover:text-white hover:no-underline">
                {categoryDisplayNames[category]}
            </AccordionTrigger>
            <AccordionContent>
                <div className="space-y-4 px-1 pt-2">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                        <Input 
                            placeholder={`Search ${categoryDisplayNames[category]}...`}
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-9 h-10 bg-[#111113] border-white/10 rounded-lg focus-visible:ring-blue-500"
                        />
                    </div>
                    <ScrollArea className="h-full max-h-48">
                        <div className="space-y-3 pr-4">
                            {filteredOptions.length > 0 ? filteredOptions.map((option) => (
                                <div key={option} className="flex items-center space-x-3">
                                    <Checkbox
                                        id={`${category}-${option}`}
                                        checked={activeOptions.has(option)}
                                        onCheckedChange={() => onFilterChange(category, option)}
                                        className="border-zinc-600 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                                    />
                                    <label htmlFor={`${category}-${option}`} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 flex-1 truncate text-zinc-300">
                                        {option}
                                    </label>
                                </div>
                            )) : (
                                <p className="text-sm text-zinc-500 text-center py-4">No matches found.</p>
                            )}
                        </div>
                    </ScrollArea>
                </div>
            </AccordionContent>
        </AccordionItem>
    );
}

export default function FilterSidebar({ filterOptions, activeFilters, onFilterChange, onClearFilters, isAiSearchActive }: FilterSidebarProps) {
  const [isSheetOpen, setSheetOpen] = useState(false);
  const activeFilterCount = Object.values(activeFilters).reduce((acc, set) => acc + set.size, 0);

  const FilterContent = () => (
    <>
      <div className="flex items-center justify-between px-6 pt-6 pb-2">
          <h2 className="text-lg font-black tracking-tight text-white">FILTER & SORT</h2>
          {(activeFilterCount > 0 || isAiSearchActive) && (
            <Button variant="link" className="p-0 h-auto text-sm text-red-500 hover:text-red-400" onClick={onClearFilters}>
                Clear all
            </Button>
          )}
      </div>
      <ScrollArea className="h-full">
         {isAiSearchActive ? (
            <div className="px-4 py-8 text-center text-sm text-zinc-400">
                <p className="font-semibold text-white">AI Search Active</p>
                <p>Clear results to use manual filters.</p>
            </div>
         ) : (
            <Accordion type="multiple" defaultValue={['owner', 'company', 'type', 'country']} className="w-full px-4">
                <FilterCategorySection category="owner" options={filterOptions.owner} activeOptions={activeFilters.owner} onFilterChange={onFilterChange} />
                <FilterCategorySection category="company" options={filterOptions.company} activeOptions={activeFilters.company} onFilterChange={onFilterChange} />
                <FilterCategorySection category="type" options={filterOptions.type} activeOptions={activeFilters.type} onFilterChange={onFilterChange} />
                <FilterCategorySection category="country" options={filterOptions.country} activeOptions={activeFilters.country} onFilterChange={onFilterChange} />
            </Accordion>
         )}
      </ScrollArea>
    </>
  )

  return (
    <>
        {/* Mobile Sheet Trigger */}
        <div className="fixed bottom-6 right-6 z-40">
             <Sheet open={isSheetOpen} onOpenChange={setSheetOpen}>
                <SheetTrigger asChild>
                    <Button size="icon" className="rounded-full w-14 h-14 shadow-lg bg-white text-black hover:bg-zinc-200 transition-all active:scale-95">
                       <Filter className="h-6 w-6" />
                       <span className="sr-only">Open Filters</span>
                       {(activeFilterCount > 0 || isAiSearchActive) && (
                            <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white ring-2 ring-[#050505]">
                                {isAiSearchActive ? 'AI' : activeFilterCount}
                            </span>
                        )}
                    </Button>
                </SheetTrigger>
                <SheetContent side="bottom" className="h-[80vh] flex flex-col p-0 bg-[#0C0C0E] text-white border-t border-white/10 rounded-t-3xl">
                    <SheetHeader className="p-4 text-left">
                         <div className="w-20 h-1.5 bg-zinc-700 rounded-full mx-auto mb-2" />
                        <SheetTitle className="text-white font-black text-center">Filter Documents</SheetTitle>
                        <SheetDescription className="text-zinc-400 text-center">
                            Refine your view of the document vault.
                        </SheetDescription>
                    </SheetHeader>
                    <div className="flex-1 overflow-hidden">
                       <FilterContent />
                    </div>
                     <div className="p-4 border-t border-white/10 bg-[#0C0C0E]">
                        <Button onClick={() => setSheetOpen(false)} className="w-full h-12 bg-blue-600 hover:bg-blue-500 rounded-xl font-bold text-base">
                            View Results
                        </Button>
                    </div>
                </SheetContent>
            </Sheet>
        </div>
    </>
  );
}
