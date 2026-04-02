import React, { useEffect, useState } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import Stats from './pages/Stats/Stats';
import PvP from './pages/PvP/PvP';
import TrainWithAdmin from './pages/TrainWithAdmin/TrainWithAdmin';
import TrainingRoleplaySubmission from './pages/TrainingRoleplaySubmission/TrainingRoleplaySubmission';
import './TrainingGrounds.scss';
import { useAuth } from '../../hooks/useAuth';
import { Character } from '../../data/characters';
import { createRoom, getRoom, deleteRoom, toFighterState } from '../../services/battleRoom/battleRoom';
import { db } from '../../firebase';
import { ref, update, get, remove } from 'firebase/database';
import { ARENA_ROLE, ROOM_STATUS } from '../../constants/battle';
import { ROLE } from '../../constants/role';
import { InviteReservation } from '../../types/battle';
import TrainingPracticeModal from './components/TrainingPracticeModal/TrainingPracticeModal';
import { hexToRgb } from '../../utils/color';
import { getTodayDate } from '../../services/training/dailyTrainingDice';

function getPreviousDate(dateStr: string): string {
  // dateStr format: "YYYY-MM-DD"
  const date = new Date(dateStr);
  date.setDate(date.getDate() - 1);
  return date.toISOString().split('T')[0];
}

export default function TrainingGrounds() {
  const { user, role } = useAuth();
  const navigate = useNavigate();
  const [openPracticeArena, setOpenPracticeArena] = useState(false);
  const [practiceModalTab, setPracticeModalTab] = useState<'create' | 'join'>('create');
  const [practiceModalJoinCode, setPracticeModalJoinCode] = useState('');
  const [createdPracticeArenaId, setCreatedPracticeArenaId] = useState<string>(''); // Match arena pattern
  const [createdPracticeArenaStatus, setCreatedPracticeArenaStatus] = useState<string>('');
  const todayDate = getTodayDate();
  const practiceSessionKey = user?.characterId ? `training-pvp-session:${user.characterId}` : '';

  const getPracticeSession = () => {
    if (!practiceSessionKey) return null;
    const raw = localStorage.getItem(practiceSessionKey);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as { arenaId?: string; roomCode?: string; date?: string; state?: string };
    } catch {
      return null;
    }
  };

  useEffect(() => {
    let mounted = true;
    void (async () => {
      const arenaId = createdPracticeArenaId || getPracticeSession()?.arenaId || '';
      if (!openPracticeArena || !arenaId) {
        if (mounted) setCreatedPracticeArenaStatus('');
        return;
      }

      const room = await getRoom(arenaId).catch(() => null);
      if (!mounted) return;
      setCreatedPracticeArenaStatus(room?.status ?? '');
    })();

    return () => {
      mounted = false;
    };
  }, [openPracticeArena, createdPracticeArenaId, practiceSessionKey, todayDate]);

  useEffect(() => {
    let mounted = true;
    void (async () => {
      const session = getPracticeSession();
      if (!session?.arenaId || !session.date || session.date === todayDate) return;
      const room = await getRoom(session.arenaId).catch(() => null);
      if (!mounted) return;
      if (room) {
        await deleteRoom(session.arenaId).catch(() => { });
      }
      localStorage.removeItem(practiceSessionKey);
    })();
    return () => {
      mounted = false;
    };
  }, [practiceSessionKey, todayDate]);

  const handleTrainWithAdmin = () => {
    navigate('/training-grounds/guided');
  };

  const handlePvPMode = () => {
    void (async () => {
      if (!user?.characterId) {
        setCreatedPracticeArenaId('');
        setCreatedPracticeArenaStatus('');
        setPracticeModalTab('create');
        setPracticeModalJoinCode('');
        setOpenPracticeArena(true);
        return;
      }

      try {
        const session = getPracticeSession();
        if (session?.arenaId && session.date && session.date !== todayDate) {
          const room = await getRoom(session.arenaId);
          if (room) {
            await deleteRoom(session.arenaId).catch(() => { });
          }
          localStorage.removeItem(practiceSessionKey);
        }

        if (session?.arenaId && session.date === todayDate) {
          const room = await getRoom(session.arenaId);
          if (room && (room.status === ROOM_STATUS.CONFIGURING || room.status === ROOM_STATUS.WAITING)) {
            setCreatedPracticeArenaId(session.arenaId);
            setCreatedPracticeArenaStatus(room.status);
            setPracticeModalTab('create');
            setPracticeModalJoinCode('');
            setOpenPracticeArena(true);
            return;
          }
          if (room && room.status !== ROOM_STATUS.FINISHED) {
            setCreatedPracticeArenaId('');
            setCreatedPracticeArenaStatus(room.status);
            setPracticeModalTab('join');
            setPracticeModalJoinCode(session.roomCode || session.arenaId);
            setOpenPracticeArena(true);
            return;
          }
          // Room is FINISHED or doesn't exist - clear the session so quota path doesn't use stale arenaId
          if (!room || room.status === ROOM_STATUS.FINISHED) {
            localStorage.removeItem(practiceSessionKey);
          }
        }

        // Check quota from Firebase instead of localStorage
        const quotaPath = `trainingQuotas/${user.characterId}/${todayDate}`;
        const quotaSnapshot = await get(ref(db, quotaPath));
        const quotaUsed = quotaSnapshot.exists();
        
        if (quotaUsed) {
          // Re-check session after potential cleanup above
          const currentSession = getPracticeSession();
          const existingArenaId = currentSession?.arenaId ?? '';
          setCreatedPracticeArenaId(existingArenaId);
          setCreatedPracticeArenaStatus(currentSession?.state === 'configuring' ? ROOM_STATUS.CONFIGURING : '');
          setPracticeModalTab('create');
          setPracticeModalJoinCode(currentSession?.roomCode || existingArenaId);
          setOpenPracticeArena(true);
          return;
        }

        const arenaId = await handleStartPractice();
        setCreatedPracticeArenaId(arenaId);
        setCreatedPracticeArenaStatus(ROOM_STATUS.CONFIGURING);
        setPracticeModalTab('create');
        setPracticeModalJoinCode('');
        setOpenPracticeArena(true);
      } catch (error) {
        setCreatedPracticeArenaId('');
        setCreatedPracticeArenaStatus('');
        setPracticeModalTab('create');
        setPracticeModalJoinCode('');
        setOpenPracticeArena(true);
      }
    })();
  };

  const handleRolePlaySubmission = () => {
    navigate('/training-grounds/tasks');
  };

  const handleStartPractice = async (): Promise<string> => {
    if (!user) throw new Error('User not authenticated');
    const session = getPracticeSession();
    if (session?.arenaId) {
      const room = await getRoom(session.arenaId);
      if (room && room.status !== ROOM_STATUS.FINISHED) {
        throw new Error('You already have a PvP practice for today. Rejoin it instead.');
      }
    }

    // Check quota from Firebase instead of localStorage
    const quotaPath = `trainingQuotas/${user.characterId}/${todayDate}`;
    const quotaRef = ref(db, quotaPath);
    const quotaSnapshot = await get(quotaRef);
    if (quotaSnapshot.exists()) {
      throw new Error('You already used your practice quota for today.');
    }

    const host = toFighterState(user, []);
    try {
      const arenaId = await createRoom(
        host,
        `Training: ${user.nicknameEng}`,
        1,
        1,
        { practiceMode: true },
      );
      await update(ref(db, `arenas/${arenaId}`), {
        inviteReservations: null,
        status: ROOM_STATUS.CONFIGURING,
      });

      // Store quota in Firebase
      await update(quotaRef, {
        used: true,
        arenaId,
        timestamp: Date.now(),
      });
      setCreatedPracticeArenaStatus(ROOM_STATUS.CONFIGURING);

      if (practiceSessionKey) {
        localStorage.setItem(practiceSessionKey, JSON.stringify({
          arenaId,
          roomCode: arenaId,
          date: todayDate,
          state: 'configuring',
        }));
      }

      // Match arena pattern: set state after creating room
      setCreatedPracticeArenaId(arenaId);
      return arenaId;
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to create training room');
    }
  };

  const handleFinalizePracticeRoom = async (opponent: Character): Promise<string> => {
    if (!user) throw new Error('User not authenticated');
    const session = getPracticeSession();
    const arenaId = createdPracticeArenaId || session?.arenaId || '';
    if (!arenaId) {
      throw new Error('No configuring training room found.');
    }

    const room = await getRoom(arenaId);
    if (!room) {
      throw new Error('Room not found. Check the code.');
    }
    if (room.status !== ROOM_STATUS.CONFIGURING && room.status !== ROOM_STATUS.WAITING) {
      throw new Error('This room can no longer be configured.');
    }

    const inviteReservations: InviteReservation[] = [
      {
        characterId: opponent.characterId,
        team: ARENA_ROLE.TEAM_B,
      },
    ];

    await update(ref(db, `arenas/${arenaId}`), {
      roomName: `Training: ${user.nicknameEng} vs ${opponent.nicknameEng}`,
      inviteReservations,
      status: ROOM_STATUS.WAITING,
    });

    setCreatedPracticeArenaStatus(ROOM_STATUS.WAITING);
    if (practiceSessionKey) {
      localStorage.setItem(practiceSessionKey, JSON.stringify({
        arenaId,
        roomCode: arenaId,
        date: todayDate,
        state: 'waiting',
      }));
    }

    return arenaId;
  };

  const handleJoinPracticeRoom = async (roomCode: string) => {
    const code = roomCode.trim().toUpperCase();
    const room = await getRoom(code);
    if (!room) {
      throw new Error('Room not found. Check the code.');
    }
    if (room.practiceMode && practiceSessionKey) {
      setCreatedPracticeArenaStatus(room.status);
      localStorage.setItem(practiceSessionKey, JSON.stringify({
        arenaId: code,
        roomCode: code,
        date: todayDate,
      }));
    }
    return code;
  };

  const handleDeletePracticeRoom = async (roomCode: string) => {
    const code = roomCode.trim().toUpperCase();
    const room = await getRoom(code);
    if (!room) {
      throw new Error('Room not found. Check the code.');
    }
    const canDeleteAnyState = role === ROLE.DEVELOPER;
    const canDeleteBeforeBattle = room.status === ROOM_STATUS.CONFIGURING || room.status === ROOM_STATUS.WAITING;
    if (!canDeleteBeforeBattle && !canDeleteAnyState) {
      throw new Error('Only waiting rooms can be deleted.');
    }

    await deleteRoom(code);

    const session = getPracticeSession();
    if (session?.arenaId === code && practiceSessionKey) {
      localStorage.removeItem(practiceSessionKey);
    }
    
    // Refund practice quota from Firebase
    // For developers: reset the room owner's quota
    // For regular users: reset their own quota
    let quotaOwnerId = user?.characterId;
    let quotaDate = todayDate;
    
    if (canDeleteAnyState && room.teamA?.members?.[0]?.characterId) {
      // Developer deleting someone else's room - get owner info from room
      quotaOwnerId = room.teamA.members[0].characterId;
      
      // Try to find the quota date from existing quotas
      // Check today first, then yesterday
      const dates = [todayDate, getPreviousDate(todayDate)];
      for (const date of dates) {
        const checkPath = `trainingQuotas/${quotaOwnerId}/${date}`;
        const snapshot = await get(ref(db, checkPath));
        if (snapshot.exists() && snapshot.val()?.arenaId === code) {
          quotaDate = date;
          break;
        }
      }
      
      console.log(`[Dev] Resetting quota for ${quotaOwnerId} (date: ${quotaDate})`);
    }
    
    const quotaPath = `trainingQuotas/${quotaOwnerId}/${quotaDate}`;
    await remove(ref(db, quotaPath));

    // Match arena pattern: clear state after deleting
    setCreatedPracticeArenaId('');
    setCreatedPracticeArenaStatus('');
  };

  const activePracticeArenaId = createdPracticeArenaId || getPracticeSession()?.arenaId || '';

  const themeStyle = {
    primaryColor: user?.theme[0] || '#C0A062',
    primaryColorRgb: hexToRgb(user?.theme[0] || '#C0A062'),
    darkColor: user?.theme[1] || '#2c2c2c',
    darkColorRgb: hexToRgb(user?.theme[1] || '#2c2c2c'),
    lightColor: user?.theme[2] || '#f5f5f5',
    surfaceHover: user?.theme[11] || '#e8e8e8',
    overlayText: user?.theme[17] || '#333333',
    accentDark: user?.theme[19] || '#0f1a2e',
  };

  return (
    <div className="training-grounds">
      <Routes>
        <Route path="/" element={<Stats onSelectTrainingWithAdminMode={handleTrainWithAdmin} onSelectPvPMode={handlePvPMode} onSelectRolePlaySubmission={handleRolePlaySubmission} />} />
        <Route path="/pvp/:arenaId" element={<PvP />} />
        <Route path="/guided" element={<TrainWithAdmin />} />
        <Route path="/tasks" element={<TrainingRoleplaySubmission />} />
      </Routes>
      <TrainingPracticeModal
        open={openPracticeArena}
        currentCharacterId={user?.characterId}
        theme={themeStyle}
        role={role}
        onClose={() => setOpenPracticeArena(false)}
        onFinalizePracticeRoom={handleFinalizePracticeRoom}
        onJoinPracticeRoom={handleJoinPracticeRoom}
        onDeletePracticeRoom={handleDeletePracticeRoom}
        initialTab={practiceModalTab}
        initialJoinCode={practiceModalJoinCode}
        arenaId={activePracticeArenaId}
        roomStatus={createdPracticeArenaStatus}
      />
    </div>
  );
}
