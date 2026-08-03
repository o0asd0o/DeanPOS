import { SheetForm } from "@/components/SheetForm.tsx";
import { TemporaryPasswordField } from "./TemporaryPasswordField.tsx";
import { useState } from "react";
import { CheckIcon, KeyRoundIcon, XIcon } from "lucide-react";
import { useForm } from "@tanstack/react-form";
import { Button, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "ui";

import {
  useCreateUserMutation,
  useStoresQuery,
  useUpdateUserMutation,
} from "./__common/queries.ts";
import type { UserOutput } from "./helpers.ts";
import { ResetPasswordDialog } from "./ResetPasswordDialog.tsx";
import { StoresField } from "./StoresField.tsx";

type Role = "cashier" | "manager" | "admin";

// The User editor, one form/one submit (record 045, record 040's shape).
// Never touches `active` or the password (their own procedures).
export function UserEditor({
  user,
  onSaved,
  onCancel,
  onAnnounce,
}: {
  user: UserOutput | null;
  onSaved: () => void;
  onCancel: () => void;
  onAnnounce: (message: string) => void;
}) {
  const storesQuery = useStoresQuery();
  const stores = storesQuery.data ?? [];

  const [storeIds, setStoreIds] = useState<Set<string>>(() => new Set(user?.storeIds ?? []));
  const [resettingPassword, setResettingPassword] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);

  const createUser = useCreateUserMutation();
  const updateUser = useUpdateUserMutation();
  const saving = createUser.isPending || updateUser.isPending;
  const failed = createUser.isError || updateUser.isError || saveFailed;

  const form = useForm({
    defaultValues: {
      firstName: user?.firstName ?? "",
      lastName: user?.lastName ?? "",
      email: "",
      role: (user?.role ?? "cashier") as Role,
      password: "",
    },
    onSubmit: async ({ value }) => {
      setSaveFailed(false);
      try {
        const saved = user
          ? await updateUser.mutateAsync({
              id: user.id,
              firstName: value.firstName,
              lastName: value.lastName,
              role: value.role,
              storeIds: [...storeIds],
            })
          : await createUser.mutateAsync({
              email: value.email,
              firstName: value.firstName,
              lastName: value.lastName,
              role: value.role,
              password: value.password,
              storeIds: [...storeIds],
            });
        if (!saved) {
          // A refusal server-side (e.g. self-demotion) resolves `null`
          // rather than rejecting — treated the same as a thrown error.
          setSaveFailed(true);
          return;
        }

        if (!user) createUser.evictPassword();
        onSaved();
      } catch {
        // isError is already set on the mutation; swallow so it doesn't
        // also surface as an unhandled promise rejection.
      }
    },
  });

  return (
    <SheetForm
      title={user ? `Edit ${user.email}` : "New employee"}
      busy={saving}
      onSubmit={() => void form.handleSubmit()}
      footer={
        <>
          <Button type="button" variant="outline" onClick={onCancel}>
            <XIcon />
            Cancel
          </Button>
          <div className="flex flex-wrap items-center gap-2">
            {user && (
              <Button type="button" variant="outline" onClick={() => setResettingPassword(true)}>
                <KeyRoundIcon />
                Reset password
              </Button>
            )}
            <Button type="submit" aria-disabled={saving}>
              <CheckIcon />
              {user
                ? saving
                  ? "Saving…"
                  : "Save changes"
                : saving
                  ? "Creating…"
                  : "Create employee"}
            </Button>
          </div>
        </>
      }
    >
      <div className="flex flex-col gap-4 sm:flex-row">
        <form.Field name="firstName">
          {(field) => (
            <div className="flex flex-1 flex-col gap-2">
              <label htmlFor="user-first-name">First name</label>
              <Input
                id="user-first-name"
                name={field.name}
                placeholder="Ana"
                required
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(event) => field.handleChange(event.target.value)}
              />
            </div>
          )}
        </form.Field>
        <form.Field name="lastName">
          {(field) => (
            <div className="flex flex-1 flex-col gap-2">
              <label htmlFor="user-last-name">Last name</label>
              <Input
                id="user-last-name"
                name={field.name}
                placeholder="Reyes"
                required
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(event) => field.handleChange(event.target.value)}
              />
            </div>
          )}
        </form.Field>
      </div>
      {!user && (
        <form.Field name="email">
          {(field) => (
            <div className="flex flex-col gap-2">
              <label htmlFor="user-email">Email</label>
              <Input
                id="user-email"
                type="email"
                name={field.name}
                placeholder="ana@restaurant.com"
                required
                autoFocus
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(event) => field.handleChange(event.target.value)}
              />
            </div>
          )}
        </form.Field>
      )}
      <form.Field name="role">
        {(field) => (
          <div className="flex flex-col gap-2">
            <label htmlFor="user-role">Role</label>
            <Select
              value={field.state.value}
              onValueChange={(value) => field.handleChange(value as Role)}
            >
              <SelectTrigger id="user-role" autoFocus={!!user}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cashier">Cashier</SelectItem>
                <SelectItem value="manager">Manager</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </form.Field>
      <StoresField stores={stores} selectedIds={storeIds} onChange={setStoreIds} />
      {!user && (
        <form.Field name="password">
          {(field) => (
            <TemporaryPasswordField
              id="temporary-password"
              name={field.name}
              label="Temporary password"
              detail="Tell this person their password yourself. It is not shown again after you save, and they choose their own the first time they sign in."
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(next) => field.handleChange(next)}
            />
          )}
        </form.Field>
      )}
      {failed && (
        <div role="alert" className="rounded-md bg-status-danger-tint p-3 text-sm text-foreground">
          Couldn&rsquo;t save the employee
        </div>
      )}
      {user && resettingPassword && (
        <ResetPasswordDialog
          user={user}
          onOpenChange={(open) => {
            if (!open) setResettingPassword(false);
          }}
          onReset={() => {
            setResettingPassword(false);
            onAnnounce("Password reset");
          }}
        />
      )}
    </SheetForm>
  );
}
