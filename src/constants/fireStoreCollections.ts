export const FIRESTORE_COLLECTIONS = {
  DAILY_CONFIGS: 'dailyConfigs',
  USER_DAILY_PROGRESS: 'userDailyProgress',
  USER_DAILY_CLAIMS: 'userDailyClaims',
  PLAYER_WISHES_OF_IRIS: 'playerWishesOfIris',
  PLAYER_BAGS: 'playerBags',
  PLAYER_EQUIPMENT: 'playerEquipment',
  ACTIVITY_LOGS: 'ActivityLogs',
};

export type FireStoreCollections = keyof typeof FIRESTORE_COLLECTIONS;