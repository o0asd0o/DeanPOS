// Minimal ambient type for the one Bun global this repo uses (issue 02).
// No `@types/bun` dependency: only the `Bun.password` shape `password.ts`
// actually calls, not the whole Bun API surface.
declare const Bun: {
  password: {
    hash(
      password: string,
      params: { algorithm: "argon2id"; memoryCost: number; timeCost: number },
    ): Promise<string>;
    verify(password: string, hash: string): Promise<boolean>;
  };
};
