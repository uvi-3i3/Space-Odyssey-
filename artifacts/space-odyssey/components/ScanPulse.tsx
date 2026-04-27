import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

interface ScanPulseProps {
  color?: string;
  size?: number;
  rings?: number;
  duration?: number;
  active?: boolean;
}

/**
 * Radial scanning pulse: expanding rings that fade out as they grow.
 * Lightweight – uses native-driven opacity + scale only.
 */
export function ScanPulse({
  color = '#4DA8DA',
  size = 32,
  rings = 2,
  duration = 1800,
  active = true,
}: ScanPulseProps) {
  const anims = useRef(
    Array.from({ length: rings }, () => new Animated.Value(0)),
  ).current;

  useEffect(() => {
    if (!active) {
      anims.forEach(a => a.stopAnimation());
      return;
    }
    const loops = anims.map((anim, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay((duration / rings) * i),
          Animated.timing(anim, {
            toValue: 1,
            duration,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(anim, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
        ]),
      ),
    );
    loops.forEach(l => l.start());
    return () => {
      loops.forEach(l => l.stop());
    };
  }, [active, anims, duration, rings]);

  return (
    <View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, styles.center]}
    >
      {anims.map((anim, i) => {
        const scale = anim.interpolate({
          inputRange: [0, 1],
          outputRange: [0.6, 2.2],
        });
        const opacity = anim.interpolate({
          inputRange: [0, 0.1, 1],
          outputRange: [0, 0.55, 0],
        });
        return (
          <Animated.View
            key={i}
            style={[
              styles.ring,
              {
                width: size,
                height: size,
                borderRadius: size / 2,
                borderColor: color,
                opacity,
                transform: [{ scale }],
              },
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  ring: {
    position: 'absolute',
    borderWidth: 1.2,
  },
});
