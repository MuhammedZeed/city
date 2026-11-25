import React, { useState } from 'react';
import {
  Clock,
  Coins,
  Crown,
  Gem,
  Gift,
  Pickaxe,
  Settings,
  Shield,
  ShieldAlert,
  ShoppingBag,
  Swords,
  Trees,
  Warehouse,
  Wheat,
} from 'lucide-react';
import { GAME_BRAND_NAME, GAME_STATUS_BADGE } from '@enginora/shared';
import {
  formatDuration,
  formatKsaTime,
  formatNumber,
  getActiveShieldEndsAt,
  getCityPoints,
  getExposedExcessResources,
  getKsaDayKey,
  getMainBuildingLevel,
  getProductionRates,
  getProtectedWarehouseCapacity,
  getTotalGems,
  getTotalStoredResources,
  isAttackBoostActive,
  isDefenseBoostActive,
} from '@enginora/shared';
import {
  FREE_ADVISOR_PORTRAIT,
  SMART_ADVISOR_PORTRAIT,
} from '../engine/advisorEngine';
import { GameState, NavSection } from '@enginora/shared';

interface TopHudProps {
  state: GameState;
  now: number;
  activeSection?: NavSection;
  onOpenSettings: () => void;
  onOpenBotModal: () => void;
  onOpenStore?: () => void;
  onOpenMonthly?: () => void;
}

export const TopHud: React.FC<TopHudProps> = ({
  state,
  now,
  activeSection,
  onOpenSettings,
  onOpenBotModal,
  onOpenStore,
  onOpenMonthly,
}) => {
  const [avatarFailed, setAvatarFailed] = useState(false);

  const mainLv = getMainBuildingLevel(state);
  const rates = getProductionRates(state);
  const warehouseCap = getProtectedWarehouseCapacity(state);
  const storedTotal = getTotalStoredResources(state.resources);
  const { excessTotal, maxLootablePerAttack } = getExposedExcessResources(state);
  const storagePct = Math.min(100, Math.round((storedTotal / Math.max(1, warehouseCap)) * 100));
  const activeShieldEnd = getActiveShieldEndsAt(state, now);
  const protectionRemainingSec = activeShieldEnd
    ? Math.max(0, (activeShieldEnd - now) / 1000)
    : 0;
  const atkBuff = isAttackBoostActive(state, now);
  const defBuff = isDefenseBoostActive(state, now);
  const cityPoints = getCityPoints(state);
  const totalGems = getTotalGems(state);
  const canClaimDailyMonthly = state.monthlyRewards.lastClaimKsaDayKey !== getKsaDayKey(now);

  return (
    <header className="w-full bg-[#090F1E]/95 backdrop-blur-md border-b border-slate-800/90 px-2.5 sm:px-5 py-1.5 sm:py-2.5 [@media(max-height:500px)]:py-1.5 shrink-0 z-30">
      <div className="flex flex-wrap lg:flex-nowrap items-center justify-between gap-2 sm:gap-3">
        {/* Zone 1: Brand + Commander + Main Building */}
        <div className="flex items-center gap-2.5 sm:gap-3.5 shrink-0">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-gradient-to-br from-[#1D4ED8] to-[#1E3A8A] border border-amber-400/60 flex items-center justify-center shadow-sm">
              <Crown className="w-4 h-4 sm:w-5 sm:h-5 text-amber-300" />
            </div>
            <div className="leading-none">
              <span className="font-display text-sm sm:text-base font-bold tracking-wide text-amber-300 whitespace-nowrap block">
                {GAME_BRAND_NAME}
              </span>
              <span className="text-[9px] text-sky-300/90 font-semibold hidden sm:block">
                {GAME_STATUS_BADGE}
              </span>
            </div>
          </div>

          <div className="h-5 w-px bg-slate-800 hidden sm:block" />

          <div className="flex items-center gap-2">
            {!avatarFailed ? (
              <img
                src="/src/assets/images/commander_avatar_1795464217803.jpg"
                alt={state.commanderName}
                referrerPolicy="no-referrer"
                onError={() => setAvatarFailed(true)}
                className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg object-cover border border-blue-500/50 shrink-0 hidden xs:block sm:block"
              />
            ) : (
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-blue-950 border border-blue-500/50 hidden sm:flex items-center justify-center text-xs font-bold text-amber-300 shrink-0">
                ق
              </div>
            )}
            <div className="leading-tight">
              <div className="text-[11px] sm:text-xs font-bold text-slate-100 whitespace-nowrap max-w-[110px] sm:max-w-none truncate">
                {state.commanderName}
              </div>
              <div className="text-[10px] sm:text-[11px] text-slate-400 font-num whitespace-nowrap">
                المبنى الرئيسي {mainLv} · {formatNumber(cityPoints)} نقطة
              </div>
            </div>
          </div>
        </div>

        {/* Zone 3: Header Store & Packages + Clock + Ledgers + Advisor + Settings */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 lg:order-3 overflow-x-auto no-scrollbar max-w-full">
          {/* Official Global UTC Clock */}
          <div
            className="hidden xl:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-900/85 border border-slate-800 text-[11px] text-slate-300 whitespace-nowrap"
            title="التوقيت الرسمي للعبة: التوقيت العالمي (UTC) — بداية اليوم الجديد 21:00 UTC"
          >
            <Clock className="w-3.5 h-3.5 text-sky-400" />
            <span className="font-num font-bold text-slate-200">{formatKsaTime(now)}</span>
            <span className="text-[10px] text-slate-500">UTC</span>
          </div>

          {/* Active Combat Buffs (+10% Atk / +10% Def) */}
          {(atkBuff || defBuff) && (
            <div className="hidden lg:flex items-center gap-1 px-2 py-1.5 rounded-lg bg-amber-950/40 border border-amber-500/40 text-[10px] font-bold text-amber-200 whitespace-nowrap">
              {atkBuff && (
                <span className="flex items-center gap-0.5 text-rose-300" title="تعزيز هجوم +10% فعّال">
                  <Swords className="w-3 h-3" />
                  <span>+10%</span>
                </span>
              )}
              {defBuff && (
                <span className="flex items-center gap-0.5 text-sky-300" title="تعزيز دفاع +10% فعّال">
                  <ShieldAlert className="w-3 h-3" />
                  <span>+10%</span>
                </span>
              )}
            </div>
          )}

          {/* Protection Shield */}
          {protectionRemainingSec > 0 && (
            <div
              className="hidden xl:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-blue-950/50 border border-blue-700/40 text-xs text-sky-200 whitespace-nowrap"
              title="درع حماية فعّال (يُبطل فور شن هجوم لاعب دون تعويض)"
            >
              <Shield className="w-3.5 h-3.5 text-sky-400" />
              <span className="text-[11px] text-sky-300">حماية</span>
              <span className="font-num">{formatDuration(protectionRemainingSec)}</span>
            </div>
          )}

          {/* Store Button + Gems Wallet in Header */}
          {onOpenStore && (
            <button
              type="button"
              onClick={onOpenStore}
              className={`min-h-[38px] sm:min-h-[40px] flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl border text-[11px] sm:text-xs font-bold whitespace-nowrap transition-colors shrink-0 ${
                activeSection === 'store'
                  ? 'bg-amber-500 border-amber-300 text-slate-950'
                  : 'bg-slate-900/95 hover:bg-slate-800 border-amber-500/50 text-amber-200'
              }`}
              title={`المتجر الرسمي والجواهر — رصيدك: ${formatNumber(totalGems)} جوهرة (10 جواهر = 1 ر.س)`}
            >
              <ShoppingBag
                className={`w-3.5 h-3.5 shrink-0 ${
                  activeSection === 'store' ? 'text-slate-950' : 'text-amber-400'
                }`}
              />
              <span>المتجر</span>
              <span
                className={`px-1.5 py-0.5 rounded-md font-num text-[10px] inline-flex items-center gap-1 ${
                  activeSection === 'store'
                    ? 'bg-slate-950/20 text-slate-950'
                    : 'bg-amber-500/15 text-amber-300'
                }`}
              >
                <Gem className="w-2.5 h-2.5" />
                {formatNumber(totalGems)}
              </span>
            </button>
          )}

          {/* Monthly Packages Button in Header */}
          {onOpenMonthly && (
            <button
              type="button"
              onClick={onOpenMonthly}
              className={`relative min-h-[38px] sm:min-h-[40px] flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl border text-[11px] sm:text-xs font-bold whitespace-nowrap transition-colors shrink-0 ${
                activeSection === 'monthly'
                  ? 'bg-[#1D4ED8] border-blue-400 text-white'
                  : 'bg-slate-900/95 hover:bg-slate-800 border-sky-500/45 text-sky-200'
              }`}
              title="الباقات الشهرية والمكافآت اليومية (30 يومًا)"
            >
              <Gift
                className={`w-3.5 h-3.5 shrink-0 ${
                  activeSection === 'monthly' ? 'text-amber-300' : 'text-sky-300'
                }`}
              />
              <span>الباقات</span>
              {canClaimDailyMonthly && (
                <span
                  className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0"
                  title="مكافأة اليوم جاهزة للاستلام"
                />
              )}
            </button>
          )}

          {/* Ledger 2: Trade Points (Strictly separated from Gems) */}
          <div
            className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-900/90 border border-emerald-600/35 text-xs whitespace-nowrap"
            title="رصيد نقاط التجارة (Trade Points) — دفتر منفصل تمامًا عن الجواهر"
          >
            <Coins className="w-3.5 h-3.5 text-emerald-400" />
            <span className="font-num text-emerald-300 font-bold">
              {formatNumber(state.ledger.tradeBalance)}
            </span>
            <span className="text-[10px] text-emerald-200/70">نقطة تجارة</span>
          </div>

          <button
            type="button"
            onClick={onOpenBotModal}
            className={`min-h-[38px] sm:min-h-[40px] flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-xl text-[11px] sm:text-xs font-bold border transition-colors whitespace-nowrap shrink-0 ${
              state.smartBotActive
                ? 'bg-amber-500/15 border-amber-400/60 text-amber-300 hover:bg-amber-500/25'
                : 'bg-slate-900 border-sky-500/45 text-sky-200 hover:border-sky-400'
            }`}
          >
            <img
              src={state.smartBotActive ? SMART_ADVISOR_PORTRAIT : FREE_ADVISOR_PORTRAIT}
              alt="المستشار"
              referrerPolicy="no-referrer"
              className="w-5 h-5 rounded object-cover border border-amber-300/60 shrink-0"
            />
            <span className="hidden xl:inline">
              {state.smartBotActive ? 'المستشار الذكي حكيم' : 'المستشار المجاني'}
            </span>
            <span className="xl:hidden">
              {state.smartBotActive ? 'حكيم' : 'المستشار'}
            </span>
          </button>

          <button
            type="button"
            onClick={onOpenSettings}
            className="min-w-[38px] min-h-[38px] sm:min-w-[40px] sm:min-h-[40px] flex items-center justify-center rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-amber-300 transition-colors shrink-0"
            aria-label="الإعدادات"
            title="الإعدادات وتيليغرام وبطاقات التسريع"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>

        {/* Zone 2: Resources & Uncapped Protected Warehouse */}
        <div className="w-full lg:w-auto lg:order-2 flex items-center gap-3 sm:gap-4 bg-slate-900/85 border border-slate-800/90 rounded-xl px-3 py-1.5 overflow-x-auto no-scrollbar">
          {/* Wheat */}
          <div className="flex items-center gap-1.5 shrink-0" title="القمح ومعدل الإنتاج بالساعة">
            <Wheat className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400 shrink-0" />
            <div className="leading-none">
              <div className="text-[11px] sm:text-xs font-bold font-num text-slate-100">
                {formatNumber(state.resources.wheat)}
              </div>
              <div className="text-[10px] font-num text-emerald-400">
                +{formatNumber(rates.wheat)}/س
              </div>
            </div>
          </div>

          <span className="text-slate-700 shrink-0">|</span>

          {/* Wood */}
          <div className="flex items-center gap-1.5 shrink-0" title="الخشب ومعدل الإنتاج بالساعة">
            <Trees className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-400 shrink-0" />
            <div className="leading-none">
              <div className="text-[11px] sm:text-xs font-bold font-num text-slate-100">
                {formatNumber(state.resources.wood)}
              </div>
              <div className="text-[10px] font-num text-emerald-400">
                +{formatNumber(rates.wood)}/س
              </div>
            </div>
          </div>

          <span className="text-slate-700 shrink-0">|</span>

          {/* Iron */}
          <div className="flex items-center gap-1.5 shrink-0" title="الحديد ومعدل الإنتاج بالساعة">
            <Pickaxe className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-sky-400 shrink-0" />
            <div className="leading-none">
              <div className="text-[11px] sm:text-xs font-bold font-num text-slate-100">
                {formatNumber(state.resources.iron)}
              </div>
              <div className="text-[10px] font-num text-emerald-400">
                +{formatNumber(rates.iron)}/س
              </div>
            </div>
          </div>

          <span className="text-slate-700 shrink-0">|</span>

          {/* Central Warehouse Protection Capacity (Never stops production) */}
          <div
            className="flex items-center gap-2 shrink-0"
            title={
              excessTotal > 0
                ? `السعة المحمية: ${formatNumber(warehouseCap)} | فائض مكشوف: ${formatNumber(excessTotal)} (قد يُنهب منه حتى 50% = ${formatNumber(maxLootablePerAttack)}). الإنتاج مستمر بلا توقف.`
                : `المخزن يحمي حتى ${formatNumber(warehouseCap)} وحدة من النهب والإنتاج لا يتوقف.`
            }
          >
            <Warehouse className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-300 shrink-0" />
            <div className="w-24 sm:w-32">
              <div className="flex justify-between text-[10px] font-num leading-none mb-1">
                <span className={excessTotal > 0 ? 'text-amber-300 font-bold' : 'text-slate-300'}>
                  {formatNumber(storedTotal)}
                </span>
                <span className="text-slate-400">
                  حماية {formatNumber(warehouseCap)}
                </span>
              </div>
              <div className="w-full h-1.5 rounded bg-slate-800 overflow-hidden">
                <div
                  className={`h-full transition-all ${
                    excessTotal > 0 ? 'bg-amber-400' : 'bg-blue-500'
                  }`}
                  style={{ width: `${storagePct}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
