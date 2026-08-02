// Password hashing parameters, declared once (issue 02). PIN hashing (issue
// 10) gets its own parameters in its own file — the two must not share a knob.
const PASSWORD_HASH_PARAMS = {
  algorithm: "argon2id" as const,
  memoryCost: 19456, // OWASP minimum for argon2id, in KiB
  timeCost: 2,
};

export const hashPassword = (password: string): Promise<string> =>
  Bun.password.hash(password, PASSWORD_HASH_PARAMS);

export const verifyPassword = (password: string, hash: string): Promise<boolean> =>
  Bun.password.verify(password, hash);
