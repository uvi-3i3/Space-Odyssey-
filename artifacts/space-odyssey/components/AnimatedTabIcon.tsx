import React, { useEffect, useRef } from 'react';
import { Animated, View, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';

type Props = {
  name: React.ComponentProps<typeof Feather>['name'];
  color: string;
  focused: boolean;
  size?: number;
};

export function AnimatedTabIcon({ name, color, focused, size = 20 }: Props) {
  const scale = useRef(new Animated.Value(focused ? 1.12 : 1)).current;
  const glow = useRef(new Animated.Value(focused ? 1 : 0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, {
        toValue: focused ? 1.12 : 1,
        useNativeDriver: true,
        speed: 18,
        bounciness: 8,
      }),
      Animated.timing(glow, {
        toValue: focused ? 1 : 0,
        duration: 260,
        useNativeDriver: true,
      }),
    ]).start();
  }, [focused, scale, glow]);

  return (
    <View style={styles.host}>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.glow,
          {
            backgroundColor: color,
            opacity: glow.interpolate({ inputRange: [0, 1], outputRange: [0, 0.22] }),
            transform: [
              {
                scale: glow.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1.4] }),
              },
            ],
          },
        ]}
      />
      <Animated.View style={{ transform: [{ scale }] }}>
        <Feather name={name} size={size} color={color} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  glow: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderRadius: 14,
  },
});
