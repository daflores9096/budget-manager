import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Sidebar from '../Sidebar.jsx';
import { api } from '../api.js';

function toIsoDate(d) {
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function startOfWeekMonday(date) {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun..6=Sat
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

function periodToRange(periodId, customStart, customEnd) {
  const now = new Date();
  const today = toIsoDate(now);
  if (periodId === 'today') return { start: today, end: today };
  if (periodId === 'this_week') {
    const s = startOfWeekMonday(now);
    const e = new Date(s);
    e.setDate(e.getDate() + 6);
    return { start: toIsoDate(s), end: toIsoDate(e) };
  }
  if (periodId === 'last_6_months') {
    const s = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    const e = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return { start: toIsoDate(s), end: toIsoDate(e) };
  }
  if (periodId === 'date_range') {
    return { start: customStart || today, end: customEnd || today };
  }
  // this_month (default)
  const s = new Date(now.getFullYear(), now.getMonth(), 1);
  const e = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { start: toIsoDate(s), end: toIsoDate(e) };
}

function viewFromPath(pathname) {
  if (pathname.startsWith('/incomes')) return 'incomes';
  if (pathname.startsWith('/expenses')) return 'expenses';
  if (pathname.startsWith('/gastos-fijos')) return 'gastos_fijos';
  if (pathname.startsWith('/categories')) return 'categories';
  return 'dashboard';
}

export default function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [categories, setCategories] = useState([]);
  const [categoryItems, setCategoryItems] = useState([]);

  const [dashboardPeriod, setDashboardPeriod] = useState('this_month');
  const [dashboardStart, setDashboardStart] = useState(() => toIsoDate(new Date(new Date().getFullYear(), new Date().getMonth(), 1)));
  const [dashboardEnd, setDashboardEnd] = useState(() => toIsoDate(new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0)));
  const [dashboardDetail, setDashboardDetail] = useState(null);
  const [monthlyDetail, setMonthlyDetail] = useState(null);
  const [pendingRecurringFixed, setPendingRecurringFixed] = useState([]);

  const activeView = useMemo(() => viewFromPath(location.pathname), [location.pathname]);
  const pageTitle =
    activeView === 'dashboard'
      ? 'Dashboard'
      : activeView === 'incomes'
        ? 'Ingresos'
        : activeView === 'expenses'
          ? 'Gastos'
          : activeView === 'gastos_fijos'
            ? 'Gastos fijos'
            : 'Categorías';

  const loadCategories = useCallback(async () => {
    const data = await api('/api/categories');
    setCategories(data.categories || []);
    setCategoryItems(data.category_items || []);
  }, []);

  const loadDashboard = useCallback(async () => {
    setError('');
    const { start, end } = periodToRange(dashboardPeriod, dashboardStart, dashboardEnd);
    if (dashboardPeriod === 'date_range') {
      setDashboardStart(start);
      setDashboardEnd(end);
    }
    const qs = new URLSearchParams({ start, end }).toString();
    const data = await api(`/api/transactions?${qs}`);
    setDashboardDetail(data);
  }, [dashboardPeriod, dashboardStart, dashboardEnd]);

  const loadMonthly = useCallback(async () => {
    // Always current calendar month (ignores dashboard filters)
    const now = new Date();
    const s = new Date(now.getFullYear(), now.getMonth(), 1);
    const e = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const qs = new URLSearchParams({ start: toIsoDate(s), end: toIsoDate(e) }).toString();
    const data = await api(`/api/transactions?${qs}`);
    setMonthlyDetail(data);
  }, []);

  const loadPendingRecurringFixed = useCallback(async () => {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth() + 1;
    const data = await api(`/api/recurring-fixed/pending?year=${y}&month=${m}`);
    setPendingRecurringFixed(data.pending || []);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        await loadCategories();
      } catch (e) {
        if (!cancelled) setError(e.message || 'No se pudo conectar con la API');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadCategories]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        await loadDashboard();
        await loadMonthly();
        await loadPendingRecurringFixed();
      } catch (e) {
        if (!cancelled) setError(e.message || 'Error al cargar el dashboard');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadDashboard, loadMonthly, loadPendingRecurringFixed]);

  const ctx = useMemo(
    () => ({
      error,
      setError,
      loading,
      setLoading,
      sidebarOpen,
      setSidebarOpen,
      categories,
      categoryItems,
      reloadCategories: loadCategories,
      dashboardPeriod,
      setDashboardPeriod,
      dashboardStart,
      setDashboardStart,
      dashboardEnd,
      setDashboardEnd,
      dashboardDetail,
      monthlyDetail,
      pendingRecurringFixed,
      reloadDashboard: loadDashboard,
      reloadMonthly: loadMonthly,
      reloadPendingRecurringFixed: loadPendingRecurringFixed,
    }),
    [
      error,
      loading,
      sidebarOpen,
      categories,
      categoryItems,
      loadCategories,
      dashboardPeriod,
      dashboardStart,
      dashboardEnd,
      dashboardDetail,
      monthlyDetail,
      pendingRecurringFixed,
      loadDashboard,
      loadMonthly,
      loadPendingRecurringFixed,
    ],
  );

  function onNavigate(id) {
    const map = {
      dashboard: '/dashboard',
      ingresos: '/incomes',
      gastos: '/expenses',
      gastos_fijos: '/gastos-fijos',
      categorias: '/categories',
      incomes: '/incomes',
      expenses: '/expenses',
      categories: '/categories',
    };
    const to = map[id] || '/dashboard';
    navigate(to);
    setSidebarOpen(false);
  }

  return (
    <div className="app-shell">
      <Sidebar
        active={
          activeView === 'dashboard'
            ? 'dashboard'
            : activeView === 'incomes'
              ? 'ingresos'
              : activeView === 'expenses'
                ? 'gastos'
                : activeView === 'gastos_fijos'
                  ? 'gastos_fijos'
                  : 'categorias'
        }
        onNavigate={onNavigate}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <div className="main-area">
        {activeView !== 'dashboard' ? (
          <header className="main-header">
            <div className="main-header-left">
              <button type="button" className="header-menu-btn" aria-label="Abrir menú" onClick={() => setSidebarOpen(true)}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                  <path d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              <div>
                <div className="main-title">{pageTitle}</div>
              </div>
            </div>
          </header>
        ) : null}

        <div className={`main-content ${activeView === 'dashboard' ? 'main-content--wide' : ''}`}>
          {error ? <div className="panel error">{error}</div> : null}
          <Outlet context={ctx} />
        </div>
      </div>
    </div>
  );
}

