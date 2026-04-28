import React from 'react';
import { Image, View, Text, StyleSheet, StyleProp, ViewStyle, Platform } from 'react-native';
import { getElementImage, getUnknownElementImage } from '@/constants/elementAssets';

interface ElementIconProps {
  elementId: string;
  symbol?: string;
  discovered?: boolean;
  rarityColor?: string;
  size: number;
  glow?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * Reusable element icon. Strategy:
 *  - undiscovered  → unknown placeholder PNG ("??")
 *  - generated PNG → use PNG (Fe / H / O / C)
 *  - fallback      → programmatic styled circle with the element symbol,
 *                    tinted by rarity color so the codex stays varied
 */
export function ElementIcon({
  elementId,
  symbol,
  discovered = true,
  rarityColor = '#5BB8FF',
  size,
  glow = false,
  style,
}: ElementIconProps) {
  if (!discovered) {
    return (
      <Image
        source={getUnknownElementImage()}
        style={[{ width: size, height: size }, style]}
        resizeMode="contain"
      />
    );
  }

  const source = getElementImage(elementId);

  const glowStyle = glow
    ? Platform.select({
        web: { boxShadow: `0 0 ${Math.round(size * 0.3)}px ${rarityColor}66` } as any,
        default: {
          shadowColor: rarityColor,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.4,
          shadowRadius: size * 0.22,
        },
      })
    : null;

  if (source) {
    return (
      <View
        style={[
          { width: size, height: size, borderRadius: size / 2 },
          glowStyle,
          style,
        ]}
      >
        <Image
          source={source}
          style={{ width: size, height: size }}
          resizeMode="contain"
        />
      </View>
    );
  }

  return (
    <View
      style={[
        styles.fallback,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderColor: rarityColor,
          backgroundColor: rarityColor + '22',
        },
        glowStyle,
        style,
      ]}
    >
      <Text
        style={{
          color: rarityColor,
          fontSize: Math.round(size * 0.5),
          fontFamily: 'SpaceMono_700Bold',
          textAlign: 'center',
          includeFontPadding: false,
        }}
      >
        {symbol ?? elementId}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: {
    borderWidth: 1.2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
