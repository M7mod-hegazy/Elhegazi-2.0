import { useCallback, useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import { Loader2, MapPin, Search, Crosshair } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Fix Leaflet default marker assets under Vite. */
const defaultLeafletIcon = L.icon({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});
L.Marker.prototype.options.icon = defaultLeafletIcon;

const DEFAULT_CENTER: L.LatLngTuple = [24.7136, 46.6753];

/** Komoot Photon — do not pass `lang=ar` (unsupported → HTTP 400). */
const PHOTON_SEARCH = 'https://photon.komoot.io/api/';
/** Nominatim fallback (OSM). Browser requests: stay debounced; policy discourages heavy use. */
const NOMINATIM_SEARCH = 'https://nominatim.openstreetmap.org/search';

const MIN_SEARCH_LEN = 3;

type PhotonFeature = {
  geometry?: { type?: string; coordinates?: [number, number] };
  properties?: {
    name?: string;
    street?: string;
    city?: string;
    country?: string;
    state?: string;
  };
};

export function hasValidPick(lat: number | undefined, lng: number | undefined): boolean {
  if (lat == null || lng == null) return false;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  if (lat === 0 && lng === 0) return false;
  return true;
}

export function buildMapsUrls(lat: number, lng: number): { link: string; embed: string } {
  const link = `https://www.google.com/maps?q=${lat},${lng}`;
  // OSM embed avoids loading maps.googleapis.com inside iframes (fewer gen_204 / blocker issues in admin previews).
  const pad = 0.02;
  const embed = `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(`${lng - pad},${lat - pad},${lng + pad},${lat + pad}`)}&layer=mapnik&marker=${encodeURIComponent(`${lat},${lng}`)}`;
  return { link, embed };
}

async function fetchPhotonFeatures(q: string): Promise<PhotonFeature[]> {
  const url = `${PHOTON_SEARCH}?q=${encodeURIComponent(q)}&limit=8`;
  const r = await fetch(url, { method: 'GET', headers: { Accept: 'application/json' } });
  if (!r.ok) return [];
  const data = (await r.json()) as { features?: PhotonFeature[] };
  return Array.isArray(data.features) ? data.features : [];
}

type NominatimRow = { lat: string; lon: string; display_name?: string };

async function fetchNominatimFeatures(q: string): Promise<PhotonFeature[]> {
  const url = `${NOMINATIM_SEARCH}?format=jsonv2&q=${encodeURIComponent(q)}&limit=8`;
  const r = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      'Accept-Language': 'ar,en-US,en',
    },
  });
  if (!r.ok) return [];
  const rows = (await r.json()) as NominatimRow[];
  if (!Array.isArray(rows)) return [];
  return rows.map((row) => {
    const plat = parseFloat(row.lat);
    const plng = parseFloat(row.lon);
    return {
      geometry: { coordinates: [plng, plat] as [number, number] },
      properties: { name: row.display_name || 'موقع' },
    };
  });
}

/** Photon first; if empty or error, Nominatim (better Arabic / coverage). */
async function geocodeCombined(q: string): Promise<PhotonFeature[]> {
  try {
    const fromPhoton = await fetchPhotonFeatures(q);
    if (fromPhoton.length > 0) return fromPhoton;
  } catch {
    /* fall through */
  }
  try {
    return await fetchNominatimFeatures(q);
  } catch {
    return [];
  }
}

type PickerMode = 'map' | 'search' | 'locate';

export interface StoreMapPickerProps {
  lat: number | undefined;
  lng: number | undefined;
  onPick: (lat: number, lng: number) => void;
  className?: string;
}

/**
 * Store location picker: **OpenStreetMap** tiles + **Leaflet** (no Google API key, no billing).
 * Address search uses **Photon** (free). Customer-facing links/embeds can still point to Google Maps from coordinates.
 *
 * Customer “open in Google Maps” still uses a normal link (no Maps JS). Previews use OSM embed from buildMapsUrls().
 */
export function StoreMapPicker({ lat, lng, onPick, className }: StoreMapPickerProps) {
  const mapElRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);

  const [mode, setMode] = useState<PickerMode>('map');
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [geoPending, setGeoPending] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<PhotonFeature[]>([]);
  const [searchHint, setSearchHint] = useState<string | null>(null);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const centerOn = useCallback((plat: number, plng: number, zoom = 16) => {
    const map = mapRef.current;
    const marker = markerRef.current;
    if (!map || !marker) return;
    const ll = L.latLng(plat, plng);
    marker.setLatLng(ll);
    map.setView(ll, zoom, { animate: true });
  }, []);

  useEffect(() => {
    const el = mapElRef.current;
    if (!el) return;

    const start: L.LatLngTuple =
      hasValidPick(lat, lng) && lat != null && lng != null ? [lat, lng] : DEFAULT_CENTER;
    const zoom = hasValidPick(lat, lng) ? 16 : 12;

    const map = L.map(el, {
      center: start,
      zoom,
      scrollWheelZoom: true,
      zoomControl: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);

    const marker = L.marker(start, { draggable: true, icon: defaultLeafletIcon }).addTo(map);
    if (!hasValidPick(lat, lng)) {
      marker.setOpacity(0.35);
    }

    map.on('click', (e: L.LeafletMouseEvent) => {
      const { lat: la, lng: ln } = e.latlng;
      marker.setOpacity(1);
      marker.setLatLng(e.latlng);
      onPick(la, ln);
    });

    marker.on('dragend', () => {
      const p = marker.getLatLng();
      marker.setOpacity(1);
      onPick(p.lat, p.lng);
    });

    mapRef.current = map;
    markerRef.current = marker;
    setReady(true);

    const ro = new ResizeObserver(() => {
      map.invalidateSize({ animate: false });
    });
    ro.observe(el);
    resizeObserverRef.current = ro;

    return () => {
      ro.disconnect();
      resizeObserverRef.current = null;
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
      setReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- map init once per mount
  }, [onPick]);

  useEffect(() => {
    if (!ready || !hasValidPick(lat, lng) || lat == null || lng == null) return;
    const marker = markerRef.current;
    if (marker) marker.setOpacity(1);
    centerOn(lat, lng, 16);
  }, [lat, lng, ready, centerOn]);

  useEffect(() => {
    if (mode !== 'search') {
      setSearchResults([]);
      setSearchHint(null);
      return;
    }
    const q = searchQuery.trim();
    if (q.length < MIN_SEARCH_LEN) {
      setSearchResults([]);
      setSearchHint(null);
      return;
    }

    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      setSearchLoading(true);
      void geocodeCombined(q)
        .then((features) => {
          setSearchResults(features);
          setLoadError(null);
          setSearchHint(
            features.length === 0 ? 'لا توجد نتائج — جرّب اسم مدينة أو حي أو شارع أوّلاً.' : null
          );
        })
        .catch(() => {
          setLoadError('تعذر البحث — تحقق من الاتصال أو أعد المحاولة.');
          setSearchResults([]);
          setSearchHint(null);
        })
        .finally(() => setSearchLoading(false));
    }, 550);

    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, [searchQuery, mode]);

  const pickPhotonFeature = useCallback(
    (f: PhotonFeature) => {
      const coords = f.geometry?.coordinates;
      if (!coords || coords.length < 2) return;
      const [plng, plat] = coords;
      if (!Number.isFinite(plat) || !Number.isFinite(plng)) return;
      onPick(plat, plng);
      centerOn(plat, plng, 17);
      setSearchResults([]);
      setSearchQuery('');
    },
    [onPick, centerOn]
  );

  const formatPhotonLabel = (f: PhotonFeature): string => {
    const p = f.properties || {};
    const parts = [p.name, p.street, p.city, p.state, p.country].filter(Boolean);
    return parts.length ? parts.join('، ') : 'موقع';
  };

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      setLoadError('المتصفح لا يدعم تحديد الموقع');
      return;
    }
    setGeoPending(true);
    setLoadError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const plat = pos.coords.latitude;
        const plng = pos.coords.longitude;
        onPick(plat, plng);
        centerOn(plat, plng, 16);
        setGeoPending(false);
      },
      () => {
        setLoadError('تعذر الحصول على موقعك — تحقق من أذونات المتصفح');
        setGeoPending(false);
      },
      { enableHighAccuracy: true, timeout: 12000 }
    );
  };

  const valid = hasValidPick(lat, lng);

  const tabBtn = (active: boolean) =>
    cn(
      'rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors',
      active
        ? 'border-primary bg-primary text-primary-foreground shadow-sm'
        : 'border-border bg-muted/70 text-muted-foreground hover:border-primary/40 hover:bg-muted'
    );

  return (
    <div
      className={cn(
        'rounded-xl border border-primary/20 bg-gradient-to-b from-card via-card to-primary/[0.06] text-foreground overflow-hidden shadow-md',
        className
      )}
    >
      <div className="flex items-center justify-between gap-2 px-4 pt-4 pb-2 border-b border-primary/10">
        <h4 className="text-sm font-semibold flex items-center gap-2">
          <MapPin className="h-4 w-4 text-primary shrink-0" />
          موقع المتجر على الخريطة
        </h4>
        <span className="text-[10px] text-muted-foreground hidden sm:inline">OpenStreetMap — بدون مفتاح API</span>
      </div>

      <div className="flex flex-wrap gap-2 px-4 py-3">
        <button type="button" onClick={() => setMode('map')} className={tabBtn(mode === 'map')}>
          النقر على الخريطة
        </button>
        <button
          type="button"
          onClick={() => setMode('search')}
          className={cn(tabBtn(mode === 'search'), 'inline-flex items-center gap-1')}
        >
          <Search className="h-3.5 w-3.5" />
          بحث عن عنوان
        </button>
        <button
          type="button"
          onClick={() => {
            setMode('locate');
            useMyLocation();
          }}
          disabled={geoPending}
          className={cn(
            tabBtn(mode === 'locate'),
            'inline-flex items-center gap-1',
            geoPending && 'opacity-60 pointer-events-none'
          )}
        >
          <Crosshair className="h-3.5 w-3.5" />
          استخدام موقعي
        </button>
      </div>

      {mode === 'map' && (
        <p className="px-4 pb-2 text-xs text-muted-foreground leading-relaxed">
          انقر على الخريطة لوضع الدبوس. يمكنك سحب الدبوس للضبط الدقيق.
        </p>
      )}

      {mode === 'search' && (
        <div className="px-4 pb-2 relative z-[500]">
          <label className="sr-only" htmlFor="store-map-search">
            بحث عن عنوان
          </label>
          <div className="relative">
            <input
              id="store-map-search"
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setLoadError(null);
                setSearchHint(null);
              }}
              placeholder="مثال: الرياض، طريق الملك فهد…"
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background"
              autoComplete="off"
            />
            {searchLoading && (
              <Loader2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-primary" />
            )}
          </div>
          <p className="mt-1.5 text-[11px] text-muted-foreground">
            بحث مجاني (Photon ثم OpenStreetMap) — {MIN_SEARCH_LEN} أحرف على الأقل. اختر نتيجة من القائمة.
          </p>
          {searchHint && !searchLoading && (
            <p className="mt-2 text-xs text-muted-foreground">{searchHint}</p>
          )}
          {searchResults.length > 0 && (
            <ul className="mt-2 max-h-44 overflow-auto rounded-lg border border-border bg-popover text-popover-foreground shadow-md">
              {searchResults.map((f, i) => (
                <li key={i} className="border-b border-border last:border-0">
                  <button
                    type="button"
                    className="w-full text-right px-3 py-2 text-xs hover:bg-accent hover:text-accent-foreground transition-colors"
                    onClick={() => pickPhotonFeature(f)}
                  >
                    {formatPhotonLabel(f)}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {loadError && (
        <div className="mx-4 mb-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {loadError}
        </div>
      )}

      <div className="relative mx-4 mb-2 h-[min(52vh,420px)] min-h-[220px] rounded-lg overflow-hidden border border-primary/15 bg-muted/30 [&_.leaflet-container]:font-sans">
        {!ready && (
          <div className="absolute inset-0 z-[400] flex flex-col items-center justify-center gap-2 bg-background/90 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="text-sm">جاري تجهيز الخريطة…</span>
          </div>
        )}
        <div ref={mapElRef} className="h-full w-full z-[1]" />
      </div>

      <p className="px-4 pb-2 text-[11px] text-muted-foreground">
        الخرائط © مساهمو OpenStreetMap — روابط «خرائط جوجل» للزوار تُبنى تلقائياً من الإحداثيات.
      </p>

      <div className="border-t border-primary/10 bg-muted/40 px-4 py-3">
        <h5 className="text-xs font-semibold text-foreground mb-2">الإحداثيات المختارة</h5>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Latitude</span>
            <div className="mt-0.5 rounded-md border border-border bg-background px-2 py-1.5 font-mono text-sm">
              {valid && lat != null ? lat.toFixed(6) : '—'}
            </div>
          </div>
          <div>
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Longitude</span>
            <div className="mt-0.5 rounded-md border border-border bg-background px-2 py-1.5 font-mono text-sm">
              {valid && lng != null ? lng.toFixed(6) : '—'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
