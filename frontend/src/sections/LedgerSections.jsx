import { useEffect, useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, Save, X, Eye, ArrowUp, ArrowDown, ChevronsUpDown } from 'lucide-react';
import { api } from '../api.js';
import { toLocalIsoDate } from '../lib/localIsoDate.js';
import Modal from '../components/Modal.jsx';

function moneyUsd(n) {
  const v = Number(n) || 0;
  return `$${v.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDateLabel(isoDate) {
  if (!isoDate) return '';
  const m = String(isoDate).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return String(isoDate);
  const [, yyyy, mm, dd] = m;
  return `${dd}/${mm}/${yyyy}`;
}

function formatDateLong(isoDate) {
  if (!isoDate) return '';
  const d = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(d.getTime())) return isoDate;
  return new Intl.DateTimeFormat('es-BO', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).format(d);
}

function splitTitleDetail(description) {
  const parts = String(description || '')
    .split('—')
    .map((s) => s.trim())
    .filter(Boolean);
  return {
    title: parts[0] || '',
    detail: parts.slice(1).join(' — ').trim(),
  };
}

function DetailField({ label, children }) {
  return (
    <div className="ui-detail-field">
      <div className="ui-detail-label">{label}</div>
      <div className="ui-detail-value">{children}</div>
    </div>
  );
}

function ExpenseDetails({ row }) {
  const { title, detail } = splitTitleDetail(row?.description);
  return (
    <div className="ui-detail">
      <DetailField label="TÍTULO">{title || '—'}</DetailField>
      <DetailField label="DETALLE">
        <span className="ui-detail-muted">{detail || '—'}</span>
      </DetailField>
      <div className="ui-detail-grid-2">
        <DetailField label="MONTO">
          <span className="ui-detail-money">{moneyUsd(row?.actual ?? 0)}</span>
        </DetailField>
        <DetailField label="CATEGORÍA">{row?.category || '—'}</DetailField>
      </div>
      <DetailField label="FECHA">{formatDateLong(row?.date) || '—'}</DetailField>
    </div>
  );
}

function IncomeDetails({ row }) {
  const { title, detail } = splitTitleDetail(row?.description);
  return (
    <div className="ui-detail">
      <DetailField label="TÍTULO">{title || '—'}</DetailField>
      <DetailField label="DETALLE">
        <span className="ui-detail-muted">{detail || '—'}</span>
      </DetailField>
      <div className="ui-detail-grid-2">
        <DetailField label="MONTO">
          <span className="ui-detail-money">{moneyUsd(row?.amount ?? 0)}</span>
        </DetailField>
        <DetailField label="FECHA">{formatDateLong(row?.date) || '—'}</DetailField>
      </div>
    </div>
  );
}

function CategoryDetails({ row }) {
  return (
    <div className="ui-detail">
      <DetailField label="CATEGORÍA">{row?.name || '—'}</DetailField>
    </div>
  );
}

function LedgerRow({
  kind,
  row,
  disabled,
  onView,
  onEdit,
  onDelete,
  showExpenseType = false,
  dateFirst = false,
  hideDetail = false,
  showUsername = false,
}) {
  const initialParts = useMemo(() => String(row.description || '').split('—').map((s) => s.trim()), [row.description]);
  const initialTitle = initialParts[0] || '';
  const initialDetail = initialParts.slice(1).join(' — ').trim();

  const amountDisplay = (Number(kind === 'expense' ? row.actual : row.amount) || 0).toLocaleString('es-BO', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return (
    <tr>
      {dateFirst ? (
        <td>
          <span className="ui-muted">{formatDateLabel(row.date)}</span>
        </td>
      ) : null}
      <td>
        <span className="ui-strong">{initialTitle || '—'}</span>
      </td>
      {!hideDetail ? (
        <td>
          <span className="ui-muted">{initialDetail || '—'}</span>
        </td>
      ) : null}
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
      {kind === 'expense' && showUsername ? (
        <td className="mono">
          <span className="ui-muted">{row.username || '—'}</span>
        </td>
      ) : null}
      {!dateFirst ? (
        <td>
          <span className="ui-muted">{formatDateLabel(row.date)}</span>
        </td>
      ) : null}
      <td className="ui-td-right">
        <span className="ui-money mono">{amountDisplay}</span>
      </td>
      <td className="ui-td-right">
        <div className="ui-row ui-row--end ui-actions-inline">
          <button className="ui-icon-btn" type="button" disabled={disabled} aria-label="Ver" onClick={onView}>
            <Eye size={16} strokeWidth={2.2} aria-hidden />
          </button>
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

export function CategorySection({ items, disabled, onChanged, setError, setLoading }) {
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

  const [viewOpen, setViewOpen] = useState(false);
  const [viewRow, setViewRow] = useState(null);

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
                sorted.map((row) => (
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
                          aria-label="Ver"
                          onClick={() => {
                            setViewRow(row);
                            setViewOpen(true);
                          }}
                        >
                          <Eye size={16} strokeWidth={2.2} aria-hidden />
                        </button>
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
                        <button className="ui-icon-btn ui-icon-btn--danger" type="button" disabled={disabled} aria-label="Eliminar" onClick={() => deleteCategory(row.id, row.name)}>
                          <Trash2 size={16} strokeWidth={2.2} aria-hidden />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <Modal
        open={viewOpen}
        title="Detalle de categoría"
        onClose={() => {
          setViewOpen(false);
          setViewRow(null);
        }}
      >
        <CategoryDetails row={viewRow} />
      </Modal>

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

export function IncomeSection({ items, disabled, onChanged, setError, setLoading }) {
  const [date, setDate] = useState(() => toLocalIsoDate());
  const [title, setTitle] = useState('');
  const [detail, setDetail] = useState('');
  const [amount, setAmount] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingRow, setEditingRow] = useState(null);
  const [viewOpen, setViewOpen] = useState(false);
  const [viewRow, setViewRow] = useState(null);

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
      await api('/api/incomes', {
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
            <div className="ui-card-title">Ingresos</div>
            <div className="ui-card-sub">Agrega y administra tus ingresos.</div>
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
            <div className="ui-card-title">Historial</div>
            <div className="ui-card-sub">Buscar por título y detalle</div>
          </div>
          <div className="ui-toolbar">
            <label className="ui-field ui-field--toolbar">
              <span className="ui-label">Buscar</span>
              <input className="ui-input ui-input--sm" placeholder="Buscar..." value={query} onChange={(e) => setQuery(e.target.value)} />
            </label>
            <label className="ui-field ui-field--toolbar">
              <span className="ui-label">Filas por página</span>
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
                <th>Fecha</th>
                <th>Título</th>
                <th>Detalle</th>
                <th className="ui-th-right">Monto</th>
                <th className="ui-th-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {paged.length === 0 ? (
                <tr>
                  <td colSpan={5} className="ui-muted">
                    Sin registros.
                  </td>
                </tr>
              ) : (
                paged.map((row) => (
                  <LedgerRow
                    key={row.id}
                    kind="income"
                    row={row}
                    disabled={disabled}
                    dateFirst
                    onDelete={() => deleteIncome(row.id)}
                    onView={() => {
                      setViewRow(row);
                      setViewOpen(true);
                    }}
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
            Mostrando {filtered.length === 0 ? 0 : start + 1}–{Math.min(start + rowsPerPage, filtered.length)} de {filtered.length}
          </div>
          <div className="ui-row ui-row--end">
            <button className="ui-btn ui-btn--sm ui-btn--ghost" type="button" disabled={currentPage <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
              ‹ Anterior
            </button>
            <div className="ui-page">Página {currentPage} de {pages}</div>
            <button className="ui-btn ui-btn--sm ui-btn--ghost" type="button" disabled={currentPage >= pages} onClick={() => setPage((p) => Math.min(pages, p + 1))}>
              Siguiente ›
            </button>
          </div>
        </div>
      </section>

      <Modal
        open={createOpen}
        title="Agregar ingreso"
        busy={disabled}
        onClose={() => {
          setCreateOpen(false);
          setTitle('');
          setDetail('');
          setAmount('');
        }}
      >
        <fieldset className="ui-form-fieldset" disabled={disabled}>
        <form className="ui-form-grid ui-form-grid--ledger" onSubmit={addIncome}>
          <label className="ui-field">
            <span className="ui-label">Monto</span>
            <input className="ui-input mono" inputMode="decimal" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </label>
          <label className="ui-field ui-field--grow">
            <span className="ui-label">Título</span>
            <input className="ui-input" placeholder="Ej. Sueldo, devolución..." value={title} onChange={(e) => setTitle(e.target.value)} />
          </label>
          <label className="ui-field">
            <span className="ui-label">Fecha</span>
            <input className="ui-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <label className="ui-field ui-field--full">
            <span className="ui-label">Detalle</span>
            <textarea className="ui-textarea" placeholder="Notas opcionales, items o contexto..." value={detail} onChange={(e) => setDetail(e.target.value)} />
          </label>
          <div className="ui-actions ui-actions--end ui-field--full">
            <button className="ui-btn ui-btn--ghost" type="button" onClick={() => setCreateOpen(false)}>
              Cancelar
            </button>
            <button className="ui-btn ui-btn--primary" type="submit" disabled={disabled}>
              <span className="ui-btn-icon" aria-hidden>
                <Plus size={18} strokeWidth={2.2} />
              </span>
              {disabled ? 'Guardando…' : 'Agregar'}
            </button>
          </div>
        </form>
        </fieldset>
      </Modal>

      <Modal
        open={editOpen}
        title="Editar ingreso"
        busy={disabled}
        onClose={() => {
          setEditOpen(false);
          setEditingRow(null);
        }}
      >
        <fieldset className="ui-form-fieldset" disabled={disabled}>
        <form
          className="ui-form-grid ui-form-grid--ledger"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!editingRow || disabled) return;
            const description = [title.trim(), detail.trim()].filter(Boolean).join(' — ');
            await patchIncome(editingRow.id, { date, description, amount: Number(amount) });
            setEditOpen(false);
            setEditingRow(null);
          }}
        >
          <label className="ui-field">
            <span className="ui-label">Monto</span>
            <input className="ui-input mono" inputMode="decimal" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </label>
          <label className="ui-field ui-field--grow">
            <span className="ui-label">Título</span>
            <input className="ui-input" value={title} onChange={(e) => setTitle(e.target.value)} />
          </label>
          <label className="ui-field">
            <span className="ui-label">Fecha</span>
            <input className="ui-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <label className="ui-field ui-field--full">
            <span className="ui-label">Detalle</span>
            <textarea className="ui-textarea" value={detail} onChange={(e) => setDetail(e.target.value)} />
          </label>
          <div className="ui-actions ui-actions--end ui-field--full">
            <button className="ui-btn ui-btn--ghost" type="button" onClick={() => setEditOpen(false)}>
              Cancelar
            </button>
            <button className="ui-btn ui-btn--primary" type="submit" disabled={disabled}>
              <span className="ui-btn-icon" aria-hidden>
                <Save size={18} strokeWidth={2.2} />
              </span>
              {disabled ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </form>
        </fieldset>
      </Modal>

      <Modal
        open={viewOpen}
        title="Detalle de ingreso"
        onClose={() => {
          setViewOpen(false);
          setViewRow(null);
        }}
      >
        <IncomeDetails row={viewRow} />
      </Modal>
    </div>
  );
}

function expenseTitleForSort(row) {
  const { title } = splitTitleDetail(String(row?.description || ''));
  const t = title.trim();
  if (t) return t;
  return String(row?.description || '').trim();
}

function SortableExpenseTh({ label, field, activeKey, dir, onSort, align = 'left' }) {
  const active = activeKey === field;
  const ariaSort = active ? (dir === 'asc' ? 'ascending' : 'descending') : 'none';
  const dirLabel = active ? (dir === 'asc' ? 'ascendente' : 'descendente') : '';
  return (
    <th className={align === 'right' ? 'ui-th-right' : undefined} aria-sort={ariaSort}>
      <button
        type="button"
        className={`ui-th-sort${align === 'right' ? ' ui-th-sort--right' : ''}`}
        onClick={() => onSort(field)}
        aria-label={active ? `${label}, orden ${dirLabel}. Cambiar orden` : `Ordenar por ${label}`}
      >
        <span>{label}</span>
        <span className="ui-th-sort__icon" aria-hidden>
          {active ? (dir === 'asc' ? <ArrowUp size={14} strokeWidth={2.2} /> : <ArrowDown size={14} strokeWidth={2.2} />) : <ChevronsUpDown size={14} strokeWidth={2} className="ui-th-sort__idle" />}
        </span>
      </button>
    </th>
  );
}

export function ExpensesUnifiedSection({
  items,
  categories,
  disabled,
  onChanged,
  setError,
  setLoading,
  pendingRecurringFixed = [],
  canManageRecurringFixed = false,
  initialCategoryFilter = 'all',
  filterSummary = '',
}) {
  const [date, setDate] = useState(() => toLocalIsoDate());
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
  const [viewOpen, setViewOpen] = useState(false);
  const [viewRow, setViewRow] = useState(null);

  const [payOpen, setPayOpen] = useState(false);
  const [payItem, setPayItem] = useState(null);
  const [payActual, setPayActual] = useState('');
  const [payDate, setPayDate] = useState(() => toLocalIsoDate());

  const [manageOpen, setManageOpen] = useState(false);
  const [manageItem, setManageItem] = useState(null);
  const [manageTitle, setManageTitle] = useState('');
  const [manageExpected, setManageExpected] = useState('');
  const [manageCategory, setManageCategory] = useState(categories[0] || 'Varios');

  const [query, setQuery] = useState('');
  const [catFilter, setCatFilter] = useState(initialCategoryFilter || 'all');
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState('date');
  const [sortDir, setSortDir] = useState('desc');

  useEffect(() => {
    if (categories.length && !categories.includes(category)) {
      setCategory(categories[0]);
    }
  }, [categories, category]);

  useEffect(() => {
    if (categories.length && manageItem && !categories.includes(manageCategory)) {
      setManageCategory(categories[0]);
    }
  }, [categories, manageItem, manageCategory]);

  useEffect(() => {
    setCatFilter((prev) => (prev !== 'all' && categories.length && !categories.includes(prev) ? 'all' : prev));
  }, [categories]);

  useEffect(() => {
    const next = initialCategoryFilter || 'all';
    if (next === 'all' || !categories.length || categories.includes(next)) {
      setCatFilter(next);
    }
  }, [categories, initialCategoryFilter]);

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

  const sorted = useMemo(() => {
    const arr = [...filtered];
    const mul = sortDir === 'asc' ? 1 : -1;
    arr.sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'date') {
        cmp = String(a.date || '').localeCompare(String(b.date || ''));
      } else if (sortKey === 'amount') {
        cmp = (Number(a.actual) || 0) - (Number(b.actual) || 0);
      } else if (sortKey === 'title') {
        cmp = expenseTitleForSort(a).localeCompare(expenseTitleForSort(b), 'es', { sensitivity: 'base', numeric: true });
      } else if (sortKey === 'type') {
        cmp = String(a.type || '').localeCompare(String(b.type || ''), 'es', { sensitivity: 'base' });
      } else if (sortKey === 'category') {
        cmp = String(a.category || '').localeCompare(String(b.category || ''), 'es', { sensitivity: 'base', numeric: true });
      } else if (sortKey === 'username') {
        cmp = String(a.username || '').localeCompare(String(b.username || ''), 'es', { sensitivity: 'base', numeric: true });
      }
      cmp *= mul;
      if (cmp !== 0) return cmp;
      return (Number(a.id) || 0) - (Number(b.id) || 0);
    });
    return arr;
  }, [filtered, sortKey, sortDir]);

  const pages = Math.max(1, Math.ceil(sorted.length / rowsPerPage));
  const currentPage = Math.min(page, pages);
  const start = (currentPage - 1) * rowsPerPage;
  const paged = sorted.slice(start, start + rowsPerPage);

  function toggleExpenseSort(field) {
    if (sortKey === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(field);
      setSortDir(field === 'date' || field === 'amount' ? 'desc' : 'asc');
    }
  }

  useEffect(() => {
    setPage(1);
  }, [query, catFilter, rowsPerPage, sortKey, sortDir]);

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
      await api('/api/expenses', { method: 'POST', body });
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

  async function submitRecurringPay(e) {
    e.preventDefault();
    if (!payItem) return;
    setError('');
    try {
      setLoading(true);
      await api(`/api/recurring-fixed/${payItem.id}/pay`, {
        method: 'POST',
        body: { date: payDate, actual: Number(payActual || 0) },
      });
      setPayOpen(false);
      setPayItem(null);
      await onChanged();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function saveRecurringTemplate(e) {
    e.preventDefault();
    if (!manageItem) return;
    setError('');
    try {
      setLoading(true);
      await api(`/api/recurring-fixed/${manageItem.id}`, {
        method: 'PATCH',
        body: { title: manageTitle.trim(), expected_amount: Number(manageExpected || 0), category: manageCategory },
      });
      setManageOpen(false);
      setManageItem(null);
      await onChanged();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function deleteRecurringTemplate(p) {
    if (!p) return;
    if (!window.confirm(`¿Eliminar el gasto fijo "${p.title}"?`)) return;
    setError('');
    try {
      setLoading(true);
      await api(`/api/recurring-fixed/${p.id}`, { method: 'DELETE' });
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
            <div className="ui-card-title">Gastos</div>
            <div className="ui-card-sub">{filterSummary || 'Gastos (fijos y variables)'}</div>
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

      <section className="ui-card ui-card--pending-fixed">
        <div className="ui-card-head">
          <div>
            <div className="ui-card-title">Gastos fijos pendientes</div>
            <div className="ui-card-sub">Este mes calendario. Clic en el título para registrar el pago (se quita de la lista al guardar).</div>
          </div>
        </div>
        {pendingRecurringFixed.length === 0 ? (
          <p className="ui-muted" style={{ margin: '0 0 0.25rem' }}>
            Sin pendientes para este mes.
          </p>
        ) : (
          <ul className="ui-pending-fixed-list">
            {pendingRecurringFixed.map((p) => (
              <li key={p.id} className="ui-pending-fixed-row">
                <button
                  type="button"
                  className="ui-pending-fixed-title"
                  disabled={disabled}
                  onClick={() => {
                    setPayItem(p);
                    setPayActual(String(p.expected_amount ?? ''));
                    setPayDate(toLocalIsoDate());
                    setPayOpen(true);
                  }}
                >
                  {p.title}
                </button>
                <span className="ui-pill">{p.category}</span>
                <span className="mono ui-muted">
                  {(Number(p.expected_amount) || 0).toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                {canManageRecurringFixed ? (
                  <span className="ui-row ui-row--end" style={{ gap: '0.35rem' }}>
                    <button
                      className="ui-icon-btn"
                      type="button"
                      disabled={disabled}
                      aria-label="Editar"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setManageItem(p);
                        setManageTitle(String(p.title || ''));
                        setManageExpected(String(p.expected_amount ?? ''));
                        setManageCategory(p.category || (categories[0] || 'Varios'));
                        setManageOpen(true);
                      }}
                    >
                      <Pencil size={16} strokeWidth={2.2} aria-hidden />
                    </button>
                    <button
                      className="ui-icon-btn ui-icon-btn--danger"
                      type="button"
                      disabled={disabled}
                      aria-label="Eliminar"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        deleteRecurringTemplate(p);
                      }}
                    >
                      <Trash2 size={16} strokeWidth={2.2} aria-hidden />
                    </button>
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="ui-card">
        <div className="ui-card-head ui-card-head--split">
          <div>
            <div className="ui-card-title">Historial</div>
            <div className="ui-card-sub">Buscar y filtrar</div>
          </div>
          <div className="ui-toolbar">
            <label className="ui-field ui-field--toolbar">
              <span className="ui-label">Buscar por título y detalle</span>
              <input className="ui-input ui-input--sm" placeholder="Buscar..." value={query} onChange={(e) => setQuery(e.target.value)} />
            </label>
            <label className="ui-field ui-field--toolbar">
              <span className="ui-label">Categoría</span>
              <select className="ui-input ui-input--sm" value={catFilter} onChange={(e) => setCatFilter(e.target.value)}>
                <option value="all">Todas</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            <label className="ui-field ui-field--toolbar">
              <span className="ui-label">Filas por página</span>
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
                <SortableExpenseTh label="Fecha" field="date" activeKey={sortKey} dir={sortDir} onSort={toggleExpenseSort} />
                <SortableExpenseTh label="Título" field="title" activeKey={sortKey} dir={sortDir} onSort={toggleExpenseSort} />
                <SortableExpenseTh label="Tipo" field="type" activeKey={sortKey} dir={sortDir} onSort={toggleExpenseSort} />
                <SortableExpenseTh label="Categoría" field="category" activeKey={sortKey} dir={sortDir} onSort={toggleExpenseSort} />
                <SortableExpenseTh label="Usuario" field="username" activeKey={sortKey} dir={sortDir} onSort={toggleExpenseSort} />
                <SortableExpenseTh label="Monto" field="amount" activeKey={sortKey} dir={sortDir} onSort={toggleExpenseSort} align="right" />
                <th className="ui-th-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {paged.length === 0 ? (
                <tr>
                  <td colSpan={7} className="ui-muted">
                    Sin registros.
                  </td>
                </tr>
              ) : (
                paged.map((row) => (
                  <LedgerRow
                    key={row.id}
                    kind="expense"
                    row={{ ...row, amount: row.actual }}
                    disabled={disabled}
                    showExpenseType
                    dateFirst
                    hideDetail
                    showUsername
                    onDelete={() => deleteExpense(row.id)}
                    onView={() => {
                      setViewRow(row);
                      setViewOpen(true);
                    }}
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
            Mostrando {sorted.length === 0 ? 0 : start + 1}–{Math.min(start + rowsPerPage, sorted.length)} de {sorted.length}
          </div>
          <div className="ui-row ui-row--end">
            <button className="ui-btn ui-btn--sm ui-btn--ghost" type="button" disabled={currentPage <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
              ‹ Anterior
            </button>
            <div className="ui-page">Página {currentPage} de {pages}</div>
            <button className="ui-btn ui-btn--sm ui-btn--ghost" type="button" disabled={currentPage >= pages} onClick={() => setPage((p) => Math.min(pages, p + 1))}>
              Siguiente ›
            </button>
          </div>
        </div>
      </section>

      <Modal
        open={payOpen}
        title="Registrar pago — gasto fijo"
        busy={disabled}
        onClose={() => {
          setPayOpen(false);
          setPayItem(null);
        }}
      >
        {payItem ? (
          <fieldset className="ui-form-fieldset" disabled={disabled}>
          <form className="ui-form-grid ui-form-grid--ledger" onSubmit={submitRecurringPay}>
            <DetailField label="TÍTULO">{payItem.title}</DetailField>
            <div className="ui-detail-grid-2">
              <DetailField label="MONTO ESPERADO">
                <span className="ui-detail-money">
                  {moneyUsd(Number(payItem.expected_amount) || 0)}
                </span>
              </DetailField>
              <DetailField label="TIPO">
                <span className="ui-pill">Fijo</span>
              </DetailField>
            </div>
            <DetailField label="CATEGORÍA">{payItem.category || '—'}</DetailField>
            <label className="ui-field">
              <span className="ui-label">Monto real</span>
              <input className="ui-input mono" inputMode="decimal" placeholder="0.00" value={payActual} onChange={(e) => setPayActual(e.target.value)} />
            </label>
            <label className="ui-field">
              <span className="ui-label">Fecha</span>
              <input className="ui-input" type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} />
            </label>
            <div className="ui-actions ui-actions--end ui-field--full">
              <button className="ui-btn ui-btn--ghost" type="button" onClick={() => setPayOpen(false)} disabled={disabled}>
                Cancelar
              </button>
              <button className="ui-btn ui-btn--primary" type="submit" disabled={disabled}>
                <span className="ui-btn-icon" aria-hidden>
                  <Save size={18} strokeWidth={2.2} />
                </span>
                {disabled ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </form>
          </fieldset>
        ) : null}
      </Modal>

      <Modal
        open={manageOpen}
        title="Editar gasto fijo"
        busy={disabled}
        onClose={() => {
          setManageOpen(false);
          setManageItem(null);
        }}
      >
        {manageItem ? (
          <fieldset className="ui-form-fieldset" disabled={disabled}>
          <form className="ui-form-grid ui-form-grid--ledger" onSubmit={saveRecurringTemplate}>
            <label className="ui-field ui-field--grow">
              <span className="ui-label">Título</span>
              <input className="ui-input" value={manageTitle} onChange={(e) => setManageTitle(e.target.value)} />
            </label>
            <label className="ui-field">
              <span className="ui-label">Monto esperado (mes)</span>
              <input className="ui-input mono" inputMode="decimal" placeholder="0.00" value={manageExpected} onChange={(e) => setManageExpected(e.target.value)} />
            </label>
            <label className="ui-field">
              <span className="ui-label">Categoría</span>
              <select className="ui-input" value={manageCategory} onChange={(e) => setManageCategory(e.target.value)}>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            <div className="ui-actions ui-actions--end ui-field--full">
              <button className="ui-btn ui-btn--ghost" type="button" onClick={() => setManageOpen(false)} disabled={disabled}>
                Cancelar
              </button>
              <button className="ui-btn ui-btn--primary" type="submit" disabled={disabled}>
                <span className="ui-btn-icon" aria-hidden>
                  <Save size={18} strokeWidth={2.2} />
                </span>
                {disabled ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </form>
          </fieldset>
        ) : null}
      </Modal>

      <Modal
        open={createOpen}
        title="Agregar gasto"
        busy={disabled}
        onClose={() => {
          setCreateOpen(false);
          setTitleText('');
          setDetailText('');
          setExpected('');
          setActual('');
          setPaid(false);
        }}
      >
        <fieldset className="ui-form-fieldset" disabled={disabled}>
        <form className="ui-form-grid ui-form-grid--ledger" onSubmit={addExpense}>
          <label className="ui-field">
            <span className="ui-label">Monto</span>
            <input className="ui-input mono" inputMode="decimal" placeholder="0.00" value={actual} onChange={(e) => setActual(e.target.value)} />
          </label>
          <label className="ui-field ui-field--grow">
            <span className="ui-label">Título</span>
            <input className="ui-input" placeholder="Ej. Supermercado, gasolina..." value={titleText} onChange={(e) => setTitleText(e.target.value)} />
          </label>
          <label className="ui-field">
            <span className="ui-label">Tipo</span>
            <select className="ui-input" value={type} onChange={(e) => setType(e.target.value)}>
              <option value="fixed">Fijo</option>
              <option value="variable">Variable</option>
            </select>
          </label>
          <label className="ui-field">
            <span className="ui-label">Categoría</span>
            <select className="ui-input" value={category} onChange={(e) => setCategory(e.target.value)}>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label className="ui-field">
            <span className="ui-label">Fecha</span>
            <input className="ui-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          {type === 'fixed' ? (
            <>
              <label className="ui-field">
                <span className="ui-label">Esperado</span>
                <input className="ui-input mono" inputMode="decimal" placeholder="0.00" value={expected} onChange={(e) => setExpected(e.target.value)} />
              </label>
              <label className="ui-field ui-field--check">
                <span className="ui-label">Pagado</span>
                <input type="checkbox" checked={paid} onChange={(e) => setPaid(e.target.checked)} />
              </label>
            </>
          ) : null}
          <label className="ui-field ui-field--full">
            <span className="ui-label">Detalle</span>
            <textarea className="ui-textarea" placeholder="Notas opcionales, items o contexto..." value={detailText} onChange={(e) => setDetailText(e.target.value)} />
          </label>
          <div className="ui-actions ui-actions--end ui-field--full">
            <button className="ui-btn ui-btn--ghost" type="button" onClick={() => setCreateOpen(false)}>
              Cancelar
            </button>
            <button className="ui-btn ui-btn--primary" type="submit" disabled={disabled}>
              <span className="ui-btn-icon" aria-hidden>
                <Plus size={18} strokeWidth={2.2} />
              </span>
              {disabled ? 'Guardando…' : 'Agregar'}
            </button>
          </div>
        </form>
        </fieldset>
      </Modal>

      <Modal
        open={editOpen}
        title="Editar gasto"
        busy={disabled}
        onClose={() => {
          setEditOpen(false);
          setEditingRow(null);
        }}
      >
        <fieldset className="ui-form-fieldset" disabled={disabled}>
        <form
          className="ui-form-grid ui-form-grid--ledger"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!editingRow || disabled) return;
            const description = [titleText.trim(), detailText.trim()].filter(Boolean).join(' — ');
            const patch = { date, description, category, actual: Number(actual || 0), type };
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
            <span className="ui-label">Monto</span>
            <input className="ui-input mono" inputMode="decimal" placeholder="0.00" value={actual} onChange={(e) => setActual(e.target.value)} />
          </label>
          <label className="ui-field ui-field--grow">
            <span className="ui-label">Título</span>
            <input className="ui-input" value={titleText} onChange={(e) => setTitleText(e.target.value)} />
          </label>
          <label className="ui-field">
            <span className="ui-label">Tipo</span>
            <select className="ui-input" value={type} onChange={(e) => setType(e.target.value)}>
              <option value="fixed">Fijo</option>
              <option value="variable">Variable</option>
            </select>
          </label>
          <label className="ui-field">
            <span className="ui-label">Categoría</span>
            <select className="ui-input" value={category} onChange={(e) => setCategory(e.target.value)}>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label className="ui-field">
            <span className="ui-label">Fecha</span>
            <input className="ui-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          {type === 'fixed' ? (
            <>
              <label className="ui-field">
                <span className="ui-label">Esperado</span>
                <input className="ui-input mono" inputMode="decimal" placeholder="0.00" value={expected} onChange={(e) => setExpected(e.target.value)} />
              </label>
              <label className="ui-field ui-field--check">
                <span className="ui-label">Pagado</span>
                <input type="checkbox" checked={paid} onChange={(e) => setPaid(e.target.checked)} />
              </label>
            </>
          ) : null}
          <label className="ui-field ui-field--full">
            <span className="ui-label">Detalle</span>
            <textarea className="ui-textarea" value={detailText} onChange={(e) => setDetailText(e.target.value)} />
          </label>
          <div className="ui-actions ui-actions--end ui-field--full">
            <button className="ui-btn ui-btn--ghost" type="button" onClick={() => setEditOpen(false)}>
              Cancelar
            </button>
            <button className="ui-btn ui-btn--primary" type="submit" disabled={disabled}>
              <span className="ui-btn-icon" aria-hidden>
                <Save size={18} strokeWidth={2.2} />
              </span>
              {disabled ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </form>
        </fieldset>
      </Modal>

      <Modal
        open={viewOpen}
        title="Detalle de gasto"
        onClose={() => {
          setViewOpen(false);
          setViewRow(null);
        }}
      >
        <ExpenseDetails row={viewRow} />
      </Modal>
    </div>
  );
}

