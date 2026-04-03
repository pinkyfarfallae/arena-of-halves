# Training System Refactor - Google Sheets Integration

## Overview
The training system has been refactored to use **Google Sheets as the primary source of truth** instead of duplicating data between Firestore and Sheets. This makes it easier for admins to view and manage all training tasks.

## Architecture

### Firestore (Lightweight - Quota Tracking Only)
- Collection: `userDailyProgress`
- Document ID format: `{userId}_{date}`
- Fields:
  - `userId`: string
  - `date`: string (YYYY-MM-DD)
  - `mode`: 'admin' | 'pvp'
  - `state`: 'waiting' | 'live' | 'finished'
  - `arenaId`: string (only for PVP)
  - `createdAt`: Timestamp

### Google Sheets (Complete Task Data)
- Sheet Name: `Training Tasks`
- Columns:
  1. **Id**: `{userId}_{date}` (unique identifier)
  2. **Date**: YYYY-MM-DD
  3. **User**: userId/characterId
  4. **Attempt**: Number of dice rolled (1-5)
  5. **Rolls**: JSON array of dice rolls
  6. **Mode**: 'admin' | 'pvp'
  7. **Success**: TRUE | FALSE
  8. **Roleplay**: URL to roleplay post
  9. **Tickets**: Number of tickets awarded
  10. **Verified**: 'pending' | 'approved' | 'rejected'
  11. **VerifiedBy**: Admin who verified
  12. **VerifiedAt**: ISO timestamp
  13. **RejectReason**: Reason for rejection
  14. **ArenaId**: Arena ID (for PVP only)
  15. **OpponentId**: Opponent character ID (for PVP only)
  16. **OpponentName**: Opponent name (for PVP only)
  17. **BattleRounds**: Number of battle rounds (for PVP only)

## API Functions

### Frontend (dailyTrainingDice.ts)

#### 1. Submit Training Result
```typescript
submitTrainingResult(params: {
  userId: string;
  rolls: number[];
  mode: 'admin' | 'pvp';
  success: boolean;
  arenaId?: string;
  opponentId?: string;
  opponentName?: string;
  battleRounds?: number;
}): Promise<void>
```
**When to call**: Once success result (True/False) is determined for both normal and PVP modes.

#### 2. Fetch All Training Tasks
```typescript
fetchAllTrainingTasks(params?: {
  userId?: string;
  verified?: 'pending' | 'approved' | 'rejected';
  mode?: 'admin' | 'pvp';
}): Promise<TrainingTask[]>
```
**Use cases**:
- Get all tasks for approval: `fetchAllTrainingTasks({ verified: 'pending' })`
- Get user's tasks: `fetchAllTrainingTasks({ userId: 'characterId' })`
- Filter by mode: `fetchAllTrainingTasks({ mode: 'pvp' })`

#### 3. Fetch User Training Tasks
```typescript
fetchUserTrainingTasks(userId: string): Promise<TrainingTask[]>
```
**Use case**: Get all tasks for a specific user.

#### 4. Fetch Pending Training Tasks
```typescript
fetchPendingTrainingTasks(): Promise<TrainingTask[]>
```
**Use case**: Admin view - get all tasks awaiting approval.

#### 5. Submit Roleplay
```typescript
submitTrainingRoleplay(
  userId: string,
  date: string,
  roleplayUrl: string,
  tickets?: number
): Promise<void>
```
**Use case**: User submits roleplay link after completing training.

#### 6. Verify Training Task
```typescript
verifyTrainingTask(
  userId: string,
  date: string,
  verified: 'approved' | 'rejected',
  verifiedBy: string,
  rejectReason?: string
): Promise<void>
```
**Use case**: Admin approves or rejects a training task.

#### 7. Recheck Training Task
```typescript
recheckTrainingTask(userId: string, date: string): Promise<void>
```
**Use case**: Reset rejected task back to pending status.

### Backend (Apps Script - training-sheets.gs)

#### Actions:
1. **SUBMIT_TRAINING** - Create new training task
2. **SUBMIT_TRAINING_ROLEPLAY** - Add roleplay link to existing task
3. **VERIFY_TRAINING** - Approve/reject task
4. **RECHECK_TRAINING** - Reset to pending
5. **FETCH_TRAININGS** - Get tasks with filters

## Setup Instructions

### 1. Google Apps Script
1. Copy the content from `scripts/training-sheets.gs`
2. Open your Google Sheets file
3. Go to Extensions > Apps Script
4. Paste the code
5. Replace `SPREADSHEET_ID` with your actual spreadsheet ID
6. Deploy as Web App:
   - Click "Deploy" > "New deployment"
   - Type: Web app
   - Execute as: Me
   - Who has access: Anyone
   - Copy the deployment URL

### 2. Update Frontend
1. Update `APPS_SCRIPT_URL` in `src/constants/sheets.ts` with your deployment URL
2. Deploy Firestore security rules (already updated to support lightweight structure)

## Migration Notes

### Breaking Changes
- `UserDailyProgress` interface is now lightweight (only quota tracking)
- Removed heavy fields from Firestore documents
- All training details now stored only in Google Sheets
- Old functions renamed with "Task" suffix for clarity

### Backward Compatibility
- `saveTrainingResult()` still works (legacy wrapper)
- Firestore quota system unchanged
- Existing quota checks still work

## Usage Examples

### Normal Training Flow
```typescript
// 1. User rolls dice
const rolls = [8, 3, 11, 6, 9];
const targets = [7, 7, 7, 7, 7];
const success = checkSuccessWithTargets(rolls, targets);

// 2. Submit result to Google Sheets
await submitTrainingResult({
  userId: 'character123',
  rolls,
  mode: 'admin',
  success,
});

// 3. Later: User submits roleplay
await submitTrainingRoleplay(
  'character123',
  '2026-04-03',
  'https://example.com/roleplay',
  2 // tickets
);
```

### PVP Training Flow
```typescript
// 1. Battle ends, determine winner
const battleRolls = [10, 12, 8];
const winner = true;

// 2. Submit result to Google Sheets
await submitTrainingResult({
  userId: 'character123',
  rolls: battleRolls,
  mode: 'pvp',
  success: winner,
  arenaId: 'ARENA123',
  opponentId: 'character456',
  opponentName: 'Opponent Name',
  battleRounds: 5,
});
```

### Admin Approval Flow
```typescript
// 1. Fetch pending tasks
const pendingTasks = await fetchPendingTrainingTasks();

// 2. Display in UI (you handle this)
// ...

// 3. Admin approves task
await verifyTrainingTask(
  'character123',
  '2026-04-03',
  'approved',
  'admin_character_id'
);

// OR rejects task
await verifyTrainingTask(
  'character123',
  '2026-04-03',
  'rejected',
  'admin_character_id',
  'Roleplay too short'
);
```

## Benefits of New System

1. **Single Source of Truth**: All task data in Google Sheets
2. **Admin Visibility**: Admins can view/edit directly in Sheets
3. **Lightweight Firestore**: Only quota tracking, faster queries
4. **Cleaner Code**: Separated concerns (quota vs. task data)
5. **Easier Debugging**: Check Sheets directly for task status
6. **Better Performance**: Smaller Firestore documents
7. **Audit Trail**: All changes visible in Sheets history

## UI Implementation Notes

You mentioned you'll handle the UI yourself. Here are the key integration points:

### For Normal Training Component:
- Call `submitTrainingResult()` after final roll determines success
- Use `fetchUserTrainingTasks()` to display user's history
- Use `submitTrainingRoleplay()` for roleplay submission

### For PVP Component:
- Call `submitTrainingResult()` when battle ends
- Include PVP-specific fields (arenaId, opponentId, etc.)

### For Admin Component:
- Use `fetchPendingTrainingTasks()` for approval queue
- Use `verifyTrainingTask()` for approve/reject actions
- Use `recheckTrainingTask()` to allow resubmission

### For Task History Component:
- Use `fetchUserTrainingTasks(userId)` for user's own tasks
- Use `fetchAllTrainingTasks()` with filters for admin views

All functions are ready to use! Just import from `dailyTrainingDice.ts` and call them in your UI components.
