import { useState } from 'react';
import { Download, UploadCloud } from 'lucide-react';
import { api, apiUrl, clearAccessToken, getAccessToken } from '../api.js';

function filenameFromDisposition(value) {
  const match = String(value || '').match(/filename="?([^"]+)"?/i);
  return match?.[1] || `budget-manager-backup-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.sql`;
}

async function responseError(res) {
  const text = await res.text();
  try {
    const data = JSON.parse(text);
    return [data?.error, data?.detail].filter(Boolean).join(' — ') || `HTTP ${res.status}`;
  } catch {
    return text || `HTTP ${res.status}`;
  }
}

export default function BackupsPage({ ctx }) {
  const [file, setFile] = useState(null);
  const [confirmText, setConfirmText] = useState('');
  const [message, setMessage] = useState('');

  async function createBackup() {
    ctx.setError('');
    setMessage('');
    try {
      ctx.setLoading(true);
      const token = getAccessToken();
      const res = await fetch(apiUrl('/api/backups'), {
        method: 'GET',
        credentials: 'include',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        throw new Error(await responseError(res));
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filenameFromDisposition(res.headers.get('Content-Disposition'));
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setMessage('Respaldo creado y descargado.');
    } catch (err) {
      ctx.setError(err.message || 'No se pudo crear el respaldo');
    } finally {
      ctx.setLoading(false);
    }
  }

  async function restoreBackup(e) {
    e.preventDefault();
    ctx.setError('');
    setMessage('');

    if (!file) {
      ctx.setError('Selecciona un archivo .sql');
      return;
    }
    if (confirmText !== 'RESTAURAR') {
      ctx.setError('Escribe RESTAURAR para confirmar');
      return;
    }
    if (!window.confirm('Esta acción borrará toda la base actual y restaurará el archivo seleccionado. ¿Continuar?')) {
      return;
    }

    const body = new FormData();
    body.append('backup', file);

    try {
      ctx.setLoading(true);
      await api('/api/backups/restore', { method: 'POST', body });
      clearAccessToken();
      setMessage('Respaldo restaurado. Vuelve a iniciar sesión para cargar los datos restaurados.');
      window.setTimeout(() => {
        window.location.assign('/login');
      }, 1800);
    } catch (err) {
      ctx.setError(err.message || 'No se pudo restaurar el respaldo');
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
        <div className="ui-card-head">
          <div>
            <div className="ui-card-title">Respaldos</div>
            <div className="ui-card-sub">Crea y restaura copias completas de la base de datos.</div>
          </div>
        </div>
        {message ? <div className="panel success">{message}</div> : null}
      </section>

      <section className="ui-card">
        <div className="ui-card-head ui-card-head--split">
          <div>
            <div className="ui-card-title">Crear respaldo</div>
            <div className="ui-card-sub">Descarga un archivo .sql con la estructura y todos los datos actuales.</div>
          </div>
          <button className="ui-btn ui-btn--primary" type="button" disabled={ctx.loading} onClick={createBackup}>
            <span className="ui-btn-icon" aria-hidden>
              <Download size={18} strokeWidth={2.2} />
            </span>
            Crear respaldo
          </button>
        </div>
      </section>

      <section className="ui-card">
        <div className="ui-card-head">
          <div>
            <div className="ui-card-title">Restaurar respaldo</div>
            <div className="ui-card-sub">
              Sube un .sql generado por esta app. La base actual se limpiará antes de restaurar tablas y contenido.
            </div>
          </div>
        </div>

        <form className="ui-form-grid ui-form-grid--ledger" onSubmit={restoreBackup}>
          <label className="ui-field ui-field--full">
            <span className="ui-label">Archivo SQL</span>
            <input className="ui-input" type="file" accept=".sql,application/sql,text/plain" disabled={ctx.loading} onChange={(e) => setFile(e.target.files?.[0] || null)} />
          </label>
          <label className="ui-field ui-field--full">
            <span className="ui-label">Confirmación</span>
            <input
              className="ui-input mono"
              value={confirmText}
              disabled={ctx.loading}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="Escribe RESTAURAR"
            />
          </label>
          <div className="ui-actions ui-actions--end ui-field--full">
            <button className="ui-btn ui-btn--danger" type="submit" disabled={ctx.loading || !file || confirmText !== 'RESTAURAR'}>
              <span className="ui-btn-icon" aria-hidden>
                <UploadCloud size={18} strokeWidth={2.2} />
              </span>
              Restaurar respaldo
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
