import type { ImageSourcePropType } from 'react-native';

const ELEMENT_IMAGES: Record<string, ImageSourcePropType> = {
  Fe: require('../assets/elements/iron.png'),
  H: require('../assets/elements/hydrogen.png'),
  O: require('../assets/elements/oxygen.png'),
  C: require('../assets/elements/carbon.png'),
};

const UNKNOWN_IMAGE: ImageSourcePropType = require('../assets/elements/unknown.png');

export function getElementImage(elementId: string): ImageSourcePropType | null {
  return ELEMENT_IMAGES[elementId] ?? null;
}

export function getUnknownElementImage(): ImageSourcePropType {
  return UNKNOWN_IMAGE;
}
