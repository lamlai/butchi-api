const ALLOWED_TYPES = ["image/jpeg", "image/png", "application/pdf"];
const MAX_SIZE = 2 * 1024 * 1024; // 2MB

export interface ProofValidationResult {
  valid: boolean;
  error?: string;
}

export function validateProofFile(file: File): ProofValidationResult {
  if (file.size > MAX_SIZE) {
    return { valid: false, error: "File size exceeds 2MB limit" };
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return { valid: false, error: "Invalid file type. Allowed: JPG, PNG, PDF" };
  }

  return { valid: true };
}

export function getProofR2Key(topupId: string, filename: string): string {
  const sanitized = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `payment-proofs/${topupId}/${sanitized}`;
}
