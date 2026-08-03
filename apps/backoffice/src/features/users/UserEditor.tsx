import { useState } from "react";
import { useForm } from "@tanstack/react-form";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  PasswordInput,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "ui";

import {
  useCreateUserMutation,
  useStoresQuery,
  useUpdateUserMutation,
} from "./__common/queries.ts";
import type { UserOutput } from "./helpers.ts";
import { ResetPasswordDialog } from "./ResetPasswordDialog.tsx";
import { StoresField } from "./StoresField.tsx";

type Role = "cashier" | "manager" | "admin";

// The User editor (record 045): a `Select` for role, native checkboxes for
// Stores, one form, one submit, one round trip (record 040's shape). Never
// touches `active` or the password — deactivate/reactivate and reset are
// their own procedures.
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

  const createUser = useCreateUserMutation();
  const updateUser = useUpdateUserMutation();
  const saving = createUser.isPending || updateUser.isPending;
  const failed = createUser.isError || updateUser.isError;

  const form = useForm({
    defaultValues: {
      email: "",
      role: (user?.role ?? "cashier") as Role,
      password: "",
    },
    onSubmit: async ({ value }) => {
      const saved = user
        ? await updateUser.mutateAsync({ id: user.id, role: value.role, storeIds: [...storeIds] })
        : await createUser.mutateAsync({
            email: value.email,
            role: value.role,
            password: value.password,
            storeIds: [...storeIds],
          });
      if (!saved) return;

      onSaved();
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle role="heading" aria-level={2}>
          {user ? `Edit ${user.email}` : "New user"}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (saving) return;
            void form.handleSubmit();
          }}
          aria-busy={saving}
          className="flex flex-col gap-4"
        >
          {!user && (
            <form.Field name="email">
              {(field) => (
                <div className="flex flex-col gap-2">
                  <label htmlFor="user-email">Email</label>
                  <Input
                    id="user-email"
                    type="email"
                    name={field.name}
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
                  <SelectTrigger id="user-role">
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
                <div className="flex flex-col gap-2">
                  <label htmlFor="temporary-password">Temporary password</label>
                  <p id="temporary-password-hint-1" className="text-foreground">
                    At least 8 characters. Any characters, including spaces — there are no other
                    rules.
                  </p>
                  <p id="temporary-password-hint-2" className="text-foreground">
                    Tell this person their password yourself. It is not shown again after you save,
                    and they choose their own the first time they sign in.
                  </p>
                  <PasswordInput
                    id="temporary-password"
                    name={field.name}
                    autoComplete="new-password"
                    required
                    minLength={8}
                    aria-describedby="temporary-password-hint-1 temporary-password-hint-2"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                  />
                </div>
              )}
            </form.Field>
          )}
          {user && (
            <Button type="button" variant="outline" onClick={() => setResettingPassword(true)}>
              Reset password
            </Button>
          )}
          <Button type="submit" aria-disabled={saving}>
            {user ? (saving ? "Saving…" : "Save changes") : saving ? "Creating…" : "Create user"}
          </Button>
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          {failed && (
            <div
              role="alert"
              className="rounded-md bg-status-danger-tint p-3 text-sm text-foreground"
            >
              Couldn&rsquo;t save the user
            </div>
          )}
        </form>
      </CardContent>
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
    </Card>
  );
}
