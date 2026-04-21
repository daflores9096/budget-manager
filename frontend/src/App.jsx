import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, Save, X } from 'lucide-react';
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

function formatDateLabel(isoDate) {
  if (!isoDate) return '';
  const d = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(d.getTime())) return isoDate;
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: '2-digit', year: 'numeric' }).format(d);
}

function summaryClass(remaining) {
  if (remaining > 0) return 'good';
  if (remaining < 0) return 'bad';
  return 'warn';
}

const VIEWS = ['dashboard', 'ingresos', 'gastos', 'categorias'];

function Modal({ open, title, children, onClose }) {
  if (!open) return null;
  return (
    <div className="ui-modal" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" className="ui-modal-backdrop" aria-label="Close modal" onClick={onClose} />
      <div className="ui-modal-card">
        <div className="ui-modal-head">
          <div className="ui-modal-title">{title}</div>
          <button type="button" className="ui-icon-btn" aria-label="Close" onClick={onClose}>
            <X size={18} strokeWidth={2.2} aria-hidden />
          </button>
        </div>
        <div className="ui-modal-body">{children}</div>
      </div>
    </div>
  );
}

export default function App() {
  const [months, setMonths] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [categories, setCategories] = useState([]);
  const [categoryItems, setCategoryItems] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeView, setActiveView] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [newYear, setNewYear] = useState(2026);
  const [newMonth, setNewMonth] = useState(4);
  const [createMonthOpen, setCreateMonthOpen] = useState(false);

  const loadMonths = useCallback(async () => {
    setError('');
    const data = await api('/api/months');
    setMonths(data.months || []);
    return data.months || [];
  }, []);

  const loadCategories = useCallback(async () => {
    const data = await api('/api/categories');
    setCategories(data.categories || []);
    setCategoryItems(data.category_items || []);
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
      setCreateMonthOpen(false);
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
    activeView === 'dashboard'
      ? 'Dashboard'
      : activeView === 'ingresos'
        ? 'Ingresos'
        : activeView === 'gastos'
          ? 'Gastos'
          : 'Categorías';

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
              <button type="button" className="btn primary" onClick={() => setCreateMonthOpen(true)}>
                Crear mes
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
              onOpenCreateMonth={() => setCreateMonthOpen(true)}
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
              <ExpensesUnifiedSection
                monthId={selectedId}
                items={detail.expenses}
                categories={categories}
                disabled={loading}
                onChanged={async () => {
                  await loadDetail(selectedId);
                  await loadMonths();
                }}
                setError={setError}
                setLoading={setLoading}
              />
            ) : (
              <section className="panel small">{loading ? 'Cargando…' : 'Crea o elige un mes en el Dashboard para registrar gastos.'}</section>
            )
          ) : null}

          {activeView === 'categorias' ? (
            <CategorySection
              items={categoryItems}
              disabled={loading}
              onChanged={async () => {
                await loadCategories();
                await loadDetail(selectedId);
              }}
              setError={setError}
              setLoading={setLoading}
            />
          ) : null}
        </div>

        <Modal
          open={createMonthOpen}
          title="Crear mes"
          onClose={() => setCreateMonthOpen(false)}
        >
          <form className="ui-form-grid ui-form-grid--cats" onSubmit={onCreateMonth}>
            <label className="ui-field">
              <span className="ui-label">Año</span>
              <input className="ui-input mono" inputMode="numeric" value={newYear} onChange={(e) => setNewYear(Number(e.target.value || 0))} />
            </label>
            <label className="ui-field">
              <span className="ui-label">Mes</span>
              <select className="ui-input" value={newMonth} onChange={(e) => setNewMonth(Number(e.target.value))}>
                {MONTH_NAMES.map((name, idx) => (
                  <option key={name} value={idx + 1}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
            <div className="ui-actions ui-actions--end ui-field--full">
              <button className="ui-btn ui-btn--ghost" type="button" onClick={() => setCreateMonthOpen(false)}>
                Cancelar
              </button>
              <button className="ui-btn ui-btn--primary" type="submit">
                <span className="ui-btn-icon" aria-hidden>
                  <Plus size={18} strokeWidth={2.2} />
                </span>
                Crear
              </button>
            </div>
          </form>
        </Modal>
      </div>
    </div>
  );
}

function CategorySection({ items, disabled, onChanged, setError, setLoading }) {
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [name, setName] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState('');

  const sorted = useMemo(() => {
    const arr = [...(items || [])];
    arr.sort((a, b) => String(a.name).localeCompare(String(b.name), 'es'));
    return arr;
  }, [items]);

  async function createCategory(e) {
    e.preventDefault();
    setError('');
    try {
      setLoading(true);
      await api('/api/categories', { method: 'POST', body: { name } });
      setName('');
      setCreateOpen(false);
      await onChanged();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function saveEdit(id) {
    setError('');
    try {
      setLoading(true);
      await api(`/api/categories/${id}`, { method: 'PATCH', body: { name: editingName } });
      setEditingId(null);
      setEditingName('');
      setEditOpen(false);
      await onChanged();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function deleteCategory(id, currentName) {
    if (!window.confirm(`¿Eliminar la categoría "${currentName}"? Los gastos con esa categoría pasarán a "Varios".`)) return;
    setError('');
    try {
      setLoading(true);
      await api(`/api/categories/${id}`, { method: 'DELETE' });
      await onChanged();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="ui-stack">
      <section className="ui-card">
        <div className="ui-card-head ui-card-head--split">
          <div>
            <div className="ui-card-title">Categorías</div>
            <div className="ui-card-sub">Gestiona las categorías disponibles para gastos.</div>
          </div>
          <div className="ui-actions">
            <button className="ui-btn ui-btn--primary" type="button" onClick={() => setCreateOpen(true)}>
              <span className="ui-btn-icon" aria-hidden>
                <Plus size={18} strokeWidth={2.2} />
              </span>
              Agregar
            </button>
          </div>
        </div>
      </section>

      <section className="ui-card">
        <div className="ui-table-wrap">
          <table className="ui-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th style={{ width: '160px' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 ? (
                <tr>
                  <td colSpan={2} className="ui-muted">
                    Sin categorías.
                  </td>
                </tr>
              ) : (
                sorted.map((row) => {
                  return (
                    <tr key={row.id}>
                      <td>
                        <span className="ui-strong">{row.name}</span>
                      </td>
                      <td>
                        <div className="ui-row ui-row--end">
                          <button
                            className="ui-icon-btn"
                            type="button"
                            disabled={disabled}
                            aria-label="Editar"
                            onClick={() => {
                              setEditingId(row.id);
                              setEditingName(row.name);
                              setEditOpen(true);
                            }}
                          >
                            <Pencil size={16} strokeWidth={2.2} aria-hidden />
                          </button>
                          <button
                            className="ui-icon-btn ui-icon-btn--danger"
                            type="button"
                            disabled={disabled}
                            aria-label="Eliminar"
                            onClick={() => deleteCategory(row.id, row.name)}
                          >
                            <Trash2 size={16} strokeWidth={2.2} aria-hidden />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      <Modal
        open={createOpen}
        title="Agregar categoría"
        onClose={() => {
          setCreateOpen(false);
          setName('');
        }}
      >
        <form className="ui-form-grid ui-form-grid--cats" onSubmit={createCategory}>
          <label className="ui-field">
            <span className="ui-label">Nombre</span>
            <input className="ui-input" placeholder="Ej. Alimentación..." value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <div className="ui-actions ui-actions--end">
            <button className="ui-btn ui-btn--ghost" type="button" onClick={() => setCreateOpen(false)}>
              Cancelar
            </button>
            <button className="ui-btn ui-btn--primary" type="submit">
              <span className="ui-btn-icon" aria-hidden>
                <Plus size={18} strokeWidth={2.2} />
              </span>
              Agregar
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={editOpen}
        title="Editar categoría"
        onClose={() => {
          setEditOpen(false);
          setEditingId(null);
          setEditingName('');
        }}
      >
        <form
          className="ui-form-grid ui-form-grid--cats"
          onSubmit={(e) => {
            e.preventDefault();
            if (!editingId) return;
            saveEdit(editingId);
          }}
        >
          <label className="ui-field">
            <span className="ui-label">Nombre</span>
            <input className="ui-input" value={editingName} onChange={(e) => setEditingName(e.target.value)} />
          </label>
          <div className="ui-actions ui-actions--end">
            <button className="ui-btn ui-btn--ghost" type="button" onClick={() => setEditOpen(false)}>
              Cancelar
            </button>
            <button className="ui-btn ui-btn--primary" type="submit">
              <span className="ui-btn-icon" aria-hidden>
                <Save size={18} strokeWidth={2.2} />
              </span>
              Guardar
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function IncomeSection({ monthId, items, disabled, onChanged, setError, setLoading }) {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [title, setTitle] = useState('');
  const [detail, setDetail] = useState('');
  const [amount, setAmount] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingRow, setEditingRow] = useState(null);

  const [query, setQuery] = useState('');
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = items || [];
    if (!q) return base;
    return base.filter((x) => `${x.description || ''}`.toLowerCase().includes(q));
  }, [items, query]);

  const pages = Math.max(1, Math.ceil(filtered.length / rowsPerPage));
  const currentPage = Math.min(page, pages);
  const start = (currentPage - 1) * rowsPerPage;
  const paged = filtered.slice(start, start + rowsPerPage);

  useEffect(() => {
    setPage(1);
  }, [query, rowsPerPage]);

  async function addIncome(e) {
    e.preventDefault();
    setError('');
    try {
      setLoading(true);
      const description = [title.trim(), detail.trim()].filter(Boolean).join(' — ');
      await api(`/api/months/${monthId}/incomes`, {
        method: 'POST',
        body: { date, description, amount: Number(amount) },
      });
      setTitle('');
      setDetail('');
      setAmount('');
      setCreateOpen(false);
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
    <div className="ui-stack">
      <section className="ui-card">
        <div className="ui-card-head ui-card-head--split">
          <div>
            <div className="ui-card-title">Incomes</div>
            <div className="ui-card-sub">Add and manage incomes for the selected month.</div>
          </div>
          <div className="ui-actions">
            <button className="ui-btn ui-btn--primary" type="button" onClick={() => setCreateOpen(true)}>
              <span className="ui-btn-icon" aria-hidden>
                <Plus size={18} strokeWidth={2.2} />
              </span>
              Agregar
            </button>
          </div>
        </div>
      </section>

      <section className="ui-card">
        <div className="ui-card-head ui-card-head--split">
          <div>
            <div className="ui-card-title">History</div>
            <div className="ui-card-sub">Search title &amp; detail</div>
          </div>
          <div className="ui-toolbar">
            <label className="ui-field ui-field--toolbar">
              <span className="ui-label">Search</span>
              <input className="ui-input ui-input--sm" placeholder="Search..." value={query} onChange={(e) => setQuery(e.target.value)} />
            </label>
            <label className="ui-field ui-field--toolbar">
              <span className="ui-label">Rows per page</span>
              <select className="ui-input ui-input--sm" value={rowsPerPage} onChange={(e) => setRowsPerPage(Number(e.target.value))}>
                {[5, 10, 20, 50].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <div className="ui-table-wrap">
          <table className="ui-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Detail</th>
                <th>Date</th>
                <th className="ui-th-right">Amount</th>
                <th className="ui-th-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paged.length === 0 ? (
                <tr>
                  <td colSpan={5} className="ui-muted">
                    No items.
                  </td>
                </tr>
              ) : (
                paged.map((row) => (
                  <LedgerRow
                    key={row.id}
                    kind="income"
                    row={row}
                    disabled={disabled}
                    onDelete={() => deleteIncome(row.id)}
                    onEdit={() => {
                      setEditingRow(row);
                      const parts = String(row.description || '').split('—').map((s) => s.trim());
                      setTitle(parts[0] || '');
                      setDetail(parts.slice(1).join(' — ').trim());
                      setDate(row.date);
                      setAmount(String(row.amount));
                      setEditOpen(true);
                    }}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="ui-pagination">
          <div className="ui-muted">
            Showing {filtered.length === 0 ? 0 : start + 1}–{Math.min(start + rowsPerPage, filtered.length)} of {filtered.length}
          </div>
          <div className="ui-row ui-row--end">
            <button className="ui-btn ui-btn--sm ui-btn--ghost" type="button" disabled={currentPage <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
              ‹ Previous
            </button>
            <div className="ui-page">Page {currentPage} of {pages}</div>
            <button className="ui-btn ui-btn--sm ui-btn--ghost" type="button" disabled={currentPage >= pages} onClick={() => setPage((p) => Math.min(pages, p + 1))}>
              Next ›
            </button>
          </div>
        </div>
      </section>

      <Modal
        open={createOpen}
        title="Agregar ingreso"
        onClose={() => {
          setCreateOpen(false);
          setTitle('');
          setDetail('');
          setAmount('');
        }}
      >
        <form className="ui-form-grid ui-form-grid--ledger" onSubmit={addIncome}>
          <label className="ui-field">
            <span className="ui-label">Amount</span>
            <input className="ui-input mono" inputMode="decimal" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </label>
          <label className="ui-field ui-field--grow">
            <span className="ui-label">Income title</span>
            <input className="ui-input" placeholder="e.g. Salary, refund..." value={title} onChange={(e) => setTitle(e.target.value)} />
          </label>
          <label className="ui-field">
            <span className="ui-label">Date</span>
            <input className="ui-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <label className="ui-field ui-field--full">
            <span className="ui-label">Income detail</span>
            <textarea className="ui-textarea" placeholder="Optional notes, line items, or context..." value={detail} onChange={(e) => setDetail(e.target.value)} />
          </label>
          <div className="ui-actions ui-actions--end ui-field--full">
            <button className="ui-btn ui-btn--ghost" type="button" onClick={() => setCreateOpen(false)}>
              Cancelar
            </button>
            <button className="ui-btn ui-btn--primary" type="submit">
              <span className="ui-btn-icon" aria-hidden>
                <Plus size={18} strokeWidth={2.2} />
              </span>
              Agregar
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={editOpen}
        title="Editar ingreso"
        onClose={() => {
          setEditOpen(false);
          setEditingRow(null);
        }}
      >
        <form
          className="ui-form-grid ui-form-grid--ledger"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!editingRow) return;
            const description = [title.trim(), detail.trim()].filter(Boolean).join(' — ');
            await patchIncome(editingRow.id, { date, description, amount: Number(amount) });
            setEditOpen(false);
            setEditingRow(null);
          }}
        >
          <label className="ui-field">
            <span className="ui-label">Amount</span>
            <input className="ui-input mono" inputMode="decimal" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </label>
          <label className="ui-field ui-field--grow">
            <span className="ui-label">Income title</span>
            <input className="ui-input" value={title} onChange={(e) => setTitle(e.target.value)} />
          </label>
          <label className="ui-field">
            <span className="ui-label">Date</span>
            <input className="ui-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <label className="ui-field ui-field--full">
            <span className="ui-label">Income detail</span>
            <textarea className="ui-textarea" value={detail} onChange={(e) => setDetail(e.target.value)} />
          </label>
          <div className="ui-actions ui-actions--end ui-field--full">
            <button className="ui-btn ui-btn--ghost" type="button" onClick={() => setEditOpen(false)}>
              Cancelar
            </button>
            <button className="ui-btn ui-btn--primary" type="submit">
              <span className="ui-btn-icon" aria-hidden>
                <Save size={18} strokeWidth={2.2} />
              </span>
              Guardar
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function ExpensesUnifiedSection({ monthId, items, categories, disabled, onChanged, setError, setLoading }) {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [type, setType] = useState('variable');
  const [titleText, setTitleText] = useState('');
  const [detailText, setDetailText] = useState('');
  const [expected, setExpected] = useState('');
  const [actual, setActual] = useState('');
  const [category, setCategory] = useState(categories[0] || 'Varios');
  const [paid, setPaid] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingRow, setEditingRow] = useState(null);

  const [query, setQuery] = useState('');
  const [catFilter, setCatFilter] = useState('all');
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (categories.length && !categories.includes(category)) {
      setCategory(categories[0]);
    }
  }, [categories, category]);

  useEffect(() => {
    setCatFilter((prev) => (prev !== 'all' && categories.length && !categories.includes(prev) ? 'all' : prev));
  }, [categories]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = items || [];
    return base.filter((x) => {
      if (catFilter !== 'all' && x.category !== catFilter) return false;
      if (!q) return true;
      const blob = `${x.description || ''} ${x.category || ''}`.toLowerCase();
      return blob.includes(q);
    });
  }, [items, query, catFilter]);

  const pages = Math.max(1, Math.ceil(filtered.length / rowsPerPage));
  const currentPage = Math.min(page, pages);
  const start = (currentPage - 1) * rowsPerPage;
  const paged = filtered.slice(start, start + rowsPerPage);

  useEffect(() => {
    setPage(1);
  }, [query, catFilter, rowsPerPage]);

  async function addExpense(e) {
    e.preventDefault();
    setError('');
    try {
      setLoading(true);
      const description = [titleText.trim(), detailText.trim()].filter(Boolean).join(' — ');
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
      setTitleText('');
      setDetailText('');
      setExpected('');
      setActual('');
      setPaid(false);
      setCreateOpen(false);
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
    <div className="ui-stack">
      <section className="ui-card">
        <div className="ui-card-head ui-card-head--split">
          <div>
            <div className="ui-card-title">Expenses</div>
            <div className="ui-card-sub">Add and manage expenses for the selected month.</div>
          </div>
          <div className="ui-actions">
            <button className="ui-btn ui-btn--primary" type="button" onClick={() => setCreateOpen(true)}>
              <span className="ui-btn-icon" aria-hidden>
                <Plus size={18} strokeWidth={2.2} />
              </span>
              Agregar
            </button>
          </div>
        </div>
      </section>

      <section className="ui-card">
        <div className="ui-card-head ui-card-head--split">
          <div>
            <div className="ui-card-title">History</div>
            <div className="ui-card-sub">Gastos (fijos y variables)</div>
          </div>
          <div className="ui-toolbar">
            <label className="ui-field ui-field--toolbar">
              <span className="ui-label">Search title &amp; detail</span>
              <input className="ui-input ui-input--sm" placeholder="Search..." value={query} onChange={(e) => setQuery(e.target.value)} />
            </label>
            <label className="ui-field ui-field--toolbar">
              <span className="ui-label">Category</span>
              <select className="ui-input ui-input--sm" value={catFilter} onChange={(e) => setCatFilter(e.target.value)}>
                <option value="all">All categories</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            <label className="ui-field ui-field--toolbar">
              <span className="ui-label">Rows per page</span>
              <select className="ui-input ui-input--sm" value={rowsPerPage} onChange={(e) => setRowsPerPage(Number(e.target.value))}>
                {[5, 10, 20, 50].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <div className="ui-table-wrap">
          <table className="ui-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Detail</th>
                <th>Type</th>
                <th>Category</th>
                <th>Date</th>
                <th className="ui-th-right">Amount</th>
                <th className="ui-th-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paged.length === 0 ? (
                <tr>
                  <td colSpan={7} className="ui-muted">
                    No items.
                  </td>
                </tr>
              ) : (
                paged.map((row) => (
                  <LedgerRow
                    key={row.id}
                    kind="expense"
                    row={{ ...row, amount: row.actual }}
                    disabled={disabled}
                    categories={categories}
                    showExpenseType
                    onDelete={() => deleteExpense(row.id)}
                    onEdit={() => {
                      setEditingRow(row);
                      const parts = String(row.description || '').split('—').map((s) => s.trim());
                      setTitleText(parts[0] || '');
                      setDetailText(parts.slice(1).join(' — ').trim());
                      setDate(row.date);
                      setType(row.type || 'variable');
                      setCategory(row.category || (categories?.[0] ?? 'Varios'));
                      setActual(String(row.actual ?? 0));
                      setExpected(row.expected == null ? '' : String(row.expected));
                      setPaid(Boolean(row.paid));
                      setEditOpen(true);
                    }}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="ui-pagination">
          <div className="ui-muted">
            Showing {filtered.length === 0 ? 0 : start + 1}–{Math.min(start + rowsPerPage, filtered.length)} of {filtered.length}
          </div>
          <div className="ui-row ui-row--end">
            <button className="ui-btn ui-btn--sm ui-btn--ghost" type="button" disabled={currentPage <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
              ‹ Previous
            </button>
            <div className="ui-page">Page {currentPage} of {pages}</div>
            <button className="ui-btn ui-btn--sm ui-btn--ghost" type="button" disabled={currentPage >= pages} onClick={() => setPage((p) => Math.min(pages, p + 1))}>
              Next ›
            </button>
          </div>
        </div>
      </section>

      <Modal
        open={createOpen}
        title="Agregar gasto"
        onClose={() => {
          setCreateOpen(false);
          setTitleText('');
          setDetailText('');
          setExpected('');
          setActual('');
          setPaid(false);
        }}
      >
        <form className="ui-form-grid ui-form-grid--ledger" onSubmit={addExpense}>
          <label className="ui-field">
            <span className="ui-label">Amount</span>
            <input className="ui-input mono" inputMode="decimal" placeholder="0.00" value={actual} onChange={(e) => setActual(e.target.value)} />
          </label>
          <label className="ui-field ui-field--grow">
            <span className="ui-label">Expense title</span>
            <input className="ui-input" placeholder="e.g. Groceries, gas..." value={titleText} onChange={(e) => setTitleText(e.target.value)} />
          </label>
          <label className="ui-field">
            <span className="ui-label">Type</span>
            <select className="ui-input" value={type} onChange={(e) => setType(e.target.value)}>
              <option value="fixed">Fijo</option>
              <option value="variable">Variable</option>
            </select>
          </label>
          <label className="ui-field">
            <span className="ui-label">Category</span>
            <select className="ui-input" value={category} onChange={(e) => setCategory(e.target.value)}>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label className="ui-field">
            <span className="ui-label">Date</span>
            <input className="ui-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          {type === 'fixed' ? (
            <>
              <label className="ui-field">
                <span className="ui-label">Expected</span>
                <input className="ui-input mono" inputMode="decimal" placeholder="0.00" value={expected} onChange={(e) => setExpected(e.target.value)} />
              </label>
              <label className="ui-field ui-field--check">
                <span className="ui-label">Paid</span>
                <input type="checkbox" checked={paid} onChange={(e) => setPaid(e.target.checked)} />
              </label>
            </>
          ) : null}
          <label className="ui-field ui-field--full">
            <span className="ui-label">Expense detail</span>
            <textarea className="ui-textarea" placeholder="Optional notes, line items, or context..." value={detailText} onChange={(e) => setDetailText(e.target.value)} />
          </label>
          <div className="ui-actions ui-actions--end ui-field--full">
            <button className="ui-btn ui-btn--ghost" type="button" onClick={() => setCreateOpen(false)}>
              Cancelar
            </button>
            <button className="ui-btn ui-btn--primary" type="submit">
              <span className="ui-btn-icon" aria-hidden>
                <Plus size={18} strokeWidth={2.2} />
              </span>
              Agregar
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={editOpen}
        title="Editar gasto"
        onClose={() => {
          setEditOpen(false);
          setEditingRow(null);
        }}
      >
        <form
          className="ui-form-grid ui-form-grid--ledger"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!editingRow) return;
            const description = [titleText.trim(), detailText.trim()].filter(Boolean).join(' — ');
            const patch = { date, description, category, actual: Number(actual || 0) };
            if (editingRow.type === 'fixed' || type === 'fixed') {
              patch.expected = expected === '' ? null : Number(expected);
              patch.paid = Boolean(paid);
            }
            await patchExpense(editingRow.id, patch);
            setEditOpen(false);
            setEditingRow(null);
          }}
        >
          <label className="ui-field">
            <span className="ui-label">Amount</span>
            <input className="ui-input mono" inputMode="decimal" placeholder="0.00" value={actual} onChange={(e) => setActual(e.target.value)} />
          </label>
          <label className="ui-field ui-field--grow">
            <span className="ui-label">Expense title</span>
            <input className="ui-input" value={titleText} onChange={(e) => setTitleText(e.target.value)} />
          </label>
          <label className="ui-field">
            <span className="ui-label">Type</span>
            <select className="ui-input" value={type} onChange={(e) => setType(e.target.value)}>
              <option value="fixed">Fijo</option>
              <option value="variable">Variable</option>
            </select>
          </label>
          <label className="ui-field">
            <span className="ui-label">Category</span>
            <select className="ui-input" value={category} onChange={(e) => setCategory(e.target.value)}>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label className="ui-field">
            <span className="ui-label">Date</span>
            <input className="ui-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          {type === 'fixed' ? (
            <>
              <label className="ui-field">
                <span className="ui-label">Expected</span>
                <input className="ui-input mono" inputMode="decimal" placeholder="0.00" value={expected} onChange={(e) => setExpected(e.target.value)} />
              </label>
              <label className="ui-field ui-field--check">
                <span className="ui-label">Paid</span>
                <input type="checkbox" checked={paid} onChange={(e) => setPaid(e.target.checked)} />
              </label>
            </>
          ) : null}
          <label className="ui-field ui-field--full">
            <span className="ui-label">Expense detail</span>
            <textarea className="ui-textarea" value={detailText} onChange={(e) => setDetailText(e.target.value)} />
          </label>
          <div className="ui-actions ui-actions--end ui-field--full">
            <button className="ui-btn ui-btn--ghost" type="button" onClick={() => setEditOpen(false)}>
              Cancelar
            </button>
            <button className="ui-btn ui-btn--primary" type="submit">
              <span className="ui-btn-icon" aria-hidden>
                <Save size={18} strokeWidth={2.2} />
              </span>
              Guardar
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function LedgerRow({ kind, row, disabled, categories, onEdit, onDelete, showExpenseType = false }) {
  const initialParts = useMemo(() => String(row.description || '').split('—').map((s) => s.trim()), [row.description]);
  const initialTitle = initialParts[0] || '';
  const initialDetail = initialParts.slice(1).join(' — ').trim();

  const amountDisplay = money(kind === 'expense' ? row.actual : row.amount);

  return (
    <tr>
      <td>
        <span className="ui-strong">{initialTitle || '—'}</span>
      </td>
      <td>
        <span className="ui-muted">{initialDetail || '—'}</span>
      </td>
      {kind === 'expense' && showExpenseType ? (
        <td>
          <span className="ui-pill">{row.type === 'fixed' ? 'Fijo' : 'Variable'}</span>
        </td>
      ) : null}
      {kind === 'expense' ? (
        <td>
          <span className="ui-pill">{row.category || '—'}</span>
        </td>
      ) : null}
      <td>
        <span className="ui-muted">{formatDateLabel(row.date)}</span>
      </td>
      <td className="ui-td-right">
        <span className="ui-money mono">{amountDisplay}</span>
      </td>
      <td className="ui-td-right">
        <div className="ui-row ui-row--end ui-actions-inline">
          <button className="ui-icon-btn" type="button" disabled={disabled} aria-label="Editar" onClick={onEdit}>
            <Pencil size={16} strokeWidth={2.2} aria-hidden />
          </button>
          <button className="ui-icon-btn ui-icon-btn--danger" type="button" disabled={disabled} aria-label="Eliminar" onClick={onDelete}>
            <Trash2 size={16} strokeWidth={2.2} aria-hidden />
          </button>
        </div>
      </td>
    </tr>
  );
}
