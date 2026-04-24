export const BIG_HOUSE_ROLEPLAY_SUBMISSION_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
};

export type BigHouseSubmissionStatus = (typeof BIG_HOUSE_ROLEPLAY_SUBMISSION_STATUS)[keyof typeof BIG_HOUSE_ROLEPLAY_SUBMISSION_STATUS];

