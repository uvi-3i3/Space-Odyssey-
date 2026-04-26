import React, { useMemo } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { useColors } from '@/hooks/useColors';

const { width, height } = Dimensions.get('window');

interface BlueprintGridProps {
  size?: number;
  opacity?: number;
}

export function BlueprintGrid({ size = 30, opacity = 0.12 }: BlueprintGridProps) {
  const colors = useColors();

  const lines = useMemo(() => {
    const horizontal: number[] = [];
    const vertical: number[] = [];
    for (let y = 0; y <= height; y += size) horizontal.push(y);
    for (let x = 0; x <= width; x += size) vertical.push(x);
    return { horizontal, vertical };
  }, [size]);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {lines.horizontal.map(y => (
        <View
          key={`h-${y}`}
          style={[styles.line, styles.horizontal, { top: y, borderColor: colors.primary, opacity }]}
        />
      ))}
      {lines.vertical.map(x => (
        <View
          key={`v-${x}`}
          style={[styles.line, styles.vertical, { left: x, borderColor: colors.primary, opacity }]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  line: {
    position: 'absolute',
    borderWidth: StyleSheet.hairlineWidth,
  },
  horizontal: {
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
  },
  vertical: {
    top: 0,
    bottom: 0,
    width: StyleSheet.hairlineWidth,
  },
});
