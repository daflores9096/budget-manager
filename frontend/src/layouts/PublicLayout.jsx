import { Outlet } from 'react-router-dom';

export default function PublicLayout() {
  return (
    <div className="auth-shell">
      <div className="auth-card">
        <Outlet />
      </div>
    </div>
  );
}

