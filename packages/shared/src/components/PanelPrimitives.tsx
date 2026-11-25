import React from 'react';
import { Clock, Pickaxe, Trees, Wheat } from 'lucide-react';
import { formatDurationArabic, formatNumber } from '../engine/gameEngine';
import { ResourceBundle } from '../types/game';

interface PanelHeaderProps {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle: string;
  rightSlot?: React.ReactNode;
}

export const PanelHeader: React.FC<PanelHeaderProps> = ({
  icon: Icon,
  title,
  subtitle,
  rightSlot,
}) => {
  return (
    <div className="group glass-panel p-4 sm:p-5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 sm:gap-4">
      <div className="flex items-start sm:items-center gap-3.5 min-w-0">
        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#1D4ED8]/40 to-amber-500/20 border border-amber-400/45 flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-105">
          <Icon className="w-5 h-5 text-amber-300" />
        </div>
        <div className="min-w-0 space-y-1">
          <h2 className="text-base sm:text-xl font-bold text-slate-100 leading-snug">
            {title}
          </h2>
          <p className="text-xs text-slate-300/90 leading-relaxed max-w-2xl">
            {subtitle}
          </p>
        </div>
      </div>

      {rightSlot && (
        <div className="shrink-0 flex flex-wrap items-center gap-2 max-w-full">
          {rightSlot}
        </div>
      )}
    </div>
  );
};

interface ResourceCostRowProps {
  cost: ResourceBundle;
  currentResources: ResourceBundle;
  durationSec?: number;
}

export const ResourceCostRow: React.FC<ResourceCostRowProps> = ({
  cost,
  currentResources,
  durationSec,
}) => {
  const hasWheat = currentResources.wheat >= cost.wheat;
  const hasWood = currentResources.wood >= cost.wood;
  const hasIron = currentResources.iron >= cost.iron;

  return (
    <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1.5 text-xs font-num">
      <span
        className={`inline-flex items-center gap-1 font-semibold ${
          hasWheat ? 'text-amber-300' : 'text-rose-400'
        }`}
        title="القمح المطلوب"
      >
        <Wheat className="w-3.5 h-3.5 shrink-0" />
        <span>{formatNumber(cost.wheat)}</span>
      </span>
      <span
        className={`inline-flex items-center gap-1 font-semibold ${
          hasWood ? 'text-emerald-300' : 'text-rose-400'
        }`}
        title="الخشب المطلوب"
      >
        <Trees className="w-3.5 h-3.5 shrink-0" />
        <span>{formatNumber(cost.wood)}</span>
      </span>
      <span
        className={`inline-flex items-center gap-1 font-semibold ${
          hasIron ? 'text-sky-300' : 'text-rose-400'
        }`}
        title="الحديد المطلوب"
      >
        <Pickaxe className="w-3.5 h-3.5 shrink-0" />
        <span>{formatNumber(cost.iron)}</span>
      </span>
      {durationSec !== undefined && (
        <span className="inline-flex items-center gap-1 text-slate-300 ms-auto">
          <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span>{formatDurationArabic(durationSec)}</span>
        </span>
      )}
    </div>
  );
};
