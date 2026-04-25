import React, { useEffect, useState } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { LanguageProvider } from './contexts/LanguageContext';
import Login from './pages/Login/Login';
import Navbar from './components/Navbar/Navbar';
import CharacterInfo from './pages/CharacterInfo/CharacterInfo';
import CampMembers from './pages/CampMembers/CampMembers';
import LifeInCamp from './pages/LifeInCamp/LifeInCamp';
import IrisMessage from './pages/IrisMessage/IrisMessage';
import Shop from './pages/Shop/Shop';
import Forge from './pages/Forge/Forge';
import AdminManager from './pages/AdminManager/AdminManager';
import Lobby from './pages/Lobby/Lobby';
import Arena from './pages/Arena/Arena';
import StrawberryFields from './pages/StrawberryFields/StrawberryFields';
import BigHouse from './pages/BigHouse/BigHouse';
import TrainingGrounds from './pages/TrainingGrounds/TrainingGrounds';
import { hexToRgb } from './utils/color';
import DailyGift from './components/DailyGift/DailyGift';
import { updateCharacterDrachma } from './services/character/currencyService';
// Using server-side persistence for daily claims; no localStorage fallback
import { getUserDailyClaim, tryClaimToday, unmarkUserClaimedToday } from './services/daily/dailyClaimService';
import DiceRollerSimulator from './pages/DiceRollerSimulator/DiceRollerSimulator';
import CampTreasury from './pages/CampTreasuryTransfer/CampTreasuryTransfer';
import './App.scss';

export const applyTheme = (t: string[]): React.CSSProperties => ({
  '--ci-primary': t[0],
  '--ci-primary-rgb': hexToRgb(t[0]) || '255, 255, 255',
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
          <Route path="/dice" element={<DiceRollerSimulator />} />
          <Route path="/iris-message" element={<IrisMessage />} />
          <Route path="/shop" element={<Shop />} />
          <Route path="/forge" element={<Forge />} />
          <Route path="/big-house" element={<BigHouse />} />
          <Route path="/strawberry-fields" element={<StrawberryFields />} />
          <Route path="/treasury-transfer" element={<CampTreasury />} />
          <Route path="/training-grounds/*" element={<TrainingGrounds />} />
          <Route path="/arena" element={<Lobby />} />
          <Route path="/arena/:arenaId" element={<Arena />} />
          <Route path="/admin/*" element={<AdminManager />} />
          <Route path="/character/:id" element={<CharacterInfo />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </>
  );
}

function AppShell() {
  const { user, refreshUser } = useAuth();

  const [showDailyGift, setShowDailyGift] = useState(false);
  const [giftAmount, setGiftAmount] = useState(0);
  const [checkedDailyGiftForSession, setCheckedDailyGiftForSession] = useState<string | null>(null);
  const dailyGiftFetchingRef = React.useRef(false);

  let themeVars: React.CSSProperties | undefined;

  // Reset daily gift state when user logs out
  useEffect(() => {
    if (!user) {
      setShowDailyGift(false);
      setGiftAmount(0);
      setCheckedDailyGiftForSession(null);
      dailyGiftFetchingRef.current = false;
    }
  }, [user?.characterId]);

  // Reset the daily-gift session flag at midnight so it auto-triggers for the new day
  useEffect(() => {
    if (!user) return;

    const now = new Date();
    const midnight = new Date(now);
    midnight.setHours(24, 0, 0, 0);
    const msUntilMidnight = midnight.getTime() - now.getTime();

    const timeout = setTimeout(() => {
      dailyGiftFetchingRef.current = false;
      setCheckedDailyGiftForSession(null);
    }, msUntilMidnight);

    return () => clearTimeout(timeout);
  }, [user?.characterId, checkedDailyGiftForSession]);

  // Check for unclaimed daily gift. Re-runs when checkedDailyGiftForSession is cleared
  // (midnight reset or new login). Does NOT mark as checked until the user actually claims,
  // so dismissing the modal without claiming will show it again on the next trigger.
  useEffect(() => {
    if (!user) return;
    if (checkedDailyGiftForSession === user.characterId) return;
    if (showDailyGift) return; // already showing — don't fetch again
    if (dailyGiftFetchingRef.current) return; // fetch already in-flight

    let cancelled = false;
    dailyGiftFetchingRef.current = true;

    (async () => {
      try {
        const serverEntry = await getUserDailyClaim(user.characterId).catch(() => ({ accepted: false, amount: (Math.floor(Math.random() * 5) + 1) * 10 }));
        if (cancelled) return;

        if (serverEntry.accepted) {
          // Already claimed today — mark session as done
          setCheckedDailyGiftForSession(user.characterId);
          dailyGiftFetchingRef.current = false;
          return;
        }

        // Unclaimed — show the modal but do NOT mark session as checked yet.
        // checkedDailyGiftForSession is only set after the user actually claims (see onClaim).
        setGiftAmount(serverEntry.amount);
        setShowDailyGift(true);
        dailyGiftFetchingRef.current = false;
      } catch (e) {
        dailyGiftFetchingRef.current = false;
      }
    })();

    return () => { cancelled = true; };
  }, [user?.characterId, checkedDailyGiftForSession, showDailyGift]);

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
      {user && showDailyGift && (
        <DailyGift
          amount={giftAmount}
          onClaim={async () => {
            setShowDailyGift(false);
            // Mark session as done now that the user has claimed
            setCheckedDailyGiftForSession(user.characterId);
            try {
              // Reserve the claim atomically to prevent double-claim on refresh
              const reserved = await tryClaimToday(user.characterId);
              if (!reserved) {
                // Someone already claimed (or transaction failed)
                try { await refreshUser(); } catch {}
                return;
              }

              const res = await updateCharacterDrachma(user.characterId, giftAmount, { source: 'daily_gift' });
              if (res.success) {
                try { await refreshUser(); } catch (e) { /* ignore */ }
              } else {
                // Award failed; rollback reservation
                try { await unmarkUserClaimedToday(user.characterId); } catch (e) { /* ignore */ }
                // console.error('Failed to award daily gift', res.error);
              }
            } catch (err) {
              // If something unexpectedly fails, attempt rollback
              try { await unmarkUserClaimedToday(user.characterId); } catch (e) { /* ignore */ }
              // console.error('Error claiming daily gift', err);
            }
          }}
        />
      )}
    </div>
  );
}

function App() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <HashRouter>
          <AppShell />
        </HashRouter>
      </AuthProvider>
    </LanguageProvider>
  );
}

export default App;
