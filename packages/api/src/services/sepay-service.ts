export interface SepayConfig {
  bankCode: string;
  accountNumber: string;
  accountName: string;
  webhookSecret: string;
}

export interface SepayService {
  createQRPayment(amountVnd: number): Promise<{ qrUrl: string; transactionId: string }>;
  verifyWebhookSignature(payload: string, signature: string): boolean;
}

export function createSepayService(config: SepayConfig): SepayService {
  const createQRPayment = async (
    amountVnd: number
  ): Promise<{ qrUrl: string; transactionId: string }> => {
    const transactionId = `topup_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;

    const qrUrl = `https://qr.sepay.vn/img?acc=${config.accountNumber}&bank=${config.bankCode}&amount=${amountVnd}&des=${transactionId}&template=compact`;

    return { qrUrl, transactionId };
  };

  const verifyWebhookSignature = (
    payload: string,
    signature: string
  ): boolean => {
    if (!config.webhookSecret) return false;
    return signature === config.webhookSecret;
  };

  return { createQRPayment, verifyWebhookSignature };
}

export interface EnvSePayConfig {
  SEPAY_BANK_CODE?: string;
  SEPAY_ACCOUNT_NUMBER?: string;
  SEPAY_ACCOUNT_NAME?: string;
  SEPAY_WEBHOOK_SECRET?: string;
}

export function createDefaultSepayService(env: EnvSePayConfig): SepayService {
  return createSepayService({
    bankCode: env.SEPAY_BANK_CODE ?? "970436",
    accountNumber: env.SEPAY_ACCOUNT_NUMBER ?? "",
    accountName: env.SEPAY_ACCOUNT_NAME ?? "BUTCHI",
    webhookSecret: env.SEPAY_WEBHOOK_SECRET ?? "",
  });
}
