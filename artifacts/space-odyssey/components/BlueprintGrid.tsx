import React, { useMemo } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';

const { width, height } = Dimensions.get('window');

interface BlueprintGridProps {
  size?: number;
  opacity?: number;
}

export function BlueprintGrid({ size = 28, opacity = 0.18 }: BlueprintGridProps) {
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
          style={[styles.line, styles.horizontal, { top: y, opacity }]}
        />
      ))}
      {lines.vertical.map(x => (
        <View
          key={`v-${x}`}
          style={[styles.line, styles.vertical, { left: x, opacity }]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  line: {
    position: 'absolute',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#4DA8DA',
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
