import type { ImageSourcePropType } from 'react-native';

const ZONE_IMAGES: ImageSourcePropType[] = [
  require('../assets/zones/zone1.png'),
  require('../assets/zones/zone2.png'),
  require('../assets/zones/zone3.png'),
  require('../assets/zones/zone4.png'),
];

/**
 * Get the zone marker image for a given 1-based zone level.
 * Levels above the registered set fall back to the highest tier.
 */
export function getZoneImage(level: number): ImageSourcePropType {
  const idx = Math.max(0, Math.min(ZONE_IMAGES.length - 1, level - 1));
  return ZONE_IMAGES[idx];
}
