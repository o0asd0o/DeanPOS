import { z } from "zod";

// `kind` is the only thing anything downstream may branch on — never `name`
// (issue 08 acceptance criteria). Presets (Card, GCash, Maya, Bank transfer)
// are seed suggestions on the Name field's `<datalist>`, not an enum.
export const paymentMethodKindSchema = z.enum(["cash", "recorded"]);

export const paymentMethodOutputSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  name: z.string(),
  kind: paymentMethodKindSchema,
  active: z.boolean(),
  createdAt: z.date(),
  // Empty for `cash`, which is available everywhere unconditionally and
  // holds no join rows (record 054 §"Smaller calls" 3).
  storeIds: z.array(z.string()),
});

// Each independently optional; a method with none set behaves byte-for-byte
// as it does today (issue 14, record 066 Q5). `image` is tri-state: absent
// leaves the bytes untouched, `null` clears them, an object replaces them.
export const paymentMethodPaymentDetailsInputSchema = z.object({
  accountName: z.string().trim().min(1).nullable(),
  accountNumber: z.string().trim().min(1).nullable(),
  image: z
    .object({ base64: z.string().min(1) })
    .nullable()
    .optional(),
});

// Every created method is `recorded` — there is no `kind` control (record 054
// Q3). Availability defaults to every Store checked (record 054 §"Smaller
// calls" 4); the caller decides which to uncheck.
export const paymentMethodCreateInputSchema = z.object({
  name: z.string().min(1),
  storeIds: z.array(z.string()),
  paymentDetails: paymentMethodPaymentDetailsInputSchema.optional(),
});

// Name, the whole availability set, and the payment-detail fields all move
// together — one form, one Save, one transaction (record 054 Q3, extended by
// record 066 Q7). Never `active`; that is its own procedure.
export const paymentMethodUpdateInputSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  storeIds: z.array(z.string()),
  paymentDetails: paymentMethodPaymentDetailsInputSchema.optional(),
});

export const paymentMethodIdInputSchema = z.object({ id: z.string() });

// The Tenant-default row for a method, admin-only (issue 14). `image` carries
// a data URL for the editor's preview and the hash triple the audit stores —
// never a separate endpoint that could commit outside the one Save.
export const paymentMethodPaymentDetailsOutputSchema = z.object({
  accountName: z.string().nullable(),
  accountNumber: z.string().nullable(),
  image: z
    .object({
      dataUrl: z.string(),
      mime: z.string(),
      sha256: z.string(),
      byteLength: z.number(),
    })
    .nullable(),
});
