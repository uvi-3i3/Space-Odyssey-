import React from 'react';
import { Image, View, StyleSheet, Platform, StyleProp, ViewStyle } from 'react-native';
import { RotatingPlanet } from './RotatingPlanet';
import { getPlanetImage, PlanetType } from '@/constants/planetAssets';

interface PlanetIconProps {
  type?: PlanetType;
  size: number;
  glowColor?: string;
  rotate?: boolean;
  rotationDuration?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * Reusable planet icon. Renders the vector-style PNG centered in a
 * size x size container with a subtle soft glow that matches the UI theme.
 *
 * Add new planet types by dropping a PNG into assets/planets/ and
 * registering it in constants/planetAssets.ts.
 */
export function PlanetIcon({
  type = 'terran',
  size,
  glowColor = '#3DB3FF',
  rotate = true,
  rotationDuration = 48_000,
  style,
}: PlanetIconProps) {
  const source = getPlanetImage(type);

  const glow = Platform.select({
    web: { boxShadow: `0 0 ${Math.round(size * 0.35)}px ${glowColor}55` } as any,
    default: {
      shadowColor: glowColor,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.45,
      shadowRadius: size * 0.28,
      elevation: 0,
    },
  });

  const image = (
    <Image
      source={source}
      style={[styles.image, { width: size, height: size }]}
      resizeMode="contain"
    />
  );

  return (
    <View
      style={[
        styles.container,
        { width: size, height: size, borderRadius: size / 2 },
        glow,
        style,
      ]}
      pointerEvents="none"
    >
      {rotate ? (
        <RotatingPlanet duration={rotationDuration}>{image}</RotatingPlanet>
      ) : (
        image
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  image: {
    alignSelf: 'center',
  },
});
