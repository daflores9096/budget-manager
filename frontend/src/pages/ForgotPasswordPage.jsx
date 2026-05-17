import { useState } from 'react';
import { api } from '../api.js';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('');
  const [resetLink, setResetLink] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    setStatus('');
    setResetLink('');
    try {
      setLoading(true);
      const data = await api('/api/auth/forgot', { method: 'POST', body: { email } });
      setStatus('Si el correo existe, se generó un enlace de restablecimiento.');
      if (data?.reset_link) setResetLink(String(data.reset_link));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="ui-stack">
      <div>
        <div className="ui-card-title">Restablecer contraseña</div>
        <div className="ui-card-sub">Ingresa tu correo para solicitar un enlace de restablecimiento.</div>
      </div>
      {error ? <div className="panel error">{error}</div> : null}
      {status ? <div className="panel">{status}</div> : null}
      <form className="ui-form-grid ui-form-grid--cats" onSubmit={onSubmit}>
        <label className="ui-field">
          <span className="ui-label">Email</span>
          <input className="ui-input" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
        </label>
        <div className="ui-actions ui-actions--end">
          <button className="ui-btn ui-btn--primary" type="submit" disabled={loading}>
            Solicitar enlace
          </button>
        </div>
      </form>
      {resetLink ? (
        <div className="panel">
          <div className="ui-muted">Enlace (modo desarrollo):</div>
          <a href={resetLink} className="mono" style={{ wordBreak: 'break-all' }}>
            {resetLink}
          </a>
        </div>
      ) : null}
    </div>
  );
}

