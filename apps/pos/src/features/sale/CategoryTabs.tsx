import { Button } from "ui";

type Props = {
  categories: { id: string; name: string }[];
  selectedCategoryId: string | null;
  onCategorySelect: (categoryId: string | null) => void;
};

export function CategoryTabs({ categories, selectedCategoryId, onCategorySelect }: Props) {
  return (
    <div
      aria-label="Categories"
      role="group"
      className="flex max-w-full gap-2 overflow-x-auto pb-1"
    >
      <Button
        type="button"
        variant="outline"
        size="sm"
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
          size="sm"
          aria-pressed={selectedCategoryId === category.id}
          onClick={() => onCategorySelect(category.id)}
        >
          {category.name}
        </Button>
      ))}
    </div>
  );
}
