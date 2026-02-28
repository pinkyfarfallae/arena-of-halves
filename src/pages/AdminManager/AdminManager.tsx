import { Routes, Route, NavLink, Navigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { ROLE } from '../../constants/role';
import User from './pages/User/User';
import SystemTesting, { SystemTestDice, SystemTestIris } from './pages/SystemTesting/SystemTesting';
import './AdminManager.scss';

const TABS = [
  { label: 'User Accounts', path: 'users' },
  { label: 'System Testing', path: 'testing' },
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
          <Route path="testing" element={<SystemTesting />} />
          <Route path="testing/dice" element={<SystemTestDice />} />
          <Route path="testing/iris-message" element={<SystemTestIris />} />
        </Routes>
      </div>
    </div>
  );
}

export default AdminManager;
