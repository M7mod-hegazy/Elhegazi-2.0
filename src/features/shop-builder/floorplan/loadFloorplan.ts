declare global {
  interface Window {
    Floorplan?: unknown; // The UMD build attaches itself here
  }
}

const CDN_URL = "https://cdn.jsdelivr.net/npm/@smplrspace/floorplan@latest/dist/floorplan.umd.js";

let loadingPromise: Promise<unknown | null> | null = null;

export async function loadFloorplan(): Promise<unknown | null> {
  if (typeof window === 'undefined') return null;
  if (window.Floorplan) return window.Floorplan;
  if (loadingPromise) return loadingPromise;

  loadingPromise = new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = CDN_URL;
    script.async = true;
    script.crossOrigin = 'anonymous';
    script.onload = () => {
      resolve(window.Floorplan ?? null);
    };
    script.onerror = () => resolve(null);
    document.head.appendChild(script);
  });

  return loadingPromise;
}
