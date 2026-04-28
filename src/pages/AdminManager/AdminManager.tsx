import { Routes, Route, NavLink, Navigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { ROLE } from '../../constants/role';
import User from './pages/User/User';
import SystemTesting, { SystemTestDice, SystemTestIris } from './pages/SystemTesting/SystemTesting';
import PowerVfxDemo from './pages/PowerVfxDemo/PowerVfxDemo';
import HarvestApproval from './pages/HarvestApproval/HarvestApproval';
import DailyTrainingConfig from './pages/DailyTrainingConfig/DailyTrainingConfig';
import TrainingApproval from './pages/TrainingApproval/TrainingApproval';
import ItemManagement from './pages/ItemManagement/ItemManagement';
import EquipmentManagement from './pages/EquipmentManagement/EquipmentManagement';
import PlayerInventory from './pages/PlayerInventory/PlayerInventory';
import './AdminManager.scss';
import NpcAffinityManagement from './pages/NpcAffinityManagement/NpcAffinityManagement';
import BigHouseSubmissionApproval from './pages/BigHouseSubmissionApproval/BigHouseSubmissionApproval';
import ActivityLog from './pages/ActivityLog/ActivityLog';
import { DatabaseManagement } from './pages/DatabaseManagement/DatabaseManagement';

const TABS = [
  { label: 'User Accounts', path: 'users' },
  { label: 'Player Inventory', path: 'player-inventory' },
  { label: 'Item Management', path: 'item-management' },
  { label: 'NPC Affinity', path: 'npc-affinity' },
  { label: 'Big House Roleplay Approval', path: 'big-house-roleplay-approval' },
  { label: 'Custom Equipment', path: 'equipment-management' },
  { label: 'Harvest Approval', path: 'harvest-approval' },
  { label: 'Daily Training Config', path: 'daily-training-config' },
  { label: 'Training Approval', path: 'training-approval' },
  { label: 'System Testing', path: 'testing' },
  { label: 'Activity Log', path: 'activity-log' },
  { label: 'Database Management', path: 'database-management', developerOnly: true },
  { label: 'Powers VFX Demo', path: 'power-vfx-demo', developerOnly: true },
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
          <Route path="player-inventory" element={<PlayerInventory />} />
          <Route path="harvest-approval" element={<HarvestApproval />} />
          <Route path="big-house-roleplay-approval" element={<BigHouseSubmissionApproval />} />
          <Route path="testing" element={<SystemTesting />} />
          <Route path="testing/dice" element={<SystemTestDice />} />
          <Route path="testing/iris-message" element={<SystemTestIris />} />
          <Route path="power-vfx-demo" element={<PowerVfxDemo />} />
          <Route path="daily-training-config" element={<DailyTrainingConfig />} />
          <Route path="training-approval" element={<TrainingApproval />} />
          <Route path="item-management" element={<ItemManagement />} />
          <Route path="equipment-management" element={<EquipmentManagement />} />
          <Route path="npc-affinity" element={<NpcAffinityManagement />} />
          <Route path="activity-log" element={<ActivityLog />} />
          <Route path="database-management" element={<DatabaseManagement />} />
        </Routes>
      </div>
    </div>
  );
}

export default AdminManager;
