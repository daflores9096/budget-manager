import { IncomeSection } from '../sections/LedgerSections.jsx';

export default function IncomesPage({ ctx }) {
  return (
    <IncomeSection
      items={ctx.monthlyDetail?.incomes || []}
      disabled={ctx.loading}
      onChanged={async () => {
        await ctx.reloadMonthly();
        await ctx.reloadDashboard();
      }}
      setError={ctx.setError}
      setLoading={ctx.setLoading}
    />
  );
}

