import { Button } from "ui";

type Props = {
  categories: { id: string; name: string }[];
  selectedCategoryId: string | null;
  onCategorySelect: (categoryId: string | null) => void;
};

export function CategoryTabs({ categories, selectedCategoryId, onCategorySelect }: Props) {
  return (
    <div aria-label="Categories" role="group" className="flex min-w-0 flex-1 gap-2 overflow-x-auto">
      <Button
        type="button"
        variant="outline"
        className="h-12 shrink-0 px-5 text-base"
        aria-pressed={selectedCategoryId === null}
        onClick={() => onCategorySelect(null)}
      >
        All
      </Button>
      {categories.map((category) => (
        <Button
          key={category.id}
          type="button"
          variant="outline"
          className="h-12 shrink-0 px-5 text-base"
          aria-pressed={selectedCategoryId === category.id}
          onClick={() => onCategorySelect(category.id)}
        >
          {category.name}
        </Button>
      ))}
    </div>
  );
}
