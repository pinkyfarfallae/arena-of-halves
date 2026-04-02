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
import { getPowers } from '../../data/powers';
import { db } from '../../firebase';
import { ref, update, get, remove } from 'firebase/database';
import { ARENA_ROLE, ROOM_STATUS } from '../../constants/battle';
import { ROLE } from '../../constants/role';
import { InviteReservation } from '../../types/battle';
import TrainingPracticeModal from './components/TrainingPracticeModal/TrainingPracticeModal';
import { hexToRgb } from '../../utils/color';
import { getTodayDate } from '../../services/training/dailyTrainingDice';
import { fetchTrainings, getTodayProgress, UserDailyProgress } from '../../services/training/dailyTrainingDice';
import { TRAINING_POINT_REQUEST_STATUS } from '../../constants/practiceStates';
import { POWER_OVERRIDES } from '../CharacterInfo/constants/overrides';

function getPreviousDate(dateStr: string): string {
  // dateStr format: "YYYY-MM-DD"
  const date = new Date(dateStr);
  date.setDate(date.getDate() - 1);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function TrainingGrounds() {
  const { user, role } = useAuth();
  const navigate = useNavigate();
  const [openPracticeArena, setOpenPracticeArena] = useState(false);
  const [practiceModalTab, setPracticeModalTab] = useState<'create' | 'join'>('create');
  const [practiceModalJoinCode, setPracticeModalJoinCode] = useState('');
  const [createdPracticeArenaId, setCreatedPracticeArenaId] = useState<string>(''); // Match arena pattern
  const [createdPracticeArenaStatus, setCreatedPracticeArenaStatus] = useState<string>('');
  const [pvpGateReady, setPvpGateReady] = useState(false);
  const [pvpGateOpenModal, setPvpGateOpenModal] = useState(false);
  const todayDate = getTodayDate();

  useEffect(() => {
    if (!openPracticeArena || !createdPracticeArenaId) {
      setCreatedPracticeArenaStatus('');
    }
  }, [openPracticeArena, createdPracticeArenaId]);

  useEffect(() => {
    let mounted = true;
    void (async () => {
      if (!user?.characterId) {
        if (mounted) {
          setCreatedPracticeArenaId('');
          setCreatedPracticeArenaStatus('');
          setPvpGateReady(true);
          setPvpGateOpenModal(true);
          setPracticeModalTab('create');
          setPracticeModalJoinCode('');
        }
        return;
      }

      try {
        const quotaPath = `trainingQuotas/${user.characterId}/${todayDate}`;
        const [quotaSnapshot, trainings, todayProgress] = await Promise.all([
          get(ref(db, quotaPath)).catch(() => null),
          fetchTrainings(user.characterId).catch(() => [] as UserDailyProgress[]),
          getTodayProgress(user.characterId).catch(() => null),
        ]);

        if (!mounted) return;

        const todaySheetTask = [...trainings].reverse().find((training) => training.date === todayDate) || null;
        const hasPendingSheetTask = !!todaySheetTask && todaySheetTask.verified !== TRAINING_POINT_REQUEST_STATUS.APPROVED;
        const hasLiveNormalTraining = todayProgress?.practiceMode === 'admin' && todayProgress.practiceState === 'live';
        const isFinishedNormalTraining = todayProgress?.practiceMode === 'admin' && todayProgress.practiceState === 'finished';
        const quotaUsed = !!quotaSnapshot?.exists();

        const canOpenModal = !hasPendingSheetTask && !hasLiveNormalTraining && !isFinishedNormalTraining && !quotaUsed;
        if (canOpenModal) {
          if (!createdPracticeArenaId) {
            const powerDeity = POWER_OVERRIDES[user.characterId?.toLowerCase()] ?? user.deityBlood;
            const powers = getPowers(powerDeity);
            const fighter = toFighterState(user, powers);
            const arenaId = await createRoom(
              fighter,
              `Training: ${user.nicknameEng} vs ???`,
              1,
              1,
              { practiceMode: true },
            );
            setCreatedPracticeArenaId(arenaId);
            setCreatedPracticeArenaStatus(ROOM_STATUS.CONFIGURING);
          }
          setCreatedPracticeArenaStatus(ROOM_STATUS.CONFIGURING);
          setPracticeModalTab('create');
          setPracticeModalJoinCode('');
          setPvpGateOpenModal(true);
        } else {
          setCreatedPracticeArenaId('');
          setCreatedPracticeArenaStatus('');
          setPracticeModalTab('create');
          setPracticeModalJoinCode('');
          setPvpGateOpenModal(false);
        }
      } finally {
        if (mounted) setPvpGateReady(true);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [todayDate, user, createdPracticeArenaId]);

  const handleTrainWithAdmin = () => {
    navigate('/training-grounds/guided');
  };

  const handlePvPMode = () => {
    if (!pvpGateReady) return;
    if (pvpGateOpenModal) {
      setOpenPracticeArena(true);
      return;
    }
    navigate('/training-grounds/pvp');
  };

  const handleRolePlaySubmission = () => {
    navigate('/training-grounds/tasks');
  };

  const handleFinalizePracticeRoom = async (opponent: Character): Promise<string> => {
    if (!user) throw new Error('User not authenticated');
    const inviteReservations: InviteReservation[] = [
      {
        characterId: opponent.characterId,
        team: ARENA_ROLE.TEAM_B,
      },
    ];

    const arenaId = createdPracticeArenaId;
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

    await update(ref(db, `arenas/${arenaId}`), {
      roomName: `Training: ${user.nicknameEng} vs ${opponent.nicknameEng}`,
      inviteReservations,
      status: ROOM_STATUS.WAITING,
      practiceMode: true,
    });

    setCreatedPracticeArenaStatus(ROOM_STATUS.WAITING);
    return arenaId;
  };

  const handleJoinPracticeRoom = async (roomCode: string) => {
    const code = roomCode.trim().toUpperCase();
    const room = await getRoom(code);
    if (!room) {
      throw new Error('Room not found. Check the code.');
    }
    if (room.practiceMode) {
      setCreatedPracticeArenaId(code);
      setCreatedPracticeArenaStatus(room.status);
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

  const activePracticeArenaId = createdPracticeArenaId;
  const activePracticeArenaStatus = createdPracticeArenaId ? (createdPracticeArenaStatus || ROOM_STATUS.CONFIGURING) : '';

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
        <Route path="/pvp" element={<PvP />} />
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
        roomStatus={activePracticeArenaStatus}
      />
    </div>
  );
}
