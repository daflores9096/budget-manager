import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from './api.js';
import Sidebar from './Sidebar.jsx';
import DashboardPage from './DashboardPage.jsx';

const MONTH_NAMES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

function money(n) {
  const v = Number(n) || 0;
  return v.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function summaryClass(remaining) {
  if (remaining > 0) return 'good';
  if (remaining < 0) return 'bad';
  return 'warn';
}

const VIEWS = ['dashboard', 'ingresos', 'gastos'];

export default function App() {
  const [months, setMonths] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [categories, setCategories] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeView, setActiveView] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [newYear, setNewYear] = useState(2026);
  const [newMonth, setNewMonth] = useState(4);

  const loadMonths = useCallback(async () => {
    setError('');
    const data = await api('/api/months');
    setMonths(data.months || []);
    return data.months || [];
  }, []);

  const loadCategories = useCallback(async () => {
    const data = await api('/api/categories');
    setCategories(data.categories || []);
  }, []);

  const loadDetail = useCallback(async (id) => {
    if (!id) {
      setDetail(null);
      return;
    }
    setError('');
    const data = await api(`/api/months/${id}`);
    setDetail(data);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        await loadCategories();
        const list = await loadMonths();
        if (cancelled) return;
        setSelectedId((prev) => prev ?? (list[0]?.id ?? null));
      } catch (e) {
        if (!cancelled) setError(e.message || 'No se pudo conectar con la API');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadCategories, loadMonths]);

  useEffect(() => {
    if (!selectedId) return;
    (async () => {
      try {
        setLoading(true);
        await loadDetail(selectedId);
      } catch (e) {
        setError(e.message || 'Error al cargar el mes');
      } finally {
        setLoading(false);
      }
    })();
  }, [selectedId, loadDetail]);

  const selectedLabel = useMemo(() => {
    const m = months.find((x) => x.id === selectedId);
    if (!m) return '';
    return `${MONTH_NAMES[m.month - 1]} ${m.year}`;
  }, [months, selectedId]);

  const fixed = useMemo(
    () => (detail?.expenses || []).filter((e) => e.type === 'fixed'),
    [detail],
  );
  const variable = useMemo(
    () => (detail?.expenses || []).filter((e) => e.type === 'variable'),
    [detail],
  );

  async function onCreateMonth(e) {
    e.preventDefault();
    setError('');
    try {
      setLoading(true);
      const created = await api('/api/months', { method: 'POST', body: { year: newYear, month: newMonth } });
      await loadMonths();
      setSelectedId(created.id);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function goToView(id) {
    if (!VIEWS.includes(id)) return;
    setActiveView(id);
    setSidebarOpen(false);
  }

  async function onDeleteMonth() {
    if (!selectedId) return;
    if (!window.confirm('¿Eliminar este mes y todos sus movimientos?')) return;
    setError('');
    try {
      setLoading(true);
      await api(`/api/months/${selectedId}`, { method: 'DELETE' });
      const list = await loadMonths();
      setSelectedId(list[0]?.id ?? null);
      setDetail(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const pageTitle =
    activeView === 'dashboard' ? 'Dashboard' : activeView === 'ingresos' ? 'Ingresos' : 'Gastos';

  return (
    <div className="app-shell">
      <Sidebar active={activeView} onNavigate={goToView} open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

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
                {selectedLabel ? <div className="main-subtitle">{selectedLabel}</div> : null}
              </div>
            </div>
            <div className="main-header-actions row">
              <label className="small">
                Mes{' '}
                <select
                  className="select"
                  value={selectedId ?? ''}
                  onChange={(ev) => setSelectedId(Number(ev.target.value))}
                >
                  {months.length === 0 ? (
                    <option value="">Sin meses</option>
                  ) : (
                    months.map((m) => (
                      <option key={m.id} value={m.id}>
                        {MONTH_NAMES[m.month - 1]} {m.year}
                      </option>
                    ))
                  )}
                </select>
              </label>
              <button type="button" className="btn danger" disabled={!selectedId || loading} onClick={onDeleteMonth}>
                Eliminar mes
              </button>
            </div>
          </header>
        ) : null}

        <div className={`main-content ${activeView === 'dashboard' ? 'main-content--wide' : ''}`}>
          {error ? <div className="panel error">{error}</div> : null}

          {activeView === 'dashboard' ? (
            <DashboardPage
              months={months}
              selectedId={selectedId}
              setSelectedId={setSelectedId}
              detail={detail}
              loading={loading}
              newYear={newYear}
              setNewYear={setNewYear}
              newMonth={newMonth}
              setNewMonth={setNewMonth}
              onCreateMonth={onCreateMonth}
              onDeleteMonth={onDeleteMonth}
              money={money}
              summaryClass={summaryClass}
              monthNames={MONTH_NAMES}
              setSidebarOpen={setSidebarOpen}
            />
          ) : null}

          {activeView === 'ingresos' ? (
            detail ? (
              <IncomeSection
                monthId={selectedId}
                items={detail.incomes}
                disabled={loading}
                onChanged={async () => {
                  await loadDetail(selectedId);
                  await loadMonths();
                }}
                setError={setError}
                setLoading={setLoading}
              />
            ) : (
              <section className="panel small">{loading ? 'Cargando…' : 'Crea o elige un mes en el Dashboard para registrar ingresos.'}</section>
            )
          ) : null}

          {activeView === 'gastos' ? (
            detail ? (
              <div className="split">
                <ExpenseSection
                  title="Gastos fijos"
                  type="fixed"
                  monthId={selectedId}
                  items={fixed}
                  categories={categories}
                  disabled={loading}
                  onChanged={async () => {
                    await loadDetail(selectedId);
                    await loadMonths();
                  }}
                  setError={setError}
                  setLoading={setLoading}
                />
                <ExpenseSection
                  title="Gastos variables"
                  type="variable"
                  monthId={selectedId}
                  items={variable}
                  categories={categories}
                  disabled={loading}
                  onChanged={async () => {
                    await loadDetail(selectedId);
                    await loadMonths();
                  }}
                  setError={setError}
                  setLoading={setLoading}
                />
              </div>
            ) : (
              <section className="panel small">{loading ? 'Cargando…' : 'Crea o elige un mes en el Dashboard para registrar gastos.'}</section>
            )
          ) : null}
        </div>
      </div>
    </div>
  );
}

function IncomeSection({ monthId, items, disabled, onChanged, setError, setLoading }) {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');

  async function addIncome(e) {
    e.preventDefault();
    setError('');
    try {
      setLoading(true);
      await api(`/api/months/${monthId}/incomes`, {
        method: 'POST',
        body: { date, description, amount: Number(amount) },
      });
      setDescription('');
      setAmount('');
      await onChanged();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function patchIncome(id, patch) {
    setError('');
    try {
      setLoading(true);
      await api(`/api/incomes/${id}`, { method: 'PATCH', body: patch });
      await onChanged();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function deleteIncome(id) {
    if (!window.confirm('¿Eliminar este ingreso?')) return;
    setError('');
    try {
      setLoading(true);
      await api(`/api/incomes/${id}`, { method: 'DELETE' });
      await onChanged();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="panel">
      <h2>Ingresos</h2>
      <form className="row" style={{ marginBottom: '0.75rem' }} onSubmit={addIncome}>
        <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        <input className="input" style={{ minWidth: '14rem', flex: '1 1 12rem' }} placeholder="Detalle" value={description} onChange={(e) => setDescription(e.target.value)} />
        <input className="input mono" style={{ width: '8rem' }} placeholder="Monto" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} required />
        <button className="btn primary" type="submit" disabled={disabled}>
          Añadir
        </button>
      </form>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Detalle</th>
              <th>Monto</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={4} className="small">
                  Sin ingresos registrados.
                </td>
              </tr>
            ) : (
              items.map((row) => (
                <IncomeRow key={row.id} row={row} disabled={disabled} onPatch={patchIncome} onDelete={deleteIncome} />
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function IncomeRow({ row, disabled, onPatch, onDelete }) {
  const [date, setDate] = useState(row.date);
  const [description, setDescription] = useState(row.description);
  const [amount, setAmount] = useState(String(row.amount));

  useEffect(() => {
    setDate(row.date);
    setDescription(row.description);
    setAmount(String(row.amount));
  }, [row]);

  return (
    <tr>
      <td>
        <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} disabled={disabled} />
      </td>
      <td>
        <input className="input" style={{ width: '100%' }} value={description} onChange={(e) => setDescription(e.target.value)} disabled={disabled} />
      </td>
      <td>
        <input className="input mono" style={{ width: '7rem' }} value={amount} onChange={(e) => setAmount(e.target.value)} disabled={disabled} />
      </td>
      <td className="row" style={{ justifyContent: 'flex-end', gap: '0.35rem' }}>
        <button type="button" className="btn" disabled={disabled} onClick={() => onPatch(row.id, { date, description, amount: Number(amount) })}>
          Guardar
        </button>
        <button type="button" className="btn danger" disabled={disabled} onClick={() => onDelete(row.id)}>
          Borrar
        </button>
      </td>
    </tr>
  );
}

function ExpenseSection({ title, type, monthId, items, categories, disabled, onChanged, setError, setLoading }) {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState('');
  const [expected, setExpected] = useState('');
  const [actual, setActual] = useState('');
  const [category, setCategory] = useState(categories[0] || 'Varios');
  const [paid, setPaid] = useState(false);

  useEffect(() => {
    if (categories.length && !categories.includes(category)) {
      setCategory(categories[0]);
    }
  }, [categories, category]);

  async function addExpense(e) {
    e.preventDefault();
    setError('');
    try {
      setLoading(true);
      const body = {
        type,
        date,
        description,
        category,
        paid: type === 'fixed' ? paid : false,
        actual: Number(actual || 0),
      };
      if (type === 'fixed' && expected !== '') {
        body.expected = Number(expected);
      }
      await api(`/api/months/${monthId}/expenses`, { method: 'POST', body });
      setDescription('');
      setExpected('');
      setActual('');
      setPaid(false);
      await onChanged();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function patchExpense(id, patch) {
    setError('');
    try {
      setLoading(true);
      await api(`/api/expenses/${id}`, { method: 'PATCH', body: patch });
      await onChanged();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function deleteExpense(id) {
    if (!window.confirm('¿Eliminar este gasto?')) return;
    setError('');
    try {
      setLoading(true);
      await api(`/api/expenses/${id}`, { method: 'DELETE' });
      await onChanged();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="panel">
      <h2>{title}</h2>
      <form className="row" style={{ marginBottom: '0.75rem', alignItems: 'flex-end' }} onSubmit={addExpense}>
        <label className="small">
          Fecha
          <br />
          <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </label>
        <label className="small" style={{ flex: '1 1 10rem' }}>
          Detalle
          <br />
          <input className="input" style={{ width: '100%' }} value={description} onChange={(e) => setDescription(e.target.value)} />
        </label>
        {type === 'fixed' ? (
          <label className="small">
            Esperado
            <br />
            <input className="input mono" style={{ width: '7rem' }} inputMode="decimal" value={expected} onChange={(e) => setExpected(e.target.value)} />
          </label>
        ) : null}
        <label className="small">
          {type === 'fixed' ? 'Real' : 'Gasto'}
          <br />
          <input className="input mono" style={{ width: '7rem' }} inputMode="decimal" value={actual} onChange={(e) => setActual(e.target.value)} required={type === 'variable'} />
        </label>
        <label className="small">
          Categoría
          <br />
          <select className="select" value={category} onChange={(e) => setCategory(e.target.value)}>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        {type === 'fixed' ? (
          <label className="small row" style={{ gap: '0.35rem' }}>
            <input type="checkbox" checked={paid} onChange={(e) => setPaid(e.target.checked)} />
            Pagado
          </label>
        ) : null}
        <button className="btn primary" type="submit" disabled={disabled}>
          Añadir
        </button>
      </form>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Detalle</th>
              {type === 'fixed' ? <th>Esperado</th> : null}
              <th>{type === 'fixed' ? 'Real' : 'Gasto'}</th>
              <th>Categoría</th>
              {type === 'fixed' ? <th>Pagado</th> : null}
              <th />
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={type === 'fixed' ? 7 : 5} className="small">
                  Sin registros.
                </td>
              </tr>
            ) : (
              items.map((row) => (
                <ExpenseRow
                  key={row.id}
                  row={row}
                  type={type}
                  categories={categories}
                  disabled={disabled}
                  onPatch={patchExpense}
                  onDelete={deleteExpense}
                />
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ExpenseRow({ row, type, categories, disabled, onPatch, onDelete }) {
  const [date, setDate] = useState(row.date);
  const [description, setDescription] = useState(row.description);
  const [expected, setExpected] = useState(row.expected == null ? '' : String(row.expected));
  const [actual, setActual] = useState(String(row.actual));
  const [category, setCategory] = useState(row.category);
  const [paid, setPaid] = useState(Boolean(row.paid));

  useEffect(() => {
    setDate(row.date);
    setDescription(row.description);
    setExpected(row.expected == null ? '' : String(row.expected));
    setActual(String(row.actual));
    setCategory(row.category);
    setPaid(Boolean(row.paid));
  }, [row]);

  return (
    <tr>
      <td>
        <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} disabled={disabled} />
      </td>
      <td>
        <input className="input" style={{ width: '100%' }} value={description} onChange={(e) => setDescription(e.target.value)} disabled={disabled} />
      </td>
      {type === 'fixed' ? (
        <td>
          <input className="input mono" style={{ width: '6.5rem' }} value={expected} onChange={(e) => setExpected(e.target.value)} disabled={disabled} />
        </td>
      ) : null}
      <td>
        <input className="input mono" style={{ width: '6.5rem' }} value={actual} onChange={(e) => setActual(e.target.value)} disabled={disabled} />
      </td>
      <td>
        <select className="select" value={category} onChange={(e) => setCategory(e.target.value)} disabled={disabled}>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </td>
      {type === 'fixed' ? (
        <td>
          <input type="checkbox" checked={paid} onChange={(e) => setPaid(e.target.checked)} disabled={disabled} />
        </td>
      ) : null}
      <td className="row" style={{ justifyContent: 'flex-end', gap: '0.35rem' }}>
        <button
          type="button"
          className="btn"
          disabled={disabled}
          onClick={() => {
            const patch = { date, description, category, actual: Number(actual || 0) };
            if (type === 'fixed') {
              patch.expected = expected === '' ? null : Number(expected);
              patch.paid = paid;
            }
            onPatch(row.id, patch);
          }}
        >
          Guardar
        </button>
        <button type="button" className="btn danger" disabled={disabled} onClick={() => onDelete(row.id)}>
          Borrar
        </button>
      </td>
    </tr>
  );
}
