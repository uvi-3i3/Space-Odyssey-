import React, { useRef } from 'react';
import {
  Animated,
  Pressable,
  PressableProps,
  StyleProp,
  ViewStyle,
  GestureResponderEvent,
  Easing,
} from 'react-native';

interface PressableScaleProps extends Omit<PressableProps, 'style'> {
  style?: StyleProp<ViewStyle>;
  pressedStyle?: StyleProp<ViewStyle>;
  scaleTo?: number;
  duration?: number;
  children?: React.ReactNode;
  glow?: boolean;
  glowColor?: string;
}

export function PressableScale({
  style,
  pressedStyle,
  scaleTo = 0.96,
  duration = 120,
  glow = false,
  glowColor = '#4DA8DA',
  onPressIn,
  onPressOut,
  children,
  ...rest
}: PressableScaleProps) {
  const scale = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;

  const handlePressIn = (e: GestureResponderEvent) => {
    Animated.parallel([
      Animated.timing(scale, {
        toValue: scaleTo,
        duration,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(glowAnim, {
        toValue: glow ? 1 : 0,
        duration,
        useNativeDriver: false,
      }),
    ]).start();
    onPressIn?.(e);
  };

  const handlePressOut = (e: GestureResponderEvent) => {
    Animated.parallel([
      Animated.spring(scale, {
        toValue: 1,
        speed: 24,
        bounciness: 6,
        useNativeDriver: true,
      }),
      Animated.timing(glowAnim, {
        toValue: 0,
        duration: 220,
        useNativeDriver: false,
      }),
    ]).start();
    onPressOut?.(e);
  };

  const animatedStyle: any = {
    transform: [{ scale }],
  };
  if (glow) {
    animatedStyle.shadowColor = glowColor;
    animatedStyle.shadowOffset = { width: 0, height: 0 };
    animatedStyle.shadowOpacity = glowAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [0, 0.55],
    });
    animatedStyle.shadowRadius = glowAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [0, 10],
    });
    animatedStyle.elevation = glowAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [0, 4],
    });
  }

  return (
    <Pressable onPressIn={handlePressIn} onPressOut={handlePressOut} {...rest}>
      <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>
    </Pressable>
  );
}
