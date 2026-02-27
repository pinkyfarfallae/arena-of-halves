import { Routes, Route, NavLink, Navigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { ROLE } from '../../constants/role';
import User from './pages/User/User';
import './AdminManager.scss';

const TABS = [
  { label: 'User Accounts', path: 'users' },
] as const;

function AdminManager() {
  const { role } = useAuth();

  if (role !== ROLE.ADMIN && role !== ROLE.DEVELOPER) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="admin">
      <header className="admin__bar">
        <nav className="admin__tabs">
          {TABS.map(t => (
            <NavLink
              key={t.path}
              to={`/admin/${t.path}`}
              className={({ isActive }) =>
                `admin__tab${isActive ? ' admin__tab--active' : ''}`
              }
            >
              {t.label}
            </NavLink>
          ))}
        </nav>
      </header>

      <div className="admin__body">
        <Routes>
          <Route index element={<Navigate to="users" replace />} />
          <Route path="users" element={<User />} />
        </Routes>
      </div>
    </div>
  );
}

export default AdminManager;
