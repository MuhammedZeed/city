import React, { useCallback, useEffect, useRef } from 'react';
import { MaritimeState, SeaExpedition } from '../types/game';

export const STAGE_W = 1920;
export const STAGE_H = 1080;

export interface WaterHoverEntity {
  kind: 'ship' | 'pier' | 'offshore_zone' | 'river';
  id: string;
  title: string;
  subtitle: string;
  targetPlotId?: 'p-seaport' | 'p-offshore';
}

interface CoastalWaterLayerProps {
  maritime: MaritimeState;
  seaportBuilt: boolean;
  seaportLevel: number;
  offshoreBuilt: boolean;
  offshoreLevel: number;
  selectedPlotId: string | null;
  hoveredPlotId: string | null;
  onHoverWaterEntity: (entity: WaterHoverEntity | null) => void;
  onSelectPlot: (plotId: string) => void;
  canClick: () => boolean;
}

interface LiveShipHitbox {
  id: string;
  x: number;
  y: number;
  radius: number;
  entity: WaterHoverEntity;
}

interface WaterRipple {
  x: number;
  y: number;
  bornAt: number;
  maxRadius: number;
}

interface WaveGlintSeed {
  u: number;
  v: number;
  phase: number;
  speed: number;
  size: number;
}

// Sea polygon covering the upper-right ocean right up to the wet golden sand & lighthouse rock jetty
const MAIN_SEA_UV: readonly (readonly [number, number])[] = [
  [0.688, 0.0],
  [1.0, 0.0],
  [1.0, 0.362],
  [0.955, 0.336],
  [0.912, 0.328],
  [0.852, 0.284],
  [0.788, 0.237],
  [0.724, 0.189],
  [0.67, 0.147],
  [0.636, 0.107],
  [0.633, 0.074],
  [0.648, 0.055],
  [0.685, 0.041],
  [0.695, 0.026],
];

// Small cove water immediately left of the stone lighthouse jetty
const COVE_SEA_UV: readonly (readonly [number, number])[] = [
  [0.598, 0.0],
  [0.648, 0.0],
  [0.652, 0.022],
  [0.624, 0.021],
];

// Upper river northwest of the stone bridge
const UPPER_RIVER_UV: readonly (readonly [number, number])[] = [
  [0.0, 0.626],
  [0.054, 0.676],
  [0.116, 0.686],
  [0.175, 0.726],
  [0.222, 0.765],
  [0.184, 0.798],
  [0.146, 0.836],
  [0.095, 0.793],
  [0.036, 0.742],
  [0.0, 0.715],
];

// Lower river southeast of the stone bridge (bridge arches remain crisply above)
const LOWER_RIVER_UV: readonly (readonly [number, number])[] = [
  [0.234, 0.835],
  [0.278, 0.822],
  [0.316, 0.892],
  [0.351, 1.0],
  [0.281, 1.0],
  [0.246, 0.942],
  [0.195, 0.884],
  [0.174, 0.863],
];

function traceUVPoly(
  ctx: CanvasRenderingContext2D,
  pts: readonly (readonly [number, number])[]
) {
  ctx.beginPath();
  pts.forEach(([u, v], i) => {
    const x = u * STAGE_W;
    const y = v * STAGE_H;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.closePath();
}

function pointInPoly(
  x: number,
  y: number,
  pts: readonly (readonly [number, number])[]
): boolean {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const xi = pts[i][0] * STAGE_W;
    const yi = pts[i][1] * STAGE_H;
    const xj = pts[j][0] * STAGE_W;
    const yj = pts[j][1] * STAGE_H;
    const intersect =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi + 1e-6) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function quadPoint(
  p0: readonly [number, number],
  p1: readonly [number, number],
  p2: readonly [number, number],
  t: number
): { x: number; y: number; angle: number } {
  const mt = 1 - t;
  const x = (mt * mt * p0[0] + 2 * mt * t * p1[0] + t * t * p2[0]) * STAGE_W;
  const y = (mt * mt * p0[1] + 2 * mt * t * p1[1] + t * t * p2[1]) * STAGE_H;
  const dx =
    (2 * mt * (p1[0] - p0[0]) + 2 * t * (p2[0] - p1[0])) * STAGE_W;
  const dy =
    (2 * mt * (p1[1] - p0[1]) + 2 * t * (p2[1] - p1[1])) * STAGE_H;
  return { x, y, angle: Math.atan2(dy, dx) };
}

function buildGlintSeeds(): WaveGlintSeed[] {
  const seeds: WaveGlintSeed[] = [];
  for (let i = 0; i < 160; i++) {
    // Deterministic pseudo-random spread over sea region
    const s1 = Math.abs(Math.sin(i * 12.9898) * 43758.5453) % 1;
    const s2 = Math.abs(Math.sin(i * 78.233 + 1.7) * 24634.6345) % 1;
    const s3 = Math.abs(Math.sin(i * 39.425 + 4.1) * 19534.1234) % 1;
    const u = 0.64 + s1 * 0.355;
    const v = 0.015 + s2 * 0.335;
    if (pointInPoly(u * STAGE_W, v * STAGE_H, MAIN_SEA_UV)) {
      seeds.push({
        u,
        v,
        phase: s3 * Math.PI * 2,
        speed: 0.9 + (i % 5) * 0.32,
        size: 1.1 + (i % 3) * 0.65,
      });
    }
  }
  return seeds;
}

const GLINT_SEEDS = buildGlintSeeds();

function drawShipVessel(
  ctx: CanvasRenderingContext2D,
  opts: {
    x: number;
    y: number;
    angle: number;
    scale: number;
    variant: 'cargo' | 'survey' | 'tug';
    tSec: number;
    speedFactor: number;
    isExpedition?: boolean;
    isHovered?: boolean;
  }
) {
  const {
    x,
    y,
    angle,
    scale,
    variant,
    tSec,
    speedFactor,
    isExpedition,
    isHovered,
  } = opts;

  const bob = Math.sin(tSec * 2.3 + x * 0.02) * 1.4;
  ctx.save();
  ctx.translate(x, y + bob);

  // Subtle highlight halo if hovered
  if (isHovered) {
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(0, 2, 34 * scale, 18 * scale, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(56, 189, 248, 0.22)';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = variant === 'survey' ? '#FBBF24' : '#38BDF8';
    ctx.stroke();
    ctx.restore();
  }

  ctx.rotate(angle);

  // Animated V-shaped white water wake behind moving vessels
  if (speedFactor > 0.05) {
    const wakeLen = (34 + speedFactor * 28) * scale;
    const wakeSpread = (11 + speedFactor * 7) * scale;
    const shimmer = 0.72 + 0.28 * Math.sin(tSec * 6.5);

    const wakeGrad = ctx.createLinearGradient(-12 * scale, 0, -wakeLen, 0);
    wakeGrad.addColorStop(0, `rgba(224, 247, 255, ${0.52 * shimmer})`);
    wakeGrad.addColorStop(0.55, `rgba(186, 230, 253, ${0.24 * shimmer})`);
    wakeGrad.addColorStop(1, 'rgba(186, 230, 253, 0)');

    ctx.fillStyle = wakeGrad;
    ctx.beginPath();
    ctx.moveTo(-10 * scale, -2.5 * scale);
    ctx.lineTo(-wakeLen, -wakeSpread);
    ctx.lineTo(-wakeLen * 0.85, 0);
    ctx.lineTo(-wakeLen, wakeSpread);
    ctx.lineTo(-10 * scale, 2.5 * scale);
    ctx.closePath();
    ctx.fill();

    // Twin foam wavelets along wake edges
    ctx.strokeStyle = `rgba(240, 249, 255, ${0.42 * shimmer})`;
    ctx.lineWidth = 1.25 * scale;
    ctx.beginPath();
    ctx.moveTo(-11 * scale, -3 * scale);
    ctx.lineTo(-wakeLen * 0.75, -wakeSpread * 0.78);
    ctx.moveTo(-11 * scale, 3 * scale);
    ctx.lineTo(-wakeLen * 0.75, wakeSpread * 0.78);
    ctx.stroke();
  } else {
    // Gentle mooring ripple around docked ship
    const rPulse = 0.5 + 0.5 * Math.sin(tSec * 1.9);
    ctx.strokeStyle = `rgba(186, 230, 253, ${0.22 + rPulse * 0.14})`;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.ellipse(0, 1, 24 * scale, 9 * scale, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Water contact shadow
  ctx.fillStyle = 'rgba(4, 18, 34, 0.42)';
  ctx.beginPath();
  ctx.ellipse(1 * scale, 3.5 * scale, 20 * scale, 7.5 * scale, 0, 0, Math.PI * 2);
  ctx.fill();

  // Bow foam splash
  if (speedFactor > 0.15) {
    ctx.strokeStyle = 'rgba(248, 250, 252, 0.72)';
    ctx.lineWidth = 1.4 * scale;
    ctx.beginPath();
    ctx.moveTo(15 * scale, -3 * scale);
    ctx.quadraticCurveTo(22 * scale, 0, 15 * scale, 3 * scale);
    ctx.stroke();
  }

  if (variant === 'cargo') {
    // Sleek steel cargo freighter hull
    ctx.fillStyle = isExpedition ? '#1E3A5F' : '#1E293B';
    ctx.strokeStyle = '#64748B';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(21 * scale, 0);
    ctx.quadraticCurveTo(15 * scale, -6.5 * scale, 6 * scale, -6.5 * scale);
    ctx.lineTo(-18 * scale, -6 * scale);
    ctx.lineTo(-20 * scale, -3.5 * scale);
    ctx.lineTo(-20 * scale, 3.5 * scale);
    ctx.lineTo(-18 * scale, 6 * scale);
    ctx.lineTo(6 * scale, 6.5 * scale);
    ctx.quadraticCurveTo(15 * scale, 6.5 * scale, 21 * scale, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Red waterline trim
    ctx.strokeStyle = '#B91C1C';
    ctx.lineWidth = 1.1 * scale;
    ctx.beginPath();
    ctx.moveTo(18 * scale, 0);
    ctx.lineTo(-17 * scale, 4.8 * scale);
    ctx.stroke();

    // Cargo deck & colored shipping containers
    ctx.fillStyle = '#334155';
    ctx.fillRect(-10 * scale, -4.4 * scale, 20 * scale, 8.8 * scale);

    const containerColors = isExpedition
      ? ['#F59E0B', '#0284C7', '#D97706', '#0EA5E9']
      : ['#0369A1', '#B45309', '#0F766E', '#475569'];
    for (let c = 0; c < 4; c++) {
      const cx = (-8.5 + c * 4.6) * scale;
      ctx.fillStyle = containerColors[c % containerColors.length];
      ctx.fillRect(cx, -3.6 * scale, 3.8 * scale, 3.1 * scale);
      ctx.fillStyle = containerColors[(c + 1) % containerColors.length];
      ctx.fillRect(cx, 0.4 * scale, 3.8 * scale, 3.1 * scale);
    }

    // White aft bridge superstructure
    ctx.fillStyle = '#F8FAFC';
    ctx.fillRect(-16.5 * scale, -4.5 * scale, 5.2 * scale, 9 * scale);
    ctx.fillStyle = '#0F172A';
    ctx.fillRect(-13.8 * scale, -3.6 * scale, 1.5 * scale, 7.2 * scale);

    // Expedition beacon or navigation mast light
    ctx.fillStyle = isExpedition ? '#FBBF24' : '#38BDF8';
    ctx.beginPath();
    ctx.arc(-14.5 * scale, 0, 1.7 * scale, 0, Math.PI * 2);
    ctx.fill();
  } else if (variant === 'survey') {
    // Offshore seismic / survey vessel (high-visibility orange & white)
    ctx.fillStyle = '#C2410C';
    ctx.strokeStyle = '#FDBA74';
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.moveTo(18 * scale, 0);
    ctx.quadraticCurveTo(12 * scale, -5.8 * scale, 3 * scale, -5.8 * scale);
    ctx.lineTo(-16 * scale, -5.2 * scale);
    ctx.lineTo(-16 * scale, 5.2 * scale);
    ctx.lineTo(3 * scale, 5.8 * scale);
    ctx.quadraticCurveTo(12 * scale, 5.8 * scale, 18 * scale, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Working aft deck
    ctx.fillStyle = '#334155';
    ctx.fillRect(-14 * scale, -3.8 * scale, 14 * scale, 7.6 * scale);

    // Forward white wheelhouse + helipad ring on bow
    ctx.fillStyle = '#F8FAFC';
    ctx.fillRect(2 * scale, -4.2 * scale, 6.5 * scale, 8.4 * scale);
    ctx.fillStyle = '#0F172A';
    ctx.fillRect(6.5 * scale, -3.2 * scale, 1.4 * scale, 6.4 * scale);

    // Helipad circle on forward deck
    ctx.strokeStyle = '#FDE047';
    ctx.lineWidth = 1 * scale;
    ctx.beginPath();
    ctx.arc(11.5 * scale, 0, 2.5 * scale, 0, Math.PI * 2);
    ctx.stroke();

    // Aft seismic A-frame / crane
    ctx.strokeStyle = '#FBBF24';
    ctx.lineWidth = 1.6 * scale;
    ctx.beginPath();
    ctx.moveTo(-14.5 * scale, -3.2 * scale);
    ctx.lineTo(-11 * scale, 0);
    ctx.lineTo(-14.5 * scale, 3.2 * scale);
    ctx.stroke();

    // Pulsing amber survey beacon
    const pulse = 0.55 + 0.45 * Math.sin(tSec * 4.8);
    ctx.fillStyle = `rgba(251, 191, 36, ${pulse})`;
    ctx.beginPath();
    ctx.arc(4.8 * scale, 0, 2.1 * scale, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // Sleek harbor pilot / river tug boat
    ctx.fillStyle = '#0F172A';
    ctx.strokeStyle = '#94A3B8';
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.moveTo(12 * scale, 0);
    ctx.quadraticCurveTo(7 * scale, -4.2 * scale, -9 * scale, -3.6 * scale);
    ctx.lineTo(-10 * scale, 3.6 * scale);
    ctx.quadraticCurveTo(7 * scale, 4.2 * scale, 12 * scale, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#F8FAFC';
    ctx.fillRect(-3.5 * scale, -2.5 * scale, 6.2 * scale, 5 * scale);
    ctx.fillStyle = '#38BDF8';
    ctx.fillRect(0.8 * scale, -1.8 * scale, 1.5 * scale, 3.6 * scale);
  }

  ctx.restore();
}

export const CoastalWaterLayer: React.FC<CoastalWaterLayerProps> = ({
  maritime,
  seaportBuilt,
  seaportLevel,
  offshoreBuilt,
  offshoreLevel,
  selectedPlotId,
  hoveredPlotId,
  onHoverWaterEntity,
  onSelectPlot,
  canClick,
}) => {
  const waterCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const shipCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const offscreenBathymetryRef = useRef<HTMLCanvasElement | null>(null);

  const shipsHitboxesRef = useRef<LiveShipHitbox[]>([]);
  const ripplesRef = useRef<WaterRipple[]>([]);
  const hoveredShipIdRef = useRef<string | null>(null);
  const lastHoverIdRef = useRef<string | null>(null);

  // Latest props ref for smooth 60fps rAF loop without tearing down loop each second
  const latestPropsRef = useRef({
    maritime,
    seaportBuilt,
    seaportLevel,
    offshoreBuilt,
    offshoreLevel,
  });
  latestPropsRef.current = {
    maritime,
    seaportBuilt,
    seaportLevel,
    offshoreBuilt,
    offshoreLevel,
  };

  // Build cached bathymetry offscreen canvas once
  const ensureBathymetryCache = useCallback(() => {
    if (offscreenBathymetryRef.current) return offscreenBathymetryRef.current;
    const c = document.createElement('canvas');
    c.width = STAGE_W;
    c.height = STAGE_H;
    const ctx = c.getContext('2d');
    if (!ctx) return c;

    // Helper: draw soft wet-sand feather border + rich bathymetry fill
    const fillSeaPolygon = (pts: readonly (readonly [number, number])[]) => {
      ctx.save();
      traceUVPoly(ctx, pts);
      ctx.clip();

      // Bathymetry gradient from warm sandy shallow shoreline (bottom-left of sea) to deep open ocean (top-right)
      const grad = ctx.createLinearGradient(
        0.72 * STAGE_W,
        0.25 * STAGE_H,
        0.96 * STAGE_W,
        0.02 * STAGE_H
      );
      grad.addColorStop(0.0, 'rgba(62, 166, 178, 0.92)');
      grad.addColorStop(0.18, 'rgba(38, 132, 156, 0.96)');
      grad.addColorStop(0.48, 'rgba(21, 94, 128, 0.98)');
      grad.addColorStop(0.82, 'rgba(13, 62, 95, 0.99)');
      grad.addColorStop(1.0, 'rgba(9, 44, 72, 0.99)');
      ctx.fillStyle = grad;
      ctx.fillRect(0.58 * STAGE_W, 0, 0.42 * STAGE_W, 0.38 * STAGE_H);

      // Shallow turquoise sandbar glow hugging the shoreline
      ctx.strokeStyle = 'rgba(103, 212, 218, 0.36)';
      ctx.lineWidth = 26;
      ctx.lineJoin = 'round';
      traceUVPoly(ctx, pts);
      ctx.stroke();

      // Subtle atmospheric sunlit mist at far top-right horizon
      const mist = ctx.createRadialGradient(
        0.96 * STAGE_W,
        0.04 * STAGE_H,
        12,
        0.95 * STAGE_W,
        0.04 * STAGE_H,
        240
      );
      mist.addColorStop(0, 'rgba(226, 242, 252, 0.32)');
      mist.addColorStop(0.55, 'rgba(186, 224, 245, 0.12)');
      mist.addColorStop(1, 'rgba(186, 224, 245, 0)');
      ctx.fillStyle = mist;
      ctx.fillRect(0.78 * STAGE_W, 0, 0.22 * STAGE_W, 0.22 * STAGE_H);

      ctx.restore();
    };

    fillSeaPolygon(MAIN_SEA_UV);
    fillSeaPolygon(COVE_SEA_UV);

    // River bathymetry gradient (upper & lower segments)
    const fillRiverPolygon = (pts: readonly (readonly [number, number])[]) => {
      ctx.save();
      traceUVPoly(ctx, pts);
      ctx.clip();
      const rGrad = ctx.createLinearGradient(0, 0.65 * STAGE_H, 0.35 * STAGE_W, 1.0 * STAGE_H);
      rGrad.addColorStop(0, 'rgba(25, 108, 152, 0.88)');
      rGrad.addColorStop(0.5, 'rgba(20, 92, 138, 0.9)');
      rGrad.addColorStop(1, 'rgba(16, 76, 118, 0.92)');
      ctx.fillStyle = rGrad;
      ctx.fillRect(0, 0.6 * STAGE_H, 0.38 * STAGE_W, 0.4 * STAGE_H);

      ctx.strokeStyle = 'rgba(125, 211, 252, 0.22)';
      ctx.lineWidth = 10;
      traceUVPoly(ctx, pts);
      ctx.stroke();
      ctx.restore();
    };

    fillRiverPolygon(UPPER_RIVER_UV);
    fillRiverPolygon(LOWER_RIVER_UV);

    offscreenBathymetryRef.current = c;
    return c;
  }, []);

  useEffect(() => {
    const reducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let rafId = 0;
    let lastDrawMs = 0;

    const renderFrame = (nowMs: number) => {
      // Cap frame rate cleanly at ~45-60fps
      if (!reducedMotion && nowMs - lastDrawMs < 18) {
        rafId = requestAnimationFrame(renderFrame);
        return;
      }
      lastDrawMs = nowMs;

      const waterCanvas = waterCanvasRef.current;
      const shipCanvas = shipCanvasRef.current;
      if (!waterCanvas || !shipCanvas) {
        rafId = requestAnimationFrame(renderFrame);
        return;
      }
      const wCtx = waterCanvas.getContext('2d');
      const sCtx = shipCanvas.getContext('2d');
      if (!wCtx || !sCtx) return;

      const tSec = reducedMotion ? 1.5 : nowMs / 1000;
      const wallNow = Date.now();
      const {
        maritime: liveMaritime,
        seaportBuilt: hasPort,
        seaportLevel: portLv,
        offshoreBuilt: hasRig,
        offshoreLevel: rigLv,
      } = latestPropsRef.current;

      // 1. WATER CANVAS (Bathymetry + Animated Waves + Sun Glints + Surf Foam + Ripples)
      wCtx.clearRect(0, 0, STAGE_W, STAGE_H);
      const bath = ensureBathymetryCache();
      wCtx.drawImage(bath, 0, 0);

      // Animate Sea Surfaces
      wCtx.save();
      traceUVPoly(wCtx, MAIN_SEA_UV);
      wCtx.clip();

      // Subtle directional ocean swell bands drifting shoreward
      wCtx.lineCap = 'round';
      for (let i = 0; i < 42; i++) {
        const lane = i / 42;
        const drift = ((tSec * 0.032 + lane * 1.37) % 1) - 0.1;
        const baseX = (0.67 + lane * 0.33 - drift * 0.045) * STAGE_W;
        const baseY = (0.02 + (i % 7) * 0.046 + drift * 0.035) * STAGE_H;
        const len = 28 + (i % 4) * 14;
        const alpha = 0.065 + 0.045 * Math.sin(tSec * 1.4 + i);
        wCtx.strokeStyle = `rgba(186, 238, 255, ${alpha})`;
        wCtx.lineWidth = 1.6;
        wCtx.beginPath();
        wCtx.moveTo(baseX - len * 0.65, baseY - len * 0.45);
        wCtx.quadraticCurveTo(
          baseX,
          baseY + Math.sin(tSec * 1.8 + i) * 3.5,
          baseX + len * 0.65,
          baseY + len * 0.45
        );
        wCtx.stroke();
      }

      // Sunlit specular glints across deep & mid-shelf sea
      for (let i = 0; i < GLINT_SEEDS.length; i++) {
        const g = GLINT_SEEDS[i];
        const intensity =
          0.5 +
          0.5 *
            Math.sin(tSec * g.speed + g.phase) *
            Math.cos(tSec * (g.speed * 0.7) + g.phase * 1.3);
        if (intensity < 0.62) continue;
        const a = (intensity - 0.62) * 1.65;
        wCtx.fillStyle = `rgba(255, 253, 238, ${Math.min(0.75, a)})`;
        wCtx.beginPath();
        wCtx.ellipse(
          g.u * STAGE_W,
          g.v * STAGE_H,
          g.size * 2.1,
          g.size * 0.72,
          0.62,
          0,
          Math.PI * 2
        );
        wCtx.fill();
      }

      // Animated breaking shoreline surf / white seafoam bands rolling onto the sandy beach
      const shorelinePts: readonly (readonly [number, number])[] = [
        [0.642, 0.068],
        [0.64, 0.105],
        [0.674, 0.146],
        [0.727, 0.189],
        [0.79, 0.237],
        [0.855, 0.284],
        [0.914, 0.326],
        [0.955, 0.335],
        [0.996, 0.36],
      ];

      for (let waveIdx = 0; waveIdx < 3; waveIdx++) {
        const phase = (tSec * 0.24 + waveIdx * 0.333) % 1;
        const offsetPx = (1 - phase) * 28;
        const foamAlpha = Math.sin(phase * Math.PI) * 0.56;
        wCtx.strokeStyle = `rgba(241, 250, 255, ${foamAlpha})`;
        wCtx.lineWidth = 2.6 - phase * 0.9;
        wCtx.beginPath();
        shorelinePts.forEach(([u, v], idx) => {
          const wobble = Math.sin(tSec * 2.2 + idx * 1.4 + waveIdx) * 3.2;
          const px = u * STAGE_W + offsetPx + wobble;
          const py = v * STAGE_H - offsetPx * 0.72 + wobble * 0.5;
          if (idx === 0) wCtx.moveTo(px, py);
          else wCtx.lineTo(px, py);
        });
        wCtx.stroke();
      }

      // Offshore Seismic Sonar Rings inside the Oil & Gas Exploration Zone (0.892, 0.142)
      const rigX = 0.892 * STAGE_W;
      const rigY = 0.142 * STAGE_H;
      const activeSurveys = liveMaritime.activeExpeditions.filter(
        (e) => e.kind === 'offshore_survey'
      ).length;
      const sonarCount = hasRig || activeSurveys > 0 ? 3 : 2;
      for (let s = 0; s < sonarCount; s++) {
        const p = (tSec * 0.28 + s / sonarCount) % 1;
        const rx = 24 + p * 98;
        const ry = 14 + p * 54;
        const alpha = (1 - p) * (hasRig || activeSurveys > 0 ? 0.42 : 0.24);
        wCtx.strokeStyle =
          s % 2 === 0
            ? `rgba(251, 191, 36, ${alpha})`
            : `rgba(56, 189, 248, ${alpha})`;
        wCtx.lineWidth = 1.6;
        wCtx.beginPath();
        wCtx.ellipse(rigX, rigY, rx, ry, -0.18, 0, Math.PI * 2);
        wCtx.stroke();
      }

      wCtx.restore();

      // Animate River Currents (Upper + Lower River)
      const drawRiverCurrents = (pts: readonly (readonly [number, number])[], isUpper: boolean) => {
        wCtx.save();
        traceUVPoly(wCtx, pts);
        wCtx.clip();
        for (let r = 0; r < 14; r++) {
          const prog = (tSec * 0.14 + r / 14) % 1;
          const sx = isUpper
            ? (0.01 + prog * 0.19) * STAGE_W
            : (0.21 + prog * 0.12) * STAGE_W;
          const sy = isUpper
            ? (0.66 + prog * 0.13 + ((r % 3) - 1) * 0.016) * STAGE_H
            : (0.84 + prog * 0.15 + ((r % 3) - 1) * 0.012) * STAGE_H;
          const alpha = Math.sin(prog * Math.PI) * 0.26;
          wCtx.strokeStyle = `rgba(186, 230, 253, ${alpha})`;
          wCtx.lineWidth = 1.5;
          wCtx.beginPath();
          wCtx.moveTo(sx - 12, sy - 9);
          wCtx.quadraticCurveTo(sx, sy + 2, sx + 14, sy + 11);
          wCtx.stroke();
        }
        wCtx.restore();
      };

      drawRiverCurrents(UPPER_RIVER_UV, true);
      drawRiverCurrents(LOWER_RIVER_UV, false);

      // Draw Interactive Water Click Ripples
      const activeRipples: WaterRipple[] = [];
      for (const rip of ripplesRef.current) {
        const ageSec = (nowMs - rip.bornAt) / 1000;
        if (ageSec < 1.35) {
          activeRipples.push(rip);
          const p = ageSec / 1.35;
          const rad = 6 + p * rip.maxRadius;
          const alpha = (1 - p) * 0.65;
          wCtx.save();
          wCtx.strokeStyle = `rgba(224, 242, 254, ${alpha})`;
          wCtx.lineWidth = 2 * (1 - p * 0.5);
          wCtx.beginPath();
          wCtx.ellipse(rip.x, rip.y, rad, rad * 0.58, 0, 0, Math.PI * 2);
          wCtx.stroke();
          wCtx.restore();
        }
      }
      ripplesRef.current = activeRipples;

      // 2. SHIP & MARITIME INFRASTRUCTURE CANVAS
      sCtx.clearRect(0, 0, STAGE_W, STAGE_H);
      const hitboxes: LiveShipHitbox[] = [];

      // Floating Navigation Buoys around Offshore Oil & Gas Exploration Sector
      const buoyCoords: readonly [number, number, string][] = [
        [0.842, 0.124, '#F59E0B'],
        [0.892, 0.088, '#38BDF8'],
        [0.944, 0.128, '#F59E0B'],
        [0.896, 0.194, '#10B981'],
      ];
      buoyCoords.forEach(([bu, bv, color], idx) => {
        const bx = bu * STAGE_W;
        const by = bv * STAGE_H + Math.sin(tSec * 2.4 + idx) * 1.3;
        sCtx.save();
        sCtx.fillStyle = 'rgba(4, 18, 34, 0.35)';
        sCtx.beginPath();
        sCtx.ellipse(bx, by + 3, 6, 3, 0, 0, Math.PI * 2);
        sCtx.fill();

        sCtx.fillStyle = color;
        sCtx.beginPath();
        sCtx.arc(bx, by, 3.6, 0, Math.PI * 2);
        sCtx.fill();

        const blink = 0.4 + 0.6 * Math.abs(Math.sin(tSec * 2.1 + idx * 1.2));
        sCtx.fillStyle = `rgba(255, 251, 235, ${blink})`;
        sCtx.beginPath();
        sCtx.arc(bx, by - 3.2, 1.8, 0, Math.PI * 2);
        sCtx.fill();
        sCtx.restore();
      });

      // Discovered Oil Wells & Gas Fields visual nodes inside the exploration sector
      const wellCount = Math.min(4, liveMaritime.discoveredOilWells);
      for (let w = 0; w < wellCount; w++) {
        const ang = -0.5 + w * 1.15;
        const wx = rigX + Math.cos(ang) * 58;
        const wy = rigY + Math.sin(ang) * 28;
        sCtx.save();
        sCtx.fillStyle = '#0F172A';
        sCtx.strokeStyle = '#10B981';
        sCtx.lineWidth = 1.4;
        sCtx.beginPath();
        sCtx.rect(wx - 4, wy - 4, 8, 8);
        sCtx.fill();
        sCtx.stroke();
        // Tiny flare glow
        const flare = 0.65 + 0.35 * Math.sin(tSec * 7 + w);
        sCtx.fillStyle = `rgba(251, 146, 60, ${flare})`;
        sCtx.beginPath();
        sCtx.arc(wx, wy - 6, 2.4, 0, Math.PI * 2);
        sCtx.fill();
        sCtx.restore();
      }

      const gasCount = Math.min(3, liveMaritime.discoveredGasFields);
      for (let g = 0; g < gasCount; g++) {
        const ang = 2.1 + g * 0.9;
        const gx = rigX + Math.cos(ang) * 64;
        const gy = rigY + Math.sin(ang) * 32;
        sCtx.save();
        sCtx.fillStyle = '#0F172A';
        sCtx.strokeStyle = '#38BDF8';
        sCtx.lineWidth = 1.4;
        sCtx.beginPath();
        sCtx.arc(gx, gy, 4.2, 0, Math.PI * 2);
        sCtx.fill();
        sCtx.stroke();
        sCtx.restore();
      }

      // --- ANIMATED SHIPS ---

      // A. Docked Commercial Freighter moored at the Commercial Pier Berth
      const dockedX = 0.779 * STAGE_W;
      const dockedY = 0.175 * STAGE_H;
      drawShipVessel(sCtx, {
        x: dockedX,
        y: dockedY,
        angle: -0.62,
        scale: 1.08,
        variant: 'cargo',
        tSec,
        speedFactor: 0,
        isHovered: hoveredShipIdRef.current === 'ship-docked-pier',
      });
      hitboxes.push({
        id: 'ship-docked-pier',
        x: dockedX,
        y: dockedY,
        radius: 30,
        entity: {
          kind: 'ship',
          id: 'ship-docked-pier',
          title: 'سفينة شحن راسية بالرصيف التجاري',
          subtitle: hasPort
            ? `الميناء البحري Lv.${portLv} · أسطول الشحن: ${liveMaritime.cargoShips}`
            : 'اضغط لفتح الميناء البحري وتفعيل خطوط التجارة',
          targetPlotId: 'p-seaport',
        },
      });

      // B. Regional & Player Cargo Ships cruising the deep-water commercial channel
      const cargoTrafficCount = Math.min(4, Math.max(1, liveMaritime.cargoShips));
      for (let c = 0; c < cargoTrafficCount; c++) {
        const cycleDur = 26 + c * 6;
        const rawP = ((tSec + c * 7.5) / cycleDur) % 2;
        const outbound = rawP <= 1;
        const t = outbound ? rawP : 2 - rawP;
        const laneOffsetV = (c % 2 === 0 ? 0.0 : -0.045) + Math.floor(c / 2) * 0.028;

        const pt = quadPoint(
          [0.798, 0.212 + laneOffsetV * 0.3],
          [0.885, 0.232 + laneOffsetV],
          [0.985, 0.258 + laneOffsetV * 0.7],
          t
        );
        const heading = outbound ? pt.angle : pt.angle + Math.PI;
        const shipId = `ship-cargo-lane-${c}`;
        drawShipVessel(sCtx, {
          x: pt.x,
          y: pt.y,
          angle: heading,
          scale: 0.96 + (c === 0 ? 0.08 : 0),
          variant: 'cargo',
          tSec,
          speedFactor: 0.78,
          isHovered: hoveredShipIdRef.current === shipId,
        });
        hitboxes.push({
          id: shipId,
          x: pt.x,
          y: pt.y,
          radius: 28,
          entity: {
            kind: 'ship',
            id: shipId,
            title:
              liveMaritime.cargoShips > 0
                ? `ناقلة تجارية #${c + 1}`
                : 'سفينة شحن ساحلية',
            subtitle:
              liveMaritime.cargoShips > 0
                ? 'تبحر عبر الممر التجاري · اضغط لإدارة الأسطول'
                : 'ممر الشحن البحري جاهز · ابنِ الميناء لبناء سفنك',
            targetPlotId: 'p-seaport',
          },
        });
      }

      // C. Offshore Seismic Survey / Exploration Vessels patrolling the Oil & Gas Zone
      const surveyTrafficCount = Math.min(
        3,
        Math.max(1, liveMaritime.surveyVessels + (hasRig ? 1 : 0))
      );
      for (let s = 0; s < surveyTrafficCount; s++) {
        const orbitAngle = tSec * (0.28 + s * 0.06) + s * ((Math.PI * 2) / surveyTrafficCount);
        const rx = 56 + s * 16;
        const ry = 29 + s * 9;
        const sx = rigX + Math.cos(orbitAngle) * rx;
        const sy = rigY + Math.sin(orbitAngle) * ry;
        const tangentAngle = Math.atan2(
          Math.cos(orbitAngle) * ry,
          -Math.sin(orbitAngle) * rx
        );
        const shipId = `ship-survey-${s}`;
        drawShipVessel(sCtx, {
          x: sx,
          y: sy,
          angle: tangentAngle,
          scale: 0.92,
          variant: 'survey',
          tSec,
          speedFactor: 0.68,
          isHovered: hoveredShipIdRef.current === shipId,
        });
        hitboxes.push({
          id: shipId,
          x: sx,
          y: sy,
          radius: 27,
          entity: {
            kind: 'ship',
            id: shipId,
            title:
              liveMaritime.surveyVessels > 0
                ? `سفينة مسح وتنقيب #${s + 1}`
                : 'زورق مسح جيوفيزيائي',
            subtitle: hasRig
              ? `منصة النفط والغاز Lv.${rigLv} · آبار: ${liveMaritime.discoveredOilWells} · غاز: ${liveMaritime.discoveredGasFields}`
              : 'تمسح حقل النفط والغاز البحري · اضغط للاستكشاف',
            targetPlotId: 'p-offshore',
          },
        });
      }

      // D. Real-Time Active Expeditions (Maritime Trade & Offshore Surveys)
      liveMaritime.activeExpeditions.forEach((exp: SeaExpedition, idx: number) => {
        const total = Math.max(1, exp.endsAt - exp.startedAt);
        const progress = Math.min(1, Math.max(0, (wallNow - exp.startedAt) / total));
        const remainingSec = Math.max(0, Math.ceil((exp.endsAt - wallNow) / 1000));
        const isSurvey = exp.kind === 'offshore_survey';
        const pt = isSurvey
          ? quadPoint([0.778, 0.194], [0.835, 0.145], [0.892, 0.142], progress)
          : quadPoint(
              [0.778, 0.194],
              [0.865, 0.18 + idx * 0.015],
              [0.98, 0.21 + idx * 0.018],
              progress
            );

        const expShipId = `ship-exp-${exp.id}`;
        drawShipVessel(sCtx, {
          x: pt.x,
          y: pt.y,
          angle: pt.angle,
          scale: 1.12,
          variant: isSurvey ? 'survey' : 'cargo',
          tSec,
          speedFactor: 1.0,
          isExpedition: true,
          isHovered: hoveredShipIdRef.current === expShipId,
        });
        hitboxes.push({
          id: expShipId,
          x: pt.x,
          y: pt.y,
          radius: 32,
          entity: {
            kind: 'ship',
            id: expShipId,
            title: exp.title,
            subtitle: `رحلة نشطة (${exp.vesselCount} سفن) · متبقي ${remainingSec} ث · ${exp.expectedYieldLabel}`,
            targetPlotId: isSurvey ? 'p-offshore' : 'p-seaport',
          },
        });
      });

      // E. River Patrol / Pilot Tug cruising along the lower river bend
      const riverP = (tSec * 0.085) % 2;
      const riverOut = riverP <= 1;
      const rt = riverOut ? riverP : 2 - riverP;
      const rPt = quadPoint([0.236, 0.858], [0.285, 0.905], [0.312, 0.976], rt);
      drawShipVessel(sCtx, {
        x: rPt.x,
        y: rPt.y,
        angle: riverOut ? rPt.angle : rPt.angle + Math.PI,
        scale: 0.86,
        variant: 'tug',
        tSec,
        speedFactor: 0.45,
        isHovered: hoveredShipIdRef.current === 'ship-river-tug',
      });
      hitboxes.push({
        id: 'ship-river-tug',
        x: rPt.x,
        y: rPt.y,
        radius: 24,
        entity: {
          kind: 'river',
          id: 'ship-river-tug',
          title: 'زورق خفر الملاحة النهرية',
          subtitle: 'يؤمّن الممر المائي السفلي وحركة الإمداد نحو الميناء',
          targetPlotId: 'p-seaport',
        },
      });

      shipsHitboxesRef.current = hitboxes;

      if (!reducedMotion) {
        rafId = requestAnimationFrame(renderFrame);
      }
    };

    rafId = requestAnimationFrame(renderFrame);
    return () => cancelAnimationFrame(rafId);
  }, [ensureBathymetryCache]);

  const resolveStageCoords = (e: React.MouseEvent | React.PointerEvent) => {
    const el = shipCanvasRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    const x = ((e.clientX - rect.left) / rect.width) * STAGE_W;
    const y = ((e.clientY - rect.top) / rect.height) * STAGE_H;
    return { x, y };
  };

  const hitTestWater = (x: number, y: number): WaterHoverEntity | null => {
    // 1. Live animated ships take priority
    for (let i = shipsHitboxesRef.current.length - 1; i >= 0; i--) {
      const h = shipsHitboxesRef.current[i];
      if (Math.hypot(x - h.x, y - h.y) <= h.radius) {
        return h.entity;
      }
    }

    // 2. Expanded Offshore Oil & Gas Exploration Sector
    const dxOff = (x - 0.892 * STAGE_W) / 140;
    const dyOff = (y - 0.142 * STAGE_H) / 76;
    if (dxOff * dxOff + dyOff * dyOff <= 1) {
      return {
        kind: 'offshore_zone',
        id: 'zone-offshore-basin',
        title: 'منطقة استكشاف آبار النفط والغاز',
        subtitle: offshoreBuilt
          ? `منصة بحرية Lv.${offshoreLevel} · آبار نفط: ${maritime.discoveredOilWells} · غاز: ${maritime.discoveredGasFields}`
          : 'حقل بحري قابل للاستكشاف · اضغط لتشييد منصة النفط والغاز',
        targetPlotId: 'p-offshore',
      };
    }

    // 3. Expanded Commercial Pier Basin
    const dxPier = (x - 0.752 * STAGE_W) / 128;
    const dyPier = (y - 0.205 * STAGE_H) / 72;
    if (dxPier * dxPier + dyPier * dyPier <= 1) {
      return {
        kind: 'pier',
        id: 'zone-commercial-pier',
        title: 'الرصيف التجاري البحري',
        subtitle: seaportBuilt
          ? `الميناء التجاري Lv.${seaportLevel} · سفن الشحن: ${maritime.cargoShips}`
          : 'رصيف بحري مهيأ للتجارة والشحن · اضغط لتشييد الميناء',
        targetPlotId: 'p-seaport',
      };
    }

    return null;
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const pt = resolveStageCoords(e);
    if (!pt) return;
    const hit = hitTestWater(pt.x, pt.y);
    const nextShipId = hit?.kind === 'ship' ? hit.id : null;
    hoveredShipIdRef.current = nextShipId;

    const nextHoverId = hit?.id ?? null;
    if (nextHoverId !== lastHoverIdRef.current) {
      lastHoverIdRef.current = nextHoverId;
      onHoverWaterEntity(hit);
    }
  };

  const handlePointerLeave = () => {
    hoveredShipIdRef.current = null;
    if (lastHoverIdRef.current !== null) {
      lastHoverIdRef.current = null;
      onHoverWaterEntity(null);
    }
  };

  const handleWaterClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!canClick()) return;
    const pt = resolveStageCoords(e);
    if (!pt) return;

    const hit = hitTestWater(pt.x, pt.y);
    if (hit) {
      e.stopPropagation();
      // Spawn subtle water ripple on interaction as well
      if (
        pointInPoly(pt.x, pt.y, MAIN_SEA_UV) ||
        pointInPoly(pt.x, pt.y, LOWER_RIVER_UV) ||
        pointInPoly(pt.x, pt.y, UPPER_RIVER_UV)
      ) {
        ripplesRef.current.push({
          x: pt.x,
          y: pt.y,
          bornAt: performance.now(),
          maxRadius: 44,
        });
      }
      if (hit.targetPlotId) {
        onSelectPlot(hit.targetPlotId);
      }
      return;
    }

    // Open navigable sea or river click spawns a realistic water ripple
    if (
      pointInPoly(pt.x, pt.y, MAIN_SEA_UV) ||
      pointInPoly(pt.x, pt.y, COVE_SEA_UV) ||
      pointInPoly(pt.x, pt.y, UPPER_RIVER_UV) ||
      pointInPoly(pt.x, pt.y, LOWER_RIVER_UV)
    ) {
      e.stopPropagation();
      ripplesRef.current.push({
        x: pt.x,
        y: pt.y,
        bornAt: performance.now(),
        maxRadius: 56,
      });
    }
  };

  const isPierHighlighted =
    selectedPlotId === 'p-seaport' || hoveredPlotId === 'p-seaport';
  const isOffshoreHighlighted =
    selectedPlotId === 'p-offshore' || hoveredPlotId === 'p-offshore';

  return (
    <div
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      onClick={handleWaterClick}
      className="absolute inset-0 pointer-events-auto"
    >
      {/* 1. Dynamic Animated Water Canvas (Ocean + River + Surf Foam + Sun Glints + Sonar) */}
      <canvas
        ref={waterCanvasRef}
        width={STAGE_W}
        height={STAGE_H}
        className="pointer-events-none absolute inset-0 w-full h-full"
      />

      {/* 2. Engineered Commercial Pier Apron & Offshore Exploration Perimeter SVG */}
      <svg
        width={STAGE_W}
        height={STAGE_H}
        viewBox={`0 0 ${STAGE_W} ${STAGE_H}`}
        className="pointer-events-none absolute inset-0"
      >
        <defs>
          <linearGradient id="pierConcreteDeck" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#94A3B8" />
            <stop offset="55%" stopColor="#64748B" />
            <stop offset="100%" stopColor="#475569" />
          </linearGradient>
          <linearGradient id="pierRoadAsphalt" x1="0" y1="1" x2="1" y2="0">
            <stop offset="0%" stopColor="#1E293B" />
            <stop offset="100%" stopColor="#334155" />
          </linearGradient>
        </defs>

        {/* Subsea Pipeline & Telemetry Link between Commercial Pier Fuel Terminal & Offshore Oil/Gas Zone */}
        <path
          d={`M ${0.778 * STAGE_W} ${0.194 * STAGE_H} Q ${0.835 * STAGE_W} ${0.168 * STAGE_H}, ${0.892 * STAGE_W} ${0.142 * STAGE_H}`}
          fill="none"
          stroke={offshoreBuilt ? 'rgba(251, 191, 36, 0.62)' : 'rgba(125, 211, 252, 0.45)'}
          strokeWidth="2.4"
          strokeDasharray="7 6"
        />

        {/* Deep-Sea Trade Corridor Marker */}
        <path
          d={`M ${0.788 * STAGE_W} ${0.205 * STAGE_H} Q ${0.885 * STAGE_W} ${0.232 * STAGE_H}, ${0.985 * STAGE_W} ${0.258 * STAGE_H}`}
          fill="none"
          stroke="rgba(56, 189, 248, 0.45)"
          strokeWidth="2"
          strokeDasharray="9 7"
        />

        {/* Offshore Oil & Gas Exploration Sector Perimeter */}
        <g>
          <polygon
            points={`${0.892 * STAGE_W},${0.088 * STAGE_H} ${0.952 * STAGE_W},${0.142 * STAGE_H} ${0.892 * STAGE_W},${0.196 * STAGE_H} ${0.832 * STAGE_W},${0.142 * STAGE_H}`}
            fill={
              isOffshoreHighlighted
                ? 'rgba(245, 158, 11, 0.16)'
                : 'rgba(14, 116, 144, 0.14)'
            }
            stroke={isOffshoreHighlighted ? '#FBBF24' : 'rgba(56, 189, 248, 0.55)'}
            strokeWidth={isOffshoreHighlighted ? '2.4' : '1.5'}
            strokeDasharray="6 5"
          />
          {/* Inner seabed survey crosshairs */}
          <line
            x1={0.858 * STAGE_W}
            y1={0.142 * STAGE_H}
            x2={0.926 * STAGE_W}
            y2={0.142 * STAGE_H}
            stroke="rgba(125, 211, 252, 0.35)"
            strokeWidth="1.2"
          />
          <line
            x1={0.892 * STAGE_W}
            y1={0.108 * STAGE_H}
            x2={0.892 * STAGE_W}
            y2={0.176 * STAGE_H}
            stroke="rgba(125, 211, 252, 0.35)"
            strokeWidth="1.2"
          />
        </g>

        {/* Expanded Coastal Commercial Pier & Road Causeway */}
        <g>
          {/* Coastal Asphalt Causeway linking the city perimeter avenue across the sand */}
          <polygon
            points={`${0.682 * STAGE_W},${0.254 * STAGE_H} ${0.728 * STAGE_W},${0.214 * STAGE_H} ${0.744 * STAGE_W},${0.226 * STAGE_H} ${0.698 * STAGE_W},${0.266 * STAGE_H}`}
            fill="url(#pierRoadAsphalt)"
            stroke="#94A3B8"
            strokeWidth="1.2"
          />
          {/* Center road dashed line */}
          <line
            x1={0.691 * STAGE_W}
            y1={0.26 * STAGE_H}
            x2={0.734 * STAGE_W}
            y2={0.221 * STAGE_H}
            stroke="#E2E8F0"
            strokeWidth="1.4"
            strokeDasharray="5 4"
          />

          {/* Water contact shadow under pier seawall */}
          <polygon
            points={`${0.706 * STAGE_W},${0.224 * STAGE_H} ${0.752 * STAGE_W},${0.178 * STAGE_H} ${0.804 * STAGE_W},${0.212 * STAGE_H} ${0.758 * STAGE_W},${0.258 * STAGE_H}`}
            fill="rgba(4, 18, 34, 0.44)"
            transform="translate(3, 6)"
          />

          {/* Concrete Seawall Side-Faces (2.5D depth) */}
          <polygon
            points={`${0.706 * STAGE_W},${0.224 * STAGE_H} ${0.758 * STAGE_W},${0.258 * STAGE_H} ${0.758 * STAGE_W},${0.266 * STAGE_H} ${0.706 * STAGE_W},${0.232 * STAGE_H}`}
            fill="#334155"
          />
          <polygon
            points={`${0.758 * STAGE_W},${0.258 * STAGE_H} ${0.804 * STAGE_W},${0.212 * STAGE_H} ${0.804 * STAGE_W},${0.220 * STAGE_H} ${0.758 * STAGE_W},${0.266 * STAGE_H}`}
            fill="#1E293B"
          />

          {/* Main Concrete Commercial Quay Deck */}
          <polygon
            points={`${0.706 * STAGE_W},${0.224 * STAGE_H} ${0.752 * STAGE_W},${0.178 * STAGE_H} ${0.804 * STAGE_W},${0.212 * STAGE_H} ${0.758 * STAGE_W},${0.258 * STAGE_H}`}
            fill="url(#pierConcreteDeck)"
            stroke={isPierHighlighted ? '#FBBF24' : '#CBD5E1'}
            strokeWidth={isPierHighlighted ? '2.4' : '1.4'}
          />

          {/* Deep-Water Finger Jetty Extending Northeast */}
          <polygon
            points={`${0.752 * STAGE_W},${0.178 * STAGE_H} ${0.784 * STAGE_W},${0.148 * STAGE_H} ${0.799 * STAGE_W},${0.159 * STAGE_H} ${0.768 * STAGE_W},${0.189 * STAGE_H}`}
            fill="#64748B"
            stroke="#CBD5E1"
            strokeWidth="1.2"
          />

          {/* Yellow Safety Dock Edge Striping */}
          <line
            x1={0.752 * STAGE_W}
            y1={0.181 * STAGE_H}
            x2={0.801 * STAGE_W}
            y2={0.213 * STAGE_H}
            stroke="#FBBF24"
            strokeWidth="1.8"
            strokeDasharray="6 3"
          />

          {/* Shipping Container Cargo Yard Stacks on Pier Apron */}
          <g>
            <polygon
              points={`${0.728 * STAGE_W},${0.221 * STAGE_H} ${0.738 * STAGE_W},${0.212 * STAGE_H} ${0.745 * STAGE_W},${0.217 * STAGE_H} ${0.735 * STAGE_W},${0.226 * STAGE_H}`}
              fill="#0369A1"
              stroke="#E0F2FE"
              strokeWidth="0.6"
            />
            <polygon
              points={`${0.738 * STAGE_W},${0.228 * STAGE_H} ${0.748 * STAGE_W},${0.219 * STAGE_H} ${0.755 * STAGE_W},${0.224 * STAGE_H} ${0.745 * STAGE_W},${0.233 * STAGE_H}`}
              fill="#B45309"
              stroke="#FEF3C7"
              strokeWidth="0.6"
            />
            <polygon
              points={`${0.749 * STAGE_W},${0.235 * STAGE_H} ${0.759 * STAGE_W},${0.226 * STAGE_H} ${0.766 * STAGE_W},${0.231 * STAGE_H} ${0.756 * STAGE_W},${0.240 * STAGE_H}`}
              fill="#0F766E"
              stroke="#CCFBF1"
              strokeWidth="0.6"
            />
          </g>

          {/* Mooring Bollards along Berth */}
          {[
            [0.756, 0.184],
            [0.771, 0.194],
            [0.786, 0.204],
            [0.795, 0.212],
          ].map(([bu, bv], idx) => (
            <circle
              key={idx}
              cx={bu * STAGE_W}
              cy={bv * STAGE_H}
              r="2.4"
              fill="#F59E0B"
              stroke="#0F172A"
              strokeWidth="0.8"
            />
          ))}
        </g>
      </svg>

      {/* 3. Live 60fps Animated Ships, Wakes, Buoys & Wellheads Canvas */}
      <canvas
        ref={shipCanvasRef}
        width={STAGE_W}
        height={STAGE_H}
        className="pointer-events-none absolute inset-0 w-full h-full"
      />
    </div>
  );
};
