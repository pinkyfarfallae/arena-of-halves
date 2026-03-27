"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchTweetText = exports.advancePhaseAfterDefendRoll = exports.requestDefendRoll = exports.advancePhaseAfterAttackRoll = exports.requestAttackRoll = void 0;
const functions = __importStar(require("firebase-functions/v1"));
const admin = __importStar(require("firebase-admin"));
admin.initializeApp();
const db = admin.database();
const PHASE = {
    ROLLING_ATTACK: "rolling-attack",
    ROLLING_DEFEND: "rolling-defend",
    RESOLVING: "resolving",
};
const ARENA_PATH = {
    BATTLE_TURN_ATTACK_ROLL: "battle/turn/attackRoll",
    BATTLE_TURN_DEFEND_ROLL: "battle/turn/defendRoll",
    BATTLE_TURN_PHASE: "battle/turn/phase",
    BATTLE_TURN_DICE_ROLL_START_AT: "battle/turn/diceRollStartAt",
};
const DICE_ROLL_ANIM_DELAY_MS = 500;
function getStatModifier(effects, fighterId, stat) {
    return (effects || [])
        .filter((e) => e.targetId === fighterId && e.modStat === stat)
        .reduce((sum, e) => { var _a, _b; return sum + (e.effectType === "buff" ? (_a = e.value) !== null && _a !== void 0 ? _a : 0 : -((_b = e.value) !== null && _b !== void 0 ? _b : 0)); }, 0);
}
function findFighter(room, characterId) {
    var _a, _b, _c, _d, _e, _f;
    const all = [
        ...((_b = (_a = room.teamA) === null || _a === void 0 ? void 0 : _a.members) !== null && _b !== void 0 ? _b : []),
        ...((_d = (_c = room.teamB) === null || _c === void 0 ? void 0 : _c.members) !== null && _d !== void 0 ? _d : []),
    ];
    const m = all.find((x) => x.characterId === characterId);
    if (!m)
        return undefined;
    return {
        characterId: m.characterId,
        attackDiceUp: Number(m.attackDiceUp) || 0,
        defendDiceUp: Number(m.defendDiceUp) || 0,
        quota: (_e = Number(m.quota)) !== null && _e !== void 0 ? _e : 0,
        maxQuota: (_f = Number(m.maxQuota)) !== null && _f !== void 0 ? _f : 0,
    };
}
function findFighterPath(room, characterId) {
    var _a, _b, _c, _d;
    const teamAIdx = ((_b = (_a = room.teamA) === null || _a === void 0 ? void 0 : _a.members) !== null && _b !== void 0 ? _b : []).findIndex((m) => m.characterId === characterId);
    if (teamAIdx !== -1)
        return `teamA/members/${teamAIdx}`;
    const teamBIdx = ((_d = (_c = room.teamB) === null || _c === void 0 ? void 0 : _c.members) !== null && _d !== void 0 ? _d : []).findIndex((m) => m.characterId === characterId);
    if (teamBIdx !== -1)
        return `teamB/members/${teamBIdx}`;
    return null;
}
/** Server-authoritative attack dice roll. Callable from client with { arenaId }. */
exports.requestAttackRoll = functions
    .region("asia-southeast1")
    .https.onCall(async (data) => {
    var _a;
    const arenaId = data === null || data === void 0 ? void 0 : data.arenaId;
    if (typeof arenaId !== "string" || !arenaId) {
        throw new functions.https.HttpsError("invalid-argument", "arenaId required");
    }
    const roomRef = db.ref(`arenas/${arenaId}`);
    const snap = await roomRef.once("value");
    if (!snap.exists()) {
        throw new functions.https.HttpsError("not-found", "Room not found");
    }
    const room = snap.val();
    const battle = room === null || room === void 0 ? void 0 : room.battle;
    const turn = battle === null || battle === void 0 ? void 0 : battle.turn;
    if (!turn || turn.phase !== PHASE.ROLLING_ATTACK) {
        throw new functions.https.HttpsError("failed-precondition", "Not in rolling-attack phase");
    }
    const roll = Math.floor(Math.random() * 12) + 1;
    const startAt = Date.now() + DICE_ROLL_ANIM_DELAY_MS;
    const updates = {
        [ARENA_PATH.BATTLE_TURN_ATTACK_ROLL]: roll,
        [ARENA_PATH.BATTLE_TURN_DICE_ROLL_START_AT]: startAt,
    };
    const attacker = findFighter(room, turn.attackerId);
    if (attacker) {
        const activeEffects = (_a = battle.activeEffects) !== null && _a !== void 0 ? _a : [];
        const buffMod = getStatModifier(activeEffects, attacker.characterId, "attackDiceUp");
        const total = roll + attacker.attackDiceUp + buffMod;
        if (total >= 11 &&
            attacker.quota < attacker.maxQuota) {
            const atkPath = findFighterPath(room, attacker.characterId);
            if (atkPath)
                updates[atkPath + "/quota"] = attacker.quota + 1;
        }
    }
    await roomRef.update(updates);
    return { roll, startAt };
});
/** Advance to ROLLING_DEFEND after attack dice animation. Call from client when animation ends. */
exports.advancePhaseAfterAttackRoll = functions
    .region("asia-southeast1")
    .https.onCall(async (data) => {
    var _a;
    const arenaId = data === null || data === void 0 ? void 0 : data.arenaId;
    if (typeof arenaId !== "string" || !arenaId) {
        throw new functions.https.HttpsError("invalid-argument", "arenaId required");
    }
    const roomRef = db.ref(`arenas/${arenaId}`);
    const snap = await roomRef.once("value");
    if (!snap.exists()) {
        throw new functions.https.HttpsError("not-found", "Room not found");
    }
    const room = snap.val();
    const turn = (_a = room === null || room === void 0 ? void 0 : room.battle) === null || _a === void 0 ? void 0 : _a.turn;
    if (!turn || turn.phase !== PHASE.ROLLING_ATTACK || turn.attackRoll == null) {
        throw new functions.https.HttpsError("failed-precondition", "Expected rolling-attack with attackRoll set");
    }
    await roomRef.update({
        [ARENA_PATH.BATTLE_TURN_PHASE]: PHASE.ROLLING_DEFEND,
    });
    return {};
});
/** Server-authoritative defend dice roll. Callable from client with { arenaId }. */
exports.requestDefendRoll = functions
    .region("asia-southeast1")
    .https.onCall(async (data) => {
    var _a;
    const arenaId = data === null || data === void 0 ? void 0 : data.arenaId;
    if (typeof arenaId !== "string" || !arenaId) {
        throw new functions.https.HttpsError("invalid-argument", "arenaId required");
    }
    const roomRef = db.ref(`arenas/${arenaId}`);
    const snap = await roomRef.once("value");
    if (!snap.exists()) {
        throw new functions.https.HttpsError("not-found", "Room not found");
    }
    const room = snap.val();
    const battle = room === null || room === void 0 ? void 0 : room.battle;
    const turn = battle === null || battle === void 0 ? void 0 : battle.turn;
    if (!turn || turn.phase !== PHASE.ROLLING_DEFEND) {
        throw new functions.https.HttpsError("failed-precondition", "Not in rolling-defend phase");
    }
    const roll = Math.floor(Math.random() * 12) + 1;
    const startAt = Date.now() + DICE_ROLL_ANIM_DELAY_MS;
    const updates = {
        [ARENA_PATH.BATTLE_TURN_DEFEND_ROLL]: roll,
        [ARENA_PATH.BATTLE_TURN_DICE_ROLL_START_AT]: startAt,
    };
    const defenderId = turn.defenderId;
    if (defenderId) {
        const defender = findFighter(room, defenderId);
        if (defender) {
            const activeEffects = (_a = battle.activeEffects) !== null && _a !== void 0 ? _a : [];
            const buffMod = getStatModifier(activeEffects, defender.characterId, "defendDiceUp");
            const total = roll + defender.defendDiceUp + buffMod;
            if (total >= 11 &&
                defender.quota < defender.maxQuota) {
                const defPath = findFighterPath(room, defender.characterId);
                if (defPath)
                    updates[defPath + "/quota"] = defender.quota + 1;
            }
        }
    }
    await roomRef.update(updates);
    return { roll, startAt };
});
/** Advance to RESOLVING after defend dice animation. Call from client when animation ends. */
exports.advancePhaseAfterDefendRoll = functions
    .region("asia-southeast1")
    .https.onCall(async (data) => {
    var _a;
    const arenaId = data === null || data === void 0 ? void 0 : data.arenaId;
    if (typeof arenaId !== "string" || !arenaId) {
        throw new functions.https.HttpsError("invalid-argument", "arenaId required");
    }
    const roomRef = db.ref(`arenas/${arenaId}`);
    const snap = await roomRef.once("value");
    if (!snap.exists()) {
        throw new functions.https.HttpsError("not-found", "Room not found");
    }
    const room = snap.val();
    const turn = (_a = room === null || room === void 0 ? void 0 : room.battle) === null || _a === void 0 ? void 0 : _a.turn;
    if (!turn || turn.phase !== PHASE.ROLLING_DEFEND || turn.defendRoll == null) {
        throw new functions.https.HttpsError("failed-precondition", "Expected rolling-defend with defendRoll set");
    }
    await roomRef.update({
        [ARENA_PATH.BATTLE_TURN_PHASE]: PHASE.RESOLVING,
    });
    return {};
});
/**
 * Extract tweet ID from various Twitter/X URL formats
 */
function extractTweetId(url) {
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
function extractTextFromHtml(html) {
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
exports.fetchTweetText = functions
    .region("asia-southeast1")
    .https.onCall(async (data) => {
    const { tweetUrl } = data;
    if (!tweetUrl || typeof tweetUrl !== "string") {
        throw new functions.https.HttpsError("invalid-argument", "tweetUrl is required");
    }
    // Validate URL format
    const tweetId = extractTweetId(tweetUrl);
    if (!tweetId) {
        throw new functions.https.HttpsError("invalid-argument", "Invalid Twitter/X URL format");
    }
    try {
        // Use Twitter's FREE oEmbed API - no authentication needed!
        const oembedUrl = `https://publish.twitter.com/oembed?url=${encodeURIComponent(tweetUrl)}&omit_script=true`;
        const response = await fetch(oembedUrl);
        if (!response.ok) {
            throw new functions.https.HttpsError("not-found", "Tweet not found or is private");
        }
        const oembedData = await response.json();
        const htmlContent = oembedData.html || "";
        // Extract text from HTML
        const text = extractTextFromHtml(htmlContent);
        if (!text) {
            throw new functions.https.HttpsError("not-found", "Could not extract text from tweet");
        }
        return {
            success: true,
            text,
            tweetId,
        };
    }
    catch (error) {
        console.error("Error fetching tweet:", error);
        if (error instanceof functions.https.HttpsError) {
            throw error;
        }
        throw new functions.https.HttpsError("internal", "Failed to fetch tweet. It may be private or deleted.");
    }
});
//# sourceMappingURL=index.js.map