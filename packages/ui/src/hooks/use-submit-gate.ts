import type { AnyFormApi } from "@tanstack/react-form";
import { useStore } from "@tanstack/react-form";

// A form with nothing changed has nothing to commit. The gate blocks the
// submit path as well as the button, because `aria-disabled` — this repo's
// disabled convention — leaves Enter-to-submit working.
export function useSubmitGate(
  form: AnyFormApi,
  { busy = false, dirty = false }: { busy?: boolean; dirty?: boolean } = {},
) {
  const pristine = useStore(form.store, (state) => state.isDefaultValue) && !dirty;
  const blocked = pristine || busy;
  return {
    blocked,
    submit: () => {
      if (blocked) return;
      void form.handleSubmit();
    },
  };
}
