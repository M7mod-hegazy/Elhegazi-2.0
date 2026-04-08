import React from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  ChevronDown,
  ChevronUp,
  Grid3X3,
  Home,
  Megaphone,
  FolderKanban,
  Star,
  Flame,
  BadgePercent,
  Sparkles,
  Info,
  MapPin,
  Clock3,
} from 'lucide-react';
import type { HomeConfig, SectionToggle } from '@/types/home-config';

interface SectionsManagementModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cfg: HomeConfig;
  setCfg: (cfg: HomeConfig) => void;
  toggleMap: (section: 'featuredProducts' | 'bestSellers' | 'sale' | 'newArrivals') => void;
}

type SectionMeta = {
  title: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
};

const DEFAULT_ORDER = ['hero', 'promoStrip', 'categories', 'featuredProducts', 'bestSellers', 'sale', 'newArrivals', 'about', 'locations', 'workHours'];

const SECTION_META: Record<string, SectionMeta> = {
  hero: {
    title: '??? ?????? ???????',
    subtitle: '?????? ??????? ?? ???? ??????',
    icon: Home,
  },
  promoStrip: {
    title: '?????? ????????',
    subtitle: '???? ????????? ???????',
    icon: Megaphone,
  },
  categories: {
    title: '?????? ???????',
    subtitle: '??? ?????? ?? ??????',
    icon: FolderKanban,
  },
  featuredProducts: {
    title: '???????? ???????',
    subtitle: '???????? ???????? ??????',
    icon: Star,
  },
  bestSellers: {
    title: '?????? ??????',
    subtitle: '???????? ?????? ??????',
    icon: Flame,
  },
  sale: {
    title: '?????? ?????????',
    subtitle: '?????? ?????? ?????????',
    icon: BadgePercent,
  },
  newArrivals: {
    title: '???????? ???????',
    subtitle: '???? ???????? ???????',
    icon: Sparkles,
  },
  about: {
    title: '??? ?? ???',
    subtitle: '??????? ??????',
    icon: Info,
  },
  locations: {
    title: '??????? ???????',
    subtitle: '????? ????? ??????',
    icon: MapPin,
  },
  workHours: {
    title: '????? ?????',
    subtitle: '????? ??? ??????',
    icon: Clock3,
  },
};

export const SectionsManagementModal: React.FC<SectionsManagementModalProps> = ({
  open,
  onOpenChange,
  cfg,
  setCfg,
}) => {
  const order = cfg.sectionsOrder?.length ? cfg.sectionsOrder : DEFAULT_ORDER;

  const move = (fromIndex: number, direction: number) => {
    const newOrder = [...order];
    const toIndex = fromIndex + direction;
    if (toIndex >= 0 && toIndex < newOrder.length) {
      [newOrder[fromIndex], newOrder[toIndex]] = [newOrder[toIndex], newOrder[fromIndex]];
      setCfg({ ...cfg, sectionsOrder: newOrder });
    }
  };

  const isEnabled = (key: string) => {
    if (key === 'hero') return cfg.heroEnabled ?? true;
    const current = cfg.toggles.find((t) => t.key === key);
    return current?.enabled ?? true;
  };

  const setEnabled = (key: string, val: boolean) => {
    if (key === 'hero') {
      setCfg({ ...cfg, heroEnabled: val });
      return;
    }

    const exists = cfg.toggles.find((t) => t.key === key);
    let toggles: SectionToggle[];
    if (exists) {
      toggles = cfg.toggles.map((t) => (t.key === key ? { ...t, enabled: val } : t));
    } else {
      toggles = [...cfg.toggles, { key, enabled: val }];
    }
    setCfg({ ...cfg, toggles });
  };

  const enabledCount = order.filter((key) => isEnabled(key)).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto border-border bg-background p-0">
        <div className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 px-6 py-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-foreground">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Grid3X3 className="h-4 w-4" />
              </span>
              ????? ????? ???????
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              ???? ??????? ???? ?? ???? ?? ?????? ???????? ?????? ???? ?????.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div className="rounded-xl border border-border bg-muted/20 p-3 sm:p-4 flex items-center justify-between gap-3">
            <div className="text-sm text-foreground font-semibold">??????? ????????</div>
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1 text-sm">
              <span className="text-primary font-bold">{enabledCount}</span>
              <span className="text-muted-foreground">/ {order.length}</span>
            </div>
          </div>

          <div className="space-y-3">
            {order.map((key, idx) => {
              const meta = SECTION_META[key] || {
                title: key,
                subtitle: '??? ????',
                icon: Grid3X3,
              };
              const Icon = meta.icon;
              const enabled = isEnabled(key);

              return (
                <div
                  key={key}
                  className="group rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-sm transition-all hover:shadow-md"
                >
                  <div className="flex items-center gap-3 sm:gap-4">
                    <div className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <Icon className="h-5 w-5" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="text-base sm:text-lg font-bold text-foreground">{meta.title}</div>
                      <div className="text-xs sm:text-sm text-muted-foreground mt-0.5">{meta.subtitle}</div>
                    </div>

                    <div className="hidden sm:flex flex-col gap-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => move(idx, -1)}
                        disabled={idx === 0}
                        title="????? ??????"
                        aria-label="????? ??????"
                      >
                        <ChevronUp className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => move(idx, 1)}
                        disabled={idx === order.length - 1}
                        title="????? ??????"
                        aria-label="????? ??????"
                      >
                        <ChevronDown className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <div
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold border ${
                          enabled
                            ? 'bg-primary/10 text-primary border-primary/20'
                            : 'bg-muted text-muted-foreground border-border'
                        }`}
                      >
                        {enabled ? '?????' : '?????'}
                      </div>
                      <div className="flex items-center gap-2">
                        <Label className="text-xs sm:text-sm text-muted-foreground">?????</Label>
                        <Switch checked={enabled} onCheckedChange={(val) => setEnabled(key, val)} />
                      </div>
                    </div>
                  </div>

                  <div className="sm:hidden mt-3 pt-3 border-t border-border flex items-center justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => move(idx, -1)}
                      disabled={idx === 0}
                      title="????? ??????"
                      aria-label="????? ??????"
                    >
                      <ChevronUp className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => move(idx, 1)}
                      disabled={idx === order.length - 1}
                      title="????? ??????"
                      aria-label="????? ??????"
                    >
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="pt-2 flex justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => setCfg({ ...cfg, sectionsOrder: DEFAULT_ORDER })}
            >
              ??????? ??????? ?????????
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
