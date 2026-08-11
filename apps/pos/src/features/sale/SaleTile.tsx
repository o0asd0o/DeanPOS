import { Button } from "ui";

import { formatPeso } from "@/features/helpers.ts";

type Props = {
  name: string;
  priceCentavos: number;
  available: boolean;
  onSelect: (source: HTMLButtonElement) => void;
};

export function SaleTile({ name, priceCentavos, available, onSelect }: Props) {
  return (
    <Button
      type="button"
      variant="secondary"
      disabled={!available}
      className="h-24 flex-col items-start justify-between rounded-xl p-4 text-left whitespace-normal active:scale-98"
      onClick={(event) => onSelect(event.currentTarget)}
    >
      <span className="line-clamp-2 font-semibold leading-snug">{name}</span>
      <span className="text-sm font-medium text-muted-foreground">
        {available ? formatPeso(priceCentavos) : "Sold out"}
      </span>
    </Button>
  );
}
