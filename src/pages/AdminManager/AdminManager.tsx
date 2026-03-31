import { Routes, Route, NavLink, Navigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { ROLE } from '../../constants/role';
import User from './pages/User/User';
import SystemTesting, { SystemTestDice, SystemTestIris } from './pages/SystemTesting/SystemTesting';
import PowerVfxDemo from './pages/PowerVfxDemo/PowerVfxDemo';
import HarvestApproval from './pages/HarvestApproval/HarvestApproval';
import './AdminManager.scss';
import DailyTrainingConfig from './pages/DailyTrainingConfig/DailyTrainingConfig';

const TABS = [
  { label: 'User Accounts', path: 'users' },
  { label: 'Harvest Approval', path: 'harvest-approval' },
  { label: 'System Testing', path: 'testing' },
  { label: 'Powers VFX Demo', path: 'power-vfx-demo', developerOnly: true },
  { label: 'Daily Training Config', path: 'daily-training-config', developerOnly: true },
] as const;

function AdminManager() {
  const { role } = useAuth();

  if (role !== ROLE.ADMIN && role !== ROLE.DEVELOPER) {
    return <Navigate to="/" replace />;
  }

  const visibleTabs = TABS.filter(t => !('developerOnly' in t && t.developerOnly) || role === ROLE.DEVELOPER);

  return (
    <div className="admin">
      <header className="admin__bar">
        <nav className="admin__tabs">
          {visibleTabs.map(t => (
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
          <Route path="harvest-approval" element={<HarvestApproval />} />
          <Route path="testing" element={<SystemTesting />} />
          <Route path="testing/dice" element={<SystemTestDice />} />
          <Route path="testing/iris-message" element={<SystemTestIris />} />
          <Route path="power-vfx-demo" element={<PowerVfxDemo />} />
          <Route path="daily-training-config" element={<DailyTrainingConfig />} />
        </Routes>
      </div>
    </div>
  );
}

export default AdminManager;
