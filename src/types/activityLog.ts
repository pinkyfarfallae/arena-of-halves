import { ACTIVITY_LOG_ACTIONS, ACTIVITY_LOG_CATEGORY, ACTIVITY_LOG_SOURCES } from "../constants/activityLog";

export type ActivityLogCategory = typeof ACTIVITY_LOG_CATEGORY[keyof typeof ACTIVITY_LOG_CATEGORY];
export type ActivityLogAction = typeof ACTIVITY_LOG_ACTIONS[keyof typeof ACTIVITY_LOG_ACTIONS];
export type ActivityLogSource = typeof ACTIVITY_LOG_SOURCES[keyof typeof ACTIVITY_LOG_SOURCES];

export interface ActivityLog {
  id?: string;
  category: ActivityLogCategory;
  action: ActivityLogAction | string;
  characterId: string;
  performedBy: ActivityLogSource | string;
  amount?: number;
  note?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  editedAt?: string;
  editedBy?: string;
}
