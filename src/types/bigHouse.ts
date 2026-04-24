import { BigHouseSubmissionStatus } from "../constants/bigHouse";

export interface BigHouseSubmission {
  id: string;
  characterId: string;
  roleplayUrl: string;
  status: BigHouseSubmissionStatus;
  submittedAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
  rejectReason?: string;
  charCount?: number;
  mentionCount?: number;
  drachmaReward?: number | string;
  roleplayers?: string;
}