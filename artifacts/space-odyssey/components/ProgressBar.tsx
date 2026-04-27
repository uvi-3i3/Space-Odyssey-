import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { useColors } from '@/hooks/useColors';

interface ProgressBarProps {
  progress: number;
  color?: string;
  height?: number;
  animated?: boolean;
}

export function ProgressBar({ progress, color, height = 4, animated = true }: ProgressBarProps) {
  const colors = useColors();
  const barColor = color ?? colors.secondary;
  const widthAnim = useRef(new Animated.Value(0)).current;

  const clampedProgress = Math.max(0, Math.min(1, progress));

  useEffect(() => {
    if (animated) {
      Animated.timing(widthAnim, {
        toValue: clampedProgress,
        duration: 400,
        useNativeDriver: false,
      }).start();
    } else {
      widthAnim.setValue(clampedProgress);
    }
  }, [clampedProgress, animated]);

  return (
    <View style={[styles.track, { height, backgroundColor: colors.border, borderRadius: 0 }]}>
      <Animated.View
        style={[
          styles.fill,
          {
            height,
            borderRadius: 0,
            backgroundColor: barColor,
            width: widthAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    overflow: 'hidden',
  },
  fill: {},
});
