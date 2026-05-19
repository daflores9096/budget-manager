import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Save, Trash2, KeyRound, Pencil } from 'lucide-react';
import { api } from '../api.js';
import Modal from '../components/Modal.jsx';

export default function UsersPage({ ctx }) {
  const [users, setUsers] = useState([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState('appuser');
  const [password, setPassword] = useState('');
  const [tempPassword, setTempPassword] = useState('');
  const [resetPasswordOpen, setResetPasswordOpen] = useState(false);
  const [resetPasswordUser, setResetPasswordUser] = useState(null);
  const [resetPasswordValue, setResetPasswordValue] = useState('');

  const load = useCallback(async () => {
    const data = await api('/api/users');
    setUsers(data.users || []);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        ctx.setError('');
        ctx.setLoading(true);
        await load();
      } catch (e) {
        if (!cancelled) ctx.setError(e.message || 'Error al cargar usuarios');
      } finally {
        if (!cancelled) ctx.setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  const sorted = useMemo(() => [...users].sort((a, b) => a.id - b.id), [users]);

  async function createUser(e) {
    e.preventDefault();
    setTempPassword('');
    ctx.setError('');
    try {
      ctx.setLoading(true);
      const data = await api('/api/users', { method: 'POST', body: { username, email, name, role, password } });
      if (data?.temp_password) setTempPassword(String(data.temp_password));
      setEmail('');
      setUsername('');
      setName('');
      setRole('appuser');
      setPassword('');
      await load();
    } catch (err) {
      ctx.setError(err.message);
    } finally {
      ctx.setLoading(false);
    }
  }

  async function patchUser(id, patch) {
    ctx.setError('');
    try {
      ctx.setLoading(true);
      await api(`/api/users/${id}`, { method: 'PATCH', body: patch });
      await load();
    } catch (err) {
      ctx.setError(err.message);
    } finally {
      ctx.setLoading(false);
    }
  }

  async function deleteUser(id, emailLabel) {
    if (!window.confirm(`¿Eliminar el usuario ${emailLabel}?`)) return;
    ctx.setError('');
    try {
      ctx.setLoading(true);
      await api(`/api/users/${id}`, { method: 'DELETE' });
      await load();
    } catch (err) {
      ctx.setError(err.message);
    } finally {
      ctx.setLoading(false);
    }
  }

  if (ctx.user?.role !== 'admin') {
    return <div className="panel error">No autorizado</div>;
  }

  return (
    <div className="ui-stack">
      <section className="ui-card">
        <div className="ui-card-head ui-card-head--split">
          <div>
            <div className="ui-card-title">Usuarios</div>
            <div className="ui-card-sub">Los administradores pueden crear usuarios y cambiar roles.</div>
          </div>
          <div className="ui-actions">
            <button className="ui-btn ui-btn--primary" type="button" onClick={() => setCreateOpen(true)}>
              <span className="ui-btn-icon" aria-hidden>
                <Plus size={18} strokeWidth={2.2} />
              </span>
              Agregar usuario
            </button>
          </div>
        </div>
      </section>

      <section className="ui-card">
        <div className="ui-table-wrap">
          <table className="ui-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Usuario</th>
                <th>Email</th>
                <th>Nombre</th>
                <th>Rol</th>
                <th>Deshabilitado</th>
                <th className="ui-th-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 ? (
                <tr>
                  <td colSpan={7} className="ui-muted">
                    Sin usuarios.
                  </td>
                </tr>
              ) : (
                sorted.map((u) => (
                  <tr key={u.id}>
                    <td className="mono">{u.id}</td>
                    <td className="mono">{u.username || '—'}</td>
                    <td>{u.email}</td>
                    <td>{u.name || '—'}</td>
                    <td>
                      <select className="ui-input ui-input--sm" value={u.role} disabled={ctx.loading} onChange={(e) => patchUser(u.id, { role: e.target.value })}>
                        <option value="admin">admin</option>
                        <option value="appuser">appuser</option>
                      </select>
                    </td>
                    <td>
                      <input type="checkbox" checked={Boolean(u.disabled)} disabled={ctx.loading} onChange={(e) => patchUser(u.id, { disabled: e.target.checked })} />
                    </td>
                    <td className="ui-td-right">
                      <button
                        className="ui-icon-btn"
                        type="button"
                        disabled={ctx.loading}
                        aria-label="Editar"
                        onClick={() => {
                          setEditingUser(u);
                          setEditOpen(true);
                        }}
                      >
                        <Pencil size={16} strokeWidth={2.2} aria-hidden />
                      </button>
                      <button
                        className="ui-icon-btn"
                        type="button"
                        disabled={ctx.loading}
                        aria-label="Restablecer contraseña"
                        onClick={() => {
                          setTempPassword('');
                          setResetPasswordUser(u);
                          setResetPasswordValue('');
                          setResetPasswordOpen(true);
                        }}
                      >
                        <KeyRound size={16} strokeWidth={2.2} aria-hidden />
                      </button>
                      <button className="ui-icon-btn ui-icon-btn--danger" type="button" disabled={ctx.loading} aria-label="Eliminar" onClick={() => deleteUser(u.id, u.email)}>
                        <Trash2 size={16} strokeWidth={2.2} aria-hidden />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <Modal
        open={createOpen}
        title="Crear usuario"
        busy={ctx.loading}
        onClose={() => {
          setCreateOpen(false);
          setTempPassword('');
        }}
      >
        <fieldset className="ui-form-fieldset" disabled={ctx.loading}>
        <form className="ui-form-grid ui-form-grid--ledger" onSubmit={createUser}>
          <label className="ui-field ui-field--grow">
            <span className="ui-label">Usuario</span>
            <input className="ui-input mono" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="off" placeholder="Ej. jsmith" />
          </label>
          <label className="ui-field ui-field--grow">
            <span className="ui-label">Email</span>
            <input className="ui-input" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" />
          </label>
          <label className="ui-field">
            <span className="ui-label">Rol</span>
            <select className="ui-input" value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="appuser">appuser</option>
              <option value="admin">admin</option>
            </select>
          </label>
          <label className="ui-field ui-field--full">
            <span className="ui-label">Nombre</span>
            <input className="ui-input" value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="ui-field ui-field--full">
            <span className="ui-label">Contraseña (opcional)</span>
            <input className="ui-input" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Deja vacío para autogenerar" />
          </label>
          <div className="ui-actions ui-actions--end ui-field--full">
            <button className="ui-btn ui-btn--ghost" type="button" onClick={() => setCreateOpen(false)}>
              Cancelar
            </button>
            <button className="ui-btn ui-btn--primary" type="submit" disabled={ctx.loading}>
              <span className="ui-btn-icon" aria-hidden>
                <Save size={18} strokeWidth={2.2} />
              </span>
              {ctx.loading ? 'Guardando…' : 'Crear'}
            </button>
          </div>
        </form>
        </fieldset>
        {tempPassword ? (
          <div className="panel" style={{ marginTop: '0.85rem' }}>
            <div className="ui-muted">Contraseña temporal (dev):</div>
            <div className="mono" style={{ fontWeight: 700 }}>
              {tempPassword}
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal
        open={editOpen}
        title="Editar usuario"
        busy={ctx.loading}
        onClose={() => {
          setEditOpen(false);
          setEditingUser(null);
        }}
      >
        {editingUser ? (
          <fieldset className="ui-form-fieldset" disabled={ctx.loading}>
          <form
            className="ui-form-grid ui-form-grid--ledger"
            onSubmit={async (e) => {
              e.preventDefault();
              await patchUser(editingUser.id, {
                username: editingUser.username,
                email: editingUser.email,
                name: editingUser.name,
              });
              setEditOpen(false);
              setEditingUser(null);
            }}
          >
            <label className="ui-field ui-field--grow">
              <span className="ui-label">Usuario</span>
              <input className="ui-input mono" value={editingUser.username || ''} onChange={(e) => setEditingUser((p) => ({ ...p, username: e.target.value }))} />
            </label>
            <label className="ui-field ui-field--grow">
              <span className="ui-label">Email</span>
              <input className="ui-input" value={editingUser.email || ''} onChange={(e) => setEditingUser((p) => ({ ...p, email: e.target.value }))} />
            </label>
            <label className="ui-field ui-field--full">
              <span className="ui-label">Nombre</span>
              <input className="ui-input" value={editingUser.name || ''} onChange={(e) => setEditingUser((p) => ({ ...p, name: e.target.value }))} />
            </label>
            <div className="ui-actions ui-actions--end ui-field--full">
              <button className="ui-btn ui-btn--ghost" type="button" onClick={() => setEditOpen(false)}>
                Cancelar
              </button>
              <button className="ui-btn ui-btn--primary" type="submit" disabled={ctx.loading}>
                <span className="ui-btn-icon" aria-hidden>
                  <Save size={18} strokeWidth={2.2} />
                </span>
                {ctx.loading ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </form>
          </fieldset>
        ) : null}
      </Modal>

      <Modal
        open={resetPasswordOpen}
        title="Restablecer contraseña"
        busy={ctx.loading}
        onClose={() => {
          setResetPasswordOpen(false);
          setResetPasswordUser(null);
          setResetPasswordValue('');
        }}
      >
        {resetPasswordUser ? (
          <fieldset className="ui-form-fieldset" disabled={ctx.loading}>
          <form
            className="ui-form-grid ui-form-grid--ledger"
            onSubmit={async (e) => {
              e.preventDefault();
              setTempPassword('');
              ctx.setError('');
              try {
                ctx.setLoading(true);
                const data = await api(`/api/users/${resetPasswordUser.id}/reset-password`, {
                  method: 'POST',
                  body: resetPasswordValue ? { password: resetPasswordValue } : {},
                });
                if (data?.temp_password) setTempPassword(String(data.temp_password));
                await load();
              } catch (err) {
                ctx.setError(err.message);
              } finally {
                ctx.setLoading(false);
              }
            }}
          >
            <div className="ui-field ui-field--full">
              <div className="ui-label">Usuario</div>
              <div className="ui-strong">
                {resetPasswordUser.email} ({resetPasswordUser.username})
              </div>
            </div>
            <label className="ui-field ui-field--full">
              <span className="ui-label">Nueva contraseña (opcional)</span>
              <input className="ui-input mono" value={resetPasswordValue} onChange={(e) => setResetPasswordValue(e.target.value)} placeholder="Deja vacío para autogenerar" />
            </label>
            <div className="ui-actions ui-actions--end ui-field--full">
              <button className="ui-btn ui-btn--ghost" type="button" onClick={() => setResetPasswordOpen(false)}>
                Cancelar
              </button>
              <button className="ui-btn ui-btn--primary" type="submit" disabled={ctx.loading}>
                <span className="ui-btn-icon" aria-hidden>
                  <KeyRound size={18} strokeWidth={2.2} />
                </span>
                {ctx.loading ? 'Guardando…' : 'Restablecer contraseña'}
              </button>
            </div>
          </form>
          </fieldset>
        ) : null}
        {tempPassword ? (
          <div className="panel" style={{ marginTop: '0.85rem' }}>
            <div className="ui-muted">Contraseña temporal (dev):</div>
            <div className="mono" style={{ fontWeight: 700 }}>
              {tempPassword}
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}

