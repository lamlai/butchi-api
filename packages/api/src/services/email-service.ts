export interface EmailService {
  sendOtp(email: string, code: string): Promise<void>;
  sendProofNotification(adminEmail: string, details: {
    userEmail: string;
    topupId: string;
    amountCents: number;
  }): Promise<void>;
}

const EMAILIT_URL = "https://api.emailit.com/v2/emails";

export function createEmailService(
  emailFrom: string,
  emailitApiKey?: string
): EmailService {
  const sendOtp = async (email: string, code: string): Promise<void> => {
    // Fallback: log to console in dev if no API key
    if (!emailitApiKey) {
      console.log(`[EMAIL] To: ${email}, OTP: ${code}`);
      return;
    }

    const res = await fetch(EMAILIT_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${emailitApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `BUTCHI.AI <${emailFrom}>`,
        to: [email],
        subject: "Your Butchi verification code",
        html: `<p>Your verification code is: <strong>${code}</strong></p><p>This code expires in 5 minutes.</p>`,
        tracking: { loads: false, clicks: false },
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "unknown");
      console.error("Emailit send error:", res.status, body);
      throw new Error("EMAIL_SEND_FAILED");
    }
  };

  const sendProofNotification = async (
    adminEmail: string,
    details: { userEmail: string; topupId: string; amountCents: number }
  ): Promise<void> => {
    if (!emailitApiKey) {
      console.log(`[EMAIL] Proof notification to: ${adminEmail}, from user: ${details.userEmail}, topup: ${details.topupId}`);
      return;
    }

    const amountUsd = (details.amountCents / 100).toFixed(2);

    const res = await fetch(EMAILIT_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${emailitApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `BUTCHI.AI <${emailFrom}>`,
        to: [adminEmail],
        subject: "New payment proof uploaded — Butchi",
        html: `<p><strong>${details.userEmail}</strong> uploaded payment proof for a topup of <strong>$${amountUsd}</strong>.</p><p>Review it in the <a href="/dashboard/admin/transactions">Admin Transactions</a> page.</p>`,
        tracking: { loads: false, clicks: false },
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "unknown");
      console.error("Emailit proof notification error:", res.status, body);
    }
  };

  return { sendOtp, sendProofNotification };
}
