# Firestore & Realtime Database Quota Optimization

## Overview

Firebase quota exceeded warning indicates excessive read/write operations. This document tracks identified issues and optimization strategies.

---

## Critical Issues Found

### 1. ❌ `fetchTodayIrisWishes()` - Unfiltered Daily Collection Query
**File:** `src/data/wishes.ts`
**Problem:** Queries entire `playerWishesOfIris` collection by date with NO limit
- Each call reads ALL wishes for that date
- With 1,000 daily users → 1,000+ reads per call
- Called 2+ times per user per session
- **Monthly Impact:** ~60,000+ reads

**Status:** ✅ FIXED (added 10,000 limit + warning logs)

**Better Solution (Future):** Create `userDailyWishes_summary` collection updated by Cloud Function:
```
// Cloud Function: On each wish write, update a summary collection
functions/src/updateDailyWishesSummary.ts
```

---

### 2. ❌ `onRoomsList()` - Unfiltered Arenas Collection
**File:** `src/services/battleRoom/battleRoom.ts` line 761
**Problem:** Listens to entire `arenas` collection, filters client-side
- Every arena update triggers full collection download
- Client must download and filter ~100+ documents
- Rules allow unfiltered read access

**Status:** ⚠️ NEEDS OPTIMIZATION

**Recommended Fix:**
```typescript
// BEFORE: Downloads all arenas, filters client-side
const arenasRef = ref(db, FIREBASE_PATHS.ARENAS);
const handler = onValue(arenasRef, (snap) => {
  const rooms = Object.values(snap.val()).filter(r => 
    r.status !== ROOM_STATUS.CONFIGURING && 
    !r.practiceMode
  );
});

// AFTER: Use Firestore with server-side filtering
const q = query(
  collection(firestore, 'arenas'),
  where('status', '!=', ROOM_STATUS.CONFIGURING),
  where('practiceMode', '==', false)
);
const unsub = onSnapshot(q, (snap) => {
  const rooms = snap.docs.map(doc => doc.data());
});
```

---

### 3. ⚠️ Chat Message Accumulation
**File:** `src/hooks/useChatPanel.tsx`
**Problem:** All chat messages loaded into React state without pagination
- Long-lived chat rooms accumulate 1000+ messages in memory
- Each listener subscribes to unbounded child additions
- No cleanup of old messages

**Recommended Fix:**
```typescript
const q = query(
  collection(firestore, `chats/${roomId}/messages`),
  orderBy('timestamp', 'desc'),
  limitToLast(100)  // Only load last 100 messages
);
```

---

### 4. ✅ One-Time Queries - Generally Good
Most one-time queries properly use `limit()`:
- `fetchActivityLogs()` → `limit(300)` ✅
- `fetchEquipment()` → Direct document read ✅
- `runTransaction()` → Atomic operation ✅

---

## Firestore Read/Write Breakdown

### Current Monthly Estimate (Before Optimizations)

| Operation | Frequency | Per-Call Cost | Monthly Total |
|-----------|-----------|---------------|---------------|
| fetchTodayIrisWishes | 2x per user/day | 1,000 reads | ~60,000 |
| onRoomsList | 1x per user/session | 100 reads | ~10,000 |
| Chat listeners | Real-time | Small per msg | ~5,000 |
| Activity logs | 1x per user | Limited | ~2,000 |
| Equipment/Bag reads | 5x per user | 1 read | ~10,000 |
| **TOTAL** | | | **~87,000 reads** |

**Firestore Free Tier:** 50,000 reads/month
**Status:** ☠️ EXCEEDS by ~37,000 reads

---

## Implemented Fixes

### ✅ Fix #1: Added Query Limits to Iris Wishes
```typescript
// src/data/wishes.ts
const q = query(ref, where('date', '==', date), limit(10000));
console.warn(`[Quota Alert] ${snap.size} documents read`);
```
- Added 10,000 document limit
- Added console warnings to track quota usage
- Reduces worst-case scenario

---

## Recommended Future Optimizations

### Priority 1: Cloud Functions for Data Aggregation
Create serverless functions to pre-compute:
1. **Daily wishes summary** → 1 read instead of 1,000+
2. **Active arenas cache** → 1 read instead of 100+
3. **Chat message excerpts** → Cache last 10 messages per room

```typescript
// functions/src/aggregateData.ts
exports.updateDailyWishesSummary = functions
  .firestore
  .document('playerWishesOfIris/{docId}')
  .onWrite(async (change, context) => {
    // Update dailyWishesSummary collection
    // Runs server-side, doesn't count as client read
  });
```

### Priority 2: Migrate Arenas to Firestore
Replace Realtime Database arenas collection with Firestore:
- Supports server-side query filtering
- Better quota tracking
- Indexed queries

### Priority 3: Implement Message Pagination
- Load only last 100 chat messages
- Add "Load More" button
- Cache locally in browser

---

## Quota Monitoring

### Enable Firebase Alerts
1. Go to Firebase Console → Firestore → Usage tab
2. Set budget alerts at:
   - 50,000 reads/month (85% of free tier)
   - 20,000 writes/month (85% of free tier)

### Monitor Daily
```typescript
// Add to your monitoring dashboard
console.log(`Daily reads: ${readCount}`, `Daily writes: ${writeCount}`);
```

---

## Best Practices Going Forward

1. **Always use `limit()`** on collection queries
2. **Prefer document reads** over collection queries
3. **Use Cloud Functions** for aggregations
4. **Implement caching** on client-side (React state, localStorage)
5. **Clean up listeners** in useEffect cleanup
6. **Use indexes** for complex queries
7. **Batch writes** where possible (transactions, batch calls)

---

## Testing Quota Impact

Add this utility to test quota usage:

```typescript
// utils/quotaMonitor.ts
let readCount = 0;
let writeCount = 0;

export function trackRead() { readCount++; }
export function trackWrite() { writeCount++; }
export function getQuotaEstimate() {
  return {
    dailyReads: readCount,
    dailyWrites: writeCount,
    monthlyEstimate: readCount * 30,
  };
}
```

---

## Next Steps

1. ✅ Add limits to Iris wishes queries
2. ⏳ Migrate arenas from RTDB to Firestore with filters
3. ⏳ Implement chat message pagination
4. ⏳ Create Cloud Functions for data aggregation
5. ⏳ Set up quota alerts in Firebase Console
