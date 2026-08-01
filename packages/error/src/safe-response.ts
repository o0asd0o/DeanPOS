const GENERIC_MESSAGE = "Something went wrong. Please try again.";

// The one place a caught error becomes a client body. ADR-0008; security criterion 5.
export const toSafeErrorResponse = (error: unknown): { message: string } => {
  console.error(error);
  return { message: GENERIC_MESSAGE };
};
