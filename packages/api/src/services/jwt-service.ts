export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  iat: number;
  exp: number;
}

export interface JwtService {
  sign(payload: { userId: string; email: string; role: string }): Promise<string>;
  verify(token: string): Promise<JwtPayload | null>;
}

async function hmacSha256(secret: string, data: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
  return btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function base64UrlEncode(data: object): string {
  return btoa(JSON.stringify(data))
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function base64UrlDecode(str: string): object | null {
  try {
    const json = atob(str.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(json);
  } catch {
    return null;
  }
}

const TOKEN_EXPIRY_HOURS = 1;
const ALG_HEADER = { alg: "HS256", typ: "JWT" };

export function createJwtService(secret: string): JwtService {
  const sign = async (payload: {
    userId: string;
    email: string;
    role: string;
  }): Promise<string> => {
    const header = base64UrlEncode(ALG_HEADER);
    const body = base64UrlEncode({
      sub: payload.userId,
      email: payload.email,
      role: payload.role,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + TOKEN_EXPIRY_HOURS * 3600,
    });
    const signature = await hmacSha256(secret, `${header}.${body}`);
    return `${header}.${body}.${signature}`;
  };

  const verify = async (token: string): Promise<JwtPayload | null> => {
    try {
      const parts = token.split(".");
      if (parts.length !== 3) return null;

      const [header, body, signature] = parts;
      const expectedSig = await hmacSha256(secret, `${header}.${body}`);

      if (signature !== expectedSig) return null;

      const payload = base64UrlDecode(body) as JwtPayload | null;
      if (!payload || !payload.exp) return null;

      if (payload.exp < Math.floor(Date.now() / 1000)) return null;

      return payload;
    } catch {
      return null;
    }
  };

  return { sign, verify };
}
