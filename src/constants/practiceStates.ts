export const PRACTICE_STATES = {
  STRENGTH: 'strength',
  MOBILITY: 'mobility',
  INTELLIGENCE: 'intelligence',
  TECHNIQUE: 'technique',
  EXPERIENCE: 'experience',
  FORTUNE: 'fortune',
}

export type PracticeState = (typeof PRACTICE_STATES)[keyof typeof PRACTICE_STATES];

export const TRAINING_POINT_REQUEST_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
};

export type TrainingPointRequestStatus = (typeof TRAINING_POINT_REQUEST_STATUS)[keyof typeof TRAINING_POINT_REQUEST_STATUS];

