export type ViewMode = "tile" | "list";

const VIEW_MODE_KEY = "deanpos.sale.view-mode";

export const readViewMode = (): ViewMode => {
  try {
    return localStorage.getItem(VIEW_MODE_KEY) === "list" ? "list" : "tile";
  } catch {
    return "tile";
  }
};

export const writeViewMode = (viewMode: ViewMode): void => {
  try {
    localStorage.setItem(VIEW_MODE_KEY, viewMode);
  } catch {
    // Storage can be unavailable in private browsing or locked-down terminals.
  }
};
