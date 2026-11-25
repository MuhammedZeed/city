import React, { useState } from "react";
import {
  Eye,
  Image as ImageIcon,
  LifeBuoy,
  MessageSquarePlus,
  Send,
  Upload,
  X,
} from "lucide-react";
import {
  PanelHeader,
  TICKET_STATUS_LABELS,
  formatKsaDateTime,
  GameState,
  TicketAttachment,
} from "@enginora/shared";

async function readTicketImages(
  files: FileList | null
): Promise<{ attachments: TicketAttachment[]; error?: string }> {
  if (!files || files.length === 0) return { attachments: [] };
  const allowed = ['image/png', 'image/jpeg', 'image/webp'];
  const list = Array.from(files).slice(0, 4);
  const results: TicketAttachment[] = [];

  for (const file of list) {
    if (!allowed.includes(file.type)) {
      return {
        attachments: [],
        error: `الملف "${file.name}" غير مدعوم — يُسمح فقط بـ PNG و JPG و WEBP.`,
      };
    }
    if (file.size > 2 * 1024 * 1024) {
      return {
        attachments: [],
        error: `حجم الصورة "${file.name}" يتجاوز الحد الأقصى المسموح (2MB).`,
      };
    }
    const dataUrl = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ''));
      reader.readAsDataURL(file);
    });
    results.push({
      id: `att-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      fileName: file.name,
      mimeType: file.type,
      sizeBytes: file.size,
      dataUrl,
    });
  }
  return { attachments: results };
}

/* -------------------------------------------------------------------------- */
/*  Support Tickets View (§55-§60)                                            */
/* -------------------------------------------------------------------------- */

export const SupportView: React.FC<{
  state: GameState;
  onCreateTicket: (
    subject: string,
    category: string,
    text: string,
    attachments: TicketAttachment[]
  ) => void;
  onReplyTicket: (
    ticketId: string,
    text: string,
    attachments: TicketAttachment[]
  ) => void;
  onMarkTicketRead: (ticketId: string) => void;
}> = ({ state, onCreateTicket, onReplyTicket, onMarkTicketRead }) => {
  const [selectedId, setSelectedId] = useState<string>(
    state.supportTickets[0]?.id ?? ''
  );
  const [showNewForm, setShowNewForm] = useState(state.supportTickets.length === 0);
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState('المدفوعات والشحن');
  const [body, setBody] = useState('');
  const [newAttachments, setNewAttachments] = useState<TicketAttachment[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [replyAttachments, setReplyAttachments] = useState<TicketAttachment[]>([]);
  const [previewImg, setPreviewImg] = useState<string | null>(null);

  const selectedTicket =
    state.supportTickets.find((t) => t.id === selectedId) ??
    state.supportTickets[0];

  const handleSelectTicket = (id: string) => {
    setSelectedId(id);
    setShowNewForm(false);
    onMarkTicketRead(id);
  };

  const handleNewSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onCreateTicket(subject, category, body, newAttachments);
    setSubject('');
    setBody('');
    setNewAttachments([]);
    setShowNewForm(false);
  };

  const handleReplySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket) return;
    onReplyTicket(selectedTicket.id, replyText, replyAttachments);
    setReplyText('');
    setReplyAttachments([]);
  };

  return (
    <div className="h-full overflow-y-auto p-3.5 sm:p-6 bg-[#070D1B] bg-[radial-gradient(ellipse_at_top_right,rgba(56,189,248,0.12),transparent_48%),radial-gradient(ellipse_at_bottom_left,rgba(29,78,216,0.12),transparent_45%)]">
      <div className="max-w-6xl mx-auto space-y-5 pb-8">
        <PanelHeader
          icon={LifeBuoy}
          title="الدعم الفني والتذاكر"
          subtitle={`معرّف حسابك: ${state.accountId} — ارفع تذكرة جديدة مع صور توضيحية وتابع حالة الرد مباشرة.`}
          rightSlot={
            <button
              type="button"
              onClick={() => setShowNewForm((v) => !v)}
              className="min-h-[42px] px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold flex items-center gap-1.5"
            >
              <MessageSquarePlus className="w-4 h-4" />
              <span>{showNewForm ? 'عرض التذاكر الحالية' : 'فتح تذكرة دعم جديدة'}</span>
            </button>
          }
        />

        {showNewForm && (
          <form
            onSubmit={handleNewSubmit}
            className="glass-panel p-5 rounded-2xl space-y-3.5 text-xs"
          >
            <h3 className="text-sm font-bold text-amber-300">إنشاء تذكرة دعم فني جديدة</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-300 mb-1.5">عنوان التذكرة</label>
                <input
                  type="text"
                  required
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="مثال: استفسار عن إيصال شحن أو مشكلة في السوق"
                  className="w-full min-h-[42px] px-3 py-2 rounded-xl bg-slate-950/85 border border-slate-700 text-slate-100"
                />
              </div>
              <div>
                <label className="block text-slate-300 mb-1.5">التصنيف</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full min-h-[42px] px-3 py-2 rounded-xl bg-slate-950/85 border border-slate-700 text-slate-100"
                >
                  <option value="المدفوعات والشحن">المدفوعات والشحن</option>
                  <option value="سوق التجارة">سوق التجارة</option>
                  <option value="البناء والمهام">البناء والمهام</option>
                  <option value="ربط تيليغرام والحساب">ربط تيليغرام والحساب</option>
                  <option value="أخرى">أخرى</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-slate-300 mb-1.5">تفاصيل المشكلة أو الطلب</label>
              <textarea
                rows={4}
                required
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="اشرح التفاصيل بوضوح ليتمكن فريق الدعم من مساعدتك سريعًا..."
                className="w-full px-3 py-2.5 rounded-xl bg-slate-950/85 border border-slate-700 text-slate-100 leading-relaxed"
              />
            </div>

            <div className="space-y-2">
              <label className="inline-flex items-center gap-2 min-h-[40px] px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-sky-200 cursor-pointer font-semibold">
                <Upload className="w-4 h-4 text-sky-300" />
                <span>إرفاق صور (PNG / JPG / WEBP حتى 2MB للصورة)</span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  multiple
                  onChange={async (e) => {
                    const res = await readTicketImages(e.target.files);
                    if (res.error) setUploadError(res.error);
                    else {
                      setUploadError(null);
                      setNewAttachments((prev) => [...prev, ...res.attachments].slice(0, 4));
                    }
                  }}
                  className="hidden"
                />
              </label>
              {uploadError && <div className="text-rose-400">{uploadError}</div>}
              {newAttachments.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {newAttachments.map((att) => (
                    <div
                      key={att.id}
                      className="relative w-16 h-16 rounded-xl overflow-hidden border border-slate-700"
                    >
                      <img
                        src={att.dataUrl}
                        alt={att.fileName}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button
              type="submit"
              className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#1D4ED8] hover:bg-blue-600 text-white font-bold flex items-center gap-2"
            >
              <Send className="w-4 h-4" />
              <span>إرسال التذكرة</span>
            </button>
          </form>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 text-xs">
          {/* Ticket List */}
          <div className="glass-panel rounded-2xl overflow-hidden divide-y divide-slate-800/70 h-fit">
            <div className="px-4 py-3 border-b border-slate-700/45 font-bold text-slate-100">
              تذاكرك ({state.supportTickets.length})
            </div>
            {state.supportTickets.length === 0 ? (
              <div className="p-6 text-center text-slate-400">
                لا توجد تذاكر حتى الآن.
              </div>
            ) : (
              state.supportTickets.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => handleSelectTicket(t.id)}
                  className={`w-full p-3.5 text-right transition-colors space-y-1.5 ${
                    selectedTicket?.id === t.id
                      ? 'bg-blue-950/45'
                      : 'hover:bg-slate-800/40'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-num font-bold text-amber-300">{t.id}</span>
                    <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-[10px] text-sky-300 font-bold">
                      {TICKET_STATUS_LABELS[t.status]}
                    </span>
                  </div>
                  <div className="font-bold text-slate-100 truncate">{t.subject}</div>
                  <div className="text-[11px] text-slate-400 flex items-center justify-between">
                    <span>{t.category}</span>
                    {t.unreadByPlayer && (
                      <span className="text-amber-300 font-bold">رد جديد</span>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>

          {/* Conversation Thread */}
          <div className="lg:col-span-2 glass-panel p-4 sm:p-5 rounded-2xl space-y-4">
            {!selectedTicket ? (
              <div className="py-10 text-center text-slate-400">
                اختر تذكرة من القائمة لعرض المحادثة.
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-700/50">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-num font-bold text-amber-300">
                        {selectedTicket.id}
                      </span>
                      <h3 className="text-sm font-bold text-slate-100">
                        {selectedTicket.subject}
                      </h3>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5 font-num">
                      {selectedTicket.category} · آخر تحديث: {formatKsaDateTime(selectedTicket.updatedAt)}
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-lg bg-sky-500/15 border border-sky-400/45 text-sky-200 font-bold">
                    {TICKET_STATUS_LABELS[selectedTicket.status]}
                  </span>
                </div>

                <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
                  {selectedTicket.messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`p-3.5 rounded-xl border space-y-2 ${
                        msg.senderRole === 'support'
                          ? 'bg-blue-950/35 border-sky-500/40'
                          : 'bg-slate-900/90 border-slate-700/60'
                      }`}
                    >
                      <div className="flex items-center justify-between text-[11px]">
                        <span
                          className={`font-bold ${
                            msg.senderRole === 'support' ? 'text-sky-300' : 'text-amber-300'
                          }`}
                        >
                          {msg.senderName}
                        </span>
                        <span className="font-num text-slate-400">
                          {formatKsaDateTime(msg.createdAt)}
                        </span>
                      </div>
                      {msg.text && (
                        <p className="text-slate-100 leading-relaxed whitespace-pre-wrap">
                          {msg.text}
                        </p>
                      )}
                      {msg.attachments.length > 0 && (
                        <div className="flex flex-wrap gap-2 pt-1">
                          {msg.attachments.map((att) => (
                            <button
                              key={att.id}
                              type="button"
                              onClick={() => setPreviewImg(att.dataUrl)}
                              className="group relative w-20 h-20 rounded-xl overflow-hidden border border-slate-600 hover:border-amber-400"
                            >
                              <img
                                src={att.dataUrl}
                                alt={att.fileName}
                                className="w-full h-full object-cover"
                              />
                              <span className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center">
                                <Eye className="w-4 h-4 text-white" />
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {selectedTicket.status !== 'closed' && (
                  <form
                    onSubmit={handleReplySubmit}
                    className="pt-3 border-t border-slate-700/50 space-y-2.5"
                  >
                    <textarea
                      rows={2}
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder="اكتب ردك هنا..."
                      className="w-full px-3 py-2 rounded-xl bg-slate-950/85 border border-slate-700 text-slate-100"
                    />
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <label className="min-h-[38px] px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-sky-200 flex items-center gap-1.5 cursor-pointer">
                        <ImageIcon className="w-4 h-4" />
                        <span>إرفاق صورة ({replyAttachments.length})</span>
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          multiple
                          onChange={async (e) => {
                            const res = await readTicketImages(e.target.files);
                            if (res.error) setUploadError(res.error);
                            else {
                              setUploadError(null);
                              setReplyAttachments(res.attachments);
                            }
                          }}
                          className="hidden"
                        />
                      </label>
                      <button
                        type="submit"
                        className="min-h-[40px] px-4 py-2 rounded-xl bg-[#1D4ED8] hover:bg-blue-600 text-white font-bold flex items-center gap-1.5"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>إرسال الرد</span>
                      </button>
                    </div>
                  </form>
                )}
              </>
            )}
          </div>
        </div>

        {/* Lightbox preview for attached screenshots */}
        {previewImg && (
          <div
            onClick={() => setPreviewImg(null)}
            className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4"
          >
            <div className="relative max-w-3xl max-h-[85dvh]">
              <button
                type="button"
                onClick={() => setPreviewImg(null)}
                className="absolute -top-3 -left-3 w-9 h-9 rounded-full bg-slate-900 border border-slate-600 text-white flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
              <img
                src={previewImg}
                alt="مرفق التذكرة"
                className="max-h-[82dvh] rounded-xl border border-slate-700"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
