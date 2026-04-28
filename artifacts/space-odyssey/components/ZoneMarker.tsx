import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Image, StyleProp, ViewStyle, View, Text, StyleSheet, Platform } from 'react-native';
import { getZoneImage } from '@/constants/zoneAssets';

interface ZoneMarkerProps {
  level: number;
  size: number;
  active?: boolean;
  locked?: boolean;
  cooldown?: boolean;
  glowColor?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * Reusable mining-zone marker. Renders the appropriate vector PNG for the
 * given level (1..N), with a subtle continuous pulse to give it life.
 *
 *  - locked    → desaturated + lock badge overlay
 *  - cooldown  → small clock badge overlay
 *  - active    → stronger glow + faster pulse
 */
export function ZoneMarker({
  level,
  size,
  active = false,
  locked = false,
  cooldown = false,
  glowColor = '#5BB8FF',
  style,
}: ZoneMarkerProps) {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (locked) return;
    const dur = active ? 1100 : 1900;
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: dur, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: dur, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [pulse, active, locked]);

  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, active ? 1.06 : 1.03] });
  const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1] });

  const glowStyle = active
    ? Platform.select({
        web: { boxShadow: `0 0 ${Math.round(size * 0.45)}px ${glowColor}88` } as any,
        default: {
          shadowColor: glowColor,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.55,
          shadowRadius: size * 0.32,
        },
      })
    : Platform.select({
        web: { boxShadow: `0 0 ${Math.round(size * 0.25)}px ${glowColor}33` } as any,
        default: {
          shadowColor: glowColor,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.22,
          shadowRadius: size * 0.18,
        },
      });

  return (
    <View
      style={[
        { width: size, height: size, alignItems: 'center', justifyContent: 'center' },
        glowStyle,
        style,
      ]}
    >
      <Animated.View
        style={{
          width: size,
          height: size,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: locked ? 0.35 : opacity,
          transform: [{ scale: locked ? 1 : scale }],
        }}
      >
        <Image
          source={getZoneImage(level)}
          style={{ width: size, height: size }}
          resizeMode="contain"
        />
      </Animated.View>

      {locked && (
        <View style={[styles.badge, { borderColor: glowColor + '99' }]} pointerEvents="none">
          <Text style={styles.badgeText}>🔒</Text>
        </View>
      )}
      {!locked && cooldown && (
        <View style={[styles.badge, { borderColor: glowColor + '99' }]} pointerEvents="none">
          <Text style={styles.badgeText}>⏱</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: 'rgba(10,22,40,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    bottom: -2,
    right: -2,
  },
  badgeText: { fontSize: 9, lineHeight: 12 },
});
