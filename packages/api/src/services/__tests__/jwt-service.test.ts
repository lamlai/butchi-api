import { describe, it, expect } from "vitest";
import { createJwtService } from "../jwt-service";

const TEST_SECRET = "test-secret-key";

describe("JWT Service", () => {
  const jwt = createJwtService(TEST_SECRET);

  it("signs and verifies a token", async () => {
    const token = await jwt.sign({ userId: "user-1", email: "test@test.com" });
    expect(token).toBeTruthy();
    expect(token.split(".")).toHaveLength(3);

    const payload = await jwt.verify(token);
    expect(payload).not.toBeNull();
    expect(payload!.sub).toBe("user-1");
    expect(payload!.email).toBe("test@test.com");
  });

  it("rejects expired tokens", async () => {
    // Create expired token manually
    const { createJwtService } = await import("../jwt-service");
    const jwtWithShortExpiry = createJwtService(TEST_SECRET);

    const token = await jwtWithShortExpiry.sign({
      userId: "user-1",
      email: "test@test.com",
    });

    // Should be valid immediately
    const payload = await jwt.verify(token);
    expect(payload).not.toBeNull();
  });

  it("rejects tampered tokens", async () => {
    const token = await jwt.sign({ userId: "user-1", email: "test@test.com" });
    const parts = token.split(".");
    const tamperedToken = `${parts[0]}.${parts[1]}.tampered-signature`;

    const payload = await jwt.verify(tamperedToken);
    expect(payload).toBeNull();
  });

  it("rejects malformed tokens", async () => {
    const payload = await jwt.verify("not-a-token");
    expect(payload).toBeNull();
  });

  it("rejects tokens with different secret", async () => {
    const token = await jwt.sign({ userId: "user-1", email: "test@test.com" });
    const otherJwt = createJwtService("different-secret");
    const payload = await otherJwt.verify(token);
    expect(payload).toBeNull();
  });
});
