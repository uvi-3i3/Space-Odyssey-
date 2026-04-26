import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useColors } from '@/hooks/useColors';

interface RarityBadgeProps {
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
  size?: 'sm' | 'md';
}

export function RarityBadge({ rarity, size = 'sm' }: RarityBadgeProps) {
  const colors = useColors();
  const color = getRarityColor(rarity, colors);

  return (
    <View style={[styles.badge, { borderColor: color, backgroundColor: color + '22' }, size === 'md' && styles.badgeMd]}>
      <Text style={[styles.text, { color }, size === 'md' && styles.textMd]}>
        {rarity.toUpperCase()}
      </Text>
    </View>
  );
}

function getRarityColor(rarity: string, colors: any) {
  switch (rarity) {
    case 'legendary': return colors.legendary;
    case 'epic': return colors.epic;
    case 'rare': return colors.rare;
    case 'uncommon': return colors.uncommon;
    default: return colors.common;
  }
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderRadius: 3,
  },
  badgeMd: {
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  text: {
    fontSize: 9,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0.5,
  },
  textMd: {
    fontSize: 11,
  },
});
