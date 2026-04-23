import { useMemo, useState } from 'react';
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

function polar(cx, cy, rad, ang) {
  return [cx + rad * Math.cos(ang), cy + rad * Math.sin(ang)];
}

/** Donut slice from angle a0 to a1 (radians), clockwise, y-down SVG coords. */
function donutSlicePath(cx, cy, rInner, rOuter, a0, a1) {
  if (a1 - a0 < 0.0001) return '';
  const large = a1 - a0 > Math.PI ? 1 : 0;
  const [x0, y0] = polar(cx, cy, rOuter, a0);
  const [x1, y1] = polar(cx, cy, rOuter, a1);
  const [x2, y2] = polar(cx, cy, rInner, a1);
  const [x3, y3] = polar(cx, cy, rInner, a0);
  return `M ${x0} ${y0} A ${rOuter} ${rOuter} 0 ${large} 1 ${x1} ${y1} L ${x2} ${y2} A ${rInner} ${rInner} 0 ${large} 0 ${x3} ${y3} Z`;
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

function spendingTrendDayIso(year, month, dayIndex) {
  const d = dayIndex + 1;
  return `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function formatTrendDayLabel(iso) {
  const dt = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(dt.getTime())) return iso;
  return new Intl.DateTimeFormat('es-BO', { weekday: 'short', day: 'numeric', month: 'short' }).format(dt);
}

function SpendingTrendChart({ series, year, month, money }) {
  const [tip, setTip] = useState(null);

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
  const step = n > 1 ? innerW / (n - 1) : innerW;

  const points = series.map((v, i) => {
    const x = padL + i * step;
    const y = padT + innerH - (v / maxVal) * innerH;
    return `${x},${y}`;
  });
  const polyline = points.join(' ');

  return (
    <div className="dash-chart-wrap">
      <svg
        className="dash-chart-svg"
        viewBox={`0 0 ${w} ${h}`}
        preserveAspectRatio="none"
        role="img"
        aria-label="Tendencia de gasto por día"
        onMouseLeave={() => setTip(null)}
      >
        <line x1={padL} y1={padT + innerH} x2={w - padR} y2={padT + innerH} stroke="#e5e7eb" strokeWidth="1" />
        <polyline fill="none" stroke="#22c55e" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" points={polyline} />
        {tip ? (
          <line
            x1={tip.chartX}
            y1={padT}
            x2={tip.chartX}
            y2={padT + innerH}
            stroke="#94a3b8"
            strokeWidth="1"
            strokeDasharray="3 3"
            pointerEvents="none"
          />
        ) : null}
        {series.map((v, i) => {
          const cx = padL + i * step;
          const y = padT + innerH - (v / maxVal) * innerH;
          const iso = spendingTrendDayIso(year, month, i);
          const bandW = Math.max(step, 10);
          return (
            <g key={i}>
              <circle cx={cx} cy={y} r="4" fill="#22c55e" stroke="#ffffff" strokeWidth="1" className="dash-trend-dot">
                <title>{`${formatTrendDayLabel(iso)}: ${money(v)}`}</title>
              </circle>
              <rect
                x={cx - bandW / 2}
                y={padT}
                width={bandW}
                height={innerH}
                fill="transparent"
                className="dash-trend-hit"
                onMouseEnter={(e) => {
                  setTip({
                    chartX: cx,
                    x: e.clientX,
                    y: e.clientY,
                    iso,
                    amount: v,
                    dayLabel: formatTrendDayLabel(iso),
                  });
                }}
                onMouseMove={(e) => {
                  setTip({
                    chartX: cx,
                    x: e.clientX,
                    y: e.clientY,
                    iso,
                    amount: v,
                    dayLabel: formatTrendDayLabel(iso),
                  });
                }}
              />
            </g>
          );
        })}
        <text x={padL} y={h - 6} fontSize="9" fill="#9ca3af">
          Día del mes (1–{n})
        </text>
      </svg>
      {tip ? (
        <div className="dash-donut-tooltip dash-trend-tooltip" style={{ left: tip.x, top: tip.y }} role="status" aria-live="polite">
          <span className="dash-donut-tooltip-name">{tip.dayLabel}</span>
          <span className="dash-donut-tooltip-amt mono">{money(tip.amount)}</span>
        </div>
      ) : null}
    </div>
  );
}

function DonutChart({ rows, money }) {
  const [tip, setTip] = useState(null);

  const size = 168;
  const stroke = 22;
  const cx = size / 2;
  const cy = size / 2;
  const rMid = (size - stroke) / 2;
  const rOuter = rMid + stroke / 2;
  const rInner = Math.max(8, rMid - stroke / 2);
  const colors = ['#7c3aed', '#a78bfa', '#c4b5fd', '#ddd6fe', '#ede9fe', '#f5f3ff'];

  const slices = useMemo(() => {
    const data = rows
      .filter(([, amt]) => (Number(amt) || 0) > 0)
      .slice(0, 6)
      .map(([name, amt]) => ({ name, amt: Number(amt) || 0 }));
    const total = data.reduce((acc, x) => acc + x.amt, 0);
    if (total <= 0) return { data, total: 0, items: [] };
    let a = 0;
    const items = data.map((d, idx) => {
      const sweep = (d.amt / total) * 2 * Math.PI;
      const a0 = a;
      const a1 = a + sweep;
      a = a1;
      return {
        ...d,
        idx,
        a0,
        a1,
        path: donutSlicePath(cx, cy, rInner, rOuter, a0, a1),
        color: colors[idx % colors.length],
      };
    });
    return { data, total, items };
  }, [rows]);

  const { data, total, items } = slices;

  return (
    <div className="dash-donut">
      <svg
        className="dash-donut-svg"
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-label="Spending by category"
        onMouseLeave={() => setTip(null)}
      >
        <circle cx={cx} cy={cy} r={(rInner + rOuter) / 2} fill="none" stroke="#ede9fe" strokeWidth={rOuter - rInner} />
        <g transform={`rotate(-90 ${cx} ${cy})`}>
          {total > 0
            ? items.map((seg) => (
                <path
                  key={`${seg.idx}-${seg.name}`}
                  d={seg.path}
                  fill={seg.color}
                  stroke="#ffffff"
                  strokeWidth="1"
                  strokeLinejoin="round"
                  className="dash-donut-seg"
                  onMouseEnter={(e) => {
                    setTip({ name: seg.name, amt: seg.amt, x: e.clientX, y: e.clientY });
                  }}
                  onMouseMove={(e) => {
                    setTip({ name: seg.name, amt: seg.amt, x: e.clientX, y: e.clientY });
                  }}
                >
                  <title>{`${seg.name}: ${money(seg.amt)}`}</title>
                </path>
              ))
            : null}
        </g>
        <circle cx={cx} cy={cy} r={rInner - 1} fill="#ffffff" />
      </svg>
      {tip ? (
        <div
          className="dash-donut-tooltip"
          style={{ left: tip.x, top: tip.y }}
          role="status"
          aria-live="polite"
        >
          <span className="dash-donut-tooltip-name">{tip.name}</span>
          <span className="dash-donut-tooltip-amt mono">{money(tip.amt)}</span>
        </div>
      ) : null}
      <div className="dash-donut-legend" aria-hidden>
        <span className="dash-donut-dot" />
        <span className="dash-donut-label">{data[0]?.name ?? '—'}</span>
      </div>
    </div>
  );
}

export default function DashboardPage({
  detail,
  monthlyDetail,
  loading,
  dashboardPeriod,
  setDashboardPeriod,
  dashboardStart,
  setDashboardStart,
  dashboardEnd,
  setDashboardEnd,
  dashboardRangeLabel,
  money,
  summaryClass,
  monthNames,
  setSidebarOpen,
}) {
  const expenses = detail?.expenses || [];
  const expenseCount = expenses.length;
  const categoryRows = useMemo(() => aggregateByCategory(expenses), [expenses]);
  const hasCategorySpend = categoryRows.length > 0;
  const spendingTrend = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    return {
      year,
      month,
      series: dailySpendingSeries(expenses, year, month),
    };
  }, [expenses]);

  const totalSpent = detail?.summary?.total_spent ?? 0;
  const totalIncome = detail?.summary?.total_income ?? 0;
  const remaining = detail?.summary?.remaining ?? 0;

  const monthTotalSpent = monthlyDetail?.summary?.total_spent ?? 0;
  const monthTotalIncome = monthlyDetail?.summary?.total_income ?? 0;
  const monthRemaining = (Number(monthTotalIncome) || 0) - (Number(monthTotalSpent) || 0);

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
            <select className="dash-select" value={dashboardPeriod} onChange={(e) => setDashboardPeriod(e.target.value)}>
              <option value="today">Today (daily)</option>
              <option value="this_week">This week</option>
              <option value="this_month">This month</option>
              <option value="last_6_months">Last 6 months</option>
              <option value="date_range">Date range</option>
            </select>
          </div>
          <div className="dash-period-range">
            Showing: <strong>{dashboardRangeLabel?.(detail?.range?.start ?? dashboardStart, detail?.range?.end ?? dashboardEnd)}</strong>
          </div>
        </div>
        {dashboardPeriod === 'date_range' ? (
          <div className="dash-period-actions" style={{ justifyContent: 'flex-start' }}>
            <div style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap' }}>
              <label className="dash-muted">
                Start{' '}
                <input className="dash-select dash-select--sm" type="date" value={dashboardStart} onChange={(e) => setDashboardStart(e.target.value)} />
              </label>
              <label className="dash-muted">
                End{' '}
                <input className="dash-select dash-select--sm" type="date" value={dashboardEnd} onChange={(e) => setDashboardEnd(e.target.value)} />
              </label>
            </div>
          </div>
        ) : null}
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
              {!hasCategorySpend ? <p className="dash-tile-empty">No spending yet for this period.</p> : <DonutChart rows={categoryRows} money={money} />}
            </article>

            <article className="dash-tile dash-tile--white">
              <div className="dash-tile-head">
                <span className="dash-tile-icon dash-tile-icon--muted" aria-hidden>
                  <LineChart size={22} strokeWidth={1.75} />
                </span>
                <h3 className="dash-tile-title">Spending trend</h3>
              </div>
              <SpendingTrendChart series={spendingTrend.series} year={spendingTrend.year} month={spendingTrend.month} money={money} />
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

            <article className="dash-tile dash-tile--white">
              <div className="dash-tile-head">
                <span className="dash-tile-icon dash-tile-icon--muted" aria-hidden>
                  <PiggyBank size={22} strokeWidth={1.75} />
                </span>
                <h3 className="dash-tile-title">Monthly budget total</h3>
              </div>
              <p className="dash-big-number mono">{money(monthTotalIncome)}</p>
              <p className="dash-tile-caption">Always uses this calendar month (does not change with filters).</p>
            </article>

            <article className="dash-tile dash-tile--green">
              <div className="dash-tile-head">
                <span className="dash-tile-icon dash-tile-icon--green" aria-hidden>
                  <Wallet size={22} strokeWidth={1.75} />
                </span>
                <h3 className="dash-tile-title">Monthly budget remaining</h3>
              </div>
              <p className={`dash-big-number mono dash-balance dash-balance--${summaryClass(monthRemaining)}`}>{money(monthRemaining)}</p>
              <p className="dash-tile-caption">Always uses this calendar month as your monthly budget.</p>
              <p className="dash-tile-caption">
                Budget: <span className="mono">{money(monthTotalIncome)}</span> • Spent this month: <span className="mono">{money(monthTotalSpent)}</span>
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
