import { Hint } from "@/components/Hint.tsx";
import { useEffect, useRef, useState } from "react";
import { ChevronDownIcon, ChevronUpIcon, XIcon } from "lucide-react";
import { Button, Input } from "ui";

export type LabelRow = { id: string; value: string };

// The reorder control (record 039). Rows are keyed by `row.id`, not index,
// so the same DOM button moves with its row and focus follows it (039 §1).
export function TableLabelsField({
  rows,
  onChange,
  onAnnounce,
}: {
  rows: LabelRow[];
  onChange: (rows: LabelRow[]) => void;
  onAnnounce: (message: string) => void;
}) {
  const [focusId, setFocusId] = useState<string | null>(null);
  const inputRefs = useRef(new Map<string, HTMLInputElement>());

  useEffect(() => {
    if (!focusId) return;
    inputRefs.current.get(focusId)?.focus();
    setFocusId(null);
  }, [focusId]);

  const moveUp = (index: number) => {
    if (index === 0) return;
    const next = [...rows];
    [next[index - 1], next[index]] = [next[index]!, next[index - 1]!];
    onChange(next);
    onAnnounce(`Moved to position ${index} of ${rows.length}`);
  };

  const moveDown = (index: number) => {
    if (index === rows.length - 1) return;
    const next = [...rows];
    [next[index], next[index + 1]] = [next[index + 1]!, next[index]!];
    onChange(next);
    onAnnounce(`Moved to position ${index + 2} of ${rows.length}`);
  };

  const remove = (index: number) => {
    onChange(rows.filter((_, i) => i !== index));
    onAnnounce("Label removed");
  };

  const add = () => {
    const id = crypto.randomUUID();
    onChange([...rows, { id, value: "" }]);
    setFocusId(id);
  };

  return (
    <fieldset className="flex flex-col gap-2">
      <legend>Table labels</legend>
      <Hint detail="Leave this empty if you do not seat customers at numbered tables. The terminal then shows no table control at all.">
        Optional — for numbered tables only.
      </Hint>
      {rows.map((row, index) => {
        const n = index + 1;
        return (
          <div key={row.id} className="flex items-center gap-1">
            <Input
              placeholder={`Table ${n}`}
              ref={(el) => {
                if (el) inputRefs.current.set(row.id, el);
                else inputRefs.current.delete(row.id);
              }}
              aria-label={`Table label ${n}`}
              className="flex-1"
              value={row.value}
              onChange={(event) => {
                const next = [...rows];
                next[index] = { ...row, value: event.target.value };
                onChange(next);
              }}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="tap-target"
              aria-label={`Move label ${n} up`}
              aria-disabled={rows.length < 2 || index === 0}
              onClick={() => moveUp(index)}
            >
              <ChevronUpIcon aria-hidden="true" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="tap-target"
              aria-label={`Move label ${n} down`}
              aria-disabled={rows.length < 2 || index === rows.length - 1}
              onClick={() => moveDown(index)}
            >
              <ChevronDownIcon aria-hidden="true" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="tap-target"
              aria-label={`Remove label ${n}`}
              onClick={() => remove(index)}
            >
              <XIcon aria-hidden="true" />
            </Button>
          </div>
        );
      })}
      <Button type="button" variant="outline" onClick={add} className="tap-target">
        Add label
      </Button>
    </fieldset>
  );
}
