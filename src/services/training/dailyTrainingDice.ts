import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';
import { firestore, db } from '../../firebase';
import { ref, set } from 'firebase/database';
import { APPS_SCRIPT_URL, csvUrl, GID } from '../../constants/sheets';
import { ACTIONS } from '../../constants/action';
import { ARENA_ROLE } from '../../constants/battle';
import { TRAINING_POINT_REQUEST_STATUS, TrainingPointRequestStatus } from '../../constants/trainingPointRequestStatus';
import { PRACTICE_MODE, PRACTICE_STATES, PracticeMode, PracticeState } from '../../constants/practice';
import { FIRESTORE_COLLECTIONS } from '../../constants/fireStoreCollections';
import { getTodayDate } from '../../utils/date';
import { splitCSVRows, parseCSVLine } from '../../utils/csv';
export interface DailyConfig {
  date: string;
  targets: number[]; // Array of 5 targets (1-12)
  confirmed: boolean; // Only true when admin confirms
  createdAt: Timestamp;
  confirmedAt?: Timestamp;
}

// Simplified UserDailyProgress for lightweight quota tracking in Firestore
export interface UserDailyProgress {
  userId: string;
  date: string;
  mode: PracticeMode; // 'admin' or 'pvp'
  state: PracticeState; // 'waiting', 'live', 'finished'
  arenaId?: string; // Only for PVP mode
  // Normal mode: store partial progress to prevent refresh exploits
  rolls?: number[]; // Current rolls (for normal training mode)
  target?: number; // Current target (for normal training mode)
  createdAt: Timestamp;
}

// Training task structure that matches Google Sheets
export interface TrainingTask {
  id: string; // Format: userId_YYYY-MM-DDTHH:mm:ss (time encoded in id)
  date: string;
  userId: string;
  attempt: number;
  rolls: number[];
  mode: PracticeMode;
  success: boolean;
  roleplay: string;
  tickets: number;
  verified: TrainingPointRequestStatus;
  verifiedBy?: string;
  verifiedAt?: string;
  rejectReason?: string;
  // PVP specific fields (optional)
  arenaId?: string;
  opponentId?: string;
  opponentName?: string;
  battleRounds?: number;
  // Fortune specific field
  withFullLevelFortune?: boolean;
  // Exact submission datetime (ISO) — set by Apps Script server-side
  submittedAt?: string;
}

export interface PracticeProgressInput {
  userId: string;
  arenaId: string;
  roomCode: string;
  role: typeof ARENA_ROLE.TEAM_A | typeof ARENA_ROLE.TEAM_B;
  rolls?: number[];
  battleRolls?: number[];
  opponentId?: string;
  opponentName?: string;
  state: PracticeState;
  rounds?: number;
  winner?: boolean;
  withFullLevelFortune?: boolean;
}

// Admin: Set today's target (legacy - for single target)
export const setDailyTarget = async (target: number): Promise<void> => {
  if (target < 1 || target > 12) {
    throw new Error('Target must be between 1 and 12');
  }

  const date = getTodayDate();
  const configRef = doc(firestore, FIRESTORE_COLLECTIONS.DAILY_CONFIGS, date);

  await setDoc(configRef, {
    date,
    targets: [target, target, target, target, target], // Store as array for compatibility
    confirmed: true, // Auto-confirm for legacy calls
    createdAt: serverTimestamp(),
    confirmedAt: serverTimestamp(),
  });
};

// Admin: Save draft targets (auto-save as admin rolls)
export const saveDraftTargets = async (targets: (number | null)[]): Promise<void> => {
  const date = getTodayDate();
  const configRef = doc(firestore, FIRESTORE_COLLECTIONS.DAILY_CONFIGS, date);

  // Filter out null values for storage
  const validTargets = targets.filter(t => t !== null) as number[];

  await setDoc(configRef, {
    date,
    targets: validTargets,
    confirmed: false,
    createdAt: serverTimestamp(),
  }, { merge: true }); // Merge to preserve existing data
};

// Admin: Confirm all targets (make them available to players)
export const confirmTargets = async (targets: number[]): Promise<void> => {
  if (targets.length !== 5) {
    throw new Error('Must have exactly 5 targets');
  }

  targets.forEach(t => {
    if (t < 1 || t > 12) {
      throw new Error('Each target must be between 1 and 12');
    }
  });

  const date = getTodayDate();
  const configRef = doc(firestore, FIRESTORE_COLLECTIONS.DAILY_CONFIGS, date);

  await setDoc(configRef, {
    date,
    targets,
    confirmed: true,
    confirmedAt: serverTimestamp(),
  }, { merge: true });
};

// Admin: Get draft targets (including unconfirmed)
export const getDraftTargets = async (): Promise<{ targets: number[], confirmed: boolean } | null> => {
  const date = getTodayDate();
  const configRef = doc(firestore, FIRESTORE_COLLECTIONS.DAILY_CONFIGS, date);
  const configSnap = await getDoc(configRef);

  if (!configSnap.exists()) {
    return null;
  }

  const data = configSnap.data();
  return {
    targets: data.targets || [],
    confirmed: data.confirmed || false,
  };
};

// Get today's target (only returns if confirmed)
export const getTodayTarget = async (): Promise<number | null> => {
  const date = getTodayDate();
  const configRef = doc(firestore, FIRESTORE_COLLECTIONS.DAILY_CONFIGS, date);
  const configSnap = await getDoc(configRef);

  if (!configSnap.exists()) {
    return null;
  }

  const data = configSnap.data();

  // Only return if confirmed
  if (!data.confirmed) {
    return null;
  }

  // Return first target for backward compatibility
  return data.targets?.[0] || data.target || null;
};

// Get all 5 today's targets (only returns if confirmed)
export const getTodayTargets = async (): Promise<number[] | null> => {
  const date = getTodayDate();
  const configRef = doc(firestore, FIRESTORE_COLLECTIONS.DAILY_CONFIGS, date);
  const configSnap = await getDoc(configRef);

  if (!configSnap.exists()) {
    return null;
  }

  const data = configSnap.data();

  // Only return if confirmed
  if (!data.confirmed) {
    return null;
  }

  // Return all 5 targets
  return data.targets || null;
};

// Roll 5 dice (d12)
export const rollDice = (): number[] => {
  return Array.from({ length: 5 }, () => Math.floor(Math.random() * 12) + 1);
};

// Check if rolls are successful (at least 3 rolls >= target)
export const checkSuccess = (rolls: number[], target: number): boolean => {
  const successfulRolls = rolls.filter(roll => roll >= target).length;
  return successfulRolls >= 3;
};

// Check if rolls are successful when each roll has its own target
export const checkSuccessWithTargets = (rolls: number[], targets: number[]): boolean => {
  if (rolls.length !== targets.length) return false;
  const successfulRolls = rolls.filter((roll, index) => roll >= targets[index]).length;
  return successfulRolls >= 3;
};

// Check if user has already trained today
export const hasTrainedToday = async (userId: string): Promise<boolean> => {
  const date = getTodayDate();
  const docId = `${userId}_${date}`;
  const progressRef = doc(firestore, FIRESTORE_COLLECTIONS.USER_DAILY_PROGRESS, docId);
  const progressSnap = await getDoc(progressRef);

  return progressSnap.exists();
};

// Get user's training progress for today (lightweight - only quota/state tracking)
export const getTodayProgress = async (userId: string): Promise<UserDailyProgress | null> => {
  const date = getTodayDate();
  const docId = `${userId}_${date}`;
  const progressRef = doc(firestore, FIRESTORE_COLLECTIONS.USER_DAILY_PROGRESS, docId);
  const progressSnap = await getDoc(progressRef);

  if (!progressSnap.exists()) {
    return null;
  }

  return progressSnap.data() as UserDailyProgress;
};

// Submit training result to Google Sheets (called once success is determined)
export const submitTrainingResult = async (params: {
  userId: string;
  rolls: number[];
  mode: PracticeMode;
  success: boolean;
  // Optional PVP fields
  arenaId?: string;
  opponentId?: string;
  opponentName?: string;
  battleRounds?: number;
  withFullLevelFortune?: boolean;
}): Promise<void> => {
  const date = getTodayDate();
  const attempt = params.rolls.filter(r => r > 0).length;

  const payload = {
    action: ACTIONS.SUBMIT_TRAINING,
    date,
    userId: params.userId,
    attempt,
    rolls: params.rolls,
    mode: params.mode,
    success: params.success,
    roleplay: '', // Will be filled later
    tickets: 0,
    arenaId: params.arenaId || '',
    opponentId: params.opponentId || '',
    opponentName: params.opponentName || '',
    battleRounds: params.battleRounds || 0,
    withFullLevelFortune: params.withFullLevelFortune || false,
  };

  const response = await fetch(APPS_SCRIPT_URL, {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    // console.error('[Training] Sheets HTTP error:', response.status, errorText);
    throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
  }

  const result = await response.json();

  if (result.error) {
    // console.error('[Training] Sheets API error:', result.error);
    throw new Error(result.error);
  }

  // Update Firestore progress to 'finished' state
  const docId = `${params.userId}_${date}`;
  const progressRef = doc(firestore, FIRESTORE_COLLECTIONS.USER_DAILY_PROGRESS, docId);

  await setDoc(progressRef, {
    userId: params.userId,
    date,
    mode: params.mode,
    state: PRACTICE_STATES.FINISHED,
    arenaId: params.arenaId || null,
    withFullLevelFortune: params.withFullLevelFortune || false,
    createdAt: serverTimestamp(),
  }, { merge: true });
};

// Save partial training progress (after each roll) - lightweight
export const savePartialProgress = async (
  userId: string,
  rolls: number[],
  target: number
): Promise<void> => {
  if (rolls.length < 1 || rolls.length > 5) {
    throw new Error('Rolls must be between 1 and 5');
  }

  rolls.forEach(roll => {
    if (roll < 1 || roll > 22) {
      throw new Error('Each roll must be between 1 and 22');
    }
  });

  const date = getTodayDate();
  const docId = `${userId}_${date}`;
  const progressRef = doc(firestore, FIRESTORE_COLLECTIONS.USER_DAILY_PROGRESS, docId);

  // Check if already completed training today
  const existing = await getTodayProgress(userId);
  if (existing?.state === PRACTICE_STATES.FINISHED) {
    throw new Error('You have already completed training today');
  }

  // Mark quota as used on first roll
  if (rolls.length === 1) {
    try {
      await set(ref(db, `trainingQuotas/${userId}/${date}`), {
        used: true,
        timestamp: Date.now(),
        mode: PRACTICE_MODE.NORMAL,
      });
    } catch (err) {
      // console.error('[Training] Failed to set quota:', err);
      throw err; // Re-throw to prevent training from continuing
    }
  }

  // Save lightweight progress to Firestore (including partial rolls to prevent refresh exploits)
  await setDoc(progressRef, {
    userId,
    date,
    mode: PRACTICE_MODE.NORMAL,
    state: PRACTICE_STATES.LIVE,
    rolls, // Save current rolls to prevent refresh exploits
    target, // Save target for reference
    createdAt: serverTimestamp(),
  }, { merge: true });
};

// Complete training (save result to Google Sheets)
export const completeTraining = async (
  userId: string,
  rolls: number[],
  target: number,
  success: boolean,
  earlyFailed: boolean = false,
  withFullLevelFortune: boolean = false
): Promise<void> => {
  if (rolls.length !== 5) {
    throw new Error('Must have exactly 5 dice rolls');
  }

  rolls.forEach(roll => {
    if ((roll < 1 && roll !== 0) || roll > 22) {
      throw new Error('Each roll must be between 0 and 22');
    }
  });

  // Submit to Google Sheets
  await submitTrainingResult({
    userId,
    rolls,
    mode: PRACTICE_MODE.NORMAL,
    success,
    withFullLevelFortune,
  });
};

// Legacy function - now redirects to completeTraining
export const saveTrainingResult = async (
  userId: string,
  rolls: number[],
  target: number,
  success: boolean
): Promise<void> => {
  await completeTraining(userId, rolls, target, success, false, false);
};

export const savePracticeProgress = async (progress: PracticeProgressInput): Promise<void> => {
  const date = getTodayDate();
  const docId = `${progress.userId}_${date}`;
  const progressRef = doc(firestore, FIRESTORE_COLLECTIONS.USER_DAILY_PROGRESS, docId);
  const existingSnap = await getDoc(progressRef);
  const existing = existingSnap.exists() ? (existingSnap.data() as UserDailyProgress) : null;

  if (existing?.mode === PRACTICE_MODE.PVP && existing.state === PRACTICE_STATES.FINISHED) {
    return;
  }

  if (existing) {
    const isSamePvp =
      existing.mode === PRACTICE_MODE.PVP &&
      existing.arenaId === progress.arenaId &&
      (existing.state === PRACTICE_STATES.LIVE || existing.state === PRACTICE_STATES.WAITING);

    if (!isSamePvp) {
      throw new Error('You already used your practice quota for today.');
    }
  }

  // Save lightweight progress to Firestore (quota tracking only)
  await setDoc(progressRef, {
    userId: progress.userId,
    date,
    mode: PRACTICE_MODE.PVP,
    state: progress.state,
    arenaId: progress.arenaId,
    createdAt: serverTimestamp(),
  }, { merge: true });

  // Mark quota as used (always ensure quota is set, even if progress already exists)
  // This handles cases where quota save might have failed on a previous attempt
  try {
    await set(ref(db, `trainingQuotas/${progress.userId}/${date}`), {
      used: true,
      timestamp: Date.now(),
      mode: PRACTICE_MODE.PVP,
    });
  } catch (err) {
    // console.error('Failed to set quota:', err);
    // Don't throw - allow progress save to succeed even if quota fails
  }

  // If battle is finished, submit result to Google Sheets
  if (progress.state === PRACTICE_STATES.FINISHED) {
    const battleRolls = progress.battleRolls ?? progress.rolls ?? [];
    const validRolls = battleRolls.filter((roll) => typeof roll === 'number' && roll >= 0 && roll <= 12);

    try {
      await submitTrainingResult({
        userId: progress.userId,
        rolls: validRolls.length > 0 ? validRolls : [0, 0, 0, 0, 0],
        mode: PRACTICE_MODE.PVP,
        success: !!progress.winner,
        arenaId: progress.arenaId,
        opponentId: progress.opponentId,
        opponentName: progress.opponentName,
        battleRounds: progress.rounds ?? 0,
        withFullLevelFortune: progress.withFullLevelFortune || false,
      });
    } catch (err) {
      // console.error('[Training] Failed to submit PVP result to Sheets:', err);
      throw err; // Re-throw so caller can handle it
    }
  }
};

// Fetch all training tasks from Google Sheets using CSV export (no CORS issues)
export const fetchAllTrainingTasks = async (params?: {
  userId?: string;
  verified?: TrainingPointRequestStatus;
  mode?: PracticeMode;
}): Promise<TrainingTask[]> => {
  try {
    // Fetch directly from Google Sheets CSV export
    const res = await fetch(csvUrl(GID.DAILY_TRAINING_DICE));
    const text = await res.text();
    const lines = splitCSVRows(text);
    
    if (lines.length < 2) {
      return [];
    }

    // Parse header row to find columns by name — resilient to column reordering
    const headers = parseCSVLine(lines[0]).map(h => h.trim().toLowerCase());
    const col = (name: string) => {
      const idx = headers.indexOf(name.toLowerCase());
      return idx;
    };

    // Resolve indices once; fall back to legacy positional indices for sheets
    // that haven't had withFullLevelFortune inserted yet.
    const hasWff = col('withfulllevelfortune') !== -1;
    const iWff      = hasWff ? col('withfulllevelfortune') : -1;
    const iId       = col('id')          !== -1 ? col('id')          : 0;
    const iDate     = col('date')        !== -1 ? col('date')        : 1;
    const iUser     = col('user')        !== -1 ? col('user')        : (hasWff ? 3 : 2);
    const iAttempt  = col('attempt')     !== -1 ? col('attempt')     : (hasWff ? 4 : 3);
    const iRolls    = col('rolls')       !== -1 ? col('rolls')       : (hasWff ? 5 : 4);
    const iMode     = col('mode')        !== -1 ? col('mode')        : (hasWff ? 6 : 5);
    const iSuccess  = col('success')     !== -1 ? col('success')     : (hasWff ? 7 : 6);
    const iRoleplay = col('roleplay')    !== -1 ? col('roleplay')    : (hasWff ? 8 : 7);
    const iTickets  = col('tickets')     !== -1 ? col('tickets')     : (hasWff ? 9 : 8);
    const iVerified = col('verified')    !== -1 ? col('verified')    : (hasWff ? 10 : 9);
    const iVerifiedBy  = col('verifiedby')   !== -1 ? col('verifiedby')   : (hasWff ? 11 : 10);
    const iVerifiedAt  = col('verifiedat')   !== -1 ? col('verifiedat')   : (hasWff ? 12 : 11);
    const iRejectReason = col('rejectreason') !== -1 ? col('rejectreason') : (hasWff ? 13 : 12);
    const iArenaId     = col('arenaid')      !== -1 ? col('arenaid')      : (hasWff ? 14 : 13);
    const iOpponentId  = col('opponentid')   !== -1 ? col('opponentid')   : (hasWff ? 15 : 14);
    const iOpponentName = col('opponentname') !== -1 ? col('opponentname') : (hasWff ? 16 : 15);
    const iBattleRounds = col('battlerounds') !== -1 ? col('battlerounds') : (hasWff ? 17 : 16);

    const trainings: TrainingTask[] = [];

    for (let i = 1; i < lines.length; i++) {
      const row = parseCSVLine(lines[i]);

      // Apply filters
      if (params?.userId && row[iUser] !== params.userId) continue;
      if (params?.verified && row[iVerified]?.toLowerCase() !== params.verified.toLowerCase()) continue;
      if (params?.mode && row[iMode] !== params.mode) continue;

      let rolls: number[] = [];
      try {
        rolls = JSON.parse(row[iRolls] || '[]');
      } catch (e) {
        rolls = [];
      }

      trainings.push({
        id: row[iId] || '',
        date: row[iDate] || '',
        userId: row[iUser] || '',
        attempt: Number(row[iAttempt]) || 0,
        rolls,
        mode: (row[iMode] || 'admin') as PracticeMode,
        success: row[iSuccess] === 'TRUE' || row[iSuccess] === 'true',
        roleplay: row[iRoleplay] || '',
        tickets: Number(row[iTickets]) || 0,
        verified: (row[iVerified] || 'pending') as TrainingPointRequestStatus,
        verifiedBy: row[iVerifiedBy] || '',
        verifiedAt: row[iVerifiedAt] || '',
        rejectReason: row[iRejectReason] || '',
        arenaId: row[iArenaId] || '',
        opponentId: row[iOpponentId] || '',
        opponentName: row[iOpponentName] || '',
        battleRounds: Number(row[iBattleRounds]) || 0,
        withFullLevelFortune: iWff !== -1 ? (row[iWff] === 'TRUE' || row[iWff] === 'true') : false,
        // submittedAt is encoded in the id after the date portion
        submittedAt: (() => {
          const idStr = row[iId] || '';
          const dateStr = row[iDate] || '';
          if (!dateStr) return undefined;
          const idx = idStr.indexOf('_' + dateStr);
          return idx !== -1 ? idStr.slice(idx + 1) : undefined;
        })(),
      });
    }

    return trainings;
  } catch (error) {
    console.error('Error fetching training tasks from CSV:', error);
    return [];
  }
};

// Fetch user's training tasks
export const fetchUserTrainingTasks = async (userId: string): Promise<TrainingTask[]> => {
  return fetchAllTrainingTasks({ userId });
};

// Fetch pending training tasks for approval
export const fetchPendingTrainingTasks = async (): Promise<TrainingTask[]> => {
  return fetchAllTrainingTasks({ verified: TRAINING_POINT_REQUEST_STATUS.PENDING });
};

// Submit roleplay link for training task
export const submitTrainingRoleplay = async (
  userId: string,
  date: string,
  roleplayUrl: string,
  tickets: number = 0
): Promise<void> => {
  const payload = {
    action: ACTIONS.SUBMIT_TRAINING_ROLEPLAY,
    userId,
    date,
    roleplayUrl,
    tickets,
  };

  const response = await fetch(APPS_SCRIPT_URL, {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const result = await response.json();
  if (result.error) {
    throw new Error(result.error);
  }
};

// Verify training task (admin approve/reject)
export const verifyTrainingTask = async (
  userId: string,
  date: string,
  verified: TrainingPointRequestStatus,
  verifiedBy: string,
  rejectReason?: string
): Promise<void> => {

  const formattedDate = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok'
  }).format(new Date(date));

  const payload = {
    action: ACTIONS.VERIFY_TRAINING,
    userId,
    date: formattedDate,
    verified,
    verifiedBy,
    rejectReason: rejectReason || '',
  };

  const response = await fetch(APPS_SCRIPT_URL, {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const result = await response.json();
  if (result.error) {
    throw new Error(result.error);
  }
};

// Request recheck for rejected training task
export const recheckTrainingTask = async (
  userId: string,
  date: string
): Promise<void> => {
  const payload = {
    action: ACTIONS.RECHECK_TRAINING,
    userId,
    date,
  };

  const response = await fetch(APPS_SCRIPT_URL, {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const result = await response.json();
  if (result.error) {
    throw new Error(result.error);
  }
};

// Check if user can start training (comprehensive validation)
export interface TrainingValidation {
  canTrain: boolean;
  reason?: string;
  hasNonApprovedTask: boolean;
  hasFinishedToday: boolean;
  hasLiveProgress: boolean;
}

export const canUserTrain = async (
  userId: string,
  requestedMode: PracticeMode
): Promise<TrainingValidation> => {
  const todayProgress = await getTodayProgress(userId);
  const todayTasks = await fetchUserTrainingTasks(userId);
  const todayTask = todayTasks.reverse().find(t => t.date === getTodayDate());

  // Check for non-approved tasks in sheet
  const hasNonApprovedTask = !!todayTask && todayTask.verified !== TRAINING_POINT_REQUEST_STATUS.APPROVED;

  // Check if already finished any mode today
  const hasFinishedToday = todayProgress?.state === PRACTICE_STATES.FINISHED;

  // Check if live progress exists
  const hasLiveProgress = todayProgress?.state === PRACTICE_STATES.LIVE || todayProgress?.state === PRACTICE_STATES.WAITING;

  // Rule 1: If have non-approved task in sheet -> block all training
  if (hasNonApprovedTask) {
    return {
      canTrain: false,
      reason: 'You have a pending training task. Please complete it or wait for approval.',
      hasNonApprovedTask: true,
      hasFinishedToday,
      hasLiveProgress,
    };
  }

  // Rule 2: If already finished any mode today -> block all other training
  if (hasFinishedToday) {
    return {
      canTrain: false,
      reason: 'You already completed training today. Come back tomorrow!',
      hasNonApprovedTask,
      hasFinishedToday: true,
      hasLiveProgress,
    };
  }

  // Rule 3: If live progress exists in different mode -> block
  if (hasLiveProgress && todayProgress.mode !== requestedMode) {
    const modeName = todayProgress.mode === PRACTICE_MODE.NORMAL ? 'Normal Training' : 'PVP';
    return {
      canTrain: false,
      reason: `You have ${modeName} in progress. Please finish it first.`,
      hasNonApprovedTask,
      hasFinishedToday,
      hasLiveProgress: true,
    };
  }

  // Rule 4: Allow continuing same mode if in progress
  if (hasLiveProgress && todayProgress.mode === requestedMode) {
    return {
      canTrain: true,
      hasNonApprovedTask,
      hasFinishedToday,
      hasLiveProgress: true,
    };
  }

  // Rule 5: Allow starting new training if no quota used
  return {
    canTrain: true,
    hasNonApprovedTask,
    hasFinishedToday,
    hasLiveProgress,
  };
};
