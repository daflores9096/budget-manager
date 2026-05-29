import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import { ExpensesUnifiedSection } from '../sections/LedgerSections.jsx';

function validIsoDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''));
}

export default function ExpensesPage({ ctx }) {
  const [params] = useSearchParams();
  const categoryFilter = params.get('category') || 'all';
  const start = params.get('start') || '';
  const end = params.get('end') || '';
  const hasRangeFilter = validIsoDate(start) && validIsoDate(end) && start <= end;
  const [rangeDetail, setRangeDetail] = useState(null);

  const loadRange = useCallback(async () => {
    if (!hasRangeFilter) {
      setRangeDetail(null);
      return null;
    }
    const qs = new URLSearchParams({ start, end }).toString();
    const data = await api(`/api/transactions?${qs}`);
    setRangeDetail(data);
    return data;
  }, [hasRangeFilter, start, end]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        ctx.setError('');
        ctx.setLoading(true);
        if (hasRangeFilter) {
          await Promise.all([loadRange(), ctx.reloadPendingRecurringFixed?.()]);
        } else {
          setRangeDetail(null);
          await Promise.all([ctx.reloadMonthly(), ctx.reloadPendingRecurringFixed?.()]);
        }
      } catch (err) {
        if (!cancelled) ctx.setError(err.message || 'Error al cargar gastos');
      } finally {
        if (!cancelled) ctx.setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ctx.reloadMonthly, ctx.reloadPendingRecurringFixed, ctx.setError, ctx.setLoading, hasRangeFilter, loadRange]);

  const filterSummary = useMemo(() => {
    const parts = [];
    if (categoryFilter !== 'all') parts.push(`Categoría: ${categoryFilter}`);
    if (hasRangeFilter) parts.push(`Periodo: ${start} — ${end}`);
    return parts.join(' · ');
  }, [categoryFilter, hasRangeFilter, start, end]);

  return (
    <ExpensesUnifiedSection
      items={(hasRangeFilter ? rangeDetail?.expenses : ctx.monthlyDetail?.expenses) || []}
      categories={ctx.categories || []}
      disabled={ctx.loading}
      initialCategoryFilter={categoryFilter}
      filterSummary={filterSummary}
      pendingRecurringFixed={ctx.pendingRecurringFixed || []}
      canManageRecurringFixed={ctx.user?.role === 'admin'}
      onChanged={async () => {
        await ctx.reloadMonthly();
        await ctx.reloadDashboard();
        await ctx.reloadPendingRecurringFixed?.();
        await loadRange();
      }}
      setError={ctx.setError}
      setLoading={ctx.setLoading}
    />
  );
}

