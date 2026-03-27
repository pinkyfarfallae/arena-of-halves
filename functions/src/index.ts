import * as functions from "firebase-functions/v1";
import * as admin from "firebase-admin";

admin.initializeApp();

const db = admin.database();

const PHASE = {
  ROLLING_ATTACK: "rolling-attack",
  ROLLING_DEFEND: "rolling-defend",
  RESOLVING: "resolving",
} as const;

const ARENA_PATH = {
  BATTLE_TURN_ATTACK_ROLL: "battle/turn/attackRoll",
  BATTLE_TURN_DEFEND_ROLL: "battle/turn/defendRoll",
  BATTLE_TURN_PHASE: "battle/turn/phase",
  BATTLE_TURN_DICE_ROLL_START_AT: "battle/turn/diceRollStartAt",
} as const;

const DICE_ROLL_ANIM_DELAY_MS = 500;

interface ActiveEffect {
  targetId?: string;
  modStat?: string;
  effectType?: string;
  value?: number;
}

function getStatModifier(
  effects: ActiveEffect[],
  fighterId: string,
  stat: string
): number {
  return (effects || [])
    .filter(
      (e) => e.targetId === fighterId && e.modStat === stat
    )
    .reduce(
      (sum, e) =>
        sum + (e.effectType === "buff" ? e.value ?? 0 : -(e.value ?? 0)),
      0
    );
}

function findFighter(
  room: { teamA?: { members?: { characterId: string; attackDiceUp?: number; defendDiceUp?: number; quota?: number; maxQuota?: number }[] }; teamB?: { members?: { characterId: string; attackDiceUp?: number; defendDiceUp?: number; quota?: number; maxQuota?: number }[] } },
  characterId: string
): { characterId: string; attackDiceUp: number; defendDiceUp: number; quota: number; maxQuota: number } | undefined {
  const all = [
    ...(room.teamA?.members ?? []),
    ...(room.teamB?.members ?? []),
  ];
  const m = all.find((x) => x.characterId === characterId);
  if (!m) return undefined;
  return {
    characterId: m.characterId,
    attackDiceUp: Number(m.attackDiceUp) || 0,
    defendDiceUp: Number(m.defendDiceUp) || 0,
    quota: Number(m.quota) ?? 0,
    maxQuota: Number(m.maxQuota) ?? 0,
  };
}

function findFighterPath(
  room: { teamA?: { members?: { characterId: string }[] }; teamB?: { members?: { characterId: string }[] } },
  characterId: string
): string | null {
  const teamAIdx = (room.teamA?.members ?? []).findIndex(
    (m) => m.characterId === characterId
  );
  if (teamAIdx !== -1) return `teamA/members/${teamAIdx}`;
  const teamBIdx = (room.teamB?.members ?? []).findIndex(
    (m) => m.characterId === characterId
  );
  if (teamBIdx !== -1) return `teamB/members/${teamBIdx}`;
  return null;
}

/** Server-authoritative attack dice roll. Callable from client with { arenaId }. */
export const requestAttackRoll = functions
  .region("asia-southeast1")
  .https.onCall(async (data: { arenaId: any; }) => {
    const arenaId = data?.arenaId;
    if (typeof arenaId !== "string" || !arenaId) {
      throw new functions.https.HttpsError("invalid-argument", "arenaId required");
    }

    const roomRef = db.ref(`arenas/${arenaId}`);
    const snap = await roomRef.once("value");
    if (!snap.exists()) {
      throw new functions.https.HttpsError("not-found", "Room not found");
    }

    const room = snap.val();
    const battle = room?.battle;
    const turn = battle?.turn;
    if (!turn || turn.phase !== PHASE.ROLLING_ATTACK) {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "Not in rolling-attack phase"
      );
    }

    const roll = Math.floor(Math.random() * 12) + 1;
    const startAt = Date.now() + DICE_ROLL_ANIM_DELAY_MS;

    const updates: Record<string, unknown> = {
      [ARENA_PATH.BATTLE_TURN_ATTACK_ROLL]: roll,
      [ARENA_PATH.BATTLE_TURN_DICE_ROLL_START_AT]: startAt,
    };

    const attacker = findFighter(room, turn.attackerId);
    if (attacker) {
      const activeEffects = battle.activeEffects ?? [];
      const buffMod = getStatModifier(
        activeEffects,
        attacker.characterId,
        "attackDiceUp"
      );
      const total = roll + attacker.attackDiceUp + buffMod;
      if (
        total >= 11 &&
        attacker.quota < attacker.maxQuota
      ) {
        const atkPath = findFighterPath(room, attacker.characterId);
        if (atkPath) updates[atkPath + "/quota"] = attacker.quota + 1;
      }
    }

    await roomRef.update(updates);
    return { roll, startAt };
  });

/** Advance to ROLLING_DEFEND after attack dice animation. Call from client when animation ends. */
export const advancePhaseAfterAttackRoll = functions
  .region("asia-southeast1")
  .https.onCall(async (data: { arenaId: any; }) => {
    const arenaId = data?.arenaId;
    if (typeof arenaId !== "string" || !arenaId) {
      throw new functions.https.HttpsError("invalid-argument", "arenaId required");
    }

    const roomRef = db.ref(`arenas/${arenaId}`);
    const snap = await roomRef.once("value");
    if (!snap.exists()) {
      throw new functions.https.HttpsError("not-found", "Room not found");
    }

    const room = snap.val();
    const turn = room?.battle?.turn;
    if (!turn || turn.phase !== PHASE.ROLLING_ATTACK || turn.attackRoll == null) {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "Expected rolling-attack with attackRoll set"
      );
    }

    await roomRef.update({
      [ARENA_PATH.BATTLE_TURN_PHASE]: PHASE.ROLLING_DEFEND,
    });
    return {};
  });

/** Server-authoritative defend dice roll. Callable from client with { arenaId }. */
export const requestDefendRoll = functions
  .region("asia-southeast1")
  .https.onCall(async (data: { arenaId: any; }) => {
    const arenaId = data?.arenaId;
    if (typeof arenaId !== "string" || !arenaId) {
      throw new functions.https.HttpsError("invalid-argument", "arenaId required");
    }

    const roomRef = db.ref(`arenas/${arenaId}`);
    const snap = await roomRef.once("value");
    if (!snap.exists()) {
      throw new functions.https.HttpsError("not-found", "Room not found");
    }

    const room = snap.val();
    const battle = room?.battle;
    const turn = battle?.turn;
    if (!turn || turn.phase !== PHASE.ROLLING_DEFEND) {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "Not in rolling-defend phase"
      );
    }

    const roll = Math.floor(Math.random() * 12) + 1;
    const startAt = Date.now() + DICE_ROLL_ANIM_DELAY_MS;

    const updates: Record<string, unknown> = {
      [ARENA_PATH.BATTLE_TURN_DEFEND_ROLL]: roll,
      [ARENA_PATH.BATTLE_TURN_DICE_ROLL_START_AT]: startAt,
    };

    const defenderId = turn.defenderId;
    if (defenderId) {
      const defender = findFighter(room, defenderId);
      if (defender) {
        const activeEffects = battle.activeEffects ?? [];
        const buffMod = getStatModifier(
          activeEffects,
          defender.characterId,
          "defendDiceUp"
        );
        const total = roll + defender.defendDiceUp + buffMod;
        if (
          total >= 11 &&
          defender.quota < defender.maxQuota
        ) {
          const defPath = findFighterPath(room, defender.characterId);
          if (defPath) updates[defPath + "/quota"] = defender.quota + 1;
        }
      }
    }

    await roomRef.update(updates);
    return { roll, startAt };
  });

/** Advance to RESOLVING after defend dice animation. Call from client when animation ends. */
export const advancePhaseAfterDefendRoll = functions
  .region("asia-southeast1")
  .https.onCall(async (data: { arenaId: any; }) => {
    const arenaId = data?.arenaId;
    if (typeof arenaId !== "string" || !arenaId) {
      throw new functions.https.HttpsError("invalid-argument", "arenaId required");
    }

    const roomRef = db.ref(`arenas/${arenaId}`);
    const snap = await roomRef.once("value");
    if (!snap.exists()) {
      throw new functions.https.HttpsError("not-found", "Room not found");
    }

    const room = snap.val();
    const turn = room?.battle?.turn;
    if (!turn || turn.phase !== PHASE.ROLLING_DEFEND || turn.defendRoll == null) {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "Expected rolling-defend with defendRoll set"
      );
    }

    await roomRef.update({
      [ARENA_PATH.BATTLE_TURN_PHASE]: PHASE.RESOLVING,
    });
    return {};
  });

/**
 * Extract tweet ID from various Twitter/X URL formats
 */
function extractTweetId(url: string): string | null {
  // Support formats:
  // https://twitter.com/username/status/1234567890
  // https://x.com/username/status/1234567890
  // https://mobile.twitter.com/username/status/1234567890
  const match = url.match(/(?:twitter\.com|x\.com)\/[\w]+\/status\/(\d+)/i);
  return match ? match[1] : null;
}

/**
 * Extract text from tweet HTML (from oEmbed response)
 */
function extractTextFromHtml(html: string): string {
  // Remove HTML tags and decode entities
  let text = html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  
  // Remove URLs at the end (usually the tweet link itself)
  text = text.replace(/https?:\/\/t\.co\/\w+\s*$/i, '').trim();
  
  return text;
}

/**
 * Fetch tweet text using FREE Twitter oEmbed API (no auth required!)
 */
export const fetchTweetText = functions
  .region("asia-southeast1")
  .https.onCall(async (data: { tweetUrl: string }) => {
    const { tweetUrl } = data;

    if (!tweetUrl || typeof tweetUrl !== "string") {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "tweetUrl is required"
      );
    }

    // Validate URL format
    const tweetId = extractTweetId(tweetUrl);
    if (!tweetId) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Invalid Twitter/X URL format"
      );
    }

    try {
      // Use Twitter's FREE oEmbed API - no authentication needed!
      const oembedUrl = `https://publish.twitter.com/oembed?url=${encodeURIComponent(tweetUrl)}&omit_script=true`;
      
      const response = await fetch(oembedUrl);

      if (!response.ok) {
        throw new functions.https.HttpsError(
          "not-found",
          "Tweet not found or is private"
        );
      }

      const oembedData = await response.json();
      const htmlContent = oembedData.html || "";
      
      // Extract text from HTML
      const text = extractTextFromHtml(htmlContent);

      if (!text) {
        throw new functions.https.HttpsError(
          "not-found",
          "Could not extract text from tweet"
        );
      }

      return {
        success: true,
        text,
        tweetId,
      };
    } catch (error: any) {
      console.error("Error fetching tweet:", error);
      
      if (error instanceof functions.https.HttpsError) {
        throw error;
      }
      
      throw new functions.https.HttpsError(
        "internal",
        "Failed to fetch tweet. It may be private or deleted."
      );
    }
  });
