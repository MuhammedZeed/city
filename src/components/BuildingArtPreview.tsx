import React, { useState } from 'react';
import {
  Anchor,
  Building2,
  Flame,
  FlaskConical,
  HeartPulse,
  Landmark,
  Pickaxe,
  Shield,
  Swords,
  Trees,
  Warehouse,
  Wheat,
} from 'lucide-react';
import { BUILDING_ARTWORK } from '../data/buildingArtwork';
import { BUILDINGS_META } from '../data/gameData';
import { BuildingType } from '../types/game';

const FALLBACK_ICON: Record<BuildingType, React.ComponentType<{ className?: string }>> = {
  hq: Building2,
  warehouse: Warehouse,
  farm: Wheat,
  sawmill: Trees,
  iron_mine: Pickaxe,
  research_center: FlaskConical,
  barracks: Swords,
  fortifications: Shield,
  hospital: HeartPulse,
  alliance_center: Landmark,
  seaport: Anchor,
  offshore_rig: Flame,
};

export const BuildingArtPreview: React.FC<{
  type: BuildingType;
  className?: string;
}> = ({ type, className = 'aspect-[4/3] w-full' }) => {
  const [failed, setFailed] = useState(false);
  const src = BUILDING_ARTWORK[type];
  const Icon = FALLBACK_ICON[type];
  const name = BUILDINGS_META[type].name;

  if (!src || failed) {
    return (
      <div
        className={`${className} rounded-lg bg-gradient-to-br from-[#172554] via-[#0F172A] to-[#1E293B] border border-slate-700/80 flex flex-col items-center justify-center gap-2 p-3`}
      >
        <Icon className="w-8 h-8 text-amber-400" />
        <span className="text-xs font-bold text-slate-200">{name}</span>
      </div>
    );
  }

  return (
    <div className={`${className} rounded-lg overflow-hidden border border-slate-700/80 bg-[#090F1E]`}>
      <img
        src={src}
        alt={name}
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        className="w-full h-full object-cover"
      />
    </div>
  );
};
