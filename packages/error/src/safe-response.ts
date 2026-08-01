const GENERIC_MESSAGE = "Something went wrong. Please try again.";

/**
 * The one place a caught error becomes a client-facing body (ADR-0008
 * consequences: "one place formats and logs them"). Logs the real error for
 * operators and returns a fixed, generic message — no stack trace, no
 * upstream error text, no connection detail (security criterion 5).
 */
export const toSafeErrorResponse = (error: unknown): { message: string } => {
  console.error(error);
  return { message: GENERIC_MESSAGE };
};
