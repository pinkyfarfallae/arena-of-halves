export type ChatMessage = {
  id: string;
  /** undefined = sent by "me", present = from another user */
  author?: string;
  authorNickname?: string;
  authorImage?: string;
  authorPrimary?: string;
  text: string;
  ts?: number;
};
