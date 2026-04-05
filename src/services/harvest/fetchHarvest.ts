import { ACTIONS } from "../../constants/action";
import { HARVEST_SUBMISSION_STATUS } from "../../constants/harvest";
import { APPS_SCRIPT_URL } from "../../constants/sheets";
import { HarvestRecords, HarvestSubmission, HarvestSubmissionStatus, TopHarvester } from "../../types/harvest";
import { generateUUID } from "../../utils/uuid";

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
  drachmaReward: number,
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
 */
export async function fetchHarvests(
  characterId?: string,
  status?: HarvestSubmissionStatus
): Promise<{ harvests: HarvestSubmission[]; error?: string }> {
  try {
    const params = new URLSearchParams();
    params.append('action', ACTIONS.FETCH_HARVESTS);
    if (characterId) params.append('characterId', characterId);
    if (status) params.append('status', status);

    const res = await fetch(`${APPS_SCRIPT_URL}?${params.toString()}`);
    const data = await res.json();

    if (data.error) {
      return { harvests: [], error: data.error };
    }

    // Convert comma-separated roleplayers string to array if needed
    const harvests = (data.harvests || []).map((h: any) => ({
      id: h.id || generateUUID(), // Generate UUID if not present (for old records)
      characterId: h.characterid || '',
      firstTweetUrl: h.firsttweeturl || '',
      lastTweetUrl: h.lasttweeturl || '',
      status: (h.status || HARVEST_SUBMISSION_STATUS.PENDING) as HarvestSubmission['status'],
      submittedAt: h.submittedat || '',
      reviewedAt: h.reviewedat || undefined,
      reviewedBy: h.reviewedby || undefined,
      charCount: h.charcount ? Number(h.charcount) : undefined,
      mentionCount: h.mentioncount ? Number(h.mentioncount) : undefined,
      drachmaReward: h.drachmareward ? Number(h.drachmareward) : undefined,
      roleplayers: h.roleplayers
        ? h.roleplayers.split(',').map((r: string) => r.trim()).filter(Boolean).join(',')
        : undefined,
      rejectReason: h.rejectreason || undefined,
    }));

    return { harvests };
  } catch (error) {
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
    const params = new URLSearchParams();
    params.append('action', ACTIONS.FETCH_TOP_HARVESTERS);
    if (limit !== undefined) {
      params.append('limit', limit.toString());
    }

    const res = await fetch(`${APPS_SCRIPT_URL}?${params.toString()}`);
    const data = await res.json();

    if (data.error) {
      return { topHarvesters: [], error: data.error };
    }

    return { topHarvesters: data.topHarvesters || [] };
  } catch (error) {
    return { topHarvesters: [], error: 'Failed to fetch top harvesters' };
  }
}