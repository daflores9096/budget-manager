import { ExpensesUnifiedSection } from '../sections/LedgerSections.jsx';

export default function ExpensesPage({ ctx }) {
  return (
    <ExpensesUnifiedSection
      items={ctx.monthlyDetail?.expenses || []}
      categories={ctx.categories || []}
      disabled={ctx.loading}
      pendingRecurringFixed={ctx.pendingRecurringFixed || []}
      onChanged={async () => {
        await ctx.reloadMonthly();
        await ctx.reloadDashboard();
        await ctx.reloadPendingRecurringFixed?.();
      }}
      setError={ctx.setError}
      setLoading={ctx.setLoading}
    />
  );
}

