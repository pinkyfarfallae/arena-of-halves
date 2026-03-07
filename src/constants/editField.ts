/**
 * Edit field input types (for character edit form).
 */
export const EDIT_FIELD_TYPE = {
  TEXT: 'text',
  TEXTAREA: 'textarea',
  COLOR: 'color',
  SEX: 'sex',
} as const;

export type EditFieldType = (typeof EDIT_FIELD_TYPE)[keyof typeof EDIT_FIELD_TYPE];
