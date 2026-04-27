import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleProp, ViewStyle } from 'react-native';

interface RotatingPlanetProps {
  children: React.ReactNode;
  duration?: number;
  reverse?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * Slow continuous rotation. Used for planet/core elements to give a sense
 * of life without being distracting.
 */
export function RotatingPlanet({
  children,
  duration = 32_000,
  reverse = false,
  style,
}: RotatingPlanetProps) {
  const spin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    anim.start();
    return () => {
      anim.stop();
    };
  }, [spin, duration]);

  const rotate = spin.interpolate({
    inputRange: [0, 1],
    outputRange: reverse ? ['0deg', '-360deg'] : ['0deg', '360deg'],
  });

  return (
    <Animated.View style={[style, { transform: [{ rotate }] }]}>
      {children}
    </Animated.View>
  );
}
