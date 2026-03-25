import { HARVEST_SCRIPT_COPY_STATUS, HARVEST_SUBMISSION_STATUS, SIDEBAR_VIEW } from '../constants/harvest';
import { APPS_SCRIPT_URL } from '../constants/sheets';

export type HarvestSubmissionStatus = typeof HARVEST_SUBMISSION_STATUS[keyof typeof HARVEST_SUBMISSION_STATUS];
export type HarvestScriptCopyStatus = typeof HARVEST_SCRIPT_COPY_STATUS[keyof typeof HARVEST_SCRIPT_COPY_STATUS];

export interface HarvestSubmission {
  id: string;
  characterId: string;
  firstTweetUrl: string;
  status: HarvestSubmissionStatus;
  submittedAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
  charCount?: number;
  mentionCount?: number;
  drachmaReward?: number;
  roleplayers?: string;
  rejectReason?: string;
}

/**
 * Submit a new harvest for review
 */
export async function submitHarvest(
  characterId: string,
  firstTweetUrl: string
): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const res = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify({
        action: 'submitHarvest',
        characterId,
        firstTweetUrl,
        submittedAt: new Date().toISOString(),
      }),
    });

    const data = await res.json();
    return data;
  } catch (error) {
    console.error('Error submitting harvest:', error);
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
  roleplayers: string[]
): Promise<{ success: boolean; awarded?: string[]; error?: string }> {
  try {
    const res = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify({
        action: 'approveHarvest',
        submissionId,
        reviewedBy,
        charCount,
        mentionCount,
        drachmaReward,
        roleplayers,
      }),
    });

    const data = await res.json();
    return data;
  } catch (error) {
    console.error('Error approving harvest:', error);
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
        action: 'rejectHarvest',
        submissionId,
        reviewedBy,
        rejectReason,
      }),
    });

    const data = await res.json();
    return data;
  } catch (error) {
    console.error('Error rejecting harvest:', error);
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
    params.append('action', 'fetchHarvests');
    if (characterId) params.append('characterId', characterId);
    if (status) params.append('status', status);

    const res = await fetch(`${APPS_SCRIPT_URL}?${params.toString()}`);
    const data = await res.json();

    if (data.error) {
      return { harvests: [], error: data.error };
    }

    // Convert comma-separated roleplayers string to array if needed
    const harvests = (data.harvests || []).map((h: any, index: number) => ({
      id: h.id || `${h.characterid || 'harvest'}-${h.submittedat || index}-${index}`,
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

export type SidebarView = typeof SIDEBAR_VIEW[keyof typeof SIDEBAR_VIEW];