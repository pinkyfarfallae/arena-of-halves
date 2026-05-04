# Firestore & Realtime Database Audit Report

**Generated:** May 4, 2026  
**Scope:** Arena of Halves - Quota Usage Analysis

---

## Executive Summary

Found **3 active real-time listeners** in the codebase with varying cleanup patterns:

1. **Firestore Listener** (`useBag.tsx`) - ✅ **PROPERLY CLEANED UP**
2. **RTDB Listener** (`useChatPanel.tsx`) - ✅ **PROPERLY CLEANED UP**
3. **RTDB Listeners** (`battleRoom.ts`) - ✅ **PROPERLY CLEANED UP** (returns cleanup functions)

**Overall Risk:** LOW for memory leaks. However, some query patterns could contribute to excessive read quota usage.

---

## Detailed Listener Analysis

### 1. Firestore: `useBag.tsx` - Player Bag Data

**Location:** [src/hooks/useBag.tsx](src/hooks/useBag.tsx#L24-L60)

**Type:** Firestore `onSnapshot` (real-time listener)

**Scope:** Single document
```
Collection: PLAYER_BAGS
Document ID: {userId}
```

**Cleanup Code:**
```typescript
useEffect(() => {
  // ...setup code...
  const unsubscribe = onSnapshot(
    docRef,
    (snapshot) => { /* handle snapshot */ },
    (err) => { /* handle error */ }
  );

  return () => {
    isMounted = false;
    unsubscribe();  // ✅ Called in cleanup
  };
}, [userId]);
```

**Cleanup Status:** ✅ **PROPER**
- Unsubscribe called in useEffect cleanup
- `isMounted` guard prevents state updates after unmount
- Listener destroyed when component unmounts or `userId` changes

**Quota Impact:** LOW
- Limited to single user's bag document
- Only listens when component is mounted
- No filtering issues (doc-level lookup)

**Potential Issues:** None identified

---

### 2. Realtime Database: `useChatPanel.tsx` - Chat Messages

**Location:** [src/hooks/useChatPanel.tsx](src/hooks/useChatPanel.tsx#L21-L44)

**Type:** RTDB `onChildAdded` (real-time listener)

**Scope:** Single chat room subcollection
```
Path: chat/{roomId}
Event Type: onChildAdded
```

**Cleanup Code:**
```typescript
useEffect(() => {
  if (!roomId) return;

  // Clean up previous listener BEFORE setting up new one
  unsubRef.current?.();
  setMessages([]);

  const unsub = onChildAdded(chatRef, (snap) => {
    // Handle messages
  });

  unsubRef.current = () => unsub();

  return () => {
    unsubRef.current?.();  // ✅ Called in cleanup
  };
}, [roomId]);
```

**Cleanup Status:** ✅ **PROPER**
- Unsubscribe stored in useRef for safe cleanup
- Previous listener cleaned before new one attached (prevents duplicates)
- Cleanup called on unmount and roomId change
- Messages array reset when switching rooms

**Quota Impact:** MEDIUM
- Only active for currently viewed chat room
- Accumulates messages (no pagination/truncation visible)
- `onChildAdded` fires once for existing messages + new ones

**Potential Issues:** 
⚠️ **Message Accumulation:** If a room has many messages, all are loaded into state. Consider implementing:
- Pagination or limit-based queries
- Deletion of old messages from state
- Virtual scrolling for large message lists

---

### 3. Realtime Database: `battleRoom.ts` - Arena Listings & Room Changes

**Location:** [src/services/battleRoom/battleRoom.ts](src/services/battleRoom/battleRoom.ts#L760-L796)

**Type:** RTDB `onValue` (real-time listener)

**Three Functions with Listeners:**

#### 3a. `onRoomsList()` - All Active Battle Rooms

**Scope:** Top-level collection
```
Path: arenas (entire collection)
Event: onValue
```

**Cleanup Code:**
```typescript
export function onRoomsList(callback, viewerCharacterId?: string): () => void {
  const arenasRef = ref(db, FIREBASE_PATHS.ARENAS);
  const handler = onValue(arenasRef, (snap) => {
    const rooms = !snap.exists() ? [] : Object.values(snap.val());
    // Filter + sort
    setTimeout(() => callback(rooms), 0);
  });

  return () => off(arenasRef, FIREBASE_EVENTS.VALUE, handler);  // ✅ Cleanup
}
```

**Cleanup Status:** ✅ **PROPER**
- Returns unsubscribe function (cleanup responsibility on caller)
- Used in 2 locations:
  - `IrisMessage.tsx` (lines 155-165, 192-202) - ✅ Called immediately after forEach
  - Not found as persistent listener

**Quota Impact:** HIGH ⚠️
- Listens to **entire `arenas` collection**
- Every room creation/update/deletion triggers a callback
- No filtering at DB level (filters applied in client code)
- Deferred callback via `setTimeout` (good for UI performance, neutral for quota)

**Potential Issues:**
⚠️ **Broad Collection Query:** 
- Loads all active arenas regardless of relevance
- Should implement Firestore query with `where` clause to filter by status/type
- Better pattern:
```typescript
// Current: Loads all, filters in client
const q = query(ref(db, 'arenas'));

// Recommended: Filter at DB level (if RTDB supports)
// Or for Firestore: query(collection(...), where('status', '!=', 'CONFIGURING'))
```

⚠️ **Filters Applied Client-Side:**
```typescript
.filter((r) => {
  if (r.status === ROOM_STATUS.CONFIGURING || r.practiceMode) return false;
  if (r.secretMode && !isSecretCharacter(viewerCharacterId)) return false;
  return true;
})
```
- These filters happen AFTER data is loaded from DB
- Wasted quota on filtered-out arenas

#### 3b. `onRoomChange()` - Single Arena by ID

**Scope:** Single document
```
Path: arenas/{arenaId}
Event: onValue
```

**Cleanup Code:**
```typescript
export function onRoomChange(arenaId: string, callback): () => void {
  const r = roomRef(arenaId);
  const handler = onValue(r, (snap) => {
    const value = snap.exists() ? snap.val() : null;
    setTimeout(() => callback(value), 0);
  });

  return () => off(r, FIREBASE_EVENTS.VALUE, handler);  // ✅ Cleanup
}
```

**Cleanup Status:** ✅ **PROPER**
- Returns cleanup function
- Caller responsible for unsubscribing

**Quota Impact:** LOW
- Single document watched
- Only active while player is in battle room
- Efficient for arena state updates

---

## Query Analysis (One-time Reads)

### Firestore Queries with Filtering

#### 1. Activity Logs (`activityLogService.ts`)
```typescript
const q = query(col(), orderBy('createdAt', 'desc'), limit(limitCount));
const snap = await getDocs(q);
```
- **Pattern:** ✅ Good - Uses `orderBy` and `limit`
- **Quota Cost:** Read 1 document per result
- **Issue:** None - `limit(300)` caps reads

---

#### 2. Iris Wishes (`wishes.ts`)

**Query A: Fetch all wishes for a player**
```typescript
const q = query(ref, where('userId', '==', characterId));
const snap = await getDocs(q);
```
- **Pattern:** ✅ Good - Single `where` clause, indexed field
- **Quota Cost:** Read all documents matching userId
- **Issue:** ✅ None - Limited by userId

**Query B: Fetch all wishes for today (DAILY READ)**
```typescript
const q = query(ref, where('date', '==', date));
const snap = await getDocs(q);
```
- **Pattern:** ⚠️ CAUTION - Reads **entire day's wishes** across all players
- **Quota Cost:** HIGH - Could read thousands of documents daily
- **Called From:** 
  - `IrisMessage.tsx` - Initial load (line 56)
  - Battle room auto-update function
- **Issue:** ⚠️ **Potential Quota Issue**
  - If 1,000+ players make wishes daily → 1,000+ reads per query
  - Called multiple times per session

**Query C: Fetch wishes by date (for admin/totals)**
```typescript
const q = query(ref, where('date', '==', date));
```
- **Same as Query B** - Same quota impact

---

#### 3. Equipment Service (`equipmentService.ts`)
```typescript
const docSnap = await getDoc(docRef);
```
- **Pattern:** ✅ Good - Direct document lookup
- **Quota Cost:** 1 read per call
- **Calls:** Multiple (~5 per operation)
- **Issue:** None - Expected cost for equipment operations

---

#### 4. Wishes: Nike Bonus Check (`wishes.ts`)
```typescript
const snap = await getDoc(ref);
// Later: updateCharacterDrachma, logActivity
```
- **Pattern:** ✅ Good - Direct lookup
- **Called:** Per wish toss
- **Issue:** None identified

---

## Batch/Transaction Operations

### `runTransaction` in `dailyClaimService.ts`
```typescript
const result = await runTransaction(firestore, async (tx) => {
  const snap = await tx.get(ref);
  // ... business logic ...
  tx.set(ref, updated);
});
```
- **Pattern:** ✅ Good - Atomic transaction
- **Quota Cost:** Reads + writes
- **Issue:** None - Proper transactional pattern

---

## Summary Table: All Listeners & Critical Queries

| Component | Type | Scope | Cleanup | Risk | Notes |
|-----------|------|-------|---------|------|-------|
| **useBag** | Firestore onSnapshot | Single doc | ✅ | LOW | User's bag only |
| **useChatPanel** | RTDB onChildAdded | Chat room | ✅ | MEDIUM | Message accumulation concern |
| **battleRoom.onRoomsList** | RTDB onValue | All arenas | ✅ | HIGH ⚠️ | Broad query, client-side filters |
| **battleRoom.onRoomChange** | RTDB onValue | Single arena | ✅ | LOW | Only in battle |
| **fetchActivityLogs** | Firestore getDocs | Ordered query | N/A | LOW | Capped with `limit()` |
| **fetchTodayIrisWishes** | Firestore getDocs | By date | N/A | HIGH ⚠️ | Daily aggregate, high volume |
| **fetchIrisWishesByDate** | Firestore getDocs | By date | N/A | HIGH ⚠️ | Same as above |
| **fetchAllIrisWishes** | Firestore getDocs | By userId | N/A | LOW | Limited by userId |

---

## Identified Issues & Recommendations

### 🔴 HIGH PRIORITY

#### Issue #1: `fetchTodayIrisWishes()` - Broad Daily Query

**Problem:**
- Reads ALL Iris wishes for a given date across ALL players
- Called at least twice per user session:
  1. Initial load in `IrisMessage.tsx` (line 56)
  2. After wish is made (line 192, 202)
- With 1,000 daily active users: **1,000+ reads per query**

**Current Usage:**
```typescript
// In IrisMessage.tsx - Initial load
const [todayWishes, userWish] = await Promise.all([
  fetchTodayIrisWishes().catch(() => [] as Wish[]),  // ← Reads all wishes
  fetchTodayIrisWish(user?.characterId || ''),        // ← Reads one (good)
]);

// In confirmChoice callback (after wish)
updateTodayWishesForRoom(room.arenaId);  // Calls fetchTodayIrisWishes internally
```

**Recommendation:**
```typescript
// ✅ BETTER: Fetch only necessary wishes
// Option A: Use Firestore Security Rules to auto-populate local cache
// Option B: Cloud Function maintains summary (deity counts)
// Option C: Separate collection: wishes_daily_summary/{date}

// For now, consider fetching only:
// - Your own wish
// - Wishes from players in current room
```

---

#### Issue #2: `onRoomsList()` - Unfiltered Arena Collection

**Problem:**
- Loads **entire** RTDB `arenas` collection at once
- Client applies filters (configuring, practice, secret mode)
- Every arena update triggers callback
- Potential for 100+ arenas → 100+ reads to load

**Current Code:**
```typescript
const arenasRef = ref(db, FIREBASE_PATHS.ARENAS);  // ALL ARENAS
const handler = onValue(arenasRef, (snap) => {
  const rooms = Object.values(snap.val())
    .filter((r) => {
      if (r.status === ROOM_STATUS.CONFIGURING) return false;  // ← Client-side
      if (r.practiceMode) return false;                         // ← Client-side
      if (r.secretMode && !isSecretCharacter()) return false;  // ← Client-side
    });
});
```

**Recommendations:**
1. **Firestore Option:** Switch to Firestore and use query filtering
   ```typescript
   const q = query(
     collection(db, 'arenas'),
     where('status', '!=', 'CONFIGURING'),
     where('practiceMode', '==', false),
     where('secretMode', '==', isSecret)
   );
   ```

2. **RTDB Option:** Use Cloud Functions to maintain filtered subset
   ```
   arenas_public/{roomId}  // Only non-configuring, non-practice
   ```

3. **Current Mitigation:** Optimize on-demand queries instead of persistent listeners

---

### 🟡 MEDIUM PRIORITY

#### Issue #3: Chat Message Accumulation

**Problem:**
- `useChatPanel` uses `onChildAdded` to stream messages
- No limit on number of messages loaded
- Large chat rooms accumulate all messages in React state

**Impact:**
- Memory leak risk on long-lived rooms
- UI slowdown with 1000+ messages

**Recommendation:**
```typescript
// Implement pagination
export function useChatPanel(roomId: string, pageSize = 50) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [hasMore, setHasMore] = useState(true);

  // Only listen to last N messages
  const chatRef = query(
    ref(db, `chat/${roomId}`),
    limitToLast(pageSize)
  );

  const unsub = onChildAdded(chatRef, (snap) => { /*...*/ });

  const loadMore = () => {
    // Load older messages batch
  };

  return { messages, sendMessage, loadMore, hasMore };
}
```

---

### 🟢 LOW PRIORITY / OBSERVATIONS

#### Observation #1: Dual-database Model
- Uses both **Firestore** AND **Realtime Database**
- Firestore: Player data (bags, equipment, wishes, training)
- RTDB: Battle rooms (real-time multiplayer state)
- → This is architectural choice; no issue if intentional

#### Observation #2: Activity Logging
```typescript
await logActivity({
  category: 'action',
  action: ACTIVITY_LOG_ACTIONS.WISH_TOSSED,
  // ...
});
```
- Creates document per action
- Good: Uses `addDoc` (auto-ID)
- Impact: Grows `ACTIVITY_LOGS` collection continuously
- Consider: Implement data export + cleanup strategy

#### Observation #3: Transaction Patterns
- Only found in `dailyClaimService.ts`
- Pattern: Read → validate → write
- ✅ Good atomicity guarantees

---

## Quota Usage Estimates

### Firestore (estimated daily)

| Operation | Reads | Writes | Notes |
|-----------|-------|--------|-------|
| Bag updates (500 users) | 500 | 500 | Per play session |
| Wish tosse (100 users/day) | 100+ | 100+ | Plus activity logs |
| Equipment operations (500 users) | 1,500 | 500 | Multiple get/set |
| Activity logging (500 actions) | - | 500 | Ongoing |
| **Daily total wishes query** | **1,000+** ⚠️ | - | **HIGH IMPACT** |
| **Total Firestore** | **~5,000** | **2,000** | **Spike from wishes** |

### Realtime Database (estimated)

| Listener | Frequency | Cost | Notes |
|----------|-----------|------|-------|
| Room listings load | Per session | 1 read | ~500 sessions = 500 reads |
| Room updates | Continuous | Varies | Each arena change = 1 read |
| Chat messages | Per active room | Varies | Each message = 1 read |
| **Estimated monthly** | - | **50K+ reads** | **Depends on activity** |

---

## Recommendations (Prioritized)

### Tier 1: Reduce High-Impact Queries
1. **Refactor `fetchTodayIrisWishes()`**
   - Create summary collection: `wishes_summary` 
   - Cloud Function updates daily counts
   - Result: From 1,000 reads → 1 read

2. **Optimize `onRoomsList()`**
   - Switch to Firestore with proper query filters
   - Or maintain separate `arenas_active` collection

### Tier 2: Memory & Performance
3. **Paginate chat messages** (in `useChatPanel`)
   - Limit to last 100 messages initially
   - Implement "load more older" feature

4. **Monitor listener lifecycle**
   - All listeners have cleanup ✅
   - Keep current pattern

### Tier 3: Observability
5. **Add quota monitoring**
   - Log daily read/write counts
   - Alert on spikes
   - Track by operation type

---

## Firestore Security Rules Review

**Note:** This audit assumes proper security rules exist. Verify:
- [ ] `onRoomsList` requires auth
- [ ] Users can only read their own bag
- [ ] Wishes are write-once (no overwrites)
- [ ] Activity logs are admin-write only

---

## Conclusion

**Overall Risk Level:** 🟡 **MEDIUM**

**Key Findings:**
- ✅ All listeners properly cleaned up (no memory leaks)
- ⚠️ `fetchTodayIrisWishes()` is **highest quota consumer**
- ⚠️ `onRoomsList()` loads unfiltered collection
- ✅ Most other operations are well-structured

**Estimated Monthly Firestore Reads:** 50,000-100,000+  
**Primary Concern:** Daily aggregation query for Iris wishes

---

**Report generated for:** Arena of Halves development team  
**Recommendation:** Address Tier 1 issues before scaling user base
