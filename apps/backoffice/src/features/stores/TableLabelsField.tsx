import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Hint } from "@/components/Hint.tsx";
import { useEffect, useRef, useState } from "react";
import { Button } from "ui";

import type { LabelRow } from "./helpers.ts";
import { SortableLabelRow } from "./SortableLabelRow.tsx";

// The reorder control (record 039): drag the grip, or lift with Space and
// move with the arrow keys. Rows are keyed by `row.id`, not index, so focus
// stays on the handle that lifted a row wherever it lands (039 §1).
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

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const fromIndex = rows.findIndex((row) => row.id === active.id);
    const toIndex = rows.findIndex((row) => row.id === over.id);
    if (fromIndex < 0 || toIndex < 0) return;
    onChange(arrayMove(rows, fromIndex, toIndex));
    onAnnounce(`Moved to position ${toIndex + 1} of ${rows.length}`);
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
        Optional — for numbered tables only. Drag the handle to reorder.
      </Hint>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={rows.map((row) => row.id)} strategy={verticalListSortingStrategy}>
          {rows.map((row, index) => (
            <SortableLabelRow
              key={row.id}
              row={row}
              index={index}
              disabled={rows.length < 2}
              inputRef={(el) => {
                if (el) inputRefs.current.set(row.id, el);
                else inputRefs.current.delete(row.id);
              }}
              onValueChange={(value) => {
                const next = [...rows];
                next[index] = { ...row, value };
                onChange(next);
              }}
              onRemove={() => remove(index)}
            />
          ))}
        </SortableContext>
      </DndContext>
      <Button type="button" variant="outline" onClick={add} className="tap-target">
        Add label
      </Button>
    </fieldset>
  );
}
