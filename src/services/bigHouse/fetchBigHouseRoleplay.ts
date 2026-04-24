import { ACTIONS } from "../../constants/action";
import { APPS_SCRIPT_URL, csvUrl, GID } from "../../constants/sheets";
import { BigHouseSubmission } from "../../types/bigHouse";
import { BigHouseSubmissionStatus } from "../../constants/bigHouse";
import { generateUUID } from "../../utils/uuid";
import { splitCSVRows, parseCSVLine } from "../../utils/csv";

/**
 * Submit a new Big House roleplay for review
 */
export async function submitBigHouseRoleplay(
  characterId: string,
  roleplayUrl: string,
): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const submissionId = generateUUID();
    const res = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify({
        action: ACTIONS.SUBMIT_BIG_HOUSE_ROLEPLAY,
        id: submissionId,
        characterId,
        roleplayUrl,
        submittedAt: new Date().toISOString(),
      }),
    });

    const data = await res.json();
    return data;
  } catch (error) {
    return { success: false, error: 'Failed to submit Big House roleplay' };
  }
}

/**
 * Approve a Big House roleplay submission
 */
export async function approveBigHouseRoleplay(
  submissionId: string,
  reviewedBy: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify({
        action: ACTIONS.APPROVE_BIG_HOUSE_ROLEPLAY,
        submissionId,
        reviewedBy,
      }),
    });

    const data = await res.json();
    return data;
  } catch (error) {
    return { success: false, error: 'Failed to approve Big House roleplay' };
  }
}

/**
 * Reject a Big House roleplay submission
 */
export async function rejectBigHouseRoleplay(
  submissionId: string,
  reviewedBy: string,
  rejectReason: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify({
        action: ACTIONS.REJECT_BIG_HOUSE_ROLEPLAY,
        submissionId,
        reviewedBy,
        rejectReason,
      }),
    });

    const data = await res.json();
    return data;
  } catch (error) {
    return { success: false, error: 'Failed to reject Big House roleplay' };
  }
}

/**
 * Fetch Big House roleplay submissions from CSV export
 * Optionally filtered by characterId or status
 */
export async function fetchBigHouseRoleplays(
  characterId?: string,
  status?: BigHouseSubmissionStatus,
): Promise<{ submissions: BigHouseSubmission[]; error?: string }> {
  try {
    const res = await fetch(csvUrl(GID.BIG_HOUSE_ROLEPLAY_SUBMISSION));
    const text = await res.text();
    const lines = splitCSVRows(text);

    if (lines.length < 2) {
      return { submissions: [] };
    }

    const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase());
    const submissions: BigHouseSubmission[] = [];

    for (let i = 1; i < lines.length; i++) {
      const cols = parseCSVLine(lines[i]);
      const row: any = {};

      for (let j = 0; j < headers.length; j++) {
        row[headers[j]] = cols[j] || '';
      }

      if (characterId && row.characterid !== characterId) {
        continue;
      }

      if (status && row.status !== status) {
        continue;
      }

      submissions.push({
        id: row.id || generateUUID(),
        characterId: row.characterid || '',
        roleplayUrl: row.roleplayurl || '',
        status: (row.status || 'pending') as BigHouseSubmissionStatus,
        submittedAt: row.submittedat || '',
        reviewedAt: row.reviewedat || undefined,
        reviewedBy: row.reviewedby || undefined,
        rejectReason: row.rejectreason || undefined,
      });
    }

    return { submissions };
  } catch (error) {
    console.error('Error fetching Big House roleplays from CSV:', error);
    return { submissions: [], error: 'Failed to fetch Big House roleplays' };
  }
}
