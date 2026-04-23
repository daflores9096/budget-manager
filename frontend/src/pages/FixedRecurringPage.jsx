import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, Save, X } from 'lucide-react';
import { api } from '../api.js';

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

export default function FixedRecurringPage({ ctx }) {
  const categories = ctx.categories || [];
  const [items, setItems] = useState([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [expectedAmount, setExpectedAmount] = useState('');
  const [category, setCategory] = useState(categories[0] || 'Varios');
  const [editingId, setEditingId] = useState(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [editingExpected, setEditingExpected] = useState('');
  const [editingCategory, setEditingCategory] = useState('Varios');

  const load = useCallback(async () => {
    const data = await api('/api/recurring-fixed');
    setItems(data.items || []);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        ctx.setLoading(true);
        await load();
      } catch (e) {
        if (!cancelled) ctx.setError(e.message || 'Error al cargar');
      } finally {
        if (!cancelled) ctx.setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  useEffect(() => {
    if (categories.length && !categories.includes(category)) {
      setCategory(categories[0]);
    }
  }, [categories, category]);

  const sorted = useMemo(() => [...items].sort((a, b) => String(a.title).localeCompare(String(b.title), 'es')), [items]);

  async function createTemplate(e) {
    e.preventDefault();
    ctx.setError('');
    try {
      ctx.setLoading(true);
      await api('/api/recurring-fixed', {
        method: 'POST',
        body: { title: title.trim(), expected_amount: Number(expectedAmount || 0), category },
      });
      setTitle('');
      setExpectedAmount('');
      setCreateOpen(false);
      await load();
      await ctx.reloadPendingRecurringFixed?.();
    } catch (err) {
      ctx.setError(err.message);
    } finally {
      ctx.setLoading(false);
    }
  }

  async function saveEdit(e) {
    e.preventDefault();
    if (!editingId) return;
    ctx.setError('');
    try {
      ctx.setLoading(true);
      await api(`/api/recurring-fixed/${editingId}`, {
        method: 'PATCH',
        body: { title: editingTitle.trim(), expected_amount: Number(editingExpected || 0), category: editingCategory },
      });
      setEditOpen(false);
      setEditingId(null);
      await load();
      await ctx.reloadPendingRecurringFixed?.();
    } catch (err) {
      ctx.setError(err.message);
    } finally {
      ctx.setLoading(false);
    }
  }

  async function deleteRow(id, label) {
    if (!window.confirm(`¿Eliminar el gasto fijo "${label}"?`)) return;
    ctx.setError('');
    try {
      ctx.setLoading(true);
      await api(`/api/recurring-fixed/${id}`, { method: 'DELETE' });
      await load();
      await ctx.reloadPendingRecurringFixed?.();
    } catch (err) {
      ctx.setError(err.message);
    } finally {
      ctx.setLoading(false);
    }
  }

  return (
    <div className="ui-stack">
      <section className="ui-card">
        <div className="ui-card-head ui-card-head--split">
          <div>
            <div className="ui-card-title">Gastos fijos recurrentes</div>
            <div className="ui-card-sub">Listado de pagos mensuales con el mismo monto esperado. En Gastos verás los pendientes del mes.</div>
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
                <th>Título</th>
                <th>Categoría</th>
                <th className="ui-th-right">Monto esperado</th>
                <th className="ui-th-right" style={{ width: '120px' }}>
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 ? (
                <tr>
                  <td colSpan={4} className="ui-muted">
                    No hay plantillas. Agrega renta, internet, seguros, etc.
                  </td>
                </tr>
              ) : (
                sorted.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <span className="ui-strong">{row.title}</span>
                    </td>
                    <td>
                      <span className="ui-pill">{row.category}</span>
                    </td>
                    <td className="ui-td-right mono ui-money">{(Number(row.expected_amount) || 0).toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td className="ui-td-right">
                      <div className="ui-row ui-row--end">
                        <button
                          className="ui-icon-btn"
                          type="button"
                          disabled={ctx.loading}
                          aria-label="Editar"
                          onClick={() => {
                            setEditingId(row.id);
                            setEditingTitle(row.title);
                            setEditingExpected(String(row.expected_amount ?? ''));
                            setEditingCategory(row.category || 'Varios');
                            setEditOpen(true);
                          }}
                        >
                          <Pencil size={16} strokeWidth={2.2} aria-hidden />
                        </button>
                        <button className="ui-icon-btn ui-icon-btn--danger" type="button" disabled={ctx.loading} aria-label="Eliminar" onClick={() => deleteRow(row.id, row.title)}>
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

      <Modal open={createOpen} title="Agregar gasto fijo" onClose={() => setCreateOpen(false)}>
        <form className="ui-form-grid ui-form-grid--ledger" onSubmit={createTemplate}>
          <label className="ui-field ui-field--grow">
            <span className="ui-label">Título</span>
            <input className="ui-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ej. Alquiler, Internet…" />
          </label>
          <label className="ui-field">
            <span className="ui-label">Monto esperado (mes)</span>
            <input className="ui-input mono" inputMode="decimal" value={expectedAmount} onChange={(e) => setExpectedAmount(e.target.value)} placeholder="0.00" />
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
          <div className="ui-actions ui-actions--end ui-field--full">
            <button className="ui-btn ui-btn--ghost" type="button" onClick={() => setCreateOpen(false)}>
              Cancelar
            </button>
            <button className="ui-btn ui-btn--primary" type="submit">
              <span className="ui-btn-icon" aria-hidden>
                <Plus size={18} strokeWidth={2.2} />
              </span>
              Guardar
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={editOpen} title="Editar gasto fijo" onClose={() => setEditOpen(false)}>
        <form className="ui-form-grid ui-form-grid--ledger" onSubmit={saveEdit}>
          <label className="ui-field ui-field--grow">
            <span className="ui-label">Título</span>
            <input className="ui-input" value={editingTitle} onChange={(e) => setEditingTitle(e.target.value)} />
          </label>
          <label className="ui-field">
            <span className="ui-label">Monto esperado</span>
            <input className="ui-input mono" inputMode="decimal" value={editingExpected} onChange={(e) => setEditingExpected(e.target.value)} />
          </label>
          <label className="ui-field">
            <span className="ui-label">Categoría</span>
            <select className="ui-input" value={editingCategory} onChange={(e) => setEditingCategory(e.target.value)}>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
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
