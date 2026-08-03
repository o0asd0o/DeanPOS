// The only file in the repository that names these localStorage keys
// (record 056 Q3) — `rg -n 'localStorage' apps/pos` must return only this
// file.
const TOKEN_KEY = "deanpos.device.token";
const IDENTITY_KEY = "deanpos.device.identity";

export type DeviceIdentity = {
  deviceId: string;
  name: string;
  code: string;
  storeId: string;
  storeName: string;
};

export const readDeviceToken = (): string | null => localStorage.getItem(TOKEN_KEY);

// A refused request never calls this — only `enrol()` clears, and it clears
// before writing (record 056 Q3's no-go).
export const clearDeviceToken = (): void => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(IDENTITY_KEY);
};

export const writeDeviceToken = (token: string, identity: DeviceIdentity): void => {
  clearDeviceToken();
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(IDENTITY_KEY, JSON.stringify(identity));
};

export const readDeviceIdentity = (): DeviceIdentity | null => {
  const raw = localStorage.getItem(IDENTITY_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as DeviceIdentity;
  } catch {
    return null;
  }
};
