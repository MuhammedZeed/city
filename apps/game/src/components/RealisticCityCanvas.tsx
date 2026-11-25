import React, { useMemo, useRef, useState } from 'react';
import {
  Anchor,
  Compass,
  Flame,
  HeartPulse,
  Landmark,
  Maximize2,
  Ship,
  Shield,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import {
  BUILDINGS_META,
  CITY_PLOTS,
  PRODUCTION_RATES_PER_HOUR,
} from '@enginora/shared';
import {
  formatDuration,
  getExposedExcessResources,
} from '@enginora/shared';
import { BuildingType, CityPlotDef, GameState, PlacedBuilding } from '@enginora/shared';
import { useTransparentBuildingSprites } from '../utils/spriteProcessor';
import {
  CoastalWaterLayer,
  STAGE_H,
  STAGE_W,
  WaterHoverEntity,
} from './CoastalWaterLayer';

interface RealisticCityCanvasProps {
  state: GameState;
  now: number;
  selectedPlotId: string | null;
  pendingBuildType: BuildingType | null;
  onSelectPlot: (plotId: string) => void;
  onCancelPendingBuild: () => void;
}

const CITY_URBAN_BASE = '/src/assets/images/city_urban_base_1795466490514.jpg';

// Exact pixel-measured (u, v) centers of the 6x6 green city blocks in city_urban_base
const CITY_BLOCK_UV: readonly (readonly [number, number])[] = [
  // Row gy=0
  [0.516, 0.194], [0.586, 0.259], [0.653, 0.323], [0.733, 0.397], [0.815, 0.473], [0.901, 0.551],
  // Row gy=1
  [0.445, 0.260], [0.515, 0.325], [0.583, 0.388], [0.662, 0.464], [0.745, 0.540], [0.829, 0.619],
  // Row gy=2
  [0.379, 0.324], [0.447, 0.388], [0.515, 0.451], [0.591, 0.531], [0.673, 0.607], [0.759, 0.687],
  // Row gy=3
  [0.303, 0.393], [0.370, 0.461], [0.435, 0.523], [0.517, 0.599], [0.589, 0.667], [0.676, 0.747],
  // Row gy=4
  [0.230, 0.460], [0.299, 0.526], [0.366, 0.590], [0.445, 0.667], [0.518, 0.735], [0.605, 0.815],
  // Row gy=5
  [0.158, 0.528], [0.226, 0.594], [0.293, 0.657], [0.373, 0.734], [0.457, 0.812], [0.545, 0.893],
];

function plotToUV(plot: CityPlotDef): { u: number; v: number } {
  if (plot.id === 'p-wall') {
    return { u: 0.278, v: 0.728 };
  }
  if (plot.id === 'p-seaport') {
    return { u: 0.748, v: 0.212 };
  }
  if (plot.id === 'p-offshore') {
    return { u: 0.892, v: 0.142 };
  }
  const gx = Math.max(0, Math.min(5, plot.gx));
  const gy = Math.max(0, Math.min(5, plot.gy));
  const pair = CITY_BLOCK_UV[gy * 6 + gx] ?? [0.5, 0.5];
  return { u: pair[0], v: pair[1] };
}

export const RealisticCityCanvas: React.FC<RealisticCityCanvasProps> = ({
  state,
  now,
  selectedPlotId,
  pendingBuildType,
  onSelectPlot,
  onCancelPendingBuild,
}) => {
  const sprites = useTransparentBuildingSprites();
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const defaultZoom =
    typeof window !== 'undefined' && (window.innerWidth < 640 || window.innerHeight < 500)
      ? 0.54
      : 0.84;
  const [zoom, setZoom] = useState(defaultZoom);
  const [hoveredPlotId, setHoveredPlotId] = useState<string | null>(null);
  const [hoveredWaterEntity, setHoveredWaterEntity] = useState<WaterHoverEntity | null>(null);

  const pointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchRef = useRef<{ dist: number; midX: number; midY: number } | null>(null);
  const dragRef = useRef<{
    active: boolean;
    startX: number;
    startY: number;
    lastX: number;
    lastY: number;
    moved: boolean;
  }>({
    active: false,
    startX: 0,
    startY: 0,
    lastX: 0,
    lastY: 0,
    moved: false,
  });

  const hasExposedExcess = getExposedExcessResources(state).excessTotal > 0;

  const buildingByPlot = useMemo(() => {
    const map = new Map<string, PlacedBuilding>();
    for (const b of state.buildings) {
      map.set(b.plotId, b);
    }
    return map;
  }, [state.buildings]);

  const queueByBuildingId = useMemo(() => {
    const map = new Map<string, (typeof state.buildQueue)[number]>();
    for (const q of state.buildQueue) {
      map.set(q.buildingId, q);
    }
    return map;
  }, [state.buildQueue]);

  // Depth-sorted plots (back-to-front by vertical UV coordinate)
  const sortedPlots = useMemo(() => {
    return CITY_PLOTS.map((plot) => ({
      plot,
      uv: plotToUV(plot),
    })).sort((a, b) => a.uv.v - b.uv.v);
  }, []);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointersRef.current.size === 1) {
      pinchRef.current = null;
      dragRef.current = {
        active: true,
        startX: e.clientX,
        startY: e.clientY,
        lastX: e.clientX,
        lastY: e.clientY,
        moved: false,
      };
    } else if (pointersRef.current.size >= 2) {
      const pts = Array.from(pointersRef.current.values());
      const dist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
      pinchRef.current = {
        dist,
        midX: (pts[0].x + pts[1].x) / 2,
        midY: (pts[0].y + pts[1].y) / 2,
      };
      dragRef.current.active = false;
      dragRef.current.moved = true;
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!pointersRef.current.has(e.pointerId)) return;
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointersRef.current.size >= 2) {
      const pts = Array.from(pointersRef.current.values());
      const dist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
      const midX = (pts[0].x + pts[1].x) / 2;
      const midY = (pts[0].y + pts[1].y) / 2;
      const prev = pinchRef.current;

      if (prev && prev.dist > 8) {
        const ratio = dist / prev.dist;
        setZoom((z) =>
          Math.max(0.42, Math.min(1.75, Number((z * ratio).toFixed(3))))
        );
        const mdx = midX - prev.midX;
        const mdy = midY - prev.midY;
        setPan((p) => ({
          x: Math.max(-360, Math.min(360, p.x + mdx)),
          y: Math.max(-220, Math.min(220, p.y + mdy)),
        }));
      }
      dragRef.current.moved = true;
      pinchRef.current = { dist, midX, midY };
      return;
    }

    if (!dragRef.current.active) return;
    const totalDx = e.clientX - dragRef.current.startX;
    const totalDy = e.clientY - dragRef.current.startY;
    if (Math.hypot(totalDx, totalDy) > 5) {
      dragRef.current.moved = true;
    }
    const stepDx = e.clientX - dragRef.current.lastX;
    const stepDy = e.clientY - dragRef.current.lastY;
    dragRef.current.lastX = e.clientX;
    dragRef.current.lastY = e.clientY;
    setPan((p) => ({
      x: Math.max(-360, Math.min(360, p.x + stepDx)),
      y: Math.max(-220, Math.min(220, p.y + stepDy)),
    }));
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    pointersRef.current.delete(e.pointerId);
    if (pointersRef.current.size === 1) {
      const remaining = Array.from(pointersRef.current.values())[0];
      pinchRef.current = null;
      dragRef.current = {
        active: true,
        startX: remaining.x,
        startY: remaining.y,
        lastX: remaining.x,
        lastY: remaining.y,
        moved: true,
      };
    } else if (pointersRef.current.size === 0) {
      pinchRef.current = null;
      dragRef.current.active = false;
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.08 : -0.08;
    setZoom((z) => Math.max(0.42, Math.min(1.75, Number((z + delta).toFixed(2)))));
  };

  const hoveredInfo = useMemo(() => {
    if (hoveredPlotId) {
      const plot = CITY_PLOTS.find((p) => p.id === hoveredPlotId);
      if (!plot) return null;
      const b = buildingByPlot.get(hoveredPlotId);
      if (!b || b.status === 'EMPTY') {
        return {
          title: plot.districtName,
          subtitle: pendingBuildType
            ? `اضغط لبناء ${BUILDINGS_META[pendingBuildType].name}`
            : plot.suggestedType === 'seaport'
              ? 'الرصيف التجاري البحري · اضغط لبناء الميناء وتشغيل سفن الشحن'
              : plot.suggestedType === 'offshore_rig'
                ? 'حقل النفط والغاز البحري · اضغط لتشييد منصة الاستكشاف'
                : plot.suggestedType
                  ? `موقع مخصص: ${BUILDINGS_META[plot.suggestedType].name}`
                  : plot.fixedType === 'fortifications'
                    ? 'موقع التحصينات الدفاعية'
                    : 'أرض متاحة للبناء',
        };
      }
      const meta = BUILDINGS_META[b.type];
      const rate =
        b.level > 0 && (b.type === 'farm' || b.type === 'sawmill' || b.type === 'iron_mine')
          ? ` · +${PRODUCTION_RATES_PER_HOUR[b.level]}/س`
          : '';
      return {
        title: meta.name,
        subtitle:
          b.status === 'CONSTRUCTING'
            ? 'قيد الإنشاء'
            : b.status === 'UPGRADING'
              ? `قيد التطوير إلى ${b.targetLevel}`
              : `المستوى ${b.level}${rate}`,
      };
    }

    if (hoveredWaterEntity) {
      return {
        title: hoveredWaterEntity.title,
        subtitle: hoveredWaterEntity.subtitle,
      };
    }

    return null;
  }, [hoveredPlotId, hoveredWaterEntity, buildingByPlot, pendingBuildType]);

  const seaportBuilding = buildingByPlot.get('p-seaport');
  const offshoreBuilding = buildingByPlot.get('p-offshore');
  const seaportBuilt = Boolean(
    seaportBuilding &&
      seaportBuilding.status !== 'EMPTY' &&
      seaportBuilding.status !== 'CONSTRUCTING'
  );
  const offshoreBuilt = Boolean(
    offshoreBuilding &&
      offshoreBuilding.status !== 'EMPTY' &&
      offshoreBuilding.status !== 'CONSTRUCTING'
  );

  return (
    <div
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onPointerLeave={handlePointerUp}
      onWheel={handleWheel}
      className={`relative w-full h-full min-h-0 overflow-hidden select-none touch-none active:cursor-grabbing bg-[#2A4A1D] ${
        hoveredWaterEntity ? 'cursor-pointer' : 'cursor-grab'
      }`}
    >
      {/* Pending Build Banner */}
      {pendingBuildType && (
        <div className="absolute top-2.5 left-1/2 -translate-x-1/2 z-30 w-[calc(100%-1.5rem)] max-w-md flex items-center justify-between gap-2.5 px-3.5 py-2 bg-[#0F172A]/95 backdrop-blur-md border border-sky-400/70 rounded-xl shadow-lg">
          <span className="text-xs font-semibold text-sky-200 leading-snug">
            اختر قطعة أرض فارغة لبناء: {BUILDINGS_META[pendingBuildType].name}
          </span>
          <button
            type="button"
            onClick={onCancelPendingBuild}
            className="min-h-[36px] px-3 py-1 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 whitespace-nowrap shrink-0"
          >
            إلغاء
          </button>
        </div>
      )}

      {/* Hover Tooltip */}
      {hoveredInfo && (
        <div className="hidden sm:block absolute top-3 right-3 z-30 pointer-events-none px-3.5 py-2 rounded-xl bg-[#090F1E]/95 backdrop-blur-md border border-amber-500/50 shadow-lg">
          <div className="text-sm font-bold text-amber-300">{hoveredInfo.title}</div>
          <div className="text-xs text-slate-300">{hoveredInfo.subtitle}</div>
        </div>
      )}

      {/* Camera Control Bar */}
      <div
        onPointerDown={(e) => e.stopPropagation()}
        className="absolute bottom-2.5 left-2.5 sm:bottom-3 sm:left-3 z-20 flex items-center gap-1 p-1 rounded-xl bg-[#090F1E]/92 backdrop-blur-md border border-slate-700/90 shadow-lg"
      >
        <button
          type="button"
          title="تكبير"
          aria-label="تكبير"
          onClick={() => setZoom((z) => Math.min(1.65, Number((z + 0.12).toFixed(2))))}
          className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-lg hover:bg-slate-800 text-slate-200 hover:text-amber-300"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          type="button"
          title="تصغير"
          aria-label="تصغير"
          onClick={() => setZoom((z) => Math.max(0.45, Number((z - 0.12).toFixed(2))))}
          className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-lg hover:bg-slate-800 text-slate-200 hover:text-amber-300"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <button
          type="button"
          title="توسيط المدينة"
          onClick={() => {
            setPan({ x: 0, y: 0 });
            setZoom(
              typeof window !== 'undefined' && (window.innerWidth < 640 || window.innerHeight < 500)
                ? 0.54
                : 0.84
            );
          }}
          className="min-h-[40px] flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-slate-800 text-xs font-semibold text-slate-200 hover:text-amber-300 whitespace-nowrap"
        >
          <Maximize2 className="w-4 h-4 shrink-0" />
          <span className="hidden sm:inline">توسيط</span>
        </button>
        <button
          type="button"
          title="الانتقال إلى الساحل والرصيف التجاري ومنطقة النفط"
          onClick={() => {
            setPan({ x: -290, y: 165 });
            setZoom(
              typeof window !== 'undefined' && (window.innerWidth < 640 || window.innerHeight < 500)
                ? 0.72
                : 1.06
            );
            onSelectPlot('p-seaport');
          }}
          className="min-h-[40px] flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-sky-950/80 hover:bg-sky-900 border border-sky-500/40 text-xs font-semibold text-sky-200 whitespace-nowrap"
        >
          <Anchor className="w-4 h-4 text-sky-300 shrink-0" />
          <span className="hidden xs:inline sm:inline">الساحل</span>
          <span className="hidden md:inline">والنفط</span>
        </button>
      </div>

      {/* Coordinates Badge (desktop only so mobile advisor pill stays unobstructed) */}
      <div className="hidden md:flex absolute bottom-3 right-3 z-20 pointer-events-none items-center gap-2 px-3 py-1.5 rounded-xl bg-[#090F1E]/92 backdrop-blur-md border border-slate-700 text-xs text-slate-200">
        <Compass className="w-3.5 h-3.5 text-amber-400" />
        <span>
          {state.cityName} · <span className="font-num">({state.cityCoords.x} | {state.cityCoords.y})</span>
        </span>
      </div>

      {/* Explicit LTR 1920x1080 Stage so every UV coordinate anchors strictly from physical top-left */}
      <div
        dir="ltr"
        className="absolute left-1/2 top-1/2"
        style={{
          width: `${STAGE_W}px`,
          height: `${STAGE_H}px`,
          marginLeft: `${-STAGE_W / 2}px`,
          marginTop: `${-STAGE_H / 2}px`,
          transformOrigin: 'center center',
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
        }}
      >
        {/* 1. Photorealistic 2.5D Isometric City Terrain & Asphalt Street Map */}
        <img
          src={CITY_URBAN_BASE}
          alt="خريطة المدينة الواقعية"
          draggable={false}
          referrerPolicy="no-referrer"
          className="pointer-events-none block w-full h-full object-fill"
        />

        {/* 1b. Dynamic Animated Coastal & River Water + Expanded Commercial Pier + Offshore Zone + Interactive Animated Ships */}
        <CoastalWaterLayer
          maritime={state.maritime}
          seaportBuilt={seaportBuilt}
          seaportLevel={seaportBuilding?.level ?? 0}
          offshoreBuilt={offshoreBuilt}
          offshoreLevel={offshoreBuilding?.level ?? 0}
          selectedPlotId={selectedPlotId}
          hoveredPlotId={hoveredPlotId}
          onHoverWaterEntity={setHoveredWaterEntity}
          onSelectPlot={onSelectPlot}
          canClick={() => !dragRef.current.moved}
        />

        {/* Live Sea Fleet & Exploration Telemetry Marker over the ocean */}
        <div
          dir="rtl"
          onClick={(e) => {
            e.stopPropagation();
            if (!dragRef.current.moved) {
              onSelectPlot(
                state.maritime.discoveredOilWells > 0 || offshoreBuilt
                  ? 'p-offshore'
                  : 'p-seaport'
              );
            }
          }}
          className="absolute cursor-pointer px-2.5 py-1 rounded-md bg-[#090F1E]/92 hover:bg-[#0F172A] border border-sky-400/65 text-[11px] text-sky-100 flex items-center gap-2 shadow-lg transition-colors"
          style={{ left: '84%', top: '4.8%', transform: 'translate(-50%, -50%)' }}
        >
          <span className="w-2 h-2 rounded-full bg-emerald-400 coastal-beacon-pulse" />
          <Ship className="w-3.5 h-3.5 text-sky-300" />
          <span>
            أسطول البحر:{' '}
            <span className="font-num font-bold text-amber-300">
              {state.maritime.cargoShips + state.maritime.surveyVessels}
            </span>
            {(state.maritime.discoveredOilWells > 0 ||
              state.maritime.discoveredGasFields > 0) && (
              <>
                {' '}
                · نفط:{' '}
                <span className="font-num font-bold text-emerald-300">
                  {state.maritime.discoveredOilWells}
                </span>
                {' '}
                · غاز:{' '}
                <span className="font-num font-bold text-sky-300">
                  {state.maritime.discoveredGasFields}
                </span>
              </>
            )}
          </span>
        </div>

        {/* 2. Depth-Sorted Realistic 2.5D Building Sprites Anchored Dead-Center on Each Block */}
        {sortedPlots.map(({ plot, uv }) => {
          const building = buildingByPlot.get(plot.id);
          const isSelected = selectedPlotId === plot.id;
          const isHovered = hoveredPlotId === plot.id;
          const queueJob = building ? queueByBuildingId.get(building.id) : undefined;
          const spriteUrl = building ? sprites[building.type] : undefined;

          let progressPct = 0;
          let remainingText: string | undefined;
          if (queueJob) {
            const total = Math.max(1, queueJob.endsAt - queueJob.startedAt);
            const elapsed = Math.max(0, now - queueJob.startedAt);
            progressPct = Math.min(100, (elapsed / total) * 100);
            remainingText = formatDuration((queueJob.endsAt - now) / 1000);
          }

          const isBusy =
            building?.status === 'CONSTRUCTING' ||
            building?.status === 'UPGRADING';
          const isEmpty = !building || building.status === 'EMPTY';
          const isPendingHighlight = Boolean(
            pendingBuildType && !plot.fixedType && isEmpty
          );

          const spriteSize =
            building?.type === 'seaport' || building?.type === 'offshore_rig'
              ? 176
              : building?.type === 'hq' || building?.type === 'hospital'
                ? 168
                : 154;

          return (
            <div
              key={plot.id}
              onClick={(e) => {
                e.stopPropagation();
                if (!dragRef.current.moved) onSelectPlot(plot.id);
              }}
              onMouseEnter={() => setHoveredPlotId(plot.id)}
              onMouseLeave={() =>
                setHoveredPlotId((prev) => (prev === plot.id ? null : prev))
              }
              className="absolute cursor-pointer"
              style={{
                left: `${uv.u * 100}%`,
                top: `${uv.v * 100}%`,
                width: plot.isCoastal ? '138px' : '150px',
                height: plot.isCoastal ? '74px' : '82px',
                transform: 'translate(-50%, -50%)',
              }}
            >
              {/* Subtle Isometric Block Highlight on hover, selection, or build placement */}
              {(isSelected || isHovered || isPendingHighlight) && (
                <svg
                  width="160"
                  height="88"
                  viewBox="-80 -44 160 88"
                  className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 overflow-visible"
                >
                  <polygon
                    points="0,-39 76,0 0,39 -76,0"
                    fill={
                      isSelected
                        ? 'rgba(245, 158, 11, 0.22)'
                        : isPendingHighlight
                          ? 'rgba(56, 189, 248, 0.24)'
                          : 'rgba(255, 255, 255, 0.14)'
                    }
                    stroke={
                      isSelected
                        ? '#F59E0B'
                        : isPendingHighlight
                          ? '#38BDF8'
                          : '#FDE68A'
                    }
                    strokeWidth="2.4"
                  />
                </svg>
              )}

              {/* Empty Plot Marker */}
              {isEmpty && (
                <div
                  dir="rtl"
                  className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center"
                >
                  {plot.suggestedType === 'seaport' ? (
                    <div className="px-2.5 py-1 rounded-md bg-[#090F1E]/92 border border-sky-400/85 text-sky-100 flex items-center gap-1.5 shadow-lg whitespace-nowrap">
                      <Anchor className="w-3.5 h-3.5 text-sky-300" />
                      <span className="text-[11px] font-bold">الرصيف التجاري والميناء</span>
                    </div>
                  ) : plot.suggestedType === 'offshore_rig' ? (
                    <div className="px-2.5 py-1 rounded-md bg-[#090F1E]/92 border border-amber-400/85 text-amber-100 flex items-center gap-1.5 shadow-lg whitespace-nowrap">
                      <Flame className="w-3.5 h-3.5 text-amber-400" />
                      <span className="text-[11px] font-bold">منطقة استكشاف النفط والغاز</span>
                    </div>
                  ) : plot.suggestedType === 'hospital' ? (
                    <div className="px-2.5 py-1 rounded-md bg-[#090F1E]/92 border border-sky-400/75 text-sky-200 flex items-center gap-1.5 shadow-lg whitespace-nowrap">
                      <HeartPulse className="w-3.5 h-3.5 text-rose-400" />
                      <span className="text-[11px] font-bold">موقع المستشفى</span>
                    </div>
                  ) : plot.suggestedType === 'alliance_center' ? (
                    <div className="px-2.5 py-1 rounded-md bg-[#090F1E]/92 border border-amber-400/80 text-amber-200 flex items-center gap-1.5 shadow-lg whitespace-nowrap">
                      <Landmark className="w-3.5 h-3.5 text-amber-400" />
                      <span className="text-[11px] font-bold">موقع مركز التحالف</span>
                    </div>
                  ) : plot.fixedType === 'fortifications' ? (
                    <div className="px-2.5 py-1 rounded-md bg-[#090F1E]/92 border border-blue-400/75 text-blue-200 flex items-center gap-1.5 shadow-lg whitespace-nowrap">
                      <Shield className="w-3.5 h-3.5 text-blue-400" />
                      <span className="text-[11px] font-bold">بوابة التحصينات</span>
                    </div>
                  ) : (
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center border text-sm font-bold shadow-md transition-transform ${
                        isPendingHighlight
                          ? 'bg-sky-950/95 border-sky-400 text-sky-200 scale-110'
                          : 'bg-[#090F1E]/82 border-amber-400/75 text-amber-300'
                      }`}
                    >
                      +
                    </div>
                  )}
                </div>
              )}

              {/* Initial Construction Site Crane */}
              {building && building.status === 'CONSTRUCTING' && (
                <svg
                  width="120"
                  height="100"
                  viewBox="-60 -70 120 100"
                  className="pointer-events-none overflow-visible absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
                >
                  <polygon points="0,-24 48,0 0,24 -48,0" fill="#64748B" stroke="#CBD5E1" strokeWidth="1" />
                  <polygon points="-48,0 0,24 0,30 -48,6" fill="#475569" />
                  <polygon points="0,24 48,0 48,6 0,30" fill="#334155" />
                  <line x1="16" y1="2" x2="16" y2="-56" stroke="#F59E0B" strokeWidth="3.5" />
                  <line x1="-28" y1="-48" x2="32" y2="-56" stroke="#FBBF24" strokeWidth="3" />
                  <line x1="-20" y1="-49" x2="-20" y2="-22" stroke="#E2E8F0" strokeWidth="1.4" />
                  <rect x="-25" y="-22" width="10" height="7" fill="#1D4ED8" rx="1" />
                </svg>
              )}

              {/* Realistic 2.5D Transparent-Cutout Sprite Centered Inside Its Grass Block */}
              {building &&
                building.status !== 'EMPTY' &&
                building.status !== 'CONSTRUCTING' && (
                  <>
                    {/* Ground Contact Ambient Shadow */}
                    <div
                      className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-slate-950/42 blur-[6px]"
                      style={{
                        width: `${Math.round(spriteSize * 0.72)}px`,
                        height: '44px',
                        marginTop: '6px',
                      }}
                    />

                    {spriteUrl ? (
                      <img
                        src={spriteUrl}
                        alt={BUILDINGS_META[building.type].name}
                        draggable={false}
                        referrerPolicy="no-referrer"
                        className="pointer-events-none max-w-none absolute left-1/2"
                        style={{
                          width: `${spriteSize}px`,
                          height: `${spriteSize}px`,
                          bottom: '8px',
                          transform: 'translateX(-50%)',
                          objectFit: 'contain',
                          objectPosition: 'bottom center',
                        }}
                      />
                    ) : (
                      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-14 h-14 rounded-lg bg-blue-700/80 border border-amber-400" />
                    )}

                    {/* Active Upgrade Crane Overlay */}
                    {building.status === 'UPGRADING' && (
                      <svg
                        width="70"
                        height="80"
                        viewBox="-35 -75 70 80"
                        className="pointer-events-none overflow-visible absolute left-1/2 top-0 translate-x-2"
                      >
                        <line x1="0" y1="0" x2="0" y2="-66" stroke="#F59E0B" strokeWidth="3" />
                        <line x1="-32" y1="-58" x2="18" y2="-65" stroke="#FBBF24" strokeWidth="2.6" />
                        <line x1="-22" y1="-60" x2="-22" y2="-35" stroke="#E2E8F0" strokeWidth="1.2" />
                      </svg>
                    )}
                  </>
                )}

              {/* Warehouse Unprotected Excess Indicator (Production Never Stops) */}
              {hasExposedExcess &&
                building?.status === 'COMPLETED' &&
                (building.type === 'farm' ||
                  building.type === 'sawmill' ||
                  building.type === 'iron_mine') && (
                  <div
                    dir="rtl"
                    className="pointer-events-none absolute left-1/2 -translate-x-1/2 -top-12 px-2 py-0.5 rounded bg-orange-950/95 border border-amber-500 text-[10px] font-bold text-amber-200 whitespace-nowrap shadow"
                  >
                    فائض غير محمي
                  </div>
                )}

              {/* Active Construction / Upgrade Timer */}
              {isBusy && remainingText && (
                <div
                  dir="rtl"
                  className="pointer-events-none absolute left-1/2 -translate-x-1/2 -top-10 w-[76px] px-1.5 py-0.5 rounded bg-slate-950/95 border border-amber-500 text-center shadow"
                >
                  <div className="text-[10px] font-num font-bold text-amber-200">
                    {remainingText}
                  </div>
                  <div className="w-full h-1 bg-slate-800 rounded overflow-hidden mt-0.5">
                    <div
                      className="h-full bg-amber-400"
                      style={{ width: `${Math.max(6, progressPct)}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Crisp Building Level Badge */}
              {building && building.level > 0 && (
                <div
                  dir="rtl"
                  className={`pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-[-10px] px-2 py-0.5 rounded text-[10px] font-bold whitespace-nowrap shadow-md border ${
                    isSelected
                      ? 'bg-amber-700 border-amber-200 text-white'
                      : 'bg-[#090F1E]/92 border-blue-500/80 text-slate-100'
                  }`}
                >
                  {BUILDINGS_META[building.type].name.split(' ')[0]}{' '}
                  <span className="font-num">{building.level}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
