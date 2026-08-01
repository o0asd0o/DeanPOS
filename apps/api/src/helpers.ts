export const requireEnv = (name: string, source: NodeJS.ProcessEnv = process.env): string => {
  const value = source[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
};
