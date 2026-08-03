import { describe, expect, it } from "vite-plus/test";

import { deriveBits, hashPin, PIN_HASH_PARAMS, verifyPin } from "./pin.ts";

// RFC 7914 §11, "Test Vectors for PBKDF2 with HMAC-SHA-256" — run through
// the production `deriveBits`, not a reimplementation, so a change to the
// derivation in `pin.ts` fails these vectors too (M3).
describe("PBKDF2-HMAC-SHA-256, pinned by RFC 7914 §11", () => {
  const textEncoder = new TextEncoder();
  const hex = (bytes: Uint8Array) => Buffer.from(bytes).toString("hex");

  it('P="passwd", S="salt", c=1, dkLen=64', async () => {
    const derived = await deriveBits("passwd", textEncoder.encode("salt"), 1, 64);
    expect(hex(derived)).toBe(
      "55ac046e56e3089fec1691c22544b605f94185216dde0465e68b9d57c20dacbc49ca9cccf179b645991664b39d77ef317c71b845b1e30bd509112041d3a19" +
        "783",
    );
  });

  it('P="Password", S="NaCl", c=80000, dkLen=64', async () => {
    const derived = await deriveBits("Password", textEncoder.encode("NaCl"), 80_000, 64);
    expect(hex(derived)).toBe(
      "4ddcd8f60b98be21830cee5ef22701f9641a4418d04c0414aeff08876b34ab56a1d425a1225833549adb841b51c9b3176a272bdebba1d078478f62b397f33" +
        "c8d",
    );
  });
});

describe("hashPin / verifyPin round trip", () => {
  it("verifies the right PIN and rejects the wrong one", async () => {
    const stored = await hashPin("482913");
    expect(await verifyPin("482913", stored)).toBe(true);
    expect(await verifyPin("000000", stored)).toBe(false);
  });

  it("stores the PHC-shaped string with the configured parameters", async () => {
    const stored = await hashPin("1234");
    expect(stored).toMatch(/^\$pbkdf2-sha256\$i=600000\$[^$]+\$[^$]+$/);
    expect(stored).toContain(`i=${PIN_HASH_PARAMS.iterations}`);
  });

  it("verifies using the iteration count parsed from the stored string, not the current constant", async () => {
    const salt = "0123456789abcdef";
    const key = await globalThis.crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode("5150"),
      "PBKDF2",
      false,
      ["deriveBits"],
    );
    const bits = await globalThis.crypto.subtle.deriveBits(
      { name: "PBKDF2", salt: new TextEncoder().encode(salt), iterations: 1000, hash: "SHA-256" },
      key,
      256,
    );
    const b64 = (buf: ArrayBuffer) => Buffer.from(buf).toString("base64").replace(/=+$/, "");
    const saltB64 = Buffer.from(salt, "utf8").toString("base64").replace(/=+$/, "");
    const stored = `$pbkdf2-sha256$i=1000$${saltB64}$${b64(bits)}`;

    expect(await verifyPin("5150", stored)).toBe(true);
  });

  it("rejects a malformed stored string rather than throwing", async () => {
    expect(await verifyPin("1234", "not-a-hash")).toBe(false);
    expect(await verifyPin("1234", "$scrypt$ln=17,r=8,p=1$abc$def")).toBe(false);
    expect(await verifyPin("1234", "$pbkdf2-sha256$i=1000$not!!valid$not!!valid")).toBe(false);
  });

  it("a stored key shorter than 32 bytes never admits a PIN (M4)", async () => {
    const stored = await hashPin("482913");
    const parts = stored.split("$");
    parts[4] = parts[4]!.slice(0, 2);
    expect(await verifyPin("482913", parts.join("$"))).toBe(false);
  });

  it("hashPin throws on anything that is not 4-6 digits", async () => {
    await expect(hashPin("123")).rejects.toThrow();
    await expect(hashPin("1234567")).rejects.toThrow();
    await expect(hashPin("abcd")).rejects.toThrow();
  });

  it("two hashes of the same PIN differ — a random salt per row", async () => {
    const first = await hashPin("135790");
    const second = await hashPin("135790");
    expect(first).not.toBe(second);
  });
});
