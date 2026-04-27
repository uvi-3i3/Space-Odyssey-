import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleProp, ViewStyle } from 'react-native';

interface GlowPulseProps {
  children: React.ReactNode;
  color?: string;
  duration?: number;
  min?: number;
  max?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * Soft idle glow – breathes between two opacities. Useful on selected
 * targets, important alerts, or rare items.
 */
export function GlowPulse({
  children,
  color = '#4DA8DA',
  duration = 2400,
  min = 0.15,
  max = 0.55,
  style,
}: GlowPulseProps) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, {
          toValue: 1,
          duration: duration / 2,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: false,
        }),
        Animated.timing(anim, {
          toValue: 0,
          duration: duration / 2,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: false,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [anim, duration]);

  const shadowOpacity = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [min, max],
  });
  const shadowRadius = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [4, 12],
  });

  return (
    <Animated.View
      style={[
        style,
        {
          shadowColor: color,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity,
          shadowRadius,
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}
