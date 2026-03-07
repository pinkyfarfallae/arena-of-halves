import type { Character } from './character';

/** Edit field input type; aligned with constants/editField EDIT_FIELD_TYPE. */
export type EditFieldType = import('../constants/editField').EditFieldType;

export interface EditField {
  key: keyof Character;
  header: string;
  label: string;
  type: EditFieldType;
  group: string;
  placeholder?: string;
  required?: boolean;
}
