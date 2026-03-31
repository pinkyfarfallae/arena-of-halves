/**
 * Camp location ID constants — use for routing, comparisons, and data/campLocations.ts.
 */
export const CAMP_LOCATION = {
  HALF_BLOOD_HILL: 'half-blood-hill',
  BIG_HOUSE: 'big-house',
  WOODS: 'woods',
  CANOE_LAKE: 'canoe-lake',
  DINING_PAVILION: 'dining-pavilion',
  CABINS: 'cabins',
  ARENA: 'arena',
  FORGE: 'forge',
  ARCHERY_RANGE: 'archery-range',
  AMPHITHEATER: 'amphitheater',
  STABLES: 'stables',
  STRAWBERRY_FIELDS: 'strawberry-fields',
  CLIMBING_WALL: 'climbing-wall',
  CAMPFIRE: 'campfire',
  ARMORY: 'armory',
  IRIS_FOUNTAIN: 'iris-fountain',
  CAMP_STORE: 'camp-store',
  TRAINING_GROUNDS: 'training-grounds',
} as const;

export type CampLocationId = (typeof CAMP_LOCATION)[keyof typeof CAMP_LOCATION];
