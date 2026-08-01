// Two of the four origins, deliberately. PRD "The CORS allowlist is two of the four origins".
export const allowedOrigins = (appDomain: string): string[] => [
  `https://pos.${appDomain}`,
  `https://admin.${appDomain}`,
];
