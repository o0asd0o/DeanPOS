import type { FormEvent, ReactNode } from "react";
import { XIcon } from "lucide-react";
import { Button, SheetClose, SheetTitle } from "ui";

// The three-part sheet: a fixed header, the one scrolling region, and a fixed
// action row. The `<form>` wraps all three so a submit button in the footer
// still belongs to the fields in the body — record 050.
export function SheetForm({
  title,
  onSubmit,
  busy,
  footer,
  children,
}: {
  title: string;
  onSubmit: () => void;
  busy?: boolean;
  footer: ReactNode;
  children: ReactNode;
}) {
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    // A dialog opened from this form portals its own <form> out of the DOM but
    // not out of the React tree, so its submit arrives here too. Only this
    // form's own submit counts.
    if (event.target !== event.currentTarget) return;
    event.preventDefault();
    if (busy) return;
    onSubmit();
  };

  return (
    <form
      onSubmit={handleSubmit}
      aria-busy={busy}
      className="flex h-full flex-col overflow-hidden rounded-2xl bg-card text-card-foreground"
    >
      <div className="flex items-center justify-between gap-4 border-b px-4 py-3">
        <SheetTitle asChild>
          <h2 className="font-semibold">{title}</h2>
        </SheetTitle>
        <SheetClose asChild>
          <Button type="button" variant="ghost" size="icon-sm" aria-label="Close">
            <XIcon />
          </Button>
        </SheetClose>
      </div>
      <div className="scrollbar-slim flex flex-1 flex-col gap-4 overflow-y-auto p-4">
        {children}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t p-4">{footer}</div>
    </form>
  );
}
