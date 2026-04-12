import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight, Images, Loader2, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { usePageTitle } from '@/hooks/usePageTitle';
import { optimizeImage } from '@/lib/imageOptimization';
import { cn } from '@/lib/utils';

export type PortfolioMedia = { url: string; type: 'image' | 'video'; order?: number };
export type PortfolioPost = {
  _id: string;
  titleAr?: string;
  bodyAr?: string;
  media?: PortfolioMedia[];
  createdAt?: string;
};

function sortedMedia(m: PortfolioMedia[] | undefined) {
  if (!m?.length) return [];
  return [...m].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

function formatPostDate(iso?: string): string {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}

function PortfolioMediaThumb({
  item,
  className,
  overlay,
  onClick,
}: {
  item: PortfolioMedia;
  className?: string;
  overlay?: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'relative block w-full overflow-hidden bg-slate-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
        className
      )}
    >
      {item.type === 'video' ? (
        <>
          <video src={item.url} className="h-full w-full object-cover" muted playsInline preload="metadata" />
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/25">
            <span className="rounded-full bg-white/90 p-3 shadow-lg">
              <Play className="h-7 w-7 text-primary fill-primary" />
            </span>
          </span>
        </>
      ) : (
        <img
          src={optimizeImage(item.url, { w: 900 })}
          alt=""
          className="h-full w-full object-cover"
          loading="lazy"
        />
      )}
      {overlay}
    </button>
  );
}

/** Facebook-style preview: 2×large on top, 3×small below; +N on last cell when count > 5. */
function PortfolioPostGallery({
  media,
  onOpen,
}: {
  media: PortfolioMedia[];
  onOpen: (index: number) => void;
}) {
  const m = media;
  const n = m.length;
  if (n === 0) return null;

  const moreCount = n > 5 ? n - 5 : 0;

  if (n === 1) {
    return (
      <div className="overflow-hidden rounded-b-xl bg-slate-100" dir="ltr">
        <PortfolioMediaThumb item={m[0]} className="max-h-[min(72vh,560px)] min-h-[220px]" onClick={() => onOpen(0)} />
      </div>
    );
  }

  if (n === 2) {
    return (
      <div className="grid grid-cols-2 gap-0.5 bg-slate-200 overflow-hidden rounded-b-xl" dir="ltr">
        <PortfolioMediaThumb item={m[0]} className="aspect-[4/3] min-h-[160px]" onClick={() => onOpen(0)} />
        <PortfolioMediaThumb item={m[1]} className="aspect-[4/3] min-h-[160px]" onClick={() => onOpen(1)} />
      </div>
    );
  }

  if (n === 3) {
    return (
      <div
        className="grid grid-cols-2 grid-rows-2 gap-0.5 bg-slate-200 overflow-hidden rounded-b-xl min-h-[260px] max-h-[min(68vh,520px)]"
        dir="ltr"
      >
        <PortfolioMediaThumb item={m[0]} className="row-span-2 h-full min-h-[200px]" onClick={() => onOpen(0)} />
        <PortfolioMediaThumb item={m[1]} className="h-full min-h-[100px]" onClick={() => onOpen(1)} />
        <PortfolioMediaThumb item={m[2]} className="h-full min-h-[100px]" onClick={() => onOpen(2)} />
      </div>
    );
  }

  if (n === 4) {
    return (
      <div className="grid grid-cols-2 grid-rows-2 gap-0.5 bg-slate-200 overflow-hidden rounded-b-xl min-h-[240px] max-h-[min(70vh,540px)]" dir="ltr">
        {m.map((item, i) => (
          <PortfolioMediaThumb key={`${item.url}-${i}`} item={item} className="min-h-[120px] h-full" onClick={() => onOpen(i)} />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-0.5 bg-slate-200 overflow-hidden rounded-b-xl" dir="ltr">
      <div className="grid grid-cols-2 gap-0.5 h-[200px] sm:h-[240px] md:h-[280px]">
        <PortfolioMediaThumb item={m[0]} className="h-full" onClick={() => onOpen(0)} />
        <PortfolioMediaThumb item={m[1]} className="h-full" onClick={() => onOpen(1)} />
      </div>
      <div className="grid grid-cols-3 gap-0.5 h-[130px] sm:h-[150px] md:h-[180px]">
        <PortfolioMediaThumb item={m[2]} className="h-full" onClick={() => onOpen(2)} />
        <PortfolioMediaThumb item={m[3]} className="h-full" onClick={() => onOpen(3)} />
        <PortfolioMediaThumb
          item={m[4]}
          className="h-full"
          onClick={() => onOpen(4)}
          overlay={
            moreCount > 0 ? (
              <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/55">
                <span className="text-2xl sm:text-3xl font-black text-white tabular-nums drop-shadow-lg">+{moreCount}</span>
              </span>
            ) : undefined
          }
        />
      </div>
    </div>
  );
}

const PortfolioWork = () => {
  usePageTitle('أعمالنا السابقة');

  const [page, setPage] = useState(1);
  const [limit] = useState(12);
  const [loading, setLoading] = useState(true);
  const [totalPages, setTotalPages] = useState(1);
  const [posts, setPosts] = useState<PortfolioPost[]>([]);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [activePost, setActivePost] = useState<PortfolioPost | null>(null);
  const [mediaIndex, setMediaIndex] = useState(0);

  const load = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/portfolio-posts?page=${p}&limit=${limit}`, { cache: 'no-store' });
      const data = (await res.json()) as {
        ok?: boolean;
        items?: PortfolioPost[];
        totalPages?: number;
        page?: number;
      };
      if (!data.ok) {
        setPosts([]);
        setTotalPages(1);
        return;
      }
      setPosts(Array.isArray(data.items) ? data.items : []);
      setTotalPages(Math.max(1, Number(data.totalPages) || 1));
      setPage(Number(data.page) || p);
    } catch {
      setPosts([]);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    void load(1);
  }, [load]);

  const openViewer = (post: PortfolioPost, startIdx = 0) => {
    const list = sortedMedia(post.media);
    if (!list.length) return;
    setActivePost(post);
    setMediaIndex(Math.min(startIdx, list.length - 1));
    setViewerOpen(true);
  };

  const viewerMedia = useMemo(() => sortedMedia(activePost?.media), [activePost]);
  const current = viewerMedia[mediaIndex];

  const step = (delta: number) => {
    if (!viewerMedia.length) return;
    setMediaIndex((i) => (i + delta + viewerMedia.length) % viewerMedia.length);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50/80">
      <section className="relative py-14 md:py-20 overflow-hidden border-b border-slate-200/60">
        <div className="absolute inset-0 opacity-[0.07] pointer-events-none">
          <div className="absolute top-0 right-0 w-[28rem] h-[28rem] bg-primary rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-[24rem] h-[24rem] bg-secondary rounded-full blur-3xl" />
        </div>
        <div className="container mx-auto px-4 relative z-10 text-center space-y-4">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-secondary shadow-lg shadow-primary/25">
            <Images className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-3xl md:text-5xl font-black text-slate-900 tracking-tight">أعمالنا السابقة</h1>
          <p className="text-slate-600 max-w-2xl mx-auto text-sm md:text-lg leading-relaxed">
            لمحات من مشاريعنا وتنفيذاتنا — صور وفيديوهات من أرض الواقع، بجودة تعكس تجربتنا.
          </p>
        </div>
      </section>

      <section className="container mx-auto px-4 py-10 md:py-14 max-w-4xl">
        {loading ? (
          <div className="flex justify-center py-24">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
          </div>
        ) : posts.length === 0 ? (
          <div className="text-center py-20 rounded-3xl border border-dashed border-slate-200 bg-white/60">
            <p className="text-slate-500">لا يوجد محتوى منشور حالياً.</p>
          </div>
        ) : (
          <div className="space-y-8 md:space-y-10">
            {posts.map((post) => {
              const m = sortedMedia(post.media);
              const dateStr = formatPostDate(post.createdAt);
              return (
                <article
                  key={post._id}
                  className="rounded-2xl border border-slate-200/90 bg-white shadow-sm shadow-slate-200/40 overflow-hidden"
                >
                  <div className="flex items-start gap-3 px-4 pt-4 pb-3 border-b border-slate-100/90">
                    <div className="shrink-0 h-11 w-11 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-md shadow-primary/20">
                      <Images className="h-5 w-5 text-white" />
                    </div>
                    <div className="min-w-0 flex-1 text-right space-y-0.5">
                      <p className="font-bold text-slate-900 leading-snug">{post.titleAr?.trim() || 'منشور'}</p>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500">
                        {dateStr ? <span>{dateStr}</span> : null}
                        <span className="inline-flex items-center gap-1 text-slate-400">
                          <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden />
                          معرض أعمال
                        </span>
                      </div>
                    </div>
                  </div>

                  {post.bodyAr?.trim() ? (
                    <div className="px-4 pt-3 pb-2">
                      <p className="text-[15px] text-slate-800 leading-relaxed whitespace-pre-wrap">{post.bodyAr}</p>
                    </div>
                  ) : null}

                  <PortfolioPostGallery media={m} onOpen={(idx) => openViewer(post, idx)} />
                </article>
              );
            })}
          </div>
        )}

        {totalPages > 1 && !loading ? (
          <div className="flex justify-center items-center gap-3 mt-12">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => void load(page - 1)}>
              السابق
            </Button>
            <span className="text-sm text-slate-600 tabular-nums">
              {page} / {totalPages}
            </span>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => void load(page + 1)}>
              التالي
            </Button>
          </div>
        ) : null}
      </section>

      <Dialog open={viewerOpen} onOpenChange={setViewerOpen}>
        <DialogContent className="max-w-[min(96vw,1100px)] w-full p-0 gap-0 overflow-hidden bg-slate-950 border-slate-800 rounded-2xl">
          <DialogTitle className="sr-only">{activePost?.titleAr || 'معرض الوسائط'}</DialogTitle>
          {activePost && current ? (
            <div className="flex flex-col max-h-[90vh]">
              <div className="relative flex-1 min-h-[240px] md:min-h-[420px] bg-black flex items-center justify-center">
                {current.type === 'video' ? (
                  <video
                    key={current.url}
                    src={current.url}
                    className="max-h-[min(70vh,720px)] w-full object-contain"
                    controls
                    playsInline
                  />
                ) : (
                  <img
                    src={optimizeImage(current.url, { w: 1600 })}
                    alt=""
                    className="max-h-[min(70vh,720px)] w-full object-contain"
                  />
                )}
                {viewerMedia.length > 1 ? (
                  <>
                    <Button
                      type="button"
                      variant="secondary"
                      size="icon"
                      className="absolute right-2 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-white/90 shadow-lg"
                      onClick={() => step(-1)}
                    >
                      <ChevronRight className="h-6 w-6" />
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      size="icon"
                      className="absolute left-2 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-white/90 shadow-lg"
                      onClick={() => step(1)}
                    >
                      <ChevronLeft className="h-6 w-6" />
                    </Button>
                  </>
                ) : null}
              </div>
              <div className="bg-slate-900 border-t border-slate-800 p-4 space-y-3">
                <div>
                  <h3 className="text-lg font-bold text-white">{activePost.titleAr || 'منشور'}</h3>
                  {activePost.bodyAr?.trim() ? (
                    <p className="text-sm text-slate-300 mt-1 whitespace-pre-wrap leading-relaxed">{activePost.bodyAr}</p>
                  ) : null}
                </div>
                {viewerMedia.length > 1 ? (
                  <div className="flex gap-2 overflow-x-auto pb-1 pt-1 scrollbar-thin">
                    {viewerMedia.map((item, idx) => (
                      <button
                        key={`${item.url}-${idx}`}
                        type="button"
                        onClick={() => setMediaIndex(idx)}
                        className={cn(
                          'relative shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-all',
                          idx === mediaIndex ? 'border-primary ring-2 ring-primary/40' : 'border-transparent opacity-70 hover:opacity-100'
                        )}
                      >
                        {item.type === 'video' ? (
                          <video src={item.url} className="h-full w-full object-cover" muted playsInline />
                        ) : (
                          <img src={optimizeImage(item.url, { w: 128 })} alt="" className="h-full w-full object-cover" />
                        )}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PortfolioWork;
