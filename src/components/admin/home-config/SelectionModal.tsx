import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Search, X } from 'lucide-react';
import { applyGenericImageFallback, optimizeImage } from '@/lib/images';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

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
  
  useEffect(() => {
    setFocusedIndex(0);
  }, [props.results]);
  
  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!props.results.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusedIndex((i) => (i + 1) % props.results.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusedIndex((i) => (i - 1 + props.results.length) % props.results.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const item = props.results[focusedIndex];
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
  
  const visible = props.results.slice(0, props.visibleCount);
  const suggestions = props.search ? visible.slice(0, 5) : props.results.slice(0, 5);
  
  return (
    <Dialog open={props.open} onOpenChange={(open) => !open && props.onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Search className="w-5 h-5 text-blue-600" />
            {props.title}
          </DialogTitle>
          <DialogDescription>
            ابحث واختر العناصر المطلوبة من القائمة أدناه
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
        
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Input 
              value={props.search} 
              onChange={(e) => props.onSearch(e.target.value)} 
              onKeyDown={onKeyDown} 
              placeholder="ابحث بالاسم أو الكود..." 
            />
            <Search className="w-4 h-4 absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
          </div>
          {props.categoryOptions && props.categoryOptions.length > 0 && props.onCategoryFilterChange ? (
            <Select
              value={props.categoryFilter ?? 'all'}
              onValueChange={props.onCategoryFilterChange}
            >
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="الفئة" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الفئات</SelectItem>
                {props.categoryOptions.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}
          {props.search ? (
            <Button type="button" variant="ghost" size="sm" onClick={() => props.onSearch('')}>
              مسح
            </Button>
          ) : null}
          <Button type="button" onClick={props.onApply} disabled={props.loading}>
            تطبيق
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
                    aria-label="إزالة"
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
            <div className="p-4 text-center text-slate-500">جاري البحث...</div>
          ) : props.results.length === 0 ? (
            <div className="p-4 text-center text-slate-500">لا توجد نتائج</div>
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
                        <div className="h-full w-full flex items-center justify-center text-[10px] text-slate-400">—</div>
                      )}
                    </div>
                    <div className="min-w-0 text-right flex-1">
                      <div className="truncate text-sm font-medium">{item.label}</div>
                      {item.sku ? (
                        <div className="truncate text-[11px] font-mono text-slate-500 mt-0.5">{item.sku}</div>
                      ) : null}
                      {showFam && item.familyName ? (
                        <div className="truncate text-[11px] text-indigo-600 font-medium mt-0.5">
                          عائلة: {item.familyName}
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
        
        {props.results.length > props.visibleCount ? (
          <div className="flex justify-center">
            <Button variant="outline" size="sm" onClick={props.onLoadMore}>
              عرض 10 المزيد
            </Button>
          </div>
        ) : null}
        
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={props.onClose}>
            إلغاء
          </Button>
          <Button onClick={props.onApply}>
            حفظ
          </Button>
        </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
