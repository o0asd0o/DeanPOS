import { useEffect, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import { useNavigate } from "@tanstack/react-router";
import type { LinkProps } from "@tanstack/react-router";
import { SearchIcon } from "lucide-react";
import { cn, Dialog, DialogContent, DialogTitle, Input } from "ui";

import { NAV_GROUPS } from "./helpers.ts";

const SCREENS = NAV_GROUPS.flatMap((group) =>
  group.items.map((item) => ({
    label: item.label,
    to: item.to,
    group: group.label,
  })),
);

// Search over the screens themselves, not over data: no search endpoint exists
// (record 048's removal), and a palette that only goes places is honest about
// that. Cmd/Ctrl+K opens it from anywhere.
export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  // The keyboard's own selection, kept apart from hover: the mouse never moves
  // it, so a pointer resting over the list cannot steal what Enter will open.
  // `null` until the User types or presses an arrow — a bare list of every
  // screen has no reason to nominate its first entry.
  const [selected, setSelected] = useState<number | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== "k" || !(event.metaKey || event.ctrlKey)) return;
      event.preventDefault();
      setOpen((previous) => !previous);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.userAgent);
  const term = query.trim().toLowerCase();
  const matches = SCREENS.filter(
    (screen) =>
      term === "" ||
      screen.label.toLowerCase().includes(term) ||
      screen.group.toLowerCase().includes(term),
  );

  const active = selected === null ? null : Math.min(selected, matches.length - 1);

  useEffect(() => {
    if (active === null) return;
    document.getElementById(`screen-${active}`)?.scrollIntoView?.({ block: "nearest" });
  }, [active, open]);

  const go = (to: LinkProps["to"]) => {
    setOpen(false);
    setQuery("");
    setSelected(null);
    void navigate({ to });
  };

  const onListKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (matches.length === 0) return;
      const step = event.key === "ArrowDown" ? 1 : -1;
      // The first arrow press enters the list from whichever end it points at.
      if (active === null) setSelected(step === 1 ? 0 : matches.length - 1);
      else setSelected((active + step + matches.length) % matches.length);
      return;
    }
    if (event.key === "Enter" && active !== null && matches[active]) go(matches[active].to);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="tap-target flex h-12 w-full items-center gap-2 rounded-full bg-card px-4 text-sm text-muted-foreground transition-colors hover:bg-hover sm:w-72"
      >
        <SearchIcon className="size-5 shrink-0" aria-hidden="true" />
        <span>Search</span>
        <kbd className="ml-auto rounded-md border px-2 py-0.5 font-sans text-xs text-muted-foreground">
          {isMac ? "⌘ K" : "Ctrl K"}
        </kbd>
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          showCloseButton={false}
          className="top-24 max-w-xl translate-y-0 gap-0 overflow-hidden p-0"
        >
          <DialogTitle className="sr-only">Search</DialogTitle>
          <div className="flex items-center gap-3 border-b px-4">
            <SearchIcon className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
            <Input
              type="search"
              autoFocus
              role="combobox"
              aria-expanded
              aria-controls="screen-results"
              aria-activedescendant={active === null ? undefined : `screen-${active}`}
              aria-label="Search screens"
              placeholder="Search screens…"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                // Typing nominates the top hit; clearing the field withdraws it.
                setSelected(event.target.value.trim() === "" ? null : 0);
              }}
              onKeyDown={onListKeyDown}
              className="h-14 rounded-none border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
            />
          </div>
          <div
            id="screen-results"
            role="listbox"
            aria-label="Screens"
            className="scrollbar-slim max-h-96 overflow-y-auto p-2"
          >
            {matches.length === 0 ? (
              <p role="status" className="p-4 text-center text-sm text-muted-foreground">
                No screen matches that
              </p>
            ) : (
              matches.map((screen, index) => {
                // Where the typed term sits in the label, so the hit can be
                // marked rather than merely implied by the row surviving.
                const at = term === "" ? -1 : screen.label.toLowerCase().indexOf(term);
                return (
                  <div
                    key={screen.label}
                    id={`screen-${index}`}
                    role="option"
                    aria-selected={index === active}
                    // Marking the hit splits the label into two text nodes, and
                    // the computed name splits with it ("Employ ees").
                    aria-label={`${screen.label}, ${screen.group}`}
                    onClick={() => go(screen.to)}
                    className={cn(
                      "flex cursor-pointer flex-col rounded-lg px-4 py-3 transition-colors",
                      index === active ? "bg-primary" : "hover:bg-hover",
                    )}
                  >
                    <span
                      className={cn(
                        "font-medium",
                        index === active ? "text-primary-foreground" : "text-foreground",
                      )}
                    >
                      {at < 0 ? (
                        screen.label
                      ) : (
                        <>
                          {screen.label.slice(0, at)}
                          <mark className="rounded-sm bg-status-warning-tint text-foreground">
                            {screen.label.slice(at, at + term.length)}
                          </mark>
                          {screen.label.slice(at + term.length)}
                        </>
                      )}
                    </span>
                    <span
                      className={cn(
                        "text-xs",
                        index === active ? "text-primary-foreground/80" : "text-muted-foreground",
                      )}
                    >
                      {screen.group}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
