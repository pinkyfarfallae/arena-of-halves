export const CHARACTER = {
  TEST: 'test',
  SKYLER: 'skyler',
  ROSABELLA: 'rosabella',

  BELUGA: 'beluga',
  BONITA: 'bonita',

  // Secret characters that don't appear in the roster and have no public info
  RENESSME: 'renessme',
  ROSCOE: 'roscoe',
} as const;

export const HIDDEN_AMPHITRITE_FOR = [CHARACTER.ROSABELLA, CHARACTER.SKYLER, CHARACTER.TEST, CHARACTER.ROSCOE, CHARACTER.RENESSME];

export const SECRET_CHARACTERS: string[] = [CHARACTER.RENESSME, CHARACTER.ROSCOE];
