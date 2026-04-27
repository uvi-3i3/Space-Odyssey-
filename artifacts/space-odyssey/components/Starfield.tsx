import React, { useEffect, useMemo, useRef } from 'react';
import { View, StyleSheet, Animated, Easing, Dimensions } from 'react-native';

const { width, height } = Dimensions.get('window');

interface StarfieldProps {
  count?: number;
  opacity?: number;
}

interface Star {
  x: number;
  y: number;
  size: number;
  duration: number;
  delay: number;
  alpha: number;
}

function makeStars(count: number): Star[] {
  const stars: Star[] = [];
  for (let i = 0; i < count; i++) {
    stars.push({
      x: Math.random() * width,
      y: Math.random() * height,
      size: Math.random() < 0.85 ? 1 : 2,
      duration: 2400 + Math.random() * 3600,
      delay: Math.random() * 2000,
      alpha: 0.25 + Math.random() * 0.55,
    });
  }
  return stars;
}

function TwinklingStar({ star, color }: { star: Star; color: string }) {
  const opacity = useRef(new Animated.Value(star.alpha * 0.4)).current;

  useEffect(() => {
    let mounted = true;
    const loop = () => {
      if (!mounted) return;
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: star.alpha,
          duration: star.duration / 2,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: star.alpha * 0.3,
          duration: star.duration / 2,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]).start(() => loop());
    };
    const t = setTimeout(loop, star.delay);
    return () => {
      mounted = false;
      clearTimeout(t);
      opacity.stopAnimation();
    };
  }, [opacity, star]);

  return (
    <Animated.View
      style={[
        styles.star,
        {
          left: star.x,
          top: star.y,
          width: star.size,
          height: star.size,
          backgroundColor: color,
          opacity,
        },
      ]}
    />
  );
}

export function Starfield({ count = 60, opacity = 1 }: StarfieldProps) {
  const stars = useMemo(() => makeStars(count), [count]);
  const driftAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(driftAnim, {
        toValue: 1,
        duration: 60_000,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    ).start();
    return () => {
      driftAnim.stopAnimation();
    };
  }, [driftAnim]);

  const translateY = driftAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -12],
  });

  return (
    <View style={[StyleSheet.absoluteFill, { opacity }]} pointerEvents="none">
      <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ translateY }] }]}>
        {stars.map((s, i) => (
          <TwinklingStar key={i} star={s} color="#9DC8E8" />
        ))}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  star: {
    position: 'absolute',
    borderRadius: 2,
  },
});
