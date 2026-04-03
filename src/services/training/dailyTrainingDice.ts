import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';
import { firestore, db } from '../../firebase';
import { ref, set } from 'firebase/database';
import { APPS_SCRIPT_URL } from '../../constants/sheets';
import { ACTIONS } from '../../constants/action';
import { ARENA_ROLE } from '../../constants/battle';
import { TRAINING_POINT_REQUEST_STATUS, TrainingPointRequestStatus } from '../../constants/trainingPointRequestStatus';
import { PRACTICE_MODE, PRACTICE_STATES, PracticeMode, PracticeState } from '../../constants/practice';

const DAILY_CONFIGS_COLLECTION = 'dailyConfigs';
export const USER_DAILY_PROGRESS_COLLECTION = 'userDailyProgress';
export interface DailyConfig {
  date: string;
  targets: number[]; // Array of 5 targets (1-12)
  confirmed: boolean; // Only true when admin confirms
  createdAt: Timestamp;
  confirmedAt?: Timestamp;
}

export interface UserDailyProgress {
  userId: string;
  date: string;
  rolls: number[];
  target: number; // Target at time of training (for historical accuracy)
  success: boolean;
  completed: boolean; // true when all 5 rolls done or early failed
  earlyFailed?: boolean; // true if failed before 5th roll
  roleplay: string | null;
  verified: TrainingPointRequestStatus;
  verifiedBy?: string;
  verifiedAt?: string;
  rejectReason?: string;
  tickets: number;
  createdAt: Timestamp;
  practiceMode?: PracticeMode;
  practiceState?: PracticeState;
  practiceArenaId?: string;
  practiceRoomCode?: string;
  practiceRole?: typeof ARENA_ROLE.TEAM_A | typeof ARENA_ROLE.TEAM_B;
  practiceOpponentId?: string;
  practiceOpponentName?: string;
  practiceBattleRounds?: number;
  practiceBattleWinner?: boolean;
  practiceBattleRolls?: number[];
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
}

// Get today's date in YYYY-MM-DD format
export const getTodayDate = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Admin: Set today's target (legacy - for single target)
export const setDailyTarget = async (target: number): Promise<void> => {
  if (target < 1 || target > 12) {
    throw new Error('Target must be between 1 and 12');
  }

  const date = getTodayDate();
  const configRef = doc(firestore, DAILY_CONFIGS_COLLECTION, date);

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
  const configRef = doc(firestore, DAILY_CONFIGS_COLLECTION, date);

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
  const configRef = doc(firestore, DAILY_CONFIGS_COLLECTION, date);

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
  const configRef = doc(firestore, DAILY_CONFIGS_COLLECTION, date);
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
  const configRef = doc(firestore, DAILY_CONFIGS_COLLECTION, date);
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
  const configRef = doc(firestore, DAILY_CONFIGS_COLLECTION, date);
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
  const progressRef = doc(firestore, USER_DAILY_PROGRESS_COLLECTION, docId);
  const progressSnap = await getDoc(progressRef);

  return progressSnap.exists();
};

// Get user's training progress for today
export const getTodayProgress = async (userId: string): Promise<UserDailyProgress | null> => {
  const date = getTodayDate();
  const docId = `${userId}_${date}`;
  const progressRef = doc(firestore, USER_DAILY_PROGRESS_COLLECTION, docId);
  const progressSnap = await getDoc(progressRef);

  if (!progressSnap.exists()) {
    return null;
  }

  return progressSnap.data() as UserDailyProgress;
};

// Save partial training progress (after each roll)
export const savePartialProgress = async (
  userId: string,
  rolls: number[],
  target: number
): Promise<void> => {
  if (rolls.length < 1 || rolls.length > 5) {
    throw new Error('Rolls must be between 1 and 5');
  }

  rolls.forEach(roll => {
    if (roll < 1 || roll > 12) {
      throw new Error('Each roll must be between 1 and 12');
    }
  });

  const date = getTodayDate();
  const docId = `${userId}_${date}`;
  const progressRef = doc(firestore, USER_DAILY_PROGRESS_COLLECTION, docId);

  // Check if already completed training today
  const existing = await getTodayProgress(userId);
  if (existing?.completed) {
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
      console.error('Failed to set training quota:', err);
      // Continue anyway - don't block training if quota write fails
    }
  }

  // Pad rolls array with nulls for partial progress
  const paddedRolls = [...rolls];
  while (paddedRolls.length < 5) {
    paddedRolls.push(0); // Use 0 as placeholder for unrolled dice
  }

  await setDoc(progressRef, {
    userId,
    date,
    rolls: paddedRolls,
    target,
    success: false, // Not determined yet
    completed: false,
    roleplay: null,
    verified: TRAINING_POINT_REQUEST_STATUS.PENDING,
    tickets: 0,
    practiceMode: PRACTICE_MODE.NORMAL,
    practiceState: PRACTICE_STATES.LIVE,
    createdAt: serverTimestamp(),
  }, { merge: true });
};

// Complete training (final save with success status)
export const completeTraining = async (
  userId: string,
  rolls: number[],
  target: number,
  success: boolean,
  earlyFailed: boolean = false
): Promise<void> => {
  if (rolls.length !== 5) {
    throw new Error('Must have exactly 5 dice rolls');
  }

  rolls.forEach(roll => {
    if ((roll < 1 && roll !== 0) || roll > 12) {
      throw new Error('Each roll must be between 0 and 12');
    }
  });

  const date = getTodayDate();
  const docId = `${userId}_${date}`;
  const progressRef = doc(firestore, USER_DAILY_PROGRESS_COLLECTION, docId);

  await setDoc(progressRef, {
    userId,
    date,
    rolls,
    target,
    success,
    completed: true,
    earlyFailed,
    roleplay: null,
    verified: TRAINING_POINT_REQUEST_STATUS.PENDING,
    tickets: 0,
    practiceMode: PRACTICE_MODE.NORMAL,
    practiceState: PRACTICE_STATES.FINISHED,
    createdAt: serverTimestamp(),
  }, { merge: true });

  // Calculate attempt number (count non-zero rolls)
  const attempt = rolls.filter(r => r > 0).length;

  // Append to Google Sheets
  try {
    await appendToGoogleSheets(userId, rolls, target, success, attempt);
  } catch (err) {
    // Don't throw - allow training to complete even if sheets fails
  }
};

// Save training result (legacy - for backward compatibility)
export const saveTrainingResult = async (
  userId: string,
  rolls: number[],
  target: number,
  success: boolean
): Promise<void> => {
  await completeTraining(userId, rolls, target, success, false);
};

// Perform complete training (roll + save + sheets)
export const performDailyTraining = async (userId: string): Promise<{
  rolls: number[];
  target: number;
  success: boolean;
}> => {
  // Check if already trained
  const alreadyTrained = await hasTrainedToday(userId);
  if (alreadyTrained) {
    throw new Error('You have already trained today');
  }

  // Get today's target
  const target = await getTodayTarget();
  if (target === null) {
    throw new Error('No training target set for today');
  }

  // Roll dice
  const rolls = rollDice();
  const success = checkSuccess(rolls, target);

  // Save result
  await saveTrainingResult(userId, rolls, target, success);

  // Append to Google Sheets (async, non-blocking)
  // For performDailyTraining, all 5 rolls are attempted
  appendToGoogleSheets(userId, rolls, target, success, 5).catch(err => {
    console.error('Failed to append to Google Sheets:', err);
  });

  return { rolls, target, success };
};

// Append to Google Sheets
const appendToGoogleSheets = async (
  userId: string,
  rolls: number[],
  target: number,
  success: boolean,
  attempt: number,
  extraFields?: Record<string, unknown>,
): Promise<void> => {
  const date = getTodayDate();

  const payload = {
    action: ACTIONS.APPEND_DAILY_TRAINING,
    date,
    userId,
    attempt,
    rolls,
    target,
    success,
    roleplay: '',
    tickets: 0,
    ...(extraFields ?? {}),
  };

  try {
    const response = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Response error text:', errorText);
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    
    if (result.error) {
      throw new Error(result.error);
    }
  } catch (error) {
    console.error('Failed to append to Google Sheets:', error);
    throw error;
  }
};

export const savePracticeProgress = async (progress: PracticeProgressInput): Promise<void> => {
  const date = getTodayDate();
  const docId = `${progress.userId}_${date}`;
  const progressRef = doc(firestore, USER_DAILY_PROGRESS_COLLECTION, docId);
  const existingSnap = await getDoc(progressRef);
  const existing = existingSnap.exists() ? (existingSnap.data() as UserDailyProgress) : null;

  if (existing?.practiceMode === PRACTICE_MODE.PVP && existing.practiceState === PRACTICE_STATES.FINISHED) {
    return;
  }

  if (existing) {
    const isSamePvp =
      existing.practiceMode === PRACTICE_MODE.PVP &&
      existing.practiceArenaId === progress.arenaId &&
      (existing.practiceState === PRACTICE_STATES.LIVE || existing.practiceState === PRACTICE_STATES.WAITING);

    if (!isSamePvp) {
      throw new Error('You already used your practice quota for today.');
    }
  }

  // Create/update Firestore document first
  await setDoc(progressRef, {
    userId: progress.userId,
    date,
    rolls: (() => {
      const source = progress.rolls ?? [0, 0, 0, 0, 0];
      const padded = [...source.slice(0, 5)];
      while (padded.length < 5) padded.push(0);
      return padded;
    })(),
    target: 1,
    success: progress.state === PRACTICE_STATES.FINISHED ? !!progress.winner : false,
    completed: progress.state === PRACTICE_STATES.FINISHED,
    earlyFailed: false,
    roleplay: null,
    verified: TRAINING_POINT_REQUEST_STATUS.PENDING,
    verifiedBy: '',
    verifiedAt: '',
    rejectReason: '',
    tickets: 0,
    practiceMode: PRACTICE_MODE.PVP,
    practiceState: progress.state,
    practiceArenaId: progress.arenaId,
    practiceRoomCode: progress.roomCode,
    practiceRole: progress.role,
    practiceOpponentId: progress.opponentId || '',
    practiceOpponentName: progress.opponentName || '',
    practiceBattleRounds: progress.rounds ?? 0,
    practiceBattleWinner: progress.state === PRACTICE_STATES.FINISHED ? !!progress.winner : false,
    practiceBattleRolls: (() => {
      const source = progress.battleRolls ?? progress.rolls ?? [];
      return source.filter((roll) => typeof roll === 'number' && roll >= 0 && roll <= 12);
    })(),
    createdAt: serverTimestamp(),
  }, { merge: true });

  // After successful Firestore write, mark quota as used (only for new records)
  if (!existing) {
    try {
      await set(ref(db, `trainingQuotas/${progress.userId}/${date}`), {
        used: true,
        timestamp: Date.now(),
        mode: PRACTICE_MODE.PVP,
      });
    } catch (err) {
      console.error('Failed to set training quota:', err);
      // Continue anyway - document is already created
    }
  }

  if (progress.state === PRACTICE_STATES.FINISHED) {
    const battleRolls = (() => {
      const source = progress.battleRolls ?? progress.rolls ?? [];
      return source.filter((roll) => typeof roll === 'number' && roll >= 0 && roll <= 12);
    })();
    const attempt = battleRolls.length > 0 ? battleRolls.length : 5;
    await appendToGoogleSheets(
      progress.userId,
      battleRolls.length > 0 ? battleRolls : [0, 0, 0, 0, 0],
      1,
      !!progress.winner,
      attempt,
      {
        practiceMode: PRACTICE_MODE.PVP,
        practiceState: PRACTICE_STATES.FINISHED,
        practiceArenaId: progress.arenaId,
        practiceRoomCode: progress.roomCode,
        practiceRole: progress.role,
        practiceOpponentId: progress.opponentId || '',
        practiceOpponentName: progress.opponentName || '',
        practiceBattleRounds: progress.rounds ?? 0,
        practiceBattleWinner: !!progress.winner,
        practiceBattleRolls: battleRolls,
      },
    );
  }
};

// Fetch training records from Google Sheets
export const fetchTrainings = async (userId?: string, verified?: TrainingPointRequestStatus): Promise<UserDailyProgress[]> => {
  try {
    const params = new URLSearchParams({ action: ACTIONS.FETCH_TRAININGS });
    if (userId) params.append('userId', userId);
    if (verified) params.append('verified', verified);

    const response = await fetch(`${APPS_SCRIPT_URL}?${params.toString()}`);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    if (result.error) {
      throw new Error(result.error);
    }

    return result.trainings || [];
  } catch (error) {
    console.error('Failed to fetch trainings:', error);
    throw error;
  }
};

// Fetch all training records (admin)
export const fetchAllTrainings = async (): Promise<UserDailyProgress[]> => {
  try {
    const params = new URLSearchParams({ action: ACTIONS.FETCH_ALL_TRAININGS });
    const response = await fetch(`${APPS_SCRIPT_URL}?${params.toString()}`);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    if (result.error) {
      throw new Error(result.error);
    }

    return result.trainings || [];
  } catch (error) {
    console.error('Failed to fetch all trainings:', error);
    throw error;
  }
};

// Submit roleplay link for training
export const submitTrainingRoleplay = async (
  userId: string,
  date: string,
  roleplayUrl: string,
  tickets: number = 0
): Promise<void> => {
  try {
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
  } catch (error) {
    console.error('Failed to submit training roleplay:', error);
    throw error;
  }
};

// Verify training (admin approve/reject)
export const verifyTraining = async (
  userId: string,
  date: string,
  verified: TrainingPointRequestStatus,
  verifiedBy: string,
  rejectReason?: string
): Promise<void> => {
  try {
    const payload = {
      action: ACTIONS.VERIFY_TRAINING,
      userId,
      date,
      verified,
      verifiedBy,
      rejectReason: rejectReason || '',
    };

    const response = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    if (result.error) {
      throw new Error(result.error);
    }
  } catch (error) {
    console.error('Failed to verify training:', error);
    throw error;
  }
};

// Request recheck for rejected training
export const recheckTraining = async (
  userId: string,
  date: string
): Promise<void> => {
  try {
    const payload = {
      action: ACTIONS.RECHECK_TRAINING,
      userId,
      date,
    };

    const response = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    if (result.error) {
      throw new Error(result.error);
    }
  } catch (error) {
    console.error('Failed to recheck training:', error);
    throw error;
  }
};
