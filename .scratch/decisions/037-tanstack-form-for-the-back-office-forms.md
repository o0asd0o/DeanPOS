# 037 — TanStack Form owns the back-office forms

- **Status:** accepted
- **Date:** 2026-08-03
- **Stakes:** low — two screens today, a convention for the rest
- **Asked by:** the human, directly
- **Decided by:** the human; this record states what was adopted and what was not
- **Relates to:** [030](030-the-back-office-sign-in-screen.md), [032](032-the-password-policy.md)

## What was adopted

`@tanstack/react-form` 1.33.3, in the workspace catalog, as a dependency of
`apps/backoffice`. Both existing forms — `SignIn` and `SetPassword` — are now
`useForm` + `form.Field`, replacing four `useState` pairs and a hand-rolled
mismatch check. Every screen behaviour record 030 fixes is unchanged: same
markup, same copy, same one `role="alert"`, same `aria-busy`, same early
return on `isPending` as the double-POST guard.

Two things deliberately stayed outside the form library:

- **The sign-in failure sentence.** Record 030 requires one form-level sentence
  that names neither field. That is the mutation's outcome, not a validation
  result, so it remains local state.
- **The password policy.** Record 032 puts the floor on the server and allows
  only the native `minLength` on the client. No zod validator was added on top;
  the policy message still arrives from the server's own rejection.

The confirm-password mismatch **did** move into the library, as an `onSubmit`
validator on the confirm field — record 030 marks only that field invalid, and
a field validator is exactly that scope.

## What was not adopted

TanStack Form's shadcn composition layer (`useAppForm` with `FormItem` /
`FormLabel` / `FormMessage` wrappers). Two forms with four fields do not pay
for six wrapper components; the render-prop form is a smaller diff and reads
the same. Revisit when a third form lands, or when a field needs an error
slot that the current markup has no place for.

## Reversal

The screens are the only consumers. Reverting is restoring two files and
dropping one catalog entry; nothing in `packages/ui` or the contract knows the
library exists.
