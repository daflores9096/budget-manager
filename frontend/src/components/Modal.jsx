import { X } from 'lucide-react';

export default function Modal({ open, title, children, onClose, busy = false, busyLabel = 'Guardando…' }) {
  if (!open) return null;
  const handleClose = () => {
    if (busy) return;
    onClose();
  };
  return (
    <div className="ui-modal" role="dialog" aria-modal="true" aria-label={title} aria-busy={busy}>
      <button type="button" className="ui-modal-backdrop" aria-label="Cerrar modal" onClick={handleClose} />
      <div className="ui-modal-card">
        <div className="ui-modal-head">
          <div className="ui-modal-title">{title}</div>
          <button type="button" className="ui-icon-btn" aria-label="Cerrar" onClick={handleClose} disabled={busy}>
            <X size={18} strokeWidth={2.2} aria-hidden />
          </button>
        </div>
        <div className={`ui-modal-body${busy ? ' ui-modal-body--busy' : ''}`}>
          {children}
          {busy ? (
            <div className="ui-modal-saving" role="status" aria-live="polite">
              <span className="ui-spinner" aria-hidden />
              <span>{busyLabel}</span>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
