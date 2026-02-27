import type { Character } from './character';

export interface EditField {
  key: keyof Character;
  header: string;
  label: string;
  type: 'text' | 'textarea' | 'color' | 'sex';
  group: string;
  placeholder?: string;
  required?: boolean;
}
