export interface EmailEnv {
  RESEND_API_KEY?: string;
  EMAIL_FROM?: string;
}

export type EmailPurpose = 'verify_email' | 'reset_password';

export interface SendEmailResult {
  sent: boolean;
  configured: boolean;
  status: number;
  messageId?: string;
  error?: string;
}

export async function sendOtpEmail(
  env: EmailEnv,
  params: {
    to: string;
    purpose: EmailPurpose;
    code: string;
    commanderName?: string;
  }
): Promise<SendEmailResult> {
  const apiKey = env.RESEND_API_KEY?.trim();
  const from = env.EMAIL_FROM?.trim();

  if (!apiKey || !from) {
    return {
      sent: false,
      configured: false,
      status: 503,
      error:
        'خدمة إرسال البريد الإلكتروني غير مفعلة حاليًا على الخادم (مطلوب إضافة RESEND_API_KEY وEMAIL_FROM في Cloudflare Secrets).',
    };
  }

  const displayName = params.commanderName?.trim() || 'القائد';
  const isVerify = params.purpose === 'verify_email';

  const subject = isVerify
    ? 'ENGINORA CITY — كود تأكيد البريد الإلكتروني'
    : 'ENGINORA CITY — كود استعادة كلمة المرور';

  const title = isVerify
    ? 'تأكيد البريد الإلكتروني لحسابك في ENGINORA CITY'
    : 'طلب استعادة كلمة المرور في ENGINORA CITY';

  const intro = isVerify
    ? `مرحبًا ${displayName}، استخدم الكود التالي لتأكيد بريدك الإلكتروني وتفعيل الدخول:`
    : `مرحبًا ${displayName}، استخدم الكود التالي لتعيين كلمة مرور جديدة لحسابك:`;

  const html = `
    <div dir="rtl" style="font-family: Tahoma, Arial, sans-serif; background:#0b1325; color:#f1f5f9; padding:24px; border-radius:12px;">
      <h2 style="color:#fbbf24; margin-top:0;">${title}</h2>
      <p style="font-size:14px; line-height:1.7;">${intro}</p>
      <div style="font-size:28px; font-weight:bold; letter-spacing:6px; color:#38bdf8; background:#020617; padding:14px 20px; border-radius:10px; display:inline-block; margin:12px 0;">
        ${params.code}
      </div>
      <p style="font-size:13px; color:#cbd5e1;">صلاحية الكود <strong>15 دقيقة</strong> ويُستخدم لمرة واحدة فقط.</p>
      <p style="font-size:12px; color:#94a3b8;">إذا لم تطلب هذا الإجراء، يرجى تجاهل هذه الرسالة.</p>
    </div>
  `.trim();

  const text = `${title}\n\n${intro}\n\nالكود: ${params.code}\nصلاحية الكود 15 دقيقة ويُستخدم لمرة واحدة فقط.\n`;

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [params.to],
        subject,
        html,
        text,
      }),
    });

    if (!response.ok) {
      let providerHint = '';
      try {
        const errBody = (await response.json()) as { message?: string; name?: string };
        if (errBody?.message) {
          providerHint = ` (${errBody.message})`;
        }
      } catch {
        // ignore non-JSON body
      }

      return {
        sent: false,
        configured: true,
        status: response.status === 429 ? 429 : 502,
        error:
          response.status === 429
            ? 'تم تجاوز الحد المسموح لإرسال الرسائل مؤقتًا. يرجى المحاولة لاحقًا.'
            : `تعذر إرسال البريد عبر Resend${providerHint}. تأكد من صحة المفتاح وتوثيق نطاق الإرسال.`,
      };
    }

    const data = (await response.json()) as { id?: string };
    return {
      sent: true,
      configured: true,
      status: 200,
      messageId: data?.id,
    };
  } catch {
    return {
      sent: false,
      configured: true,
      status: 502,
      error: 'تعذر الاتصال بخدمة إرسال البريد الإلكتروني حاليًا.',
    };
  }
}
