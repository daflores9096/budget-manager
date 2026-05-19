export default function SavingOverlay({ label = 'Procesando…' }) {
  return (
    <div className="ui-page-saving" role="status" aria-live="polite" aria-busy="true">
      <span className="ui-spinner" aria-hidden />
      <span>{label}</span>
    </div>
  );
}
