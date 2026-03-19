/**
 * Copy target for room code vs viewer link (used in Arena and ConfigArenaModal).
 */
export const COPY_TYPE = {
  CODE: 'code',
  LINK: 'link',
} as const;

export type CopyType = (typeof COPY_TYPE)[keyof typeof COPY_TYPE];
