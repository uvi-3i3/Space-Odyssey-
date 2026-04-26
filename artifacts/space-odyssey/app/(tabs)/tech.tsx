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
import { Technology } from '@/constants/gameData';

const ERA_NAMES = ['', 'Stone Age', 'Bronze Age', 'Industrial', 'Atomic'];
const CATEGORY_ICONS: Record<string, string> = {
  mining: 'tool',
  military: 'shield',
  research: 'cpu',
  diplomacy: 'users',
  construction: 'home',
};
const CATEGORY_COLORS: Record<string, string> = {
  mining: '#FFB800',
  military: '#FF4444',
  research: '#00D4FF',
  diplomacy: '#00FF88',
  construction: '#9B59B6',
};

export default function TechScreen() {
  const { state, startResearch, getElementQuantity } = useGame();
  const colors = useColors();
  const [selectedEra, setSelectedEra] = useState(1);

  const currentResearchTech = state.technologies.find(t => t.id === state.currentResearch);
  const researchProgress = currentResearchTech
    ? state.researchProgress / currentResearchTech.researchTime
    : 0;

  const eraTechs = state.technologies.filter(t => t.era === selectedEra);

  const canAffordTech = (tech: Technology) => {
    return Object.entries(tech.cost).every(([id, amount]) => getElementQuantity(id) >= amount);
  };

  const prereqsMet = (tech: Technology) => {
    return tech.prerequisites.every(p => state.technologies.find(t => t.id === p)?.researched);
  };

  const handleResearch = (techId: string) => {
    const result = startResearch(techId);
    if (!result.success) {
      Alert.alert('Cannot Research', result.message);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  const paddingBottom = Platform.OS === 'web' ? 34 : 0;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <BlueprintGrid />

      {currentResearchTech && (
        <View style={[styles.researchBanner, { backgroundColor: colors.card, borderBottomColor: colors.primary }]}>
          <View style={styles.researchInfo}>
            <Feather name="cpu" size={14} color={colors.primary} />
            <Text style={[styles.researchLabel, { color: colors.primary }]}>RESEARCHING:</Text>
            <Text style={[styles.researchName, { color: colors.foreground }]}>{currentResearchTech.name}</Text>
          </View>
          <ProgressBar progress={researchProgress} color={colors.primary} height={4} />
          <Text style={[styles.researchPercent, { color: colors.mutedForeground }]}>
            {Math.floor(researchProgress * 100)}%
          </Text>
        </View>
      )}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={[styles.eraBar, { borderBottomColor: colors.border }]}
        contentContainerStyle={styles.eraContent}
      >
        {[1, 2, 3].map(era => (
          <TouchableOpacity
            key={era}
            style={[
              styles.eraBtn,
              { borderColor: selectedEra === era ? colors.primary : colors.border, backgroundColor: selectedEra === era ? colors.primary + '22' : 'transparent' },
            ]}
            onPress={() => setSelectedEra(era)}
          >
            <Text style={[styles.eraNum, { color: selectedEra === era ? colors.primary : colors.mutedForeground }]}>
              ERA {era}
            </Text>
            <Text style={[styles.eraName, { color: selectedEra === era ? colors.primary : colors.mutedForeground }]}>
              {ERA_NAMES[era]}
            </Text>
            <Text style={[styles.eraProgress, { color: colors.mutedForeground }]}>
              {state.technologies.filter(t => t.era === era && t.researched).length}/
              {state.technologies.filter(t => t.era === era).length}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: 100 + paddingBottom }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.sectionLabel, { color: colors.primary }]}>// TECHNOLOGY TREE — ERA {selectedEra}</Text>

        {eraTechs.map(tech => {
          const meetsPrereqs = prereqsMet(tech);
          const affordable = canAffordTech(tech);
          const isResearching = state.currentResearch === tech.id;
          const catColor = CATEGORY_COLORS[tech.category] ?? colors.primary;
          const available = meetsPrereqs && !tech.researched && !state.currentResearch;

          return (
            <View
              key={tech.id}
              style={[
                styles.techCard,
                {
                  borderColor: tech.researched ? catColor : isResearching ? colors.primary : meetsPrereqs ? catColor + '55' : colors.border,
                  backgroundColor: colors.card,
                  opacity: (!meetsPrereqs && !tech.researched) ? 0.6 : 1,
                },
              ]}
            >
              <View style={styles.techHeader}>
                <View style={[styles.catIcon, { backgroundColor: catColor + '22', borderColor: catColor + '55' }]}>
                  <Feather name={CATEGORY_ICONS[tech.category] as any} size={16} color={catColor} />
                </View>
                <View style={styles.techInfo}>
                  <Text style={[styles.techName, { color: tech.researched ? catColor : colors.foreground }]}>{tech.name}</Text>
                  <Text style={[styles.techEffect, { color: colors.mutedForeground }]}>{tech.effect}</Text>
                </View>
                {tech.researched && (
                  <View style={[styles.doneTag, { borderColor: catColor, backgroundColor: catColor + '22' }]}>
                    <Feather name="check" size={12} color={catColor} />
                    <Text style={[styles.doneTagText, { color: catColor }]}>DONE</Text>
                  </View>
                )}
                {isResearching && (
                  <View style={[styles.doneTag, { borderColor: colors.primary, backgroundColor: colors.primary + '22' }]}>
                    <Feather name="loader" size={12} color={colors.primary} />
                    <Text style={[styles.doneTagText, { color: colors.primary }]}>{Math.floor(researchProgress * 100)}%</Text>
                  </View>
                )}
              </View>

              <Text style={[styles.techDesc, { color: colors.mutedForeground }]}>{tech.description}</Text>

              {tech.prerequisites.length > 0 && (
                <View style={styles.prereqRow}>
                  <Text style={[styles.prereqLabel, { color: colors.mutedForeground }]}>REQUIRES:</Text>
                  {tech.prerequisites.map(p => {
                    const prereq = state.technologies.find(t => t.id === p);
                    return (
                      <View key={p} style={[
                        styles.prereqTag,
                        { borderColor: prereq?.researched ? colors.success : colors.warning, backgroundColor: prereq?.researched ? colors.success + '22' : colors.warning + '22' },
                      ]}>
                        <Text style={[styles.prereqTagText, { color: prereq?.researched ? colors.success : colors.warning }]}>
                          {prereq?.name ?? p}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              )}

              {!tech.researched && (
                <View style={styles.costRow}>
                  <Text style={[styles.costLabel, { color: colors.mutedForeground }]}>COST:</Text>
                  {Object.entries(tech.cost).map(([elemId, amount]) => {
                    const have = getElementQuantity(elemId);
                    const enough = have >= amount;
                    return (
                      <View key={elemId} style={styles.costItem}>
                        <Text style={[styles.costElem, { color: enough ? catColor : colors.destructive }]}>{elemId}</Text>
                        <Text style={[styles.costAmount, { color: enough ? colors.foreground : colors.destructive }]}>
                          {have}/{amount}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              )}

              {available && (
                <TouchableOpacity
                  style={[
                    styles.researchBtn,
                    { backgroundColor: affordable ? catColor : colors.muted },
                  ]}
                  onPress={() => handleResearch(tech.id)}
                  disabled={!affordable}
                >
                  <Feather name="cpu" size={14} color={affordable ? colors.background : colors.mutedForeground} />
                  <Text style={[styles.researchBtnText, { color: affordable ? colors.background : colors.mutedForeground }]}>
                    {affordable ? 'BEGIN RESEARCH' : 'INSUFFICIENT RESOURCES'}
                  </Text>
                </TouchableOpacity>
              )}

              {!meetsPrereqs && !tech.researched && (
                <View style={[styles.lockedRow, { borderColor: colors.border }]}>
                  <Feather name="lock" size={12} color={colors.mutedForeground} />
                  <Text style={[styles.lockedText, { color: colors.mutedForeground }]}>Complete prerequisites to unlock</Text>
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  researchBanner: {
    padding: 12,
    borderBottomWidth: 2,
    gap: 8,
  },
  researchInfo: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  researchLabel: { fontSize: 10, fontFamily: 'Inter_700Bold', letterSpacing: 1 },
  researchName: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  researchPercent: { fontSize: 10, fontFamily: 'Inter_400Regular', textAlign: 'right' },
  eraBar: { borderBottomWidth: 1, maxHeight: 72 },
  eraContent: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 10 },
  eraBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: 'center',
    gap: 2,
  },
  eraNum: { fontSize: 10, fontFamily: 'Inter_700Bold', letterSpacing: 1 },
  eraName: { fontSize: 11, fontFamily: 'Inter_500Medium' },
  eraProgress: { fontSize: 9, fontFamily: 'Inter_400Regular' },
  scroll: { flex: 1 },
  content: { padding: 16, gap: 12 },
  sectionLabel: { fontSize: 11, fontFamily: 'Inter_700Bold', letterSpacing: 2, marginBottom: 4 },
  techCard: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 14,
    gap: 10,
  },
  techHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  catIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  techInfo: { flex: 1, gap: 2 },
  techName: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  techEffect: { fontSize: 11, fontFamily: 'Inter_400Regular' },
  doneTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderRadius: 4,
  },
  doneTagText: { fontSize: 10, fontFamily: 'Inter_700Bold', letterSpacing: 0.5 },
  techDesc: { fontSize: 12, fontFamily: 'Inter_400Regular', lineHeight: 18 },
  prereqRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  prereqLabel: { fontSize: 10, fontFamily: 'Inter_500Medium', letterSpacing: 0.5 },
  prereqTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderRadius: 4,
  },
  prereqTagText: { fontSize: 10, fontFamily: 'Inter_600SemiBold' },
  costRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  costLabel: { fontSize: 10, fontFamily: 'Inter_500Medium', letterSpacing: 0.5 },
  costItem: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  costElem: { fontSize: 12, fontFamily: 'Inter_700Bold' },
  costAmount: { fontSize: 10, fontFamily: 'Inter_400Regular' },
  researchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 11,
    borderRadius: 6,
  },
  researchBtnText: { fontSize: 12, fontFamily: 'Inter_700Bold', letterSpacing: 1 },
  lockedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 8,
    borderTopWidth: 1,
    borderStyle: 'dashed',
  },
  lockedText: { fontSize: 11, fontFamily: 'Inter_400Regular' },
});
