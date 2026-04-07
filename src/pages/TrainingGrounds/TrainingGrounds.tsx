import React, { useEffect, useState } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import Stats from './pages/Stats/Stats';
import PvP from './pages/PvP/PvP';
import TrainWithAdmin from './pages/TrainWithAdmin/TrainWithAdmin';
import TrainingRoleplaySubmission from './pages/TrainingRoleplaySubmission/TrainingRoleplaySubmission';
import { useAuth } from '../../hooks/useAuth';
import { Character } from '../../data/characters';
import { createRoom, getRoom, deleteRoom, toFighterState } from '../../services/battleRoom/battleRoom';
import { getPowers } from '../../data/powers';
import { db, firestore } from '../../firebase';
import { ref, update, get, remove } from 'firebase/database';
import { doc, deleteDoc } from 'firebase/firestore';
import { ARENA_ROLE, ROOM_STATUS } from '../../constants/battle';
import { ROLE } from '../../constants/role';
import { InviteReservation } from '../../types/battle';
import TrainingPracticeModal from './components/TrainingPracticeModal/TrainingPracticeModal';
import { hexToRgb } from '../../utils/color';
import { getTodayDate } from '../../services/training/dailyTrainingDice';
import { fetchUserTrainingTasks, getTodayProgress, TrainingTask, canUserTrain, savePracticeProgress } from '../../services/training/dailyTrainingDice';
import { TRAINING_POINT_REQUEST_STATUS } from '../../constants/trainingPointRequestStatus';
import { POWER_OVERRIDES } from '../CharacterInfo/constants/overrides';
import { PRACTICE_MODE, PRACTICE_STATES } from '../../constants/practice';
import { ARENA_ACTIONS, ArenaAction } from '../../constants/arenaAction';
import { FIRESTORE_COLLECTIONS } from '../../constants/fireStoreCollections';
import { fetchTodayIrisWish } from '../../data/wishes';
import './TrainingGrounds.scss';
import { DEITY } from '../../constants/deities';
import HeraBlocked from '../../components/HeraBlocked/HeraBlocked';

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
  const [practiceModalTab, setPracticeModalTab] = useState<ArenaAction>(ARENA_ACTIONS.CREATE);
  const [practiceModalJoinCode, setPracticeModalJoinCode] = useState('');
  const [createdPracticeArenaId, setCreatedPracticeArenaId] = useState<string>(''); // Match arena pattern
  const [createdPracticeArenaStatus, setCreatedPracticeArenaStatus] = useState<string>('');
  const [keepPracticeCreateTab, setKeepPracticeCreateTab] = useState(false);
  const [pvpGateReady, setPvpGateReady] = useState(false);
  const [pvpGateOpenModal, setPvpGateOpenModal] = useState(false);
  const [existingPvpArenaId, setExistingPvpArenaId] = useState<string>(''); // Existing room from DB
  const [pendingModalOpen, setPendingModalOpen] = useState(false); // Flag to open modal after room creation
  const [todayUserIrisWish, setTodayUserIrisWish] = useState<any>(null);
  const [heraBlocked, setHeraBlocked] = useState(false);
  const todayDate = getTodayDate();

  useEffect(() => {
    if (!openPracticeArena || !createdPracticeArenaId) {
      setCreatedPracticeArenaStatus('');
    }
  }, [openPracticeArena, createdPracticeArenaId]);

  // Open modal when room is created and pendingModalOpen flag is set
  useEffect(() => {
    if (pendingModalOpen && createdPracticeArenaId) {
      setOpenPracticeArena(true);
      setPendingModalOpen(false);
    }
  }, [pendingModalOpen, createdPracticeArenaId]);

  useEffect(() => {
    let mounted = true;
    void (async () => {
      if (!user?.characterId) {
        if (mounted) {
          setCreatedPracticeArenaId('');
          setCreatedPracticeArenaStatus('');
          setKeepPracticeCreateTab(false);
          setPvpGateReady(true);
          setPvpGateOpenModal(true);
          setPracticeModalTab(ARENA_ACTIONS.CREATE);
          setPracticeModalJoinCode('');
        }
        return;
      }

      try {
        const quotaPath = `trainingQuotas/${user.characterId}/${todayDate}`;
        const [, trainings, todayProgress, tasks, todayUserIrisWish] = await Promise.all([
          get(ref(db, quotaPath)).catch(() => null),
          fetchUserTrainingTasks(user.characterId).catch(() => [] as TrainingTask[]),
          getTodayProgress(user.characterId).catch(() => null),
          fetchUserTrainingTasks(user.characterId).catch(() => [] as TrainingTask[]),
          fetchTodayIrisWish(user?.characterId).catch(() => null),
        ]);

        if (!mounted) return;

        setTodayUserIrisWish(todayUserIrisWish);

        const todaySheetTask = [...trainings].reverse().find((training) => training.date === todayDate) || null;
        const hasPendingSheetTask = !!todaySheetTask && todaySheetTask.verified !== TRAINING_POINT_REQUEST_STATUS.APPROVED;
        const hasNonApprovedTasks = tasks.some(task => task.verified !== TRAINING_POINT_REQUEST_STATUS.APPROVED);
        const hasLiveNormalTraining = todayProgress?.mode === PRACTICE_MODE.NORMAL && todayProgress.state === PRACTICE_STATES.LIVE;
        const isFinishedNormalTraining = todayProgress?.mode === PRACTICE_MODE.NORMAL && todayProgress.state === PRACTICE_STATES.FINISHED;
        const isFinishedPvpTraining = todayProgress?.mode === PRACTICE_MODE.PVP && todayProgress.state === PRACTICE_STATES.FINISHED;
        const hasActivePracticeRoom = !!createdPracticeArenaId;

        // Check if there's an existing PvP room in database (any state: waiting, live, or finished)
        const hasExistingPvpRoom = todayProgress?.mode === PRACTICE_MODE.PVP && todayProgress?.arenaId;

        // If existing PvP room found, verify user is a fighter or creator before storing for auto-navigation
        if (hasExistingPvpRoom && todayProgress?.arenaId) {
          try {
            const room = await getRoom(todayProgress.arenaId);
            if (room) {
              const teamAMembers = room.teamA?.members || [];
              const teamBMembers = room.teamB?.members || [];
              const allMembers = [...teamAMembers, ...teamBMembers];
              const isFighter = allMembers.some(
                (member: any) => member.characterId?.toLowerCase() === user.characterId?.toLowerCase()
              );

              // Check if user is the creator (first member of teamA in practice rooms)
              const isCreator = room.practiceMode &&
                teamAMembers.length > 0 &&
                teamAMembers[0]?.characterId?.toLowerCase() === user.characterId?.toLowerCase();

              // For CONFIGURING/WAITING rooms, also check if this matches the user's practice record
              // (They created it but might not have joined as fighter yet)
              const isOwnPracticeRoom = todayProgress.arenaId === room.arenaId &&
                (room.status === ROOM_STATUS.CONFIGURING || room.status === ROOM_STATUS.WAITING);

              if (mounted) {
                setExistingPvpArenaId(isFighter || isCreator || isOwnPracticeRoom ? todayProgress.arenaId : '');
              }
            } else {
              if (mounted) {
                setExistingPvpArenaId('');
              }
            }
          } catch (err) {
            if (mounted) {
              setExistingPvpArenaId('');
            }
          }
        } else {
          if (mounted) {
            setExistingPvpArenaId('');
          }
        }

        // Re-check quota after potential cleanup
        const quotaSnapshot2 = await get(ref(db, `trainingQuotas/${user.characterId}/${todayDate}`)).catch(() => null);
        const quotaUsed = !!quotaSnapshot2?.exists();

        // Determine if user can open PvP modal (no pending tasks, no quota used, or has existing room)
        const canOpenModal = !hasPendingSheetTask &&
          !hasNonApprovedTasks &&
          !hasLiveNormalTraining &&
          !isFinishedNormalTraining &&
          !isFinishedPvpTraining &&
          (!quotaUsed || hasActivePracticeRoom || !!existingPvpArenaId);

        if (mounted) {
          setPvpGateOpenModal(canOpenModal);
          setPvpGateReady(true);
        }
      } catch (err) {
        if (mounted) {
          setPvpGateOpenModal(false);
          setPvpGateReady(true);
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, [todayDate, user, createdPracticeArenaId, existingPvpArenaId]);

  const handleTrainWithAdmin = () => {
    navigate('/training-grounds/guided');
  };

  const handlePvPMode = async () => {
    if(!user?.characterId) {
      return;
    }

    if (todayUserIrisWish?.deity === DEITY.HERA) {
      setHeraBlocked(true);
      return;
    }

    if (existingPvpArenaId) {
      navigate(`/training-grounds/pvp/${existingPvpArenaId}`);
      return;
    }

    if (!pvpGateOpenModal) {
      navigate('/training-grounds/pvp');
      return;
    }

    // Create room if needed
    if (!createdPracticeArenaId && user?.characterId) {
      const powerDeity = POWER_OVERRIDES[user.characterId.toLowerCase()] ?? user.deityBlood;
      const powers = getPowers(powerDeity);
      const fighter = toFighterState(user, powers, todayUserIrisWish?.deity || null);
      try {
        const arenaId = await createRoom(
          fighter,
          `Training: ${user.nicknameEng} vs ???`,
          1,
          1,
          { practiceMode: true },
        );
        setCreatedPracticeArenaId(arenaId);
        setCreatedPracticeArenaStatus(ROOM_STATUS.CONFIGURING);
        setKeepPracticeCreateTab(false);
        setPendingModalOpen(true);
      } catch (err) {
        return;
      }
    } else {
      setOpenPracticeArena(true);
    }
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

    // Get current room data to preserve team structure
    const roomSnap = await get(ref(db, `arenas/${arenaId}`));
    if (!roomSnap.exists()) {
      throw new Error('Room not found');
    }

    const room = roomSnap.val();

    // Save quota and progress BEFORE updating room status
    try {
      await savePracticeProgress({
        userId: user.characterId!,
        arenaId,
        roomCode: arenaId,
        role: ARENA_ROLE.TEAM_A,
        rolls: [0, 0, 0, 0, 0],
        battleRolls: [],
        opponentId: opponent.characterId,
        opponentName: opponent.nicknameEng,
        state: PRACTICE_STATES.WAITING,
        rounds: 0,
        winner: false,
      });
    } catch (err: any) {
      // If quota already used or other error, throw to prevent room finalization
      throw new Error(err.message || 'Failed to save practice progress');
    }

    await update(ref(db, `arenas/${arenaId}`), {
      roomName: `Training: ${user.nicknameEng} vs ${opponent.nicknameEng}`,
      inviteReservations,
      status: ROOM_STATUS.WAITING,
      practiceMode: true,
      // Preserve team structure with maxSize
      teamA: room.teamA || { members: [], maxSize: 1, minions: [] },
      teamB: room.teamB || { members: [], maxSize: 1, minions: [] },
    });

    setCreatedPracticeArenaStatus(ROOM_STATUS.WAITING);
    setKeepPracticeCreateTab(true);

    // Update existingPvpArenaId to reflect the new room
    setExistingPvpArenaId(arenaId);

    return arenaId;
  };

  const handleJoinPracticeRoom = async (roomCode: string) => {
    if (!user?.characterId) {
      throw new Error('User not authenticated');
    }

    // Validate user can train before allowing them to proceed
    const validation = await canUserTrain(user.characterId, PRACTICE_MODE.PVP);
    if (!validation.canTrain) {
      throw new Error(validation.reason || 'Cannot join PvP training at this time');
    }

    const code = roomCode.trim().toUpperCase();
    const room = await getRoom(code);
    if (!room) {
      throw new Error('Room not found. Check the code.');
    }

    if (!room.practiceMode) {
      throw new Error('This is not a practice room.');
    }

    // Prevent joining rooms that are still being configured
    if (room.status === ROOM_STATUS.CONFIGURING) {
      throw new Error('This room is still being set up. Please wait for the host to finalize it.');
    }

    // Only allow joining WAITING rooms
    if (room.status !== ROOM_STATUS.WAITING) {
      throw new Error('This room is not available for joining.');
    }

    // Note: Quota and progress will be saved when user actually joins the room in Arena component
    // This just validates they CAN join
    setCreatedPracticeArenaId(code);
    setCreatedPracticeArenaStatus(room.status);

    return code;
  };

  const handleDeletePracticeRoom = async (roomCode: string) => {
    const code = roomCode.trim().toUpperCase();
    const room = await getRoom(code);
    if (!room) {
      setCreatedPracticeArenaId('');
      setCreatedPracticeArenaStatus('');
      setOpenPracticeArena(false);
      return;
    }
    const canDeleteAnyState = role === ROLE.DEVELOPER;
    const canDeleteBeforeBattle = room.status === ROOM_STATUS.CONFIGURING || room.status === ROOM_STATUS.WAITING;
    if (!canDeleteBeforeBattle && !canDeleteAnyState) {
      throw new Error('Only waiting rooms can be deleted.');
    }

    await deleteRoom(code);

    // Refund practice quota and delete progress from Firestore if deleting before battle starts
    if (canDeleteBeforeBattle) {
      // For developers: reset the room owner's quota
      // For regular users: reset their own quota
      let quotaOwnerId = user?.characterId;
      let quotaDate = todayDate;

      if (canDeleteAnyState && room.teamA?.members?.[0]?.characterId) {
        // Developer deleting someone else's room - get owner info from room
        quotaOwnerId = room.teamA.members[0].characterId;

        // Try to find the quota date - check today first, then yesterday
        const dates = [todayDate, getPreviousDate(todayDate)];
        for (const date of dates) {
          const checkPath = `trainingQuotas/${quotaOwnerId}/${date}`;
          const snapshot = await get(ref(db, checkPath));
          if (snapshot.exists() && snapshot.val()?.mode === PRACTICE_MODE.PVP) {
            quotaDate = date;
            break;
          }
        }
      }

      // Delete quota from Realtime Database
      const quotaPath = `trainingQuotas/${quotaOwnerId}/${quotaDate}`;
      try {
        await remove(ref(db, quotaPath));
      } catch (err) {
        // Don't fail the deletion if quota refund fails
      }

      // Delete practice progress from Firestore
      const progressDocId = `${quotaOwnerId}_${quotaDate}`;
      const progressRef = doc(firestore, FIRESTORE_COLLECTIONS.USER_DAILY_PROGRESS, progressDocId);
      try {
        await deleteDoc(progressRef);
      } catch (err) {
        // Don't fail the deletion if progress delete fails
      }
    }

    // Match arena pattern: clear state after deleting
    setCreatedPracticeArenaId('');
    setCreatedPracticeArenaStatus('');
    setKeepPracticeCreateTab(false);
    setExistingPvpArenaId('');
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
        <Route path="/" element={<Stats onSelectTrainingWithAdminMode={handleTrainWithAdmin} onSelectPvPMode={handlePvPMode} onSelectRolePlaySubmission={handleRolePlaySubmission} loading={!pvpGateReady} />} />
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
        keepCreateTabAfterFinalize={keepPracticeCreateTab}
      />
      {heraBlocked && <HeraBlocked onClose={() => setHeraBlocked(false)} />}
    </div>
  );
}
