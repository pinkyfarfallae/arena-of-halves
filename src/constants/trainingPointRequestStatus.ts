export const TRAINING_POINT_REQUEST_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
};

export type TrainingPointRequestStatus = (typeof TRAINING_POINT_REQUEST_STATUS)[keyof typeof TRAINING_POINT_REQUEST_STATUS];

