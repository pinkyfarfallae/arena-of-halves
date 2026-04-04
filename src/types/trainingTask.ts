import { HARVEST_SCRIPT_COPY_STATUS, HARVEST_SUBMISSION_STATUS, SIDEBAR_VIEW } from '../constants/harvest';

export type SidebarView = typeof SIDEBAR_VIEW[keyof typeof SIDEBAR_VIEW];
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

export interface HarvestRecord {
  charCount?: number;
  participantCount?: number;
  participants?: string[];
  drachmaReward?: number;
  tweetCount?: number;
  characterId: string;
  url: string;
  submittedAt: string;
}

export interface HarvestRecords {
  totalApproved: number;
  longestHarvest: HarvestRecord;
  mostParticipants: HarvestRecord;
  biggestReward: HarvestRecord;
  mostTweets: HarvestRecord;
}

export interface TopHarvester {
  characterId: string;
  totalDrachma: number;
  nicknameEng?: string;
  nicknameThai?: string;
}