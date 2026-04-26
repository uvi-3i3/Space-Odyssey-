import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useGame } from '@/context/GameContext';
import { useColors } from '@/hooks/useColors';

export function ResourceBar() {
  const { state } = useGame();
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const topElements = state.elements.filter(e => e.discovered && e.quantity > 0).slice(0, 5);

  return (
    <View style={[styles.container, { backgroundColor: colors.card, borderBottomColor: colors.border, paddingTop: insets.top + 4 }]}>
      <View style={styles.topRow}>
        <View style={styles.stat}>
          <Feather name="zap" size={12} color={colors.warning} />
          <Text style={[styles.statText, { color: colors.foreground }]}>Era {state.era}</Text>
        </View>
        <View style={styles.stat}>
          <Feather name="credit-card" size={12} color={colors.success} />
          <Text style={[styles.statText, { color: colors.foreground }]}>{Math.floor(state.credits).toLocaleString()}</Text>
        </View>
        <View style={styles.stat}>
          <Feather name="users" size={12} color={colors.primary} />
          <Text style={[styles.statText, { color: colors.foreground }]}>{state.population}/{state.maxPopulation}</Text>
        </View>
        <View style={styles.stat}>
          <Feather name="shield" size={12} color={colors.rare} />
          <Text style={[styles.statText, { color: colors.foreground }]}>{state.defensePower}</Text>
        </View>
        {state.prestigeLevel > 0 && (
          <View style={styles.stat}>
            <Feather name="award" size={12} color={colors.legendary} />
            <Text style={[styles.statText, { color: colors.legendary }]}>P{state.prestigeLevel}</Text>
          </View>
        )}
      </View>
      {topElements.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.elementsRow} contentContainerStyle={styles.elementsContent}>
          {topElements.map(elem => (
            <View key={elem.id} style={[styles.elemChip, { borderColor: getRarityColor(elem.rarity, colors) }]}>
              <Text style={[styles.elemSymbol, { color: getRarityColor(elem.rarity, colors) }]}>{elem.symbol}</Text>
              <Text style={[styles.elemQty, { color: colors.mutedForeground }]}>{elem.quantity.toLocaleString()}</Text>
            </View>
          ))}
        </ScrollView>
      )}
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
  container: {
    borderBottomWidth: 1,
    paddingBottom: 6,
    paddingHorizontal: 12,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 4,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statText: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
  },
  elementsRow: {
    marginTop: 2,
  },
  elementsContent: {
    gap: 6,
    paddingVertical: 2,
  },
  elemChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderWidth: 1,
    borderRadius: 4,
  },
  elemSymbol: {
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
  },
  elemQty: {
    fontSize: 10,
    fontFamily: 'Inter_400Regular',
  },
});
