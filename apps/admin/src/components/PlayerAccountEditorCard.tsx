import React, { useEffect, useState } from "react";
import {
  AdminConfig,
  AdminPlayerRecord,
  PlayerRegistrationStatus,
  SPEEDUP_CARDS_META,
  SpeedUpTierId,
  formatDecimal,
  formatKsaDateTime,
} from "@enginora/shared";
import {
  Gem,
  PackageCheck,
  Save,
  Shield,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";
import {
  AdminPlayerAccountPatch,
  AdminShieldAction,
  AdminSubAction,
} from "../engine/adminEngine";

const SPEEDUP_TIERS: SpeedUpTierId[] = ["1m", "5m", "30m", "1h", "24h", "3d", "7d"];

function buildInitialDraft(player: AdminPlayerRecord): AdminPlayerAccountPatch {
  const st = player.state;
  return {
    commanderName: st.commanderName || player.commanderName,
    cityName: st.cityName || "مدينة إنجينورا",
    selectedServerId: st.selectedServerId || player.selectedServerId || "srv-1",
    registrationStatus: st.registration?.status ?? player.registrationStatus ?? "unregistered",
    chargedGems: st.gemLedger?.chargedGems ?? 0,
    bonusGems: st.gemLedger?.bonusGems ?? 0,
    marketGems: st.gemLedger?.marketGems ?? 0,
    tradeBalance: st.ledger?.tradeBalance ?? 0,
    achievementPoints: st.ledger?.achievementPoints ?? 0,
    wheat: st.resources?.wheat ?? 0,
    wood: st.resources?.wood ?? 0,
    iron: st.resources?.iron ?? 0,
    crudeOilStock: st.maritime?.crudeOilStock ?? 0,
    naturalGasStock: st.maritime?.naturalGasStock ?? 0,
    hakimAction: "keep",
    vipAction: "keep",
    shieldAction: "keep",
    speedUpCards: {
      "1m": st.speedUpCards?.["1m"] ?? 0,
      "5m": st.speedUpCards?.["5m"] ?? 0,
      "30m": st.speedUpCards?.["30m"] ?? 0,
      "1h": st.speedUpCards?.["1h"] ?? 0,
      "24h": st.speedUpCards?.["24h"] ?? 0,
      "3d": st.speedUpCards?.["3d"] ?? 0,
      "7d": st.speedUpCards?.["7d"] ?? 0,
    },
  };
}

export const PlayerAccountEditorCard: React.FC<{
  player: AdminPlayerRecord;
  adminConfig: AdminConfig;
  now: number;
  busyAction?: boolean;
  onUpdatePlayerAccount: (
    accountId: string,
    patch: AdminPlayerAccountPatch
  ) => Promise<boolean>;
}> = ({ player, adminConfig, now, busyAction = false, onUpdatePlayerAccount }) => {
  const [draft, setDraft] = useState<AdminPlayerAccountPatch>(() =>
    buildInitialDraft(player)
  );
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ text: string; isError?: boolean } | null>(
    null
  );

  useEffect(() => {
    setDraft(buildInitialDraft(player));
    setFeedback(null);
  }, [player.accountId, player.revision]);

  const hakimActive =
    Boolean(player.state.hakimSubscription?.active) &&
    typeof player.state.hakimSubscription?.expiresAt === "number" &&
    player.state.hakimSubscription.expiresAt > now;
  const vipActive =
    Boolean(player.state.vipSubscription?.active) &&
    typeof player.state.vipSubscription?.expiresAt === "number" &&
    player.state.vipSubscription.expiresAt > now;
  const shieldActive =
    typeof player.state.shieldEndsAt === "number" && player.state.shieldEndsAt > now;

  const projectedGems = Number(
    (
      Math.max(0, Number(draft.chargedGems) || 0) +
      Math.max(0, Number(draft.bonusGems) || 0) +
      Math.max(0, Number(draft.marketGems) || 0)
    ).toFixed(2)
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    setSaving(true);
    const ok = await onUpdatePlayerAccount(player.accountId, draft);
    setSaving(false);
    if (ok) {
      setFeedback({
        text: `تم حفظ تعديلات حساب ${draft.commanderName || player.commanderName} في Cloudflare D1 بنجاح.`,
      });
    } else {
      setFeedback({
        text: "تعذر حفظ تعديلات اللاعب. يرجى المحاولة مرة أخرى.",
        isError: true,
      });
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="glass-panel p-4 sm:p-5 rounded-2xl border-emerald-500/40 space-y-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-800">
        <div>
          <h4 className="font-bold text-sm text-emerald-300 flex items-center gap-1.5">
            <SlidersHorizontal className="w-4 h-4" />
            <span>لوحة التحكم الكاملة بحساب اللاعب (تعديل مباشر في D1)</span>
          </h4>
          <p className="text-[11px] text-slate-400 mt-0.5">
            عدّل الجواهر، الموارد، السيرفر، حالة الحساب، الاشتراكات، أو بطاقات التسريع مباشرة؛ مع بقاء التفعيل التلقائي عبر صفحة الاعتمادات فعالًا كما هو.
          </p>
        </div>
        <span className="text-[10px] px-2.5 py-1 rounded-lg bg-emerald-950/60 border border-emerald-500/35 text-emerald-300 font-semibold">
          حصري للمؤسس
        </span>
      </div>

      {/* 1. Identity, Server, Status */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 text-[11px]">
        <label className="space-y-1">
          <span className="text-slate-300 font-semibold block">اسم القائد</span>
          <input
            type="text"
            value={draft.commanderName}
            onChange={(e) => setDraft((d) => ({ ...d, commanderName: e.target.value }))}
            className="w-full min-h-[38px] px-3 py-1.5 rounded-xl bg-slate-950/90 border border-slate-700 text-slate-100"
          />
        </label>
        <label className="space-y-1">
          <span className="text-slate-300 font-semibold block">اسم المدينة</span>
          <input
            type="text"
            value={draft.cityName}
            onChange={(e) => setDraft((d) => ({ ...d, cityName: e.target.value }))}
            className="w-full min-h-[38px] px-3 py-1.5 rounded-xl bg-slate-950/90 border border-slate-700 text-slate-100"
          />
        </label>
        <label className="space-y-1">
          <span className="text-slate-300 font-semibold block">السيرفر</span>
          <select
            value={draft.selectedServerId}
            onChange={(e) => setDraft((d) => ({ ...d, selectedServerId: e.target.value }))}
            className="w-full min-h-[38px] px-3 py-1.5 rounded-xl bg-slate-950/90 border border-slate-700 text-sky-300 font-bold"
          >
            {adminConfig.servers.map((srv) => (
              <option key={srv.id} value={srv.id}>
                {srv.code} — {srv.name}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <span className="text-slate-300 font-semibold block">حالة الحساب</span>
          <select
            value={draft.registrationStatus}
            onChange={(e) =>
              setDraft((d) => ({
                ...d,
                registrationStatus: e.target.value as PlayerRegistrationStatus,
              }))
            }
            className="w-full min-h-[38px] px-3 py-1.5 rounded-xl bg-slate-950/90 border border-slate-700 text-amber-300 font-bold"
          >
            <option value="unregistered">غير مكتمل</option>
            <option value="pending">قيد المراجعة</option>
            <option value="approved">معتمد</option>
            <option value="rejected">مرفوض</option>
          </select>
        </label>
      </div>

      {/* 2. Gems & Points */}
      <div className="glass-subpanel p-3 rounded-xl space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
            <Gem className="w-4 h-4" />
            <span>دفتر الجواهر ونقاط التجارة والإنجاز</span>
          </div>
          <span className="text-[11px] font-num text-amber-200">
            إجمالي الجواهر بعد التعديل: {formatDecimal(projectedGems)}
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 text-[11px] font-num">
          <label className="space-y-1">
            <span className="text-slate-400 block">جواهر مشحونة</span>
            <input
              type="number"
              min={0}
              step="0.01"
              value={draft.chargedGems}
              onChange={(e) =>
                setDraft((d) => ({ ...d, chargedGems: Number(e.target.value) || 0 }))
              }
              className="w-full min-h-[38px] px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-amber-300 font-bold"
            />
          </label>
          <label className="space-y-1">
            <span className="text-slate-400 block">جواهر هدية (Bonus)</span>
            <input
              type="number"
              min={0}
              step="0.01"
              value={draft.bonusGems}
              onChange={(e) =>
                setDraft((d) => ({ ...d, bonusGems: Number(e.target.value) || 0 }))
              }
              className="w-full min-h-[38px] px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-sky-300 font-bold"
            />
          </label>
          <label className="space-y-1">
            <span className="text-slate-400 block">جواهر السوق</span>
            <input
              type="number"
              min={0}
              step="0.01"
              value={draft.marketGems}
              onChange={(e) =>
                setDraft((d) => ({ ...d, marketGems: Number(e.target.value) || 0 }))
              }
              className="w-full min-h-[38px] px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-emerald-300 font-bold"
            />
          </label>
          <label className="space-y-1">
            <span className="text-slate-400 block">نقاط التجارة</span>
            <input
              type="number"
              min={0}
              step="0.01"
              value={draft.tradeBalance}
              onChange={(e) =>
                setDraft((d) => ({ ...d, tradeBalance: Number(e.target.value) || 0 }))
              }
              className="w-full min-h-[38px] px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-purple-300 font-bold"
            />
          </label>
          <label className="space-y-1">
            <span className="text-slate-400 block">نقاط الإنجاز</span>
            <input
              type="number"
              min={0}
              step="1"
              value={draft.achievementPoints}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  achievementPoints: Math.max(0, Math.floor(Number(e.target.value) || 0)),
                }))
              }
              className="w-full min-h-[38px] px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-slate-100 font-bold"
            />
          </label>
        </div>
      </div>

      {/* 3. Resources & Maritime Energy */}
      <div className="glass-subpanel p-3 rounded-xl space-y-2.5">
        <div className="text-xs font-bold text-sky-300 flex items-center gap-1.5">
          <PackageCheck className="w-4 h-4" />
          <span>مخزون المدينة ومخزون الطاقة البحرية</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 text-[11px] font-num">
          <label className="space-y-1">
            <span className="text-slate-400 block">القمح</span>
            <input
              type="number"
              min={0}
              step="1"
              value={draft.wheat}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  wheat: Math.max(0, Math.floor(Number(e.target.value) || 0)),
                }))
              }
              className="w-full min-h-[38px] px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-amber-200 font-bold"
            />
          </label>
          <label className="space-y-1">
            <span className="text-slate-400 block">الخشب</span>
            <input
              type="number"
              min={0}
              step="1"
              value={draft.wood}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  wood: Math.max(0, Math.floor(Number(e.target.value) || 0)),
                }))
              }
              className="w-full min-h-[38px] px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-emerald-200 font-bold"
            />
          </label>
          <label className="space-y-1">
            <span className="text-slate-400 block">الحديد</span>
            <input
              type="number"
              min={0}
              step="1"
              value={draft.iron}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  iron: Math.max(0, Math.floor(Number(e.target.value) || 0)),
                }))
              }
              className="w-full min-h-[38px] px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-sky-200 font-bold"
            />
          </label>
          <label className="space-y-1">
            <span className="text-slate-400 block">النفط الخام</span>
            <input
              type="number"
              min={0}
              step="1"
              value={draft.crudeOilStock}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  crudeOilStock: Math.max(0, Math.floor(Number(e.target.value) || 0)),
                }))
              }
              className="w-full min-h-[38px] px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-orange-200 font-bold"
            />
          </label>
          <label className="space-y-1">
            <span className="text-slate-400 block">الغاز الطبيعي</span>
            <input
              type="number"
              min={0}
              step="1"
              value={draft.naturalGasStock}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  naturalGasStock: Math.max(0, Math.floor(Number(e.target.value) || 0)),
                }))
              }
              className="w-full min-h-[38px] px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-cyan-200 font-bold"
            />
          </label>
        </div>
      </div>

      {/* 4. Subscriptions & Shield */}
      <div className="glass-subpanel p-3 rounded-xl space-y-2.5">
        <div className="text-xs font-bold text-purple-300 flex items-center gap-1.5">
          <Sparkles className="w-4 h-4" />
          <span>الاشتراكات والدرع الدفاعي</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-[11px]">
          <div className="space-y-1">
            <span className="text-slate-300 font-semibold block">
              المستشار الذكي (حكيم)
            </span>
            <div className="text-[10px] font-num text-slate-400">
              {hakimActive && player.state.hakimSubscription?.expiresAt
                ? `مفعّل حتى ${formatKsaDateTime(player.state.hakimSubscription.expiresAt)}`
                : "غير مفعّل حاليًا"}
            </div>
            <select
              value={draft.hakimAction}
              onChange={(e) =>
                setDraft((d) => ({ ...d, hakimAction: e.target.value as AdminSubAction }))
              }
              className="w-full min-h-[38px] px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-slate-100"
            >
              <option value="keep">الإبقاء على الوضع الحالي</option>
              <option value="add_30d">تفعيل / تمديد +30 يومًا</option>
              <option value="add_90d">تفعيل / تمديد +90 يومًا</option>
              <option value="disable">إيقاف الاشتراك فورًا</option>
            </select>
          </div>

          <div className="space-y-1">
            <span className="text-slate-300 font-semibold block">اشتراك VIP الشهري</span>
            <div className="text-[10px] font-num text-slate-400">
              {vipActive && player.state.vipSubscription?.expiresAt
                ? `مفعّل حتى ${formatKsaDateTime(player.state.vipSubscription.expiresAt)}`
                : "غير مفعّل حاليًا"}
            </div>
            <select
              value={draft.vipAction}
              onChange={(e) =>
                setDraft((d) => ({ ...d, vipAction: e.target.value as AdminSubAction }))
              }
              className="w-full min-h-[38px] px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-slate-100"
            >
              <option value="keep">الإبقاء على الوضع الحالي</option>
              <option value="add_30d">تفعيل / تمديد +30 يومًا</option>
              <option value="add_90d">تفعيل / تمديد +90 يومًا</option>
              <option value="disable">إيقاف الاشتراك فورًا</option>
            </select>
          </div>

          <div className="space-y-1">
            <span className="text-slate-300 font-semibold flex items-center gap-1">
              <Shield className="w-3.5 h-3.5 text-sky-400" />
              <span>درع الحماية</span>
            </span>
            <div className="text-[10px] font-num text-slate-400">
              {shieldActive && player.state.shieldEndsAt
                ? `مفعّل حتى ${formatKsaDateTime(player.state.shieldEndsAt)}`
                : "لا يوجد درع نشط"}
            </div>
            <select
              value={draft.shieldAction}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  shieldAction: e.target.value as AdminShieldAction,
                }))
              }
              className="w-full min-h-[38px] px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-slate-100"
            >
              <option value="keep">الإبقاء على الوضع الحالي</option>
              <option value="add_24h">منح / تمديد +24 ساعة</option>
              <option value="add_3d">منح / تمديد +3 أيام</option>
              <option value="add_7d">منح / تمديد +7 أيام</option>
              <option value="add_30d">منح / تمديد +30 يومًا</option>
              <option value="clear">إزالة الدرع</option>
            </select>
          </div>
        </div>
      </div>

      {/* 5. Speed-up Cards */}
      <div className="glass-subpanel p-3 rounded-xl space-y-2.5">
        <div className="text-xs font-bold text-slate-200">
          بطاقات التسريع المملوكة للاعب (7 فئات)
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 text-[11px] font-num">
          {SPEEDUP_TIERS.map((tier) => (
            <label key={tier} className="space-y-1">
              <span className="text-slate-400 block truncate">
                {SPEEDUP_CARDS_META[tier].name}
              </span>
              <input
                type="number"
                min={0}
                step="1"
                value={draft.speedUpCards[tier]}
                onChange={(e) => {
                  const val = Math.max(0, Math.floor(Number(e.target.value) || 0));
                  setDraft((d) => ({
                    ...d,
                    speedUpCards: { ...d.speedUpCards, [tier]: val },
                  }));
                }}
                className="w-full min-h-[36px] px-2 py-1 rounded-lg bg-slate-950 border border-slate-700 text-amber-200 font-bold text-center"
              />
            </label>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        <button
          type="submit"
          disabled={saving || busyAction}
          className="min-h-[42px] px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-colors"
        >
          <Save className="w-4 h-4" />
          <span>
            {saving || busyAction
              ? "جارٍ الحفظ في D1..."
              : "حفظ جميع تعديلات حساب اللاعب في D1"}
          </span>
        </button>
      </div>

      {feedback && (
        <div
          className={`p-2.5 rounded-xl text-[11px] font-semibold border ${
            feedback.isError
              ? "bg-rose-950/60 border-rose-500/45 text-rose-200"
              : "bg-emerald-950/60 border-emerald-500/45 text-emerald-200"
          }`}
        >
          {feedback.text}
        </div>
      )}
    </form>
  );
};
