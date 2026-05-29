import { useEffect } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import DashboardPage from '../DashboardPage.jsx';

function formatDateLabel(isoDate) {
  if (!isoDate) return '';
  const d = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(d.getTime())) return isoDate;
  return new Intl.DateTimeFormat('es-BO', { month: 'short', day: '2-digit', year: 'numeric' }).format(d);
}

function formatIsoRangeLabel(startIso, endIso) {
  if (!startIso || !endIso) return '';
  return `${formatDateLabel(startIso)} \u2014 ${formatDateLabel(endIso)}`;
}

export default function DashboardRoute() {
  const ctx = useOutletContext();
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        ctx.setError('');
        ctx.setLoading(true);
        await ctx.reloadDashboardPageData();
      } catch (err) {
        if (!cancelled) ctx.setError(err.message || 'Error al cargar el dashboard');
      } finally {
        if (!cancelled) ctx.setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    ctx.reloadDashboardPageData,
    ctx.dashboardPeriod,
    ctx.dashboardStart,
    ctx.dashboardEnd,
    ctx.setError,
    ctx.setLoading,
  ]);

  function openExpensesForCategory(category) {
    const params = new URLSearchParams({ category });
    const start = ctx.dashboardDetail?.range?.start || ctx.dashboardStart;
    const end = ctx.dashboardDetail?.range?.end || ctx.dashboardEnd;
    if (start && end) {
      params.set('start', start);
      params.set('end', end);
    }
    navigate(`/expenses?${params.toString()}`);
  }

  return (
    <DashboardPage
      detail={ctx.dashboardDetail}
      monthlyDetail={ctx.monthlyDetail}
      loading={ctx.loading}
      dashboardPeriod={ctx.dashboardPeriod}
      setDashboardPeriod={ctx.setDashboardPeriod}
      dashboardStart={ctx.dashboardStart}
      setDashboardStart={ctx.setDashboardStart}
      dashboardEnd={ctx.dashboardEnd}
      setDashboardEnd={ctx.setDashboardEnd}
      dashboardRangeLabel={formatIsoRangeLabel}
      money={(n) => (Number(n) || 0).toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      summaryClass={(remaining) => (remaining > 0 ? 'good' : remaining < 0 ? 'bad' : 'warn')}
      monthNames={[]}
      onCategoryClick={openExpensesForCategory}
    />
  );
}

