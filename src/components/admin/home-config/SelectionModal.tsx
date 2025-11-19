import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Search, X } from 'lucide-react';

interface SelectionModalProps {
  open: boolean;
  title: string;
  search: string;
  onSearch: (v: string) => void;
  loading: boolean;
  results: Array<{ id: string; label: string; image?: string }>;
  visibleCount: number;
  onLoadMore: () => void;
  selected: string[];
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
  
  const visible = props.results.slice(0, props.visibleCount);
  const suggestions = props.search ? visible.slice(0, 5) : props.results.slice(0, 5);
  
  return (
    <Dialog open={props.open} onOpenChange={(open) => !open && props.onClose()}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
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
        
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Input 
              value={props.search} 
              onChange={(e) => props.onSearch(e.target.value)} 
              onKeyDown={onKeyDown} 
              placeholder="ابحث بالاسم..." 
            />
            <Search className="w-4 h-4 absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
          </div>
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
                {s.image ? <img src={s.image} alt="" className="w-5 h-5 rounded object-cover" /> : null}
                <span className="truncate max-w-[140px]">{s.label}</span>
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
              const label = props.results.find(r => r.id === id)?.label || id;
              return (
                <span key={id} className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-slate-100 text-slate-700 text-xs border">
                  {label}
                  <button 
                    className="hover:text-red-600" 
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
                  className={`flex items-center justify-between p-2 ${idx === focusedIndex ? 'bg-slate-50' : ''}`}
                  onMouseEnter={() => setFocusedIndex(idx)}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {item.image ? <img src={item.image} alt="" className="w-8 h-8 rounded object-cover flex-none" /> : null}
                    <div className="truncate text-sm">{item.label}</div>
                  </div>
                  <div className="flex items-center gap-2">
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
