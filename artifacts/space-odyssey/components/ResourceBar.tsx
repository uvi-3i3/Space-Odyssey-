import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useGame } from '@/context/GameContext';
import { useColors } from '@/hooks/useColors';

export function ResourceBar() {
  const { state } = useGame();
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const eraNames = ['', 'STONE AGE', 'BRONZE AGE', 'INDUSTRIAL', 'ATOMIC'];

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.card,
          borderBottomColor: colors.primary,
          paddingTop: insets.top + 4,
        },
      ]}
    >
      <View style={styles.missionBanner}>
        <View style={styles.missionLeft}>
          <View style={[styles.eraTag, { borderColor: colors.primary, backgroundColor: colors.primary + '18' }]}>
            <Text style={[styles.eraLabel, { color: colors.primary }]}>ERA {state.era}</Text>
          </View>
          <Text style={[styles.eraName, { color: colors.mutedForeground }]}>
            {eraNames[state.era] ?? 'ADVANCED'}
          </Text>
        </View>
        {state.prestigeLevel > 0 && (
          <View style={[styles.prestigeTag, { borderColor: colors.legendary, backgroundColor: colors.legendary + '18' }]}>
            <Feather name="repeat" size={9} color={colors.legendary} />
            <Text style={[styles.prestigeText, { color: colors.legendary }]}>P{state.prestigeLevel}</Text>
          </View>
        )}
      </View>

      <View style={styles.statsRow}>
        <StatCell icon="credit-card" value={Math.floor(state.credits).toLocaleString()} label="CREDITS" color={colors.primary} colors={colors} />
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <StatCell icon="users" value={`${state.population}/${state.maxPopulation}`} label="CREW" color={colors.secondary} colors={colors} />
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <StatCell icon="shield" value={String(state.defensePower)} label="DEFENSE" color={colors.mutedForeground} colors={colors} />
        {state.currentResearch && (
          <>
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <View style={styles.statCell}>
              <Feather name="loader" size={10} color={colors.secondary} />
              <Text style={[styles.statValue, { color: colors.secondary, fontFamily: 'SpaceMono_700Bold' }]}>
                {Math.floor((state.researchProgress / (state.technologies.find(t => t.id === state.currentResearch)?.researchTime ?? 1)) * 100)}%
              </Text>
              <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>RESEARCH</Text>
            </View>
          </>
        )}
      </View>
    </View>
  );
}

function StatCell({ icon, value, label, color, colors }: { icon: string; value: string; label: string; color: string; colors: any }) {
  return (
    <View style={styles.statCell}>
      <Feather name={icon as any} size={10} color={color} />
      <Text style={[styles.statValue, { color: colors.foreground, fontFamily: 'SpaceMono_700Bold' }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderBottomWidth: 1.5,
    paddingBottom: 8,
    paddingHorizontal: 16,
    gap: 6,
  },
  missionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 2,
  },
  missionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  eraTag: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderWidth: 1,
    borderRadius: 3,
  },
  eraLabel: {
    fontSize: 9,
    fontFamily: 'SpaceMono_700Bold',
    letterSpacing: 1,
  },
  eraName: {
    fontSize: 9,
    fontFamily: 'Inter_400Regular',
    letterSpacing: 0.5,
  },
  prestigeTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderWidth: 1,
    borderRadius: 3,
  },
  prestigeText: {
    fontSize: 9,
    fontFamily: 'SpaceMono_700Bold',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 0,
  },
  statCell: {
    flex: 1,
    alignItems: 'center',
    gap: 1,
    paddingVertical: 2,
  },
  statValue: {
    fontSize: 13,
  },
  statLabel: {
    fontSize: 7,
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: 1,
  },
  divider: {
    width: 1,
    height: 28,
    marginHorizontal: 0,
  },
});
