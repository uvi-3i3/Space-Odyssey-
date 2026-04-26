import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useGame } from '@/context/GameContext';
import { useColors } from '@/hooks/useColors';
import { BlueprintGrid } from '@/components/BlueprintGrid';
import { ProgressBar } from '@/components/ProgressBar';

export default function SettingsScreen() {
  const { state, performPrestige } = useGame();
  const colors = useColors();
  const [showPrestigeConfirm, setShowPrestigeConfirm] = useState(false);

  const totalElements = state.elements.reduce((sum, e) => sum + e.quantity, 0);
  const builtBuildings = state.buildings.filter(b => b.level > 0).length;
  const researchedTechs = state.technologies.filter(t => t.researched).length;

  const handlePrestige = () => {
    Alert.alert(
      'Prestige Reset',
      `Reset your civilization for a ${(state.prestigeLevel + 1) * 10}% permanent resource bonus?\n\nAll buildings, tech, and elements will be lost. Prestige bonuses persist.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Prestige',
          style: 'destructive',
          onPress: () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            performPrestige();
          },
        },
      ]
    );
  };

  const paddingBottom = Platform.OS === 'web' ? 34 : 0;

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <BlueprintGrid />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: 100 + paddingBottom }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.pageTitle, { color: colors.primary }]}>COMMAND CENTER</Text>

        <View style={[styles.civilizationCard, { borderColor: colors.primary, backgroundColor: colors.card }]}>
          <View style={styles.civHeader}>
            <Feather name="globe" size={20} color={colors.primary} />
            <Text style={[styles.civTitle, { color: colors.primary }]}>CIVILIZATION STATUS</Text>
          </View>

          <View style={styles.statsGrid}>
            <View style={[styles.statBox, { borderColor: colors.border }]}>
              <Text style={[styles.statNum, { color: colors.foreground }]}>{state.era}</Text>
              <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>ERA</Text>
            </View>
            <View style={[styles.statBox, { borderColor: colors.border }]}>
              <Text style={[styles.statNum, { color: colors.foreground }]}>{Math.floor(state.credits).toLocaleString()}</Text>
              <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>CREDITS</Text>
            </View>
            <View style={[styles.statBox, { borderColor: colors.border }]}>
              <Text style={[styles.statNum, { color: colors.foreground }]}>{state.population}</Text>
              <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>POPULATION</Text>
            </View>
            <View style={[styles.statBox, { borderColor: colors.border }]}>
              <Text style={[styles.statNum, { color: colors.foreground }]}>{totalElements.toLocaleString()}</Text>
              <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>ELEMENTS</Text>
            </View>
            <View style={[styles.statBox, { borderColor: colors.border }]}>
              <Text style={[styles.statNum, { color: colors.foreground }]}>{builtBuildings}</Text>
              <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>BUILDINGS</Text>
            </View>
            <View style={[styles.statBox, { borderColor: colors.border }]}>
              <Text style={[styles.statNum, { color: colors.foreground }]}>{researchedTechs}</Text>
              <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>TECHS</Text>
            </View>
          </View>
        </View>

        <View style={[styles.section, { borderColor: colors.border, backgroundColor: colors.card }]}>
          <Text style={[styles.sectionTitle, { color: colors.primary }]}>// SESSION DATA</Text>
          <View style={styles.sessionRow}>
            <Feather name="clock" size={14} color={colors.mutedForeground} />
            <Text style={[styles.sessionLabel, { color: colors.mutedForeground }]}>Total Play Time:</Text>
            <Text style={[styles.sessionValue, { color: colors.foreground }]}>{formatTime(state.totalPlayTime)}</Text>
          </View>
          <View style={styles.sessionRow}>
            <Feather name="calendar" size={14} color={colors.mutedForeground} />
            <Text style={[styles.sessionLabel, { color: colors.mutedForeground }]}>Login Streak:</Text>
            <Text style={[styles.sessionValue, { color: colors.foreground }]}>{state.loginStreak} days</Text>
          </View>
          <View style={styles.sessionRow}>
            <Feather name="database" size={14} color={colors.mutedForeground} />
            <Text style={[styles.sessionLabel, { color: colors.mutedForeground }]}>Storage Used:</Text>
            <Text style={[styles.sessionValue, { color: colors.foreground }]}>{totalElements.toLocaleString()}/{state.storageCapacity.toLocaleString()}</Text>
          </View>
          <ProgressBar progress={totalElements / state.storageCapacity} color={colors.primary} height={4} />
        </View>

        <View style={[styles.section, { borderColor: colors.border, backgroundColor: colors.card }]}>
          <Text style={[styles.sectionTitle, { color: colors.primary }]}>// TRAITS & BONUSES</Text>
          <View style={styles.traitRow}>
            <View style={[styles.traitTag, { borderColor: colors.primary + '55', backgroundColor: colors.primary + '11' }]}>
              <Feather name="activity" size={12} color={colors.primary} />
              <Text style={[styles.traitText, { color: colors.primary }]}>Mining x{state.miningMultiplier.toFixed(1)}</Text>
            </View>
            <View style={[styles.traitTag, { borderColor: colors.success + '55', backgroundColor: colors.success + '11' }]}>
              <Feather name="cpu" size={12} color={colors.success} />
              <Text style={[styles.traitText, { color: colors.success }]}>Research x{state.researchSpeed.toFixed(1)}</Text>
            </View>
            <View style={[styles.traitTag, { borderColor: colors.legendary + '55', backgroundColor: colors.legendary + '11' }]}>
              <Feather name="award" size={12} color={colors.legendary} />
              <Text style={[styles.traitText, { color: colors.legendary }]}>Prestige Lv{state.prestigeLevel}</Text>
            </View>
          </View>
        </View>

        <View style={[styles.prestigeCard, { borderColor: colors.legendary, backgroundColor: colors.card }]}>
          <View style={styles.prestHeader}>
            <Feather name="repeat" size={20} color={colors.legendary} />
            <Text style={[styles.prestTitle, { color: colors.legendary }]}>PRESTIGE RESET</Text>
          </View>
          <Text style={[styles.prestDesc, { color: colors.mutedForeground }]}>
            Reset your civilization to gain a permanent {((state.prestigeLevel + 1) * 10)}% resource production bonus.
            All buildings, elements, and tech will reset. Login streak and prestige bonuses persist.
          </Text>
          <View style={styles.prestInfo}>
            <View style={styles.prestInfoRow}>
              <Text style={[styles.prestInfoLabel, { color: colors.mutedForeground }]}>Current Bonus:</Text>
              <Text style={[styles.prestInfoValue, { color: colors.legendary }]}>+{state.prestigeLevel * 10}%</Text>
            </View>
            <View style={styles.prestInfoRow}>
              <Text style={[styles.prestInfoLabel, { color: colors.mutedForeground }]}>After Prestige:</Text>
              <Text style={[styles.prestInfoValue, { color: colors.legendary }]}>+{(state.prestigeLevel + 1) * 10}%</Text>
            </View>
            <View style={styles.prestInfoRow}>
              <Text style={[styles.prestInfoLabel, { color: colors.mutedForeground }]}>Prestige Points:</Text>
              <Text style={[styles.prestInfoValue, { color: colors.legendary }]}>{state.prestigePoints} → {state.prestigePoints + 5}</Text>
            </View>
          </View>
          <TouchableOpacity
            style={[styles.prestigeBtn, { backgroundColor: colors.legendary + '22', borderColor: colors.legendary }]}
            onPress={handlePrestige}
          >
            <Feather name="repeat" size={16} color={colors.legendary} />
            <Text style={[styles.prestigeBtnText, { color: colors.legendary }]}>INITIATE PRESTIGE</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.section, { borderColor: colors.border, backgroundColor: colors.card }]}>
          <Text style={[styles.sectionTitle, { color: colors.primary }]}>// ABOUT</Text>
          <Text style={[styles.aboutText, { color: colors.mutedForeground }]}>
            Space Odyssey: Galactic Evolution
          </Text>
          <Text style={[styles.aboutVersion, { color: colors.mutedForeground }]}>Version 1.0.0 · April 2026</Text>
          <Text style={[styles.aboutDesc, { color: colors.mutedForeground }]}>
            An idle RPG where you guide a civilization through planetary exploration, element discovery, and galactic conquest.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flex: 1 },
  content: { padding: 16, gap: 16 },
  pageTitle: { fontSize: 14, fontFamily: 'Inter_700Bold', letterSpacing: 2 },
  civilizationCard: {
    borderWidth: 1.5,
    borderRadius: 8,
    padding: 16,
    gap: 14,
  },
  civHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  civTitle: { fontSize: 12, fontFamily: 'Inter_700Bold', letterSpacing: 1.5 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statBox: {
    flex: 1,
    minWidth: 90,
    alignItems: 'center',
    paddingVertical: 10,
    borderWidth: 1,
    borderRadius: 6,
    gap: 2,
  },
  statNum: { fontSize: 18, fontFamily: 'Inter_700Bold' },
  statLabel: { fontSize: 9, fontFamily: 'Inter_600SemiBold', letterSpacing: 1 },
  section: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 14,
    gap: 10,
  },
  sectionTitle: { fontSize: 11, fontFamily: 'Inter_700Bold', letterSpacing: 2, marginBottom: 2 },
  sessionRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sessionLabel: { fontSize: 12, fontFamily: 'Inter_400Regular', flex: 1 },
  sessionValue: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  traitRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  traitTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderRadius: 6,
  },
  traitText: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  prestigeCard: {
    borderWidth: 1.5,
    borderRadius: 8,
    padding: 16,
    gap: 12,
  },
  prestHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  prestTitle: { fontSize: 13, fontFamily: 'Inter_700Bold', letterSpacing: 1.5 },
  prestDesc: { fontSize: 12, fontFamily: 'Inter_400Regular', lineHeight: 18 },
  prestInfo: { gap: 6 },
  prestInfoRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  prestInfoLabel: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  prestInfoValue: { fontSize: 13, fontFamily: 'Inter_700Bold' },
  prestigeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 6,
    borderWidth: 1.5,
  },
  prestigeBtnText: { fontSize: 13, fontFamily: 'Inter_700Bold', letterSpacing: 1 },
  aboutText: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  aboutVersion: { fontSize: 11, fontFamily: 'Inter_400Regular' },
  aboutDesc: { fontSize: 12, fontFamily: 'Inter_400Regular', lineHeight: 18 },
});
