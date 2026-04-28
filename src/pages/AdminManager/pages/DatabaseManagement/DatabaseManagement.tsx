import React, { useState } from 'react';
import FirestoreManager from './components/FirestoreManager/FirestoreManager';
import RealtimeManager from './components/RealtimeManager/RealtimeManager';
import SheetManager from './components/SheetManager/SheetManager';
import { DATABASE_TYPES } from '../../../../constants/database';
import './DatabaseManagement.scss';

export const DatabaseManagement = () => {

  const visibleTabs = [
    { label: 'Firestore', key: DATABASE_TYPES.FIRESTORE },
    { label: 'Realtime Database', key: DATABASE_TYPES.REALTIME },
    { label: 'Google Sheets', key: DATABASE_TYPES.SHEET },
  ];

  const [active, setActive] = useState<string>(DATABASE_TYPES.FIRESTORE);

  return (
    <div className="database-management">
      <header className="database-management__bar">
        <nav className="database-management__tabs">
          {visibleTabs.map((t) => (
            <button
              key={t.key}
              className={`database-management__tab${active === t.key ? ' database-management__tab--active' : ''}`}
              onClick={() => setActive(t.key)}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </header>

      <div className="database-management__panel">
        {active === DATABASE_TYPES.FIRESTORE && <FirestoreManager />}
        {active === DATABASE_TYPES.REALTIME && <RealtimeManager />}
        {active === DATABASE_TYPES.SHEET && <SheetManager />}
      </div>
    </div>
  );
};

export default DatabaseManagement;