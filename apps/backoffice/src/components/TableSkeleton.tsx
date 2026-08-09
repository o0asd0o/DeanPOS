import { cn, Skeleton, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "ui";

type TableSkeletonVariant =
  | "stores"
  | "employees"
  | "devices"
  | "paymentMethods"
  | "menuItems"
  | "modifierGroups"
  | "overrides";

const headersByVariant: Record<TableSkeletonVariant, string[]> = {
  stores: ["Name", "Business-day start", "Table labels", "Status", ""],
  employees: ["Name", "Email", "Role", "Stores", "Status", ""],
  devices: ["Device", "Store", "Assigned to", "Last seen", "Status", ""],
  paymentMethods: ["Method", "Kind", "Available at", "Status", ""],
  menuItems: ["", "Name", "Price", "Actions"],
  modifierGroups: ["", "Group", "Rule", "Modifiers", "Linked to", "Status", "Actions"],
  overrides: ["When", "Store", "Action", "Approved by", "Reason", "Device"],
};

export function TableSkeleton({
  variant,
  isAdmin = true,
  rows = 5,
}: {
  variant: TableSkeletonVariant;
  isAdmin?: boolean;
  rows?: number;
}) {
  const headers = headersByVariant[variant].slice(
    0,
    isAdmin || !["stores", "employees", "devices", "paymentMethods"].includes(variant)
      ? undefined
      : -1,
  );
  const hasActions = [
    "stores",
    "employees",
    "devices",
    "paymentMethods",
    "menuItems",
    "modifierGroups",
  ].includes(variant);

  return (
    <div className="overflow-x-auto py-1">
      <Table aria-label="Loading table">
        <TableHeader>
          <TableRow>
            {headers.map((header, index) => (
              <TableHead
                key={`${header}-${index}`}
                className={cn(index === headers.length - 1 && hasActions && "text-right")}
              >
                {header || <span className="sr-only">Reorder</span>}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: rows }, (_, row) => (
            <TableRow key={row}>
              {headers.map((_, column) => (
                <TableCell key={column}>
                  <Skeleton
                    className={cn(
                      "h-4 bg-muted",
                      column === 0 && "w-32",
                      column === 1 && "w-24",
                      column === 2 && "w-28",
                      column === 3 && "w-20",
                      column === 4 && "w-24",
                      column === 5 && "w-16",
                      column === headers.length - 1 && hasActions && "ml-auto w-8",
                    )}
                  />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
