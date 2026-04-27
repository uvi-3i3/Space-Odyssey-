import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

interface ShimmerProps {
  color?: string;
  duration?: number;
  intensity?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * A subtle diagonal shimmer overlay – use to mark rare/legendary content.
 * Implemented with a moving translucent stripe; native-driven.
 */
export function Shimmer({
  color = '#FFFFFF',
  duration = 2400,
  intensity = 0.18,
  style,
}: ShimmerProps) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(progress, {
          toValue: 1,
          duration,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.delay(800),
        Animated.timing(progress, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [progress, duration]);

  const translateX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [-80, 80],
  });
  const opacity = progress.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, intensity, 0],
  });

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.clip, style]}>
      <Animated.View
        style={[
          styles.stripe,
          {
            backgroundColor: color,
            opacity,
            transform: [{ translateX }, { rotate: '20deg' }],
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  clip: { overflow: 'hidden' },
  stripe: {
    position: 'absolute',
    top: -20,
    bottom: -20,
    left: 0,
    width: 28,
  },
});
