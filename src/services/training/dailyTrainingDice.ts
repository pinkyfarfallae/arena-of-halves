import { 
  collection, 
  doc, 
  getDoc, 
  setDoc, 
  serverTimestamp,
  Timestamp 
} from 'firebase/firestore';
import { firestore } from '../../firebase';

export interface DailyConfig {
  date: string;
  target: number;
  createdAt: Timestamp;
}

export interface UserDailyProgress {
  userId: string;
  date: string;
  rolls: number[];
  target: number;
  success: boolean;
  roleplay: string | null;
  verified: boolean;
  createdAt: Timestamp;
}

// Get today's date in YYYY-MM-DD format
export const getTodayDate = (): string => {
  const now = new Date();
  return now.toISOString().split('T')[0];
};

// Admin: Set today's target
export const setDailyTarget = async (target: number): Promise<void> => {
  if (target < 1 || target > 12) {
    throw new Error('Target must be between 1 and 12');
  }

  const date = getTodayDate();
  const configRef = doc(firestore, 'dailyConfigs', date);

  await setDoc(configRef, {
    date,
    target,
    createdAt: serverTimestamp(),
  });
};

// Get today's target
export const getTodayTarget = async (): Promise<number | null> => {
  const date = getTodayDate();
  const configRef = doc(firestore, 'dailyConfigs', date);
  const configSnap = await getDoc(configRef);

  if (!configSnap.exists()) {
    return null;
  }

  return configSnap.data().target;
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

// Check if user has already trained today
export const hasTrainedToday = async (userId: string): Promise<boolean> => {
  const date = getTodayDate();
  const docId = `${userId}_${date}`;
  const progressRef = doc(firestore, 'userDailyProgress', docId);
  const progressSnap = await getDoc(progressRef);

  return progressSnap.exists();
};

// Get user's training progress for today
export const getTodayProgress = async (userId: string): Promise<UserDailyProgress | null> => {
  const date = getTodayDate();
  const docId = `${userId}_${date}`;
  const progressRef = doc(firestore, 'userDailyProgress', docId);
  const progressSnap = await getDoc(progressRef);

  if (!progressSnap.exists()) {
    return null;
  }

  return progressSnap.data() as UserDailyProgress;
};

// Save training result
export const saveTrainingResult = async (
  userId: string,
  rolls: number[],
  target: number,
  success: boolean
): Promise<void> => {
  if (rolls.length !== 5) {
    throw new Error('Must have exactly 5 dice rolls');
  }

  rolls.forEach(roll => {
    if (roll < 1 || roll > 12) {
      throw new Error('Each roll must be between 1 and 12');
    }
  });

  const date = getTodayDate();
  const docId = `${userId}_${date}`;
  const progressRef = doc(firestore, 'userDailyProgress', docId);

  // Check if already trained today
  const exists = await hasTrainedToday(userId);
  if (exists) {
    throw new Error('You have already trained today');
  }

  await setDoc(progressRef, {
    userId,
    date,
    rolls,
    target,
    success,
    roleplay: null,
    verified: false,
    createdAt: serverTimestamp(),
  });
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
  appendToGoogleSheets(userId, rolls, target, success).catch(err => {
    console.error('Failed to append to Google Sheets:', err);
  });

  return { rolls, target, success };
};

// Append to Google Sheets
const appendToGoogleSheets = async (
  userId: string,
  rolls: number[],
  target: number,
  success: boolean
): Promise<void> => {
  const date = getTodayDate();

  // Call your Google Apps Script endpoint
  const SHEETS_ENDPOINT = process.env.REACT_APP_SHEETS_ENDPOINT || '';
  
  if (!SHEETS_ENDPOINT) {
    console.warn('REACT_APP_SHEETS_ENDPOINT not configured');
    return;
  }

  const payload = {
    action: 'appendDailyTraining',
    date,
    userId,
    rolls,
    target,
    success,
    roleplay: '', // Optional field, empty by default
  };

  await fetch(SHEETS_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
};
