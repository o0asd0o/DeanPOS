import { Button, Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "ui";

import type { Draft } from "./draft-store.ts";
import { formatPeso } from "./helpers.ts";
import { Cart } from "./Cart.tsx";

type Props = {
  draft: Draft | null;
  optionNames: ReadonlyMap<string, string>;
  onEdit: (line: Draft["lines"][number]) => void;
};

export function MobileCart(props: Props) {
  const { draft } = props;
  const lineCount = draft?.lines.length ?? 0;
  const total = draft?.totalCentavos ?? 0;
  return (
    <div className="fixed inset-x-0 bottom-0 z-10 bg-background p-3 md:hidden">
      <Sheet>
        <SheetTrigger asChild>
          <Button type="button" variant="outline" className="w-full">
            {lineCount} items · {formatPeso(total)} · Open cart
          </Button>
        </SheetTrigger>
        <SheetContent side="bottom" className="h-4/5">
          <SheetHeader>
            <SheetTitle>Order</SheetTitle>
          </SheetHeader>
          <div className="mt-4 h-full pb-12">
            <Cart {...props} />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
