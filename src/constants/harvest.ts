export const SIDEBAR_VIEW = {
      RECORD: 'record',
      TOP: 'top',
} as const;

export const HARVEST_SUBMISSION_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
} as const;

export const HARVEST_SCRIPT_COPY_STATUS = {
  IDLE: 'idle',
  SUCCESS: 'success',
  ERROR: 'error',
} as const;