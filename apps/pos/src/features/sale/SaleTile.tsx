import { Button } from "ui";

import { formatPeso } from "./helpers.ts";

type Props = {
  name: string;
  priceCentavos: number;
  available: boolean;
  onSelect: () => void;
};

export function SaleTile({ name, priceCentavos, available, onSelect }: Props) {
  return (
    <Button
      type="button"
      variant="outline"
      disabled={!available}
      className="h-20 flex-col items-start justify-between rounded-xl p-3 whitespace-normal"
      onClick={onSelect}
    >
      <span className="line-clamp-2 text-left text-sm leading-tight">{name}</span>
      <span className="text-xs text-muted-foreground">
        {available ? formatPeso(priceCentavos) : "Sold out"}
      </span>
    </Button>
  );
}
