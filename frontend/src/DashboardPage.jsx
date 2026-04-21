import { useMemo } from 'react';
import {
  Calendar,
  Lightbulb,
  LineChart,
  Menu,
  PieChart,
  PiggyBank,
  Sparkles,
  Wallet,
} from 'lucide-react';

const SHORT_MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

function daysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

function formatPeriodRange(year, month) {
  const d = daysInMonth(year, month);
  return `${SHORT_MONTHS[month - 1]} 1 – ${SHORT_MONTHS[month - 1]} ${d}, ${year}`;
}

function aggregateByCategory(expenses) {
  const map = new Map();
  for (const e of expenses || []) {
    const v = Number(e.actual) || 0;
    if (v <= 0) continue;
    const c = e.category || 'Varios';
    map.set(c, (map.get(c) || 0) + v);
  }
  return [...map.entries()].sort((a, b) => b[1] - a[1]);
}

function dailySpendingSeries(expenses, year, month) {
  const dim = daysInMonth(year, month);
  const arr = Array.from({ length: dim }, () => 0);
  for (const e of expenses || []) {
    if (!e.date) continue;
    const [y, m, d] = e.date.split('-').map(Number);
    if (y !== year || m !== month) continue;
    const day = d - 1;
    if (day >= 0 && day < dim) {
      arr[day] += Number(e.actual) || 0;
    }
  }
  return arr;
}

function sumSpentOnDate(expenses, isoDate) {
  let total = 0;
  for (const e of expenses || []) {
    if (e?.date !== isoDate) continue;
    total += Number(e.actual) || 0;
  }
  return total;
}

function SpendingTrendChart({ series }) {
  const w = 320;
  const h = 110;
  const padL = 36;
  const padR = 8;
  const padT = 10;
  const padB = 28;
  const maxVal = Math.max(1, ...series);
  const innerW = w - padL - padR;
  const innerH = h - padT - padB;
  const n = series.length || 1;
  const points = series.map((v, i) => {
    const x = padL + (i / Math.max(1, n - 1)) * innerW;
    const y = padT + innerH - (v / maxVal) * innerH;
    return `${x},${y}`;
  });
  const polyline = points.join(' ');

  return (
    <div className="dash-chart-wrap" aria-hidden>
      <svg className="dash-chart-svg" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
        <line x1={padL} y1={padT + innerH} x2={w - padR} y2={padT + innerH} stroke="#e5e7eb" strokeWidth="1" />
        <polyline fill="none" stroke="#22c55e" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" points={polyline} />
        {series.map((v, i) => {
          const x = padL + (i / Math.max(1, n - 1)) * innerW;
          const y = padT + innerH - (v / maxVal) * innerH;
          return <circle key={i} cx={x} cy={y} r="3" fill="#22c55e" />;
        })}
        <text x={padL} y={h - 6} fontSize="9" fill="#9ca3af">
          Día del mes (1–{n})
        </text>
      </svg>
    </div>
  );
}

function DonutChart({ rows }) {
  const data = rows
    .filter(([, amt]) => (Number(amt) || 0) > 0)
    .slice(0, 6)
    .map(([name, amt]) => ({ name, amt: Number(amt) || 0 }));
  const total = data.reduce((acc, x) => acc + x.amt, 0);

  const size = 168;
  const stroke = 22;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const cx = size / 2;
  const cy = size / 2;
  const colors = ['#7c3aed', '#a78bfa', '#c4b5fd', '#ddd6fe', '#ede9fe', '#f5f3ff'];

  let offset = 0;
  const segs =
    total > 0
      ? data.map((d, idx) => {
          const frac = d.amt / total;
          const len = Math.max(0, frac * c);
          const dash = `${len} ${Math.max(0, c - len)}`;
          const seg = (
            <circle
              key={d.name}
              cx={cx}
              cy={cy}
              r={r}
              fill="none"
              stroke={colors[idx % colors.length]}
              strokeWidth={stroke}
              strokeDasharray={dash}
              strokeDashoffset={-offset}
              strokeLinecap="butt"
            />
          );
          offset += len;
          return seg;
        })
      : null;

  return (
    <div className="dash-donut">
      <svg className="dash-donut-svg" viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Spending by category">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#ede9fe" strokeWidth={stroke} />
        <g transform={`rotate(-90 ${cx} ${cy})`}>{segs}</g>
        <circle cx={cx} cy={cy} r={r - stroke / 2 + 1} fill="#ffffff" />
      </svg>
      <div className="dash-donut-legend" aria-hidden>
        <span className="dash-donut-dot" />
        <span className="dash-donut-label">{data[0]?.name ?? '—'}</span>
      </div>
    </div>
  );
}

export default function DashboardPage({
  months,
  selectedId,
  setSelectedId,
  detail,
  loading,
  newYear,
  setNewYear,
  newMonth,
  setNewMonth,
  onCreateMonth,
  onDeleteMonth,
  onOpenCreateMonth,
  money,
  summaryClass,
  monthNames,
  setSidebarOpen,
}) {
  const selectedMeta = useMemo(() => months.find((x) => x.id === selectedId), [months, selectedId]);
  const year = selectedMeta?.year;
  const month = selectedMeta?.month;

  const expenses = detail?.expenses || [];
  const expenseCount = expenses.length;
  const categoryRows = useMemo(() => aggregateByCategory(expenses), [expenses]);
  const hasCategorySpend = categoryRows.length > 0;
  const series = useMemo(() => {
    if (!year || !month) return Array.from({ length: 30 }, () => 0);
    return dailySpendingSeries(expenses, year, month);
  }, [expenses, year, month]);

  const totalSpent = detail?.summary?.total_spent ?? 0;
  const totalIncome = detail?.summary?.total_income ?? 0;
  const remaining = detail?.summary?.remaining ?? 0;
  const todayIso = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const todaySpent = useMemo(() => sumSpentOnDate(expenses, todayIso), [expenses, todayIso]);

  const insight = useMemo(() => {
    if (!detail) {
      return {
        title: 'Empieza a registrar',
        body: 'Cuando añadas ingresos y gastos, verás aquí un resumen automático de tu mes y consejos útiles según tus hábitos de gasto.',
      };
    }
    if (expenseCount === 0 && totalIncome === 0) {
      return {
        title: 'Empieza a registrar',
        body: 'Añade ingresos en la sección Ingresos y gastos en Gastos. Este panel mostrará tendencias, totales y alertas cuando tengas datos.',
      };
    }
    if (expenseCount === 0) {
      return {
        title: 'Sin gastos en el periodo',
        body: 'Tienes ingresos registrados. Registra tus gastos para ver la tendencia diaria y el desglose por categoría.',
      };
    }
    if (remaining < 0) {
      return {
        title: 'Atención al flujo',
        body: `En este mes los gastos superan los ingresos por ${money(Math.abs(remaining))}. Revisa gastos variables o ajusta el presupuesto.`,
      };
    }
    if (remaining >= 0 && totalIncome > 0) {
      return {
        title: 'Buen ritmo',
        body: `Llevas un saldo positivo de ${money(remaining)} respecto a tus ingresos. Sigue registrando para mantener el control.`,
      };
    }
    return {
      title: 'Sigue registrando',
      body: 'Cuanto más completo esté tu mes, más claros serán los patrones de gasto y las oportunidades de ahorro.',
    };
  }, [detail, expenseCount, totalIncome, remaining]);

  return (
    <div className="dashboard-page">
      <div className="dashboard-mobile-header">
        <button type="button" className="header-menu-btn header-menu-btn--light" aria-label="Abrir menú" onClick={() => setSidebarOpen(true)}>
          <Menu size={22} strokeWidth={2} aria-hidden />
        </button>
      </div>

      <header className="dashboard-hero">
        <div className="dashboard-hero-top">
          <div className="dashboard-kicker">
            <PiggyBank className="dash-kicker-icon" size={18} strokeWidth={2} aria-hidden />
            <span>Smart personal finance</span>
          </div>
          <div className="dashboard-meta">{expenseCount} expense{expenseCount === 1 ? '' : 's'} saved</div>
        </div>
        <h1 className="dashboard-title">Dashboard</h1>
        <p className="dashboard-subtitle">Month at a glance: categories, daily trend, today&apos;s spending and budget.</p>
      </header>

      <section className="dash-card dash-period-card">
        <div className="dash-period-inner">
          <div>
            <div className="dash-label-upper">Periodo</div>
            <select
              className="dash-select"
              value={selectedId ?? ''}
              onChange={(ev) => setSelectedId(Number(ev.target.value))}
            >
              {months.length === 0 ? (
                <option value="">Sin meses</option>
              ) : (
                months.map((m) => (
                  <option key={m.id} value={m.id}>
                    {monthNames[m.month - 1]} {m.year}
                  </option>
                ))
              )}
            </select>
          </div>
          <div className="dash-period-range">
            {year && month ? (
              <>
                Mostrando: <strong>{formatPeriodRange(year, month)}</strong>
              </>
            ) : (
              <span className="dash-muted">Crea un mes para ver el rango de fechas.</span>
            )}
          </div>
        </div>
        <div className="dash-period-actions">
          <button type="button" className="dash-btn dash-btn--primary" onClick={onOpenCreateMonth} disabled={loading}>
            Crear mes
          </button>
          <button type="button" className="dash-btn dash-btn--ghost" disabled={!selectedId || loading} onClick={onDeleteMonth}>
            Eliminar mes
          </button>
        </div>
      </section>

      {loading && !detail ? (
        <p className="dash-muted dash-loading">Cargando…</p>
      ) : null}

      {detail ? (
        <>
          <div className="dashboard-grid-4">
            <article className="dash-tile dash-tile--white">
              <div className="dash-tile-head">
                <span className="dash-tile-icon dash-tile-icon--muted" aria-hidden>
                  <PieChart size={22} strokeWidth={1.75} />
                </span>
                <h3 className="dash-tile-title">Spending by category</h3>
              </div>
              {!hasCategorySpend ? <p className="dash-tile-empty">No spending yet for this period.</p> : <DonutChart rows={categoryRows} />}
            </article>

            <article className="dash-tile dash-tile--white">
              <div className="dash-tile-head">
                <span className="dash-tile-icon dash-tile-icon--muted" aria-hidden>
                  <LineChart size={22} strokeWidth={1.75} />
                </span>
                <h3 className="dash-tile-title">Spending trend</h3>
              </div>
              <SpendingTrendChart series={series} />
            </article>

            <article className="dash-tile dash-tile--yellow">
              <div className="dash-tile-head">
                <span className="dash-tile-icon dash-tile-icon--amber" aria-hidden>
                  <Calendar size={22} strokeWidth={1.75} />
                </span>
                <h3 className="dash-tile-title">Period total</h3>
              </div>
              <p className="dash-big-number mono">{money(totalSpent)}</p>
              <p className="dash-tile-caption">All expenses between the selected start and end dates.</p>
              <p className="dash-tile-caption dash-tile-caption--today">Today (local date): <span className="mono">{money(todaySpent)}</span></p>
            </article>

            <article className="dash-tile dash-tile--green">
              <div className="dash-tile-head">
                <span className="dash-tile-icon dash-tile-icon--green" aria-hidden>
                  <Wallet size={22} strokeWidth={1.75} />
                </span>
                <h3 className="dash-tile-title">Monthly budget remaining</h3>
              </div>
              <p className={`dash-big-number mono dash-balance dash-balance--${summaryClass(remaining)}`}>{money(remaining)}</p>
              <p className="dash-tile-caption">Always uses this calendar month as your monthly budget.</p>
              <p className="dash-tile-caption">
                Budget: <span className="mono">{money(totalIncome)}</span> • Spent this month: <span className="mono">{money(totalSpent)}</span>
              </p>
            </article>
          </div>

          <section className="dash-insights">
            <div className="dash-insights-head">
              <span className="dash-sparkle" aria-hidden>
                <Sparkles size={20} strokeWidth={2} className="dash-sparkle-icon" />
              </span>
              <div>
                <h2 className="dash-insights-title">Smart insights</h2>
                <p className="dash-insights-sub">Análisis rápido según los datos de este periodo.</p>
              </div>
            </div>
            <div className="dash-insights-body">
              <div className="dash-insights-bulb" aria-hidden>
                <Lightbulb size={22} strokeWidth={1.65} className="dash-insights-bulb-icon" />
              </div>
              <div>
                <h3 className="dash-insights-h3">{insight.title}</h3>
                <p className="dash-insights-text">{insight.body}</p>
              </div>
            </div>
          </section>
        </>
      ) : (
        !loading && (
          <section className="dash-card dash-empty-hint">
            <p className="dash-muted">Crea tu primer mes con el formulario de arriba para empezar a ver el dashboard completo.</p>
          </section>
        )
      )}
    </div>
  );
}
