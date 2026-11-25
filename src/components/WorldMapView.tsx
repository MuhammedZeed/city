import React, { useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Binoculars,
  ChevronDown,
  ChevronUp,
  Compass,
  Maximize2,
  MapPin,
  Shield,
  Sparkles,
  Swords,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { TERRAIN_LABELS, UNITS_META } from '../data/gameData';
import {
  formatDuration,
  formatNumber,
  getMainBuildingLevel,
  getReconRevealPct,
  isShieldActive,
} from '../engine/gameEngine';
import { BuildingType, GameState, WorldTile } from '../types/game';
import { useTransparentBuildingSprites } from '../utils/spriteProcessor';

interface WorldMapViewProps {
  state: GameState;
  now: number;
  onDispatchRecon: (tileId: string, scoutCount: number) => void;
  onDispatchAttack?: (
    tileId: string,
    units: { infantry: number; tank: number; aircraft: number }
  ) => void;
}

const WORLD_TERRAIN_BG = '/src/assets/images/world_map_iso_terrain_1795466063027.jpg';

const CENTER_X = 412;
const CENTER_Y = 288;
const SECTOR_W = 148;
const SECTOR_H = 92;

function sectorToPos(x: number, y: number): { x: number; y: number } {
  const staggerX = ((y - CENTER_Y) % 2 === 0 ? 0 : 14) + (((x * 13 + y * 7) % 5) - 2) * 4;
  const staggerY = (((x * 11 + y * 17) % 5) - 2) * 3;
  return {
    x: (x - CENTER_X) * SECTOR_W + staggerX,
    y: (y - CENTER_Y) * SECTOR_H + staggerY,
  };
}

function siteSpriteType(cat?: WorldTile['siteCategory']): BuildingType {
  switch (cat) {
    case 'مورد استراتيجي':
      return 'sawmill';
    case 'موقع مراقبة':
      return 'research_center';
    case 'موقع تجاري':
      return 'warehouse';
    case 'موقع عسكري':
      return 'barracks';
    default:
      return 'iron_mine';
  }
}

export const WorldMapView: React.FC<WorldMapViewProps> = ({
  state,
  now,
  onDispatchRecon,
  onDispatchAttack,
}) => {
  const sprites = useTransparentBuildingSprites();
  const [selectedTileId, setSelectedTileId] = useState<string>(
    state.worldMap.find((t) => t.kind === 'npc_city')?.id ?? state.worldMap[0].id
  );
  const [hoveredTileId, setHoveredTileId] = useState<string | null>(null);
  const [scoutCount, setScoutCount] = useState(1);
  const [attackCounts, setAttackCounts] = useState({
    infantry: 0,
    tank: 0,
    aircraft: 0,
  });
  const [mobileInspectorOpen, setMobileInspectorOpen] = useState(false);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1.0);

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

  const playerHq = getMainBuildingLevel(state);
  const reconRevealPct = getReconRevealPct(state);
  const playerHasShield = isShieldActive(state, now);

  const selectedTile =
    state.worldMap.find((t) => t.id === selectedTileId) ?? state.worldMap[0];

  const dist = Math.hypot(
    selectedTile.x - state.cityCoords.x,
    selectedTile.y - state.cityCoords.y
  );
  const outboundSec = Math.max(15, Math.round((dist * 160) / UNITS_META.scout.speed));
  const returnSec = Math.max(12, Math.round(outboundSec * 0.8));
  const isSelectedProtected = Boolean(
    selectedTile.protectedUntil && selectedTile.protectedUntil > now
  );

  // Depth-sorted tiles for clean 2.5D overlap
  const projectedTiles = useMemo(() => {
    return state.worldMap
      .map((tile) => ({
        tile,
        pos: sectorToPos(tile.x, tile.y),
      }))
      .sort((a, b) => a.pos.y - b.pos.y);
  }, [state.worldMap]);

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
      const d = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
      pinchRef.current = {
        dist: d,
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
      const d = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
      const midX = (pts[0].x + pts[1].x) / 2;
      const midY = (pts[0].y + pts[1].y) / 2;
      const prev = pinchRef.current;

      if (prev && prev.dist > 8) {
        const ratio = d / prev.dist;
        setZoom((z) =>
          Math.max(0.65, Math.min(1.95, Number((z * ratio).toFixed(3))))
        );
        const mdx = midX - prev.midX;
        const mdy = midY - prev.midY;
        setPan((p) => ({
          x: Math.max(-460, Math.min(460, p.x + mdx)),
          y: Math.max(-260, Math.min(260, p.y + mdy)),
        }));
      }
      dragRef.current.moved = true;
      pinchRef.current = { dist: d, midX, midY };
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
      x: Math.max(-460, Math.min(460, p.x + stepDx)),
      y: Math.max(-260, Math.min(260, p.y + stepDy)),
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
    const delta = e.deltaY < 0 ? 0.1 : -0.1;
    setZoom((z) => Math.max(0.65, Math.min(1.95, Number((z + delta).toFixed(2)))));
  };

  const playerOrigin = sectorToPos(state.cityCoords.x, state.cityCoords.y);

  return (
    <div className="flex flex-col lg:flex-row h-full overflow-hidden">
      {/* Isometric 2.5D Realistic Strategy World Map */}
      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onWheel={handleWheel}
        className="relative flex-1 min-h-0 bg-[#3E6B2B] overflow-hidden select-none touch-none cursor-grab active:cursor-grabbing"
      >
        {/* Top Right Title Overlay */}
        <div className="absolute top-2.5 right-2.5 sm:top-3 sm:right-3 z-20 pointer-events-none px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl bg-[#090F1E]/92 backdrop-blur-md border border-amber-500/40 shadow-lg">
          <div className="text-xs sm:text-sm font-bold text-amber-300">خريطة العالم الاستراتيجية</div>
          <div className="hidden sm:block text-xs text-slate-300">
            اسحب للتنقل · اضغط على أي مدينة أو قطاع استراتيجي للاستطلاع
          </div>
        </div>

        {/* Selected Sector Quick Coordinate Readout (desktop) */}
        <div className="hidden lg:flex absolute bottom-3 right-3 z-20 pointer-events-none items-center gap-2.5 px-3.5 py-1.5 rounded-xl bg-[#090F1E]/92 backdrop-blur-md border border-slate-700 text-xs text-slate-200 shadow-lg">
          <Compass className="w-3.5 h-3.5 text-amber-400" />
          <span className="font-num font-bold text-amber-300">
            X: {selectedTile.x} | Y: {selectedTile.y}
          </span>
          <span className="text-slate-400">
            · {selectedTile.kind === 'player_city' ? state.cityName : selectedTile.name}
          </span>
        </div>

        {/* Camera Zoom & Center Controls */}
        <div
          onPointerDown={(e) => e.stopPropagation()}
          className="absolute bottom-2.5 left-2.5 sm:bottom-3 sm:left-3 z-20 flex items-center gap-1 p-1 rounded-xl bg-[#090F1E]/92 backdrop-blur-md border border-slate-700/90 shadow-lg"
        >
          <button
            type="button"
            title="تكبير"
            aria-label="تكبير"
            onClick={() => setZoom((z) => Math.min(1.85, Number((z + 0.14).toFixed(2))))}
            className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-lg hover:bg-slate-800 text-slate-200 hover:text-amber-300"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            type="button"
            title="تصغير"
            aria-label="تصغير"
            onClick={() => setZoom((z) => Math.max(0.7, Number((z - 0.14).toFixed(2))))}
            className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-lg hover:bg-slate-800 text-slate-200 hover:text-amber-300"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => {
              setPan({ x: 0, y: 0 });
              setZoom(1.0);
              const home = state.worldMap.find((t) => t.kind === 'player_city');
              if (home) setSelectedTileId(home.id);
            }}
            className="min-h-[40px] flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-slate-800 text-xs font-semibold text-slate-200 hover:text-amber-300 whitespace-nowrap"
          >
            <Maximize2 className="w-4 h-4 shrink-0" />
            <span className="hidden sm:inline">توسيط على مدينتي</span>
            <span className="sm:hidden">مدينتي</span>
          </button>
        </div>

        <svg
          viewBox="-840 -440 1680 920"
          className="w-full h-full"
          preserveAspectRatio="xMidYMid slice"
        >
          <defs>
            <radialGradient id="shieldDomeGrad" cx="46%" cy="34%" r="58%">
              <stop offset="0%" stopColor="#E0F2FE" stopOpacity="0.16" />
              <stop offset="65%" stopColor="#38BDF8" stopOpacity="0.34" />
              <stop offset="100%" stopColor="#1D4ED8" stopOpacity="0.68" />
            </radialGradient>
            <radialGradient id="softContactShadow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#09110A" stopOpacity="0.48" />
              <stop offset="72%" stopColor="#09110A" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#09110A" stopOpacity="0" />
            </radialGradient>
          </defs>

          <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
            {/* 1. Calm Sunlit Flat-Plane Isometric 2.5D Terrain Background */}
            <image
              href={WORLD_TERRAIN_BG}
              x="-1360"
              y="-765"
              width="2720"
              height="1530"
              preserveAspectRatio="xMidYMid slice"
            />

            {/* 2. Interactive Sector Hit Areas (appear cleanly only on hover or selection) */}
            {projectedTiles.map(({ tile, pos }) => {
              const isSelected = selectedTileId === tile.id;
              const isHovered = hoveredTileId === tile.id;

              return (
                <g
                  key={`hit-${tile.id}`}
                  transform={`translate(${pos.x}, ${pos.y})`}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!dragRef.current.moved) {
                      setSelectedTileId(tile.id);
                      if (typeof window !== 'undefined' && window.innerWidth < 1024) {
                        setMobileInspectorOpen(true);
                      }
                    }
                  }}
                  onMouseEnter={() => setHoveredTileId(tile.id)}
                  onMouseLeave={() =>
                    setHoveredTileId((prev) => (prev === tile.id ? null : prev))
                  }
                  className="cursor-pointer"
                >
                  <polygon
                    points="0,-42 70,0 0,42 -70,0"
                    fill={
                      isSelected
                        ? 'rgba(245, 158, 11, 0.16)'
                        : isHovered
                          ? 'rgba(56, 189, 248, 0.14)'
                          : 'transparent'
                    }
                    stroke={
                      isSelected
                        ? '#F59E0B'
                        : isHovered
                          ? 'rgba(253, 230, 138, 0.78)'
                          : 'transparent'
                    }
                    strokeWidth={isSelected ? 2.4 : 1.5}
                  />
                </g>
              );
            })}

            {/* 3. Active Recon March Trajectories */}
            {state.marches.map((march) => {
              const target = sectorToPos(march.targetCoords.x, march.targetCoords.y);
              let progress = 0;
              if (march.phase === 'OUTBOUND') {
                progress = Math.max(
                  0,
                  Math.min(
                    1,
                    (now - march.startedAt) / Math.max(1, march.arrivalAt - march.startedAt)
                  )
                );
              } else {
                progress =
                  1 -
                  Math.max(
                    0,
                    Math.min(
                      1,
                      (now - march.arrivalAt) / Math.max(1, march.returnAt - march.arrivalAt)
                    )
                  );
              }
              const sx = playerOrigin.x + (target.x - playerOrigin.x) * progress;
              const sy = playerOrigin.y + (target.y - playerOrigin.y) * progress;
              const angleDeg =
                (Math.atan2(target.y - playerOrigin.y, target.x - playerOrigin.x) * 180) /
                Math.PI;

              return (
                <g key={march.id} pointerEvents="none">
                  <line
                    x1={playerOrigin.x}
                    y1={playerOrigin.y}
                    x2={target.x}
                    y2={target.y}
                    stroke={march.phase === 'OUTBOUND' ? '#F59E0B' : '#38BDF8'}
                    strokeWidth="2.8"
                    strokeDasharray="8 6"
                    opacity="0.92"
                  />
                  <g
                    transform={`translate(${sx}, ${sy}) rotate(${
                      march.phase === 'OUTBOUND' ? angleDeg : angleDeg + 180
                    })`}
                  >
                    <polygon
                      points="12,0 -8,-7 -4,0 -8,7"
                      fill="#FDE68A"
                      stroke="#1D4ED8"
                      strokeWidth="1.6"
                    />
                  </g>
                  <g transform={`translate(${sx}, ${sy - 20})`}>
                    <rect
                      x="-28"
                      y="-9"
                      width="56"
                      height="15"
                      rx="3"
                      fill="#090F1E"
                      fillOpacity="0.92"
                      stroke={march.phase === 'OUTBOUND' ? '#F59E0B' : '#38BDF8'}
                      strokeWidth="1"
                    />
                    <text
                      x="0"
                      y="1.5"
                      textAnchor="middle"
                      fill="#F8FAFC"
                      fontSize="8.5"
                      fontFamily="IBM Plex Mono, monospace"
                      fontWeight="700"
                    >
                      {formatDuration(
                        ((march.phase === 'OUTBOUND' ? march.arrivalAt : march.returnAt) - now) /
                          1000
                      )}
                    </text>
                  </g>
                </g>
              );
            })}

            {/* 4. Crisp Cities & Strategic Sites Sitting Squarely on the Terrain */}
            {projectedTiles.map(({ tile, pos }) => {
              if (tile.kind === 'wilderness') return null;

              const isPlayer = tile.kind === 'player_city';
              const isCity = isPlayer || tile.kind === 'npc_city';
              const isProtected = Boolean(
                (isPlayer ? state.protectionEndsAt : tile.protectedUntil ?? 0) > now
              );
              const hqLvl = isPlayer ? playerHq : tile.hqLevel ?? 1;
              const displayCityName = isPlayer ? state.cityName : tile.name;
              const displayOwner = isPlayer ? state.commanderName : tile.ownerName;

              const spriteKey: BuildingType = isCity
                ? 'hq'
                : siteSpriteType(tile.siteCategory);
              const spriteUrl = sprites[spriteKey];
              const flankLeftUrl = isCity ? sprites.warehouse : undefined;
              const flankRightUrl = isCity ? sprites.barracks : undefined;
              const isSelected = selectedTileId === tile.id;

              return (
                <g
                  key={`ent-${tile.id}`}
                  transform={`translate(${pos.x}, ${pos.y})`}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!dragRef.current.moved) {
                      setSelectedTileId(tile.id);
                      if (typeof window !== 'undefined' && window.innerWidth < 1024) {
                        setMobileInspectorOpen(true);
                      }
                    }
                  }}
                  onMouseEnter={() => setHoveredTileId(tile.id)}
                  onMouseLeave={() =>
                    setHoveredTileId((prev) => (prev === tile.id ? null : prev))
                  }
                  className="cursor-pointer"
                >
                  {/* Soft Ground Ambient Shadow */}
                  <ellipse
                    cx="0"
                    cy="8"
                    rx={isCity ? 66 : 44}
                    ry={isCity ? 32 : 21}
                    fill="url(#softContactShadow)"
                  />

                  {/* Crisp Isometric City Compound Concrete & Perimeter Wall Base */}
                  {isCity ? (
                    <g>
                      <polygon
                        points="0,-29 58,3 0,35 -58,3"
                        fill="#475569"
                      />
                      <polygon
                        points="0,-32 58,0 0,32 -58,0"
                        fill="#9CA3AF"
                        stroke={isPlayer ? '#F59E0B' : isSelected ? '#FDE68A' : '#1E3A8A'}
                        strokeWidth={isPlayer || isSelected ? 2.4 : 1.6}
                      />
                      <polygon
                        points="0,-26 47,0 0,26 -47,0"
                        fill="#64748B"
                        opacity="0.45"
                      />
                    </g>
                  ) : (
                    /* Strategic Site Concrete Base Pad */
                    <polygon
                      points="0,-22 40,0 0,22 -40,0"
                      fill="#64748B"
                      stroke={isSelected ? '#FDE68A' : '#F59E0B'}
                      strokeWidth={isSelected ? 2.2 : 1.3}
                    />
                  )}

                  {/* Left & Right Compound Buildings (for realistic fortified city look) */}
                  {isCity && flankLeftUrl && (
                    <image
                      href={flankLeftUrl}
                      x="-52"
                      y="-42"
                      width="46"
                      height="46"
                      preserveAspectRatio="xMidYMax meet"
                    />
                  )}
                  {isCity && flankRightUrl && (
                    <image
                      href={flankRightUrl}
                      x="6"
                      y="-42"
                      width="46"
                      height="46"
                      preserveAspectRatio="xMidYMax meet"
                    />
                  )}

                  {/* Primary Center Building Sprite */}
                  {spriteUrl ? (
                    <image
                      href={spriteUrl}
                      x={isCity ? -54 : -42}
                      y={isCity ? -92 : -68}
                      width={isCity ? 108 : 84}
                      height={isCity ? 108 : 84}
                      preserveAspectRatio="xMidYMax meet"
                    />
                  ) : (
                    <polygon
                      points="0,-24 40,0 0,24 -40,0"
                      fill="#1D4ED8"
                      stroke="#F59E0B"
                      strokeWidth="1.5"
                    />
                  )}

                  {/* Glowing Translucent Beginner Shield Dome */}
                  {isProtected && (
                    <g pointerEvents="none">
                      <ellipse
                        cx="0"
                        cy="-20"
                        rx="64"
                        ry="52"
                        fill="url(#shieldDomeGrad)"
                        stroke="#BAE6FD"
                        strokeWidth="1.8"
                      />
                      <path
                        d="M -46,-35 Q 0,-66 46,-35"
                        fill="none"
                        stroke="#F0F9FF"
                        strokeWidth="1.5"
                        opacity="0.82"
                      />
                    </g>
                  )}

                  {/* Nameplate & Royal Blue / Gold Level Crest beneath City */}
                  {isCity ? (
                    <g transform="translate(0, 36)" pointerEvents="none">
                      <rect
                        x="-68"
                        y="-10"
                        width="136"
                        height="20"
                        rx="4"
                        fill="#090F1E"
                        fillOpacity="0.93"
                        stroke={isPlayer ? '#F59E0B' : '#3B82F6'}
                        strokeWidth="1.2"
                      />
                      <text
                        x="-8"
                        y="3.2"
                        textAnchor="middle"
                        fill={isPlayer ? '#FDE68A' : '#E2E8F0'}
                        fontSize="9.5"
                        fontFamily="Cairo, sans-serif"
                        fontWeight="700"
                      >
                        {displayCityName}
                        {displayOwner ? ` · ${displayOwner}` : ''}
                      </text>

                      {/* Royal Blue & Gold Diamond HQ Crest */}
                      <g transform="translate(59, 0)">
                        <polygon
                          points="0,-13 13,0 0,13 -13,0"
                          fill={isPlayer ? '#B45309' : '#1D4ED8'}
                          stroke="#FDE68A"
                          strokeWidth="1.5"
                        />
                        <text
                          x="0"
                          y="3.5"
                          textAnchor="middle"
                          fill="#FFFFFF"
                          fontSize="9.5"
                          fontFamily="IBM Plex Mono, monospace"
                          fontWeight="700"
                        >
                          {hqLvl}
                        </text>
                      </g>
                    </g>
                  ) : (
                    /* Strategic Site Tag */
                    <g transform="translate(0, 26)" pointerEvents="none">
                      <rect
                        x="-58"
                        y="-9"
                        width="116"
                        height="17"
                        rx="3"
                        fill="#090F1E"
                        fillOpacity="0.92"
                        stroke="#F59E0B"
                        strokeWidth="1"
                      />
                      <text
                        x="0"
                        y="2.5"
                        textAnchor="middle"
                        fill="#FCD34D"
                        fontSize="9"
                        fontFamily="Cairo, sans-serif"
                        fontWeight="700"
                      >
                        {tile.name}
                      </text>
                    </g>
                  )}
                </g>
              );
            })}
          </g>
        </svg>
      </div>

      {/* Sector Inspector Drawer (compact collapsible bar on mobile, full sidebar on lg+) */}
      <aside className="w-full lg:w-[360px] shrink-0 bg-[#0B1222]/98 backdrop-blur-xl border-t lg:border-t-0 lg:border-r border-slate-800 flex flex-col max-h-[56dvh] lg:max-h-full">
        {/* Mobile Toggle Bar */}
        <button
          type="button"
          onClick={() => setMobileInspectorOpen((v) => !v)}
          className="lg:hidden min-h-[44px] w-full px-4 py-2 flex items-center justify-between gap-2 bg-slate-900/90 border-b border-slate-800 text-right"
        >
          <div className="flex items-center gap-2 min-w-0">
            <Compass className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="text-xs font-bold text-slate-100 truncate">
              {selectedTile.kind === 'player_city' ? state.cityName : selectedTile.name}
            </span>
            <span className="text-[11px] font-num text-amber-300 shrink-0">
              ({selectedTile.x} | {selectedTile.y})
            </span>
          </div>
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-sky-300 shrink-0">
            <span>{mobileInspectorOpen ? 'إخفاء التفاصيل' : 'تفاصيل واستطلاع'}</span>
            {mobileInspectorOpen ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronUp className="w-4 h-4" />
            )}
          </span>
        </button>

        <div
          className={`${
            mobileInspectorOpen ? 'block' : 'hidden'
          } lg:block p-4 sm:p-5 overflow-y-auto space-y-4`}
        >
        <div className="flex items-start justify-between gap-2 pb-3 border-b border-slate-800">
          <div>
            <div className="text-xs text-amber-400 font-semibold flex items-center gap-1.5">
              <Compass className="w-3.5 h-3.5" />
              <span>قطاع ({selectedTile.x} | {selectedTile.y})</span>
            </div>
            <h3 className="text-lg font-bold text-slate-100 mt-1">
              {selectedTile.kind === 'player_city' ? state.cityName : selectedTile.name}
            </h3>
            <p className="text-xs text-slate-400">
              التضاريس: {TERRAIN_LABELS[selectedTile.terrain]}
              {selectedTile.siteCategory ? ` · ${selectedTile.siteCategory}` : ''}
            </p>
          </div>
        </div>

        {(selectedTile.kind === 'npc_city' || selectedTile.kind === 'player_city') && (
          <div className="p-3.5 rounded-lg bg-slate-900 border border-slate-800 space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-400">الحاكم</span>
              <span className="font-bold text-slate-100">
                {selectedTile.kind === 'player_city'
                  ? state.commanderName
                  : selectedTile.ownerName}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">مستوى المبنى الرئيسي</span>
              <span className="font-num font-bold text-sky-300">
                مستوى {selectedTile.kind === 'player_city' ? playerHq : selectedTile.hqLevel}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">نقاط المدينة</span>
              <span className="font-num font-bold text-amber-300">
                {formatNumber(selectedTile.points ?? 0)}
              </span>
            </div>
            <div className="flex justify-between items-center pt-1 border-t border-slate-800">
              <span className="text-slate-400">حالة الحماية</span>
              <span
                className={
                  (selectedTile.kind === 'player_city'
                    ? playerHasShield
                    : isSelectedProtected)
                    ? 'text-sky-300 font-semibold'
                    : 'text-amber-300 font-semibold'
                }
              >
                {selectedTile.kind === 'player_city'
                  ? playerHasShield
                    ? `محمية`
                    : 'غير محمية'
                  : isSelectedProtected
                    ? `محمية (${formatDuration((selectedTile.protectedUntil! - now) / 1000)})`
                    : 'غير محمية'}
              </span>
            </div>
          </div>
        )}

        {selectedTile.kind === 'strategic_site' && (
          <div className="p-3.5 rounded-lg bg-slate-900 border border-slate-800 space-y-2 text-xs text-slate-300">
            <div className="flex items-center gap-1.5 font-bold text-amber-300">
              <Sparkles className="w-3.5 h-3.5" />
              <span>{selectedTile.siteCategory}</span>
            </div>
            <p className="leading-relaxed text-slate-400">
              أرسل الكشافة لمعرفة تفاصيل الموقع والموارد الموجودة فيه، وتفتح السيطرة الكاملة عليه في المراحل المتقدمة بعد المبنى الرئيسي 10.
            </p>
          </div>
        )}

        {selectedTile.scouted && selectedTile.lastScoutInfo && (
          <div className="p-3.5 rounded-lg bg-blue-950/35 border border-blue-500/30 space-y-1.5 text-xs">
            <div className="font-bold text-blue-200">آخر معلومات الاستطلاع</div>
            <p className="text-slate-300">{selectedTile.lastScoutInfo}</p>
          </div>
        )}

        {selectedTile.kind !== 'player_city' && (
          <div className="p-4 rounded-lg bg-slate-900/90 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-200 flex items-center gap-1.5">
                <Binoculars className="w-4 h-4 text-amber-400" />
                <span>إرسال حملة استطلاع</span>
              </span>
              <span className="text-slate-400 font-num">
                المسافة: {dist.toFixed(1)} قطاع
              </span>
            </div>

            <div className="space-y-1.5 text-xs text-slate-300">
              <div className="flex justify-between">
                <span className="text-slate-400">نسبة الكشف الاستخباراتي</span>
                <span className="font-num font-bold text-amber-300">{reconRevealPct}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">كشافة الاستطلاع المتاحون</span>
                <span className="font-num font-bold text-sky-300">{state.units.scout}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">زمن الوصول</span>
                <span className="font-num">{formatDuration(outboundSec)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">زمن العودة (أسرع 20%)</span>
                <span className="font-num text-emerald-300">{formatDuration(returnSec)}</span>
              </div>
            </div>

            {state.units.scout > 0 ? (
              <div className="space-y-2.5 pt-1">
                <div className="flex items-center gap-2">
                  <label htmlFor="scout-count" className="text-xs text-slate-400 shrink-0">
                    عدد الكشافة:
                  </label>
                  <input
                    id="scout-count"
                    type="number"
                    min={1}
                    max={state.units.scout}
                    value={scoutCount}
                    onChange={(e) =>
                      setScoutCount(
                        Math.max(1, Math.min(state.units.scout, Number(e.target.value) || 1))
                      )
                    }
                    className="w-full px-3 py-1.5 rounded bg-slate-950 border border-slate-700 text-xs font-num text-slate-100"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => onDispatchRecon(selectedTile.id, scoutCount)}
                  className="w-full min-h-[44px] py-2.5 px-4 rounded-xl bg-[#1D4ED8] hover:bg-blue-600 text-white text-xs font-bold flex items-center justify-center gap-2 transition-colors"
                >
                  <MapPin className="w-4 h-4" />
                  <span>إرسال استطلاع الآن (يحافظ على درع الحماية)</span>
                </button>
              </div>
            ) : (
              <div className="p-2.5 rounded bg-slate-950 border border-slate-800 text-[11px] text-slate-400 flex items-start gap-2">
                <Shield className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <span>
                  لا تملك كشافة استطلاع حاليًا. تُفتح الثكنة العسكرية لتدريب الكشافة عند المبنى الرئيسي مستوى 9.
                </span>
              </div>
            )}
          </div>
        )}

        {/* Military Attack Panel on Unprotected NPC Cities */}
        {selectedTile.kind === 'npc_city' && onDispatchAttack && (
          <div className="p-4 rounded-lg bg-rose-950/20 border border-rose-500/35 space-y-3 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-bold text-rose-200 flex items-center gap-1.5">
                <Swords className="w-4 h-4 text-rose-400" />
                <span>شن هجوم عسكري على المدينة</span>
              </span>
            </div>

            {isSelectedProtected ? (
              <p className="text-[11px] text-sky-300">
                هذه المدينة محمية بدرع حماية حاليًا ولا يمكن مهاجمتها حتى انتهاء الدرع.
              </p>
            ) : (
              <>
                {playerHasShield && (
                  <div className="p-2.5 rounded-lg bg-amber-950/40 border border-amber-500/50 text-[11px] text-amber-200 flex items-start gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <span>
                      تنبيه هام: إرسال هجوم عسكري من لاعب سيُبطل درع الحماية الخاص بك فورًا دون أي تعويض!
                    </span>
                  </div>
                )}

                <div className="grid grid-cols-3 gap-2">
                  {(['infantry', 'tank', 'aircraft'] as const).map((uType) => {
                    const maxAvail = state.units[uType] ?? 0;
                    return (
                      <div key={uType} className="space-y-1">
                        <label className="text-[10px] text-slate-400 block truncate">
                          {UNITS_META[uType].name} ({maxAvail})
                        </label>
                        <input
                          type="number"
                          min={0}
                          max={maxAvail}
                          value={Math.min(attackCounts[uType], maxAvail)}
                          onChange={(e) =>
                            setAttackCounts((prev) => ({
                              ...prev,
                              [uType]: Math.max(0, Math.min(maxAvail, Number(e.target.value) || 0)),
                            }))
                          }
                          className="w-full px-2 py-1.5 rounded bg-slate-950 border border-slate-700 text-xs font-num text-slate-100 text-center"
                        />
                      </div>
                    );
                  })}
                </div>

                <button
                  type="button"
                  disabled={
                    Math.min(attackCounts.infantry, state.units.infantry ?? 0) +
                      Math.min(attackCounts.tank, state.units.tank ?? 0) +
                      Math.min(attackCounts.aircraft, state.units.aircraft ?? 0) <=
                    0
                  }
                  onClick={() =>
                    onDispatchAttack(selectedTile.id, {
                      infantry: Math.min(attackCounts.infantry, state.units.infantry ?? 0),
                      tank: Math.min(attackCounts.tank, state.units.tank ?? 0),
                      aircraft: Math.min(attackCounts.aircraft, state.units.aircraft ?? 0),
                    })
                  }
                  className="w-full min-h-[42px] py-2 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-bold flex items-center justify-center gap-2 transition-colors"
                >
                  <Swords className="w-4 h-4" />
                  <span>إرسال حملة الهجوم</span>
                </button>
              </>
            )}
          </div>
        )}
        </div>
      </aside>
    </div>
  );
};
