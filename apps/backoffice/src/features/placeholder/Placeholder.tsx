import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "ui";

// Stands in for a screen a later area owns. It states that plainly rather than
// drawing a dimmed version of the real thing — record 009's rule against fake
// data in an unbuilt surface still holds. Record 020.
export function Placeholder({ title }: { title: string }) {
  return (
    <div className="p-4">
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>This screen has not been built yet.</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          The route exists so navigation can be used and reviewed. Nothing here is real data.
        </CardContent>
      </Card>
    </div>
  );
}
