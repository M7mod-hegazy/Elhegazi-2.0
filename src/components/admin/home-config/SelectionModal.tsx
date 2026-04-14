import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ChevronDown, Search, X } from 'lucide-react';
import { applyGenericImageFallback, optimizeImage } from '@/lib/images';

export type SelectionModalResultRow = {
  id: string;
  label: string;
  image?: string;
  familyName?: string;
  sku?: string;
};

interface SelectionModalProps {
  open: boolean;
  title: string;
  search: string;
  onSearch: (v: string) => void;
  loading: boolean;
  results: SelectionModalResultRow[];
  visibleCount: number;
  onLoadMore: () => void;
  selected: string[];
  /** Resolved labels for chips when an id is not in the current search results */
  selectionMeta?: Record<string, { label: string; familyName?: string; image?: string }>;
  /** When true, show family name under each product row and on selected chips (catalog setting). */
  showFamilyHints?: boolean;
  /** Product picker: filter by category (Mongo category id). */
  categoryFilter?: string;
  onCategoryFilterChange?: (id: string) => void;
  categoryOptions?: Array<{ id: string; label: string }>;
  onToggle: (id: string) => void;
  onClose: () => void;
  onApply: () => void;
}

export const SelectionModal: React.FC<SelectionModalProps> = (props) => {
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  
  useEffect(() => {
    setFocusedIndex(0);
  }, [props.results]);

  useEffect(() => {
    setCurrentPage(1);
    setFocusedIndex(0);
  }, [props.search, props.categoryFilter, props.open]);
  
  const pageSize = Math.max(1, Number(props.visibleCount) || 10);
  const totalPages = Math.max(1, Math.ceil(props.results.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const pageStart = (safePage - 1) * pageSize;
  const visible = props.results.slice(pageStart, pageStart + pageSize);
  const suggestions = props.search ? props.results.slice(0, 5) : props.results.slice(0, 5);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!visible.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusedIndex((i) => (i + 1) % visible.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusedIndex((i) => (i - 1 + visible.length) % visible.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const item = visible[focusedIndex];
      if (item) props.onToggle(item.id);
    }
  };
  
  if (!props.open) return null;

  const showFam = props.showFamilyHints === true;
  const chipLabel = (id: string) =>
    props.selectionMeta?.[id]?.label || props.results.find((r) => r.id === id)?.label || id;
  const chipFamily = (id: string) => {
    if (!showFam) return undefined;
    return props.selectionMeta?.[id]?.familyName || props.results.find((r) => r.id === id)?.familyName;
  };
  
  return (
    <Dialog open={props.open} onOpenChange={(open) => !open && props.onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Search className="w-5 h-5 text-blue-600" />
            {props.title}
          </DialogTitle>
          <DialogDescription>
            {'ابحث واختر العناصر المطلوبة من القائمة أدناه'}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
        
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Input 
              value={props.search} 
              onChange={(e) => props.onSearch(e.target.value)} 
              onKeyDown={onKeyDown} 
              placeholder={'ابحث بالاسم أو الكود...'} 
            />
            <Search className="w-4 h-4 absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
          </div>
          {props.categoryOptions && props.categoryOptions.length > 0 && props.onCategoryFilterChange ? (
            <div className="relative w-full sm:w-[200px]">
              <select
                value={props.categoryFilter ?? 'all'}
                onChange={(e) => props.onCategoryFilterChange?.(e.target.value)}
                className="h-10 w-full appearance-none rounded-md border border-slate-300 bg-white px-3 pl-8 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                <option value="all">{'كل الفئات'}</option>
                {props.categoryOptions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            </div>
          ) : null}
          {props.search ? (
            <Button type="button" variant="ghost" size="sm" onClick={() => props.onSearch('')}>
              {'مسح'}
            </Button>
          ) : null}
          <Button type="button" onClick={props.onApply} disabled={props.loading}>
            {'تطبيق'}
          </Button>
        </div>
        
        {/* suggestions */}
        {suggestions.length ? (
          <div className="flex items-center gap-2 flex-wrap">
            {suggestions.map((s) => (
              <button 
                key={s.id} 
                className={`flex items-center gap-2 px-2 py-1 rounded border text-xs ${props.selected.includes(s.id) ? 'bg-emerald-50 border-emerald-200' : 'bg-white'}`} 
                onClick={() => props.onToggle(s.id)}
              >
                {s.image ? (
                  <img
                    src={optimizeImage(s.image, { w: 80 })}
                    alt=""
                    className="w-8 h-8 rounded-md object-cover border border-slate-100"
                    onError={applyGenericImageFallback}
                  />
                ) : null}
                <span className="truncate max-w-[160px] text-right">
                  <span className="block">{s.label}</span>
                  {showFam && s.familyName ? (
                    <span className="block text-[10px] text-slate-500 truncate">{s.familyName}</span>
                  ) : null}
                </span>
              </button>
            ))}
          </div>
        ) : null}
        
        <div className="text-xs text-slate-500">
          {`${props.selected.length} مختار — ${props.results.length} نتائج`}
        </div>
        
        {props.selected.length ? (
          <div className="flex flex-wrap gap-2">
            {props.selected.map((id) => {
              const label = chipLabel(id);
              const fam = chipFamily(id);
              const rowImg = props.results.find((r) => r.id === id)?.image;
              const metaImg = props.selectionMeta?.[id]?.image;
              const chipImg = rowImg || metaImg;
              return (
                <span key={id} className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-slate-100 text-slate-700 text-xs border max-w-full">
                  {chipImg ? (
                    <img
                      src={optimizeImage(chipImg, { w: 64 })}
                      alt=""
                      className="w-7 h-7 rounded object-cover shrink-0 border border-white shadow-sm"
                      onError={applyGenericImageFallback}
                    />
                  ) : null}
                  <span className="min-w-0 text-right">
                    <span className="block truncate max-w-[200px]">{label}</span>
                    {fam ? <span className="block truncate max-w-[200px] text-[10px] text-slate-500">{fam}</span> : null}
                  </span>
                  <button 
                    className="hover:text-red-600 shrink-0" 
                    onClick={() => props.onToggle(id)} 
                    aria-label={'إزالة'}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              );
            })}
          </div>
        ) : null}
        
        <div className="max-h-80 overflow-auto border rounded">
          {props.loading ? (
            <div className="p-4 text-center text-slate-500">{'جاري البحث...'}</div>
          ) : props.results.length === 0 ? (
            <div className="p-4 text-center text-slate-500">{'لا توجد نتائج'}</div>
          ) : (
            <ul className="divide-y">
              {visible.map((item, idx) => (
                <li
                  key={item.id}
                  className={`flex items-center justify-between gap-3 p-2.5 ${idx === focusedIndex ? 'bg-slate-50' : ''}`}
                  onMouseEnter={() => setFocusedIndex(idx)}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-slate-100 border border-slate-100">
                      {item.image ? (
                        <img
                          src={optimizeImage(item.image, { w: 112 })}
                          alt=""
                          className="h-full w-full object-cover"
                          onError={applyGenericImageFallback}
                        />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center text-[10px] text-slate-400">-</div>
                      )}
                    </div>
                    <div className="min-w-0 text-right flex-1">
                      <div className="truncate text-sm font-medium">{item.label}</div>
                      {item.sku ? (
                        <div className="truncate text-[11px] font-mono text-slate-500 mt-0.5">{item.sku}</div>
                      ) : null}
                      {showFam && item.familyName ? (
                        <div className="truncate text-[11px] text-indigo-600 font-medium mt-0.5">
                          {'عائلة:'} {item.familyName}
                        </div>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <input 
                      type="checkbox" 
                      checked={props.selected.includes(item.id)} 
                      onChange={() => props.onToggle(item.id)} 
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
        
                {totalPages > 1 ? (
          <div className="flex items-center justify-center gap-1.5 flex-wrap">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={safePage === 1}
            >
              {'السابق'}
            </Button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter((p) => p === 1 || p === totalPages || Math.abs(p - safePage) <= 1)
              .reduce<number[]>((acc, p, i, arr) => {
                if (i > 0 && p - arr[i - 1] > 1) acc.push(-1);
                acc.push(p);
                return acc;
              }, [])
              .map((p, i) =>
                p === -1 ? (
                  <span key={`dots-${i}`} className="px-1 text-slate-400">...</span>
                ) : (
                  <Button
                    key={p}
                    type="button"
                    variant={p === safePage ? 'default' : 'outline'}
                    size="sm"
                    className="min-w-9"
                    onClick={() => setCurrentPage(p)}
                  >
                    {p}
                  </Button>
                )
              )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage === totalPages}
            >
              {'التالي'}
            </Button>
          </div>
        ) : null}
        
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={props.onClose}>
            {'إلغاء'}
          </Button>
          <Button onClick={props.onApply}>
            {'حفظ'}
          </Button>
        </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

