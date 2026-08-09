export const SAVED_LINE = (version: string) => `Saved — catalog version ${version.slice(0, 8)}`;
export const draftKey = (kind: "variant" | "menuItem", id: string) => `${kind}:${id}`;
