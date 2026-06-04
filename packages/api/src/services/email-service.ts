export interface EmailService {
  sendOtp(email: string, code: string): Promise<void>;
}

export function createEmailService(
  _emailFrom: string
): EmailService {
  const sendOtp = async (email: string, code: string): Promise<void> => {
    try {
      // Use Cloudflare Email Workers to send OTP email
      // In local dev, just log it
      console.log(`[EMAIL] To: ${email}, OTP: ${code}`);
    } catch (err) {
      console.error("Failed to send OTP email:", err);
      throw new Error("EMAIL_SEND_FAILED");
    }
  };

  return { sendOtp };
}
