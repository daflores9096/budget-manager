import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api.js';

export default function ResetPasswordPage() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const token = useMemo(() => params.get('token') || '', [params]);

  const [pw1, setPw1] = useState('');
  const [pw2, setPw2] = useState('');
  const [error, setError] = useState('');
  const [ok, setOk] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    if (!token) {
      setError('Falta el token.');
      return;
    }
    if (pw1 !== pw2) {
      setError('Las contraseñas no coinciden.');
      return;
    }
    try {
      setLoading(true);
      await api('/api/auth/reset', { method: 'POST', body: { token, new_password: pw1 } });
      setOk(true);
      setTimeout(() => nav('/login', { replace: true }), 700);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="ui-stack">
      <div>
        <div className="ui-card-title">Crear nueva contraseña</div>
        <div className="ui-card-sub">Elige una nueva contraseña para tu cuenta.</div>
      </div>
      {error ? <div className="panel error">{error}</div> : null}
      {ok ? <div className="panel">Contraseña actualizada. Redirigiendo al login…</div> : null}
      <form className="ui-form-grid ui-form-grid--cats" onSubmit={onSubmit}>
        <label className="ui-field">
          <span className="ui-label">Nueva contraseña</span>
          <input className="ui-input" type="password" value={pw1} onChange={(e) => setPw1(e.target.value)} autoComplete="new-password" />
        </label>
        <label className="ui-field">
          <span className="ui-label">Confirmar contraseña</span>
          <input className="ui-input" type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} autoComplete="new-password" />
        </label>
        <div className="ui-actions ui-actions--end ui-field--full">
          <button className="ui-btn ui-btn--primary" type="submit" disabled={loading}>
            Guardar contraseña
          </button>
        </div>
      </form>
    </div>
  );
}

