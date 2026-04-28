import type { ImageSourcePropType } from 'react-native';

export type PlanetType = 'terran' | 'desert' | 'ice' | 'volcanic' | 'gas';

const PLANET_IMAGES: Record<PlanetType, ImageSourcePropType> = {
  terran: require('../assets/planets/terran.png'),
  desert: require('../assets/planets/terran.png'),
  ice: require('../assets/planets/terran.png'),
  volcanic: require('../assets/planets/terran.png'),
  gas: require('../assets/planets/terran.png'),
};

export function getPlanetImage(type: PlanetType): ImageSourcePropType {
  return PLANET_IMAGES[type] ?? PLANET_IMAGES.terran;
}
