import { z } from "zod";

export const pingOutputSchema = z.object({
  id: z.number().int(),
  message: z.string(),
  createdAt: z.date(),
});
