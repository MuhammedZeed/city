import { useEffect, useState } from 'react';
import { BUILDING_ARTWORK } from '../data/buildingArtwork';
import { BuildingType } from '../types/game';

const processedCache = new Map<string, string>();
const inFlightCache = new Map<string, Promise<string>>();

/**
 * Flood-fills from the outer 4 edges of the image to remove the uniform white
 * studio background while keeping white roofs/windows inside the building intact.
 */
export function stripOuterWhiteBackground(src: string): Promise<string> {
  const cached = processedCache.get(src);
  if (cached) return Promise.resolve(cached);

  const pending = inFlightCache.get(src);
  if (pending) return pending;

  const promise = new Promise<string>((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const w = img.naturalWidth || img.width;
        const h = img.naturalHeight || img.height;
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(src);
          return;
        }
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, w, h);
        const data = imageData.data;

        const isNearWhite = (idx: number) => {
          const r = data[idx];
          const g = data[idx + 1];
          const b = data[idx + 2];
          // Pure/near-white studio background check
          return r >= 232 && g >= 232 && b >= 232 && Math.max(r, g, b) - Math.min(r, g, b) <= 18;
        };

        const visited = new Uint8Array(w * h);
        const queue = new Int32Array(w * h);
        let head = 0;
        let tail = 0;

        const enqueue = (x: number, y: number) => {
          const pos = y * w + x;
          if (visited[pos]) return;
          const idx = pos * 4;
          if (!isNearWhite(idx)) return;
          visited[pos] = 1;
          queue[tail++] = pos;
        };

        // Seed from all 4 perimeter edges
        for (let x = 0; x < w; x++) {
          enqueue(x, 0);
          enqueue(x, h - 1);
        }
        for (let y = 0; y < h; y++) {
          enqueue(0, y);
          enqueue(w - 1, y);
        }

        while (head < tail) {
          const pos = queue[head++];
          const px = pos % w;
          const py = (pos - px) / w;
          data[pos * 4 + 3] = 0;

          if (px > 0) enqueue(px - 1, py);
          if (px < w - 1) enqueue(px + 1, py);
          if (py > 0) enqueue(px, py - 1);
          if (py < h - 1) enqueue(px, py + 1);
        }

        // Soft 1px edge anti-aliasing on pixels adjacent to cleared background
        for (let y = 1; y < h - 1; y++) {
          for (let x = 1; x < w - 1; x++) {
            const pos = y * w + x;
            if (visited[pos]) continue;
            const hasClearedNeighbor =
              visited[pos - 1] ||
              visited[pos + 1] ||
              visited[pos - w] ||
              visited[pos + w];
            if (hasClearedNeighbor) {
              const idx = pos * 4;
              const lum = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
              if (lum > 215) {
                data[idx + 3] = Math.min(data[idx + 3], 130);
              }
            }
          }
        }

        ctx.putImageData(imageData, 0, 0);
        const outUrl = canvas.toDataURL('image/png');
        processedCache.set(src, outUrl);
        resolve(outUrl);
      } catch {
        resolve(src);
      }
    };
    img.onerror = () => resolve(src);
    img.src = src;
  });

  inFlightCache.set(src, promise);
  return promise;
}

export function useTransparentBuildingSprites(): Partial<Record<BuildingType, string>> {
  const [sprites, setSprites] = useState<Partial<Record<BuildingType, string>>>(() => {
    const initial: Partial<Record<BuildingType, string>> = {};
    (Object.keys(BUILDING_ARTWORK) as BuildingType[]).forEach((type) => {
      const raw = BUILDING_ARTWORK[type];
      if (raw && processedCache.has(raw)) {
        initial[type] = processedCache.get(raw)!;
      }
    });
    return initial;
  });

  useEffect(() => {
    let active = true;
    const entries = Object.entries(BUILDING_ARTWORK) as [BuildingType, string][];

    Promise.all(
      entries.map(async ([type, raw]) => {
        const clean = await stripOuterWhiteBackground(raw);
        return [type, clean] as const;
      })
    ).then((results) => {
      if (!active) return;
      const next: Partial<Record<BuildingType, string>> = {};
      for (const [t, url] of results) {
        next[t] = url;
      }
      setSprites(next);
    });

    return () => {
      active = false;
    };
  }, []);

  return sprites;
}
