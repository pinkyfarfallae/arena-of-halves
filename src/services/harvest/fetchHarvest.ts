import { ACTIONS } from "../../constants/action";
import { HARVEST_SUBMISSION_STATUS } from "../../constants/harvest";
import { APPS_SCRIPT_URL, csvUrl, GID } from "../../constants/sheets";
import { HarvestRecords, HarvestSubmission, HarvestSubmissionStatus, TopHarvester } from "../../types/harvest";
import { generateUUID } from "../../utils/uuid";
import { splitCSVRows, parseCSVLine } from "../../utils/csv";

/**
 * Submit a new harvest for review
 */
export async function submitHarvest(
  characterId: string,
  firstTweetUrl: string,
): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const submissionId = generateUUID();
    const res = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify({
        action: ACTIONS.SUBMIT_HARVEST,
        id: submissionId,
        characterId,
        firstTweetUrl,
        submittedAt: new Date().toISOString(),
      }),
    });

    const data = await res.json();
    return data;
  } catch (error) {
    return { success: false, error: 'Failed to submit harvest' };
  }
}

/**
 * Approve a harvest submission and award drachma to all roleplayers
 */
export async function approveHarvest(
  submissionId: string,
  reviewedBy: string,
  charCount: number,
  mentionCount: number,
  drachmaReward: string | number, // Now accepts JSON string map or legacy number
  roleplayers: string[],
  demeterBonusIds: string[] = []
): Promise<{ success: boolean; awarded?: string[]; error?: string }> {
  try {
    const res = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify({
        action: ACTIONS.APPROVE_HARVEST,
        submissionId,
        reviewedBy,
        charCount,
        mentionCount,
        drachmaReward,
        roleplayers,
        demeterBonusIds,
      }),
    });

    const data = await res.json();
    return data;
  } catch (error) {
    return { success: false, error: 'Failed to approve harvest' };
  }
}

/**
 * Reject a harvest submission
 */
export async function rejectHarvest(
  submissionId: string,
  reviewedBy: string,
  rejectReason: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify({
        action: ACTIONS.REJECT_HARVEST,
        submissionId,
        reviewedBy,
        rejectReason,
      }),
    });

    const data = await res.json();
    return data;
  } catch (error) {
    return { success: false, error: 'Failed to reject harvest' };
  }
}

/**
 * Fetch harvest submissions (optionally filtered by characterId or status)
 * Uses CSV export to avoid CORS issues
 */
export async function fetchHarvests(
  characterId?: string,
  status?: HarvestSubmissionStatus
): Promise<{ harvests: HarvestSubmission[]; error?: string }> {
  try {
    // Fetch directly from Google Sheets CSV export (no CORS issues)
    const res = await fetch(csvUrl(GID.HARVEST));
    const text = await res.text();
    const lines = splitCSVRows(text);

    if (lines.length < 2) {
      return { harvests: [] };
    }

    const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase());
    const harvests: HarvestSubmission[] = [];

    for (let i = 1; i < lines.length; i++) {
      const cols = parseCSVLine(lines[i]);
      const harvest: any = {};

      for (let j = 0; j < headers.length; j++) {
        harvest[headers[j]] = cols[j] || '';
      }

      // Filter by characterId if provided
      if (characterId && harvest.characterid !== characterId) {
        continue;
      }

      // Filter by status if provided
      if (status && harvest.status !== status) {
        continue;
      }

      harvests.push({
        id: harvest.id || generateUUID(),
        characterId: harvest.characterid || '',
        firstTweetUrl: harvest.firsttweeturl || '',
        status: (harvest.status || HARVEST_SUBMISSION_STATUS.PENDING) as HarvestSubmission['status'],
        submittedAt: harvest.submittedat || '',
        reviewedAt: harvest.reviewedat || undefined,
        reviewedBy: harvest.reviewedby || undefined,
        charCount: harvest.charcount ? Number(harvest.charcount) : undefined,
        mentionCount: harvest.mentioncount ? Number(harvest.mentioncount) : undefined,
        drachmaReward: harvest.drachmareward || undefined,
        roleplayers: harvest.roleplayers
          ? harvest.roleplayers.split(',').map((r: string) => r.trim()).filter(Boolean).join(',')
          : undefined,
        rejectReason: harvest.rejectreason || undefined,
      });
    }

    return { harvests };
  } catch (error) {
    console.error('Error fetching harvests from CSV:', error);
    return { harvests: [], error: 'Failed to fetch harvests' };
  }
}

/**
 * Fetch harvest records (statistics and notable achievements)
 */
export async function fetchHarvestRecords(): Promise<{ records?: HarvestRecords; error?: string }> {
  try {
    const params = new URLSearchParams();
    params.append('action', ACTIONS.FETCH_HARVEST_RECORDS);

    const res = await fetch(`${APPS_SCRIPT_URL}?${params.toString()}`);
    const data = await res.json();

    if (data.error) {
      return { error: data.error };
    }

    return { records: data.records };
  } catch (error) {
    return { error: 'Failed to fetch harvest records' };
  }
}

/**
 * Fetch top harvesters leaderboard
 * @param limit - Number of results to return (0 or undefined = no limit)
 */
export async function fetchTopHarvesters(limit?: number): Promise<{ topHarvesters: TopHarvester[]; error?: string }> {
  try {
    // Fetch approved harvests from CSV
    const { harvests, error } = await fetchHarvests(undefined, HARVEST_SUBMISSION_STATUS.APPROVED);

    if (error) {
      return { topHarvesters: [], error };
    }

    // Aggregate drachma by character
    const drachmaByCharacter = new Map<string, number>();

    for (const harvest of harvests) {
      if (!harvest.drachmaReward) continue;

      let totalForHarvest = 0;

      // Parse drachmaReward (can be JSON string or number)
      if (typeof harvest.drachmaReward === 'string' && harvest.drachmaReward.startsWith('{')) {
        try {
          const rewardMap = JSON.parse(harvest.drachmaReward);
          // Sum all values in the reward map
          totalForHarvest = Object.values(rewardMap).reduce((sum: number, val) => sum + Number(val || 0), 0);
        } catch (e) {
          totalForHarvest = Number(harvest.drachmaReward) || 0;
        }
      } else {
        totalForHarvest = Number(harvest.drachmaReward) || 0;
      }

      // Add to character's total
      const current = drachmaByCharacter.get(harvest.characterId) || 0;
      drachmaByCharacter.set(harvest.characterId, current + totalForHarvest);
    }

    // Convert to array and sort by total drachma (descending)
    let topHarvesters: TopHarvester[] = Array.from(drachmaByCharacter.entries())
      .map(([characterId, totalDrachma]) => ({ characterId, totalDrachma }))
      .sort((a, b) => b.totalDrachma - a.totalDrachma);

    // Apply limit if specified
    if (limit && limit > 0) {
      topHarvesters = topHarvesters.slice(0, limit);
    }

    // Fetch character names from character CSV
    try {
      const charRes = await fetch(csvUrl(GID.CHARACTER));
      const charText = await charRes.text();
      const charLines = splitCSVRows(charText);

      if (charLines.length >= 2) {
        const charHeaders = parseCSVLine(charLines[0]).map(h => h.toLowerCase());
        const idIdx = charHeaders.indexOf('characterid');
        const engIdx = charHeaders.indexOf('nicknameeng');
        const thaiIdx = charHeaders.indexOf('nicknamethai');

        if (idIdx !== -1) {
          const charMap = new Map<string, { nicknameEng?: string; nicknameThai?: string }>();

          for (let i = 1; i < charLines.length; i++) {
            const cols = parseCSVLine(charLines[i]);
            const cid = cols[idIdx];
            if (cid) {
              charMap.set(cid, {
                nicknameEng: engIdx !== -1 ? cols[engIdx] : undefined,
                nicknameThai: thaiIdx !== -1 ? cols[thaiIdx] : undefined,
              });
            }
          }

          // Add character names to top harvesters
          topHarvesters = topHarvesters.map(h => ({
            ...h,
            ...charMap.get(h.characterId),
          }));
        }
      }
    } catch (e) {
      // Character name fetch failed, but we still have the leaderboard
      console.error('Failed to fetch character names for top harvesters:', e);
    }

    return { topHarvesters };
  } catch (error) {
    console.error('Error fetching top harvesters:', error);
    return { topHarvesters: [], error: 'Failed to fetch top harvesters' };
  }
}