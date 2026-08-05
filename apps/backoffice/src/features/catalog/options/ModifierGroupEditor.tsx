import { GroupForm } from "./GroupForm.tsx";
import type { ModifierGroupOutput, ModifierOutput } from "./helpers.ts";
import { ModifierForm } from "./ModifierForm.tsx";

type EditorMode =
  | { kind: "group"; group: ModifierGroupOutput | null }
  | { kind: "modifier"; group: ModifierGroupOutput; modifier: ModifierOutput | null };

export function ModifierGroupEditor({
  mode,
  onSaved,
  onCancel,
}: {
  mode: EditorMode;
  onSaved: (message: string) => void;
  onCancel: () => void;
}) {
  if (mode.kind === "group") {
    return <GroupForm group={mode.group} onSaved={onSaved} onCancel={onCancel} />;
  }
  return (
    <ModifierForm
      group={mode.group}
      modifier={mode.modifier}
      onSaved={onSaved}
      onCancel={onCancel}
    />
  );
}
