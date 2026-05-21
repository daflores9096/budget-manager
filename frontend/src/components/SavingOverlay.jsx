export default function SavingOverlay({ label = 'Procesando…', className = '' }) {
  return (
    <div className={`ui-page-saving${className ? ` ${className}` : ''}`} role="status" aria-live="polite" aria-busy="true">
      <span className="ui-spinner" aria-hidden />
      <span>{label}</span>
    </div>
  );
}
