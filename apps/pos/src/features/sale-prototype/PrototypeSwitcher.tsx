import { useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Button } from "ui";

const VARIANTS = [
  { key: "A", name: "Loyverse faithful — bottom categories, persistent cart" },
  { key: "B", name: "Left category rail — list-first density" },
  { key: "C", name: "Full-bleed grid — cart collapsed to an action bar" },
];

type Props = { current: string };

export function PrototypeSwitcher({ current }: Props) {
  const navigate = useNavigate();
  const index = Math.max(
    0,
    VARIANTS.findIndex((entry) => entry.key === current),
  );
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, [contenteditable]")) return;
      const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
      if (step === 0) return;
      const next = VARIANTS[(index + step + VARIANTS.length) % VARIANTS.length]!.key;
      void navigate({ to: "/prototype-sale", search: { variant: next }, replace: true });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, navigate]);

  if (import.meta.env.PROD) return null;
  const go = (step: number) => {
    const next = VARIANTS[(index + step + VARIANTS.length) % VARIANTS.length]!.key;
    void navigate({ to: "/prototype-sale", search: { variant: next }, replace: true });
  };
  return (
    <div className="pointer-events-auto fixed top-2 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-full bg-foreground px-3 py-1 text-background shadow-lg">
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label="Previous variant"
        className="text-background hover:bg-background/20 hover:text-background"
        onClick={() => go(-1)}
      >
        ‹
      </Button>
      <span className="text-xs whitespace-nowrap">
        {VARIANTS[index]!.key} — {VARIANTS[index]!.name} · ← →
      </span>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label="Next variant"
        className="text-background hover:bg-background/20 hover:text-background"
        onClick={() => go(1)}
      >
        ›
      </Button>
    </div>
  );
}
