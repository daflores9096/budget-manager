import { CategorySection } from '../sections/LedgerSections.jsx';

export default function CategoriesPage({ ctx }) {
  return (
    <CategorySection
      items={ctx.categoryItems || []}
      disabled={ctx.loading}
      onChanged={async () => {
        await ctx.reloadCategories();
      }}
      setError={ctx.setError}
      setLoading={ctx.setLoading}
    />
  );
}

