import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Sidebar from '../Sidebar.jsx';
import SavingOverlay from '../components/SavingOverlay.jsx';
import { api, clearAccessToken } from '../api.js';
import { toLocalIsoDate } from '../lib/localIsoDate.js';

function toIsoDate(d) {
  return toLocalIsoDate(d);
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
  if (pathname.startsWith('/users')) return 'users';
  if (pathname.startsWith('/backups')) return 'backups';
  return 'dashboard';
}

export default function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [user, setUser] = useState(null);

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
            : activeView === 'users'
              ? 'Usuarios'
              : activeView === 'backups'
                ? 'Respaldos'
                : 'Categorías';

  const loadCategories = useCallback(async () => {
    const data = await api('/api/categories');
    setCategories(data.categories || []);
    setCategoryItems(data.category_items || []);
  }, []);

  const currentCalendarMonthRange = useCallback(() => {
    const now = new Date();
    return {
      start: toIsoDate(new Date(now.getFullYear(), now.getMonth(), 1)),
      end: toIsoDate(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
    };
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
    const { start, end } = currentCalendarMonthRange();
    const qs = new URLSearchParams({ start, end }).toString();
    const data = await api(`/api/transactions?${qs}`);
    setMonthlyDetail(data);
  }, [currentCalendarMonthRange]);

  const loadDashboardPageData = useCallback(async () => {
    setError('');
    const { start, end } = periodToRange(dashboardPeriod, dashboardStart, dashboardEnd);
    if (dashboardPeriod === 'date_range') {
      setDashboardStart(start);
      setDashboardEnd(end);
    }
    const monthRange = currentCalendarMonthRange();
    const sameAsCurrentMonth = start === monthRange.start && end === monthRange.end;
    const dashboardQs = new URLSearchParams({ start, end }).toString();

    if (sameAsCurrentMonth) {
      const data = await api(`/api/transactions?${dashboardQs}`);
      setDashboardDetail(data);
      setMonthlyDetail(data);
      return;
    }

    const monthQs = new URLSearchParams({ start: monthRange.start, end: monthRange.end }).toString();
    const [dashboardData, monthlyData] = await Promise.all([
      api(`/api/transactions?${dashboardQs}`),
      api(`/api/transactions?${monthQs}`),
    ]);
    setDashboardDetail(dashboardData);
    setMonthlyDetail(monthlyData);
  }, [dashboardPeriod, dashboardStart, dashboardEnd, currentCalendarMonthRange]);

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
        const me = await api('/api/auth/me');
        const u = me?.user ?? null;
        if (!cancelled) setUser(u);
        if (!u) {
          return;
        }
        await loadCategories();
      } catch (e) {
        if (!cancelled) setError(e.message || 'No se pudo conectar con la API');
      } finally {
        if (!cancelled) {
          setAuthReady(true);
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadCategories]);

  useEffect(() => {
    (async () => {
      if (!authReady) return;
      if (!user) {
        const next = `${location.pathname || '/'}${location.search || ''}`;
        navigate(`/login?next=${encodeURIComponent(next)}`, { replace: true });
        return;
      }
      // Frontend route guard (UX). Backend RBAC is still the source of truth.
      const p = location.pathname || '/';
      if (user.role !== 'admin' && (p.startsWith('/categories') || p.startsWith('/gastos-fijos') || p.startsWith('/users') || p.startsWith('/backups'))) {
        navigate('/dashboard', { replace: true });
      }
    })();
  }, [authReady, user, navigate, location.pathname, location.search]);

  async function onLogout() {
    setError('');
    setLoggingOut(true);
    try {
      setLoading(true);
      await api('/api/auth/logout', { method: 'POST' });
    } catch (e) {
      // ignore
    } finally {
      clearAccessToken();
      setUser(null);
      setLoading(false);
      navigate('/login', { replace: true });
      setLoggingOut(false);
    }
  }

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
      user,
      pendingRecurringFixed,
      reloadDashboard: loadDashboard,
      reloadMonthly: loadMonthly,
      reloadDashboardPageData: loadDashboardPageData,
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
      user,
      pendingRecurringFixed,
      loadDashboard,
      loadMonthly,
      loadDashboardPageData,
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
      users: '/users',
      backups: '/backups',
      incomes: '/incomes',
      expenses: '/expenses',
      categories: '/categories',
    };
    const to = map[id] || '/dashboard';
    navigate(to);
    setSidebarOpen(false);
  }

  if (!authReady) {
    return (
      <div className="app-shell">
        <div className="main-area">
          <div className="main-content">
            <div className="panel">Cargando…</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      {loggingOut ? <SavingOverlay className="ui-app-saving" label="Cerrando sesión…" /> : null}
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
                  : activeView === 'users'
                    ? 'users'
                    : activeView === 'backups'
                      ? 'backups'
                      : 'categorias'
        }
        role={user?.role || 'appuser'}
        user={user}
        onLogout={onLogout}
        onNavigate={onNavigate}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <div className="main-area">
        <header className={`main-header${activeView === 'dashboard' ? ' main-header--dashboard' : ''}`}>
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

        <div className={`main-content ${activeView === 'dashboard' ? 'main-content--wide' : ''}`}>
          {loading && !loggingOut ? <SavingOverlay label="Procesando…" /> : null}
          {error ? <div className="panel error">{error}</div> : null}
          <Outlet context={ctx} />
        </div>
      </div>
    </div>
  );
}

