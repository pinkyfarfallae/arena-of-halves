import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';
import Login from './pages/Login/Login';
import Navbar from './components/Navbar/Navbar';
import CharacterInfo from './pages/CharacterInfo/CharacterInfo';
import CampMembers from './pages/CampMembers/CampMembers';
import LifeInCamp from './pages/LifeInCamp/LifeInCamp';
import IrisMessage from './pages/IrisMessage/IrisMessage';
import Shop from './pages/Shop/Shop';
import Forge from './pages/Forge/Forge';
import AdminManager from './pages/AdminManager/AdminManager';
import './App.scss';

export const applyTheme = (t: string[]): React.CSSProperties => ({
  '--ci-primary': t[0],
  '--ci-dark': t[1],
  '--ci-light': t[2],
  '--ci-accent': t[3],
  '--ci-bg': t[4],
  '--ci-fg': t[5],
  '--ci-surface': t[6],
  '--ci-muted': t[7],
  '--ci-border': t[8],
  '--ci-primary-hover': t[9],
  '--ci-accent-soft': t[10],
  '--ci-surface-hover': t[11],
  '--ci-bg-alt': t[12],
  '--ci-shadow': t[13],
  '--ci-highlight': t[14],
  '--ci-overlay': t[15],
  '--ci-nav-icon': t[16],
  '--ci-overlay-text': t[17],
  '--ci-primary-dark': t[18],
  '--ci-accent-dark': t[19],
  '--ci-left-grad1': t[20],
  '--ci-left-grad2': t[21],
  '--ci-right-grad1': t[22],
  '--ci-right-grad2': t[23],
  '--ci-tag-color': t[24],
} as React.CSSProperties);

function AppRoutes() {
  const { isLoggedIn, restoring } = useAuth();

  if (restoring) {
    return (
      <div className="app-loader">
        <div className="app-loader__ring" />
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <>
      <Navbar />
      <main className="app__content app__content--with-sidebar">
        <Routes>
          <Route path="/" element={<CharacterInfo />} />
          <Route path="/camp" element={<CampMembers />} />
          <Route path="/life" element={<LifeInCamp />} />
          <Route path="/iris-message" element={<IrisMessage />} />
          <Route path="/shop" element={<Shop />} />
          <Route path="/craft-forge" element={<Forge />} />
          <Route path="/admin/*" element={<AdminManager />} />
          <Route path="/character/:id" element={<CharacterInfo />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </>
  );
}

function AppShell() {
  const { user } = useAuth();

  let themeVars: React.CSSProperties | undefined;

  if (user) {
    themeVars = applyTheme(user.theme);
  } else {
    try {
      const cached = localStorage.getItem('aoh_theme');
      if (cached) {
        themeVars = applyTheme(JSON.parse(cached));
      }
    } catch { /* ignore */ }
  }

  return (
    <div className="app" style={themeVars}>
      <AppRoutes />
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <HashRouter>
        <AppShell />
      </HashRouter>
    </AuthProvider>
  );
}

export default App;
