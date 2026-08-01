/**
 * Two of the four origins (PRD "The CORS allowlist is two of the four
 * origins"): `pos.` and `admin.` call the API. `api.` calling itself is not
 * cross-origin and needs no entry; the apex landing origin is deliberately
 * excluded until area 11 adds itself with its own reason.
 */
export const allowedOrigins = (appDomain: string): string[] => [
  `https://pos.${appDomain}`,
  `https://admin.${appDomain}`,
];
