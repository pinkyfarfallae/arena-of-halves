export const USER_MANAGEMENT_MODE = {
  CREATE: 'create',
  EDIT: 'edit',
} as const;

export type UserManagementMode = (typeof USER_MANAGEMENT_MODE)[keyof typeof USER_MANAGEMENT_MODE];