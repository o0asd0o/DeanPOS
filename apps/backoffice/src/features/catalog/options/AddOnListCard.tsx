import {
  Button,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "ui";
import { ArchiveIcon, EllipsisVerticalIcon, PencilIcon, RotateCcwIcon } from "lucide-react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import type { UsageFilter } from "@/components/ListToolbar.tsx";
import { ListToolbar } from "@/components/ListToolbar.tsx";
import { formatDelta, getAddOnSignals, type AddOnOutput } from "./helpers.ts";

export function AddOnListCard({
  addOns,
  canMutate,
  onEdit,
  onArchive,
  onReactivate,
}: {
  addOns: AddOnOutput[] | undefined;
  canMutate: boolean;
  onEdit: (addOn: AddOnOutput) => void;
  onArchive: (addOn: AddOnOutput) => void;
  onReactivate: (addOn: AddOnOutput) => void;
}) {
  const { usage: status, q: query } = useSearch({ from: "/_shell/add-ons" });
  const navigate = useNavigate();
  const setSearch = (next: { usage: UsageFilter; q: string }) =>
    navigate({ to: "/add-ons", search: next, replace: true });
  const term = query.trim().toLowerCase();
  const visible = (addOns ?? []).filter(
    (addOn) =>
      (status === "all" ||
        (status === "unused" && getAddOnSignals(addOn).unused) ||
        (status === "inuse" && !getAddOnSignals(addOn).unused && !addOn.archivedAt) ||
        (status === "needsattention" && addOn.archivedAt !== null)) &&
      (term === "" || addOn.name.toLowerCase().includes(term)),
  );
  return (
    <Card className="gap-4">
      <CardContent className="flex flex-col gap-4">
        <ListToolbar
          status={status}
          onStatusChange={(next) => setSearch({ usage: next, q: query })}
          query={query}
          onQueryChange={(next) => setSearch({ usage: status, q: next })}
          searchLabel="Search add-ons"
          searchExample="Extra rice"
          variant="usage"
        />
        <div className="overflow-x-auto py-1">
          <Table aria-label="Add-ons">
            <TableHeader>
              <TableRow>
                <TableHead>Add-on</TableHead>
                <TableHead>Delta type</TableHead>
                <TableHead>Value</TableHead>
                <TableHead>Max qty</TableHead>
                <TableHead>Linked variants</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((addOn) => (
                <TableRow key={addOn.id}>
                  <TableCell className="font-medium">
                    {addOn.name}
                    {getAddOnSignals(addOn).unused ? (
                      <span className="ml-2 text-status-warning-foreground">Offered nowhere</span>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    {addOn.delta.kind === "absolute" ? "Absolute" : "Multiplier"}
                  </TableCell>
                  <TableCell>{formatDelta(addOn.delta)}</TableCell>
                  <TableCell>{addOn.maximum ?? "Unlimited"}</TableCell>
                  <TableCell>{addOn.linkedToCount}</TableCell>
                  <TableCell className="text-right">
                    {canMutate ? (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className="tap-target"
                            aria-label={`Actions for ${addOn.name}`}
                          >
                            <EllipsisVerticalIcon />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="end"
                          onCloseAutoFocus={(event) => event.preventDefault()}
                        >
                          {addOn.archivedAt ? (
                            <DropdownMenuItem onSelect={() => onReactivate(addOn)}>
                              <RotateCcwIcon />
                              Reactivate
                            </DropdownMenuItem>
                          ) : (
                            <>
                              <DropdownMenuItem onSelect={() => onEdit(addOn)}>
                                <PencilIcon />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onSelect={() => onArchive(addOn)}
                              >
                                <ArchiveIcon />
                                Archive
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
