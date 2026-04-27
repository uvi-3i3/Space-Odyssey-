import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleProp, ViewStyle } from 'react-native';

interface FadeSlideInProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  delay?: number;
  duration?: number;
  offset?: number;
  from?: 'bottom' | 'top' | 'left' | 'right';
}

export function FadeSlideIn({
  children,
  style,
  delay = 0,
  duration = 360,
  offset = 12,
  from = 'bottom',
}: FadeSlideInProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translate = useRef(new Animated.Value(offset)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration,
        delay,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(translate, {
        toValue: 0,
        duration,
        delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [opacity, translate, delay, duration]);

  const transform =
    from === 'bottom' || from === 'top'
      ? [{ translateY: from === 'bottom' ? translate : translate.interpolate({ inputRange: [0, offset], outputRange: [0, -offset] }) }]
      : [{ translateX: from === 'right' ? translate : translate.interpolate({ inputRange: [0, offset], outputRange: [0, -offset] }) }];

  return (
    <Animated.View style={[style, { opacity, transform }]}>
      {children}
    </Animated.View>
  );
}
