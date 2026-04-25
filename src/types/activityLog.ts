export type ActivityLogCategory = 'drachma' | 'item' | 'equipment' | 'stat' | 'action';

export interface ActivityLog {
  id?: string;
  category: ActivityLogCategory;
  action: string;
  characterId: string;
  performedBy: string;
  amount?: number;
  note?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  editedAt?: string;
  editedBy?: string;
}
