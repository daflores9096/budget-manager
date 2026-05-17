import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api, setAccessToken } from '../api.js';

export default function LoginPage() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const next = useMemo(() => params.get('next') || '/dashboard', [params]);
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    try {
      setLoading(true);
      const data = await api('/api/auth/login', { method: 'POST', body: { login, password } });
      if (data?.access_token) setAccessToken(String(data.access_token));
      nav(next, { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-content">
      <div className="auth-head">
        <div className="auth-badge">Budget Manager</div>
        <div className="auth-title">Bienvenido/a de nuevo</div>
        <div className="auth-sub">Inicia sesión para acceder a tu dashboard, ingresos y gastos.</div>
      </div>
      {error ? <div className="panel error">{error}</div> : null}
      <form className="auth-form" onSubmit={onSubmit}>
        <label className="ui-field">
          <span className="ui-label">Email o usuario</span>
          <input
            className="ui-input"
            value={login}
            onChange={(e) => setLogin(e.target.value)}
            autoComplete="username"
            placeholder="tucorreo@ejemplo.com o usuario"
          />
        </label>
        <label className="ui-field">
          <span className="ui-label">Contraseña</span>
          <input className="ui-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
        </label>
        <button className="ui-btn ui-btn--primary auth-submit" type="submit" disabled={loading}>
          Ingresar
        </button>
      </form>
      <div className="auth-foot">
        <button className="ui-btn ui-btn--ghost" type="button" onClick={() => nav('/forgot-password')}>
          ¿Olvidaste tu contraseña?
        </button>
      </div>
    </div>
  );
}

