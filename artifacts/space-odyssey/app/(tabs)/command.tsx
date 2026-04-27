import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useGame } from '@/context/GameContext';
import { useColors } from '@/hooks/useColors';
import { BlueprintGrid } from '@/components/BlueprintGrid';
import { Starfield } from '@/components/Starfield';
import { ProgressBar } from '@/components/ProgressBar';
import { Building, Technology } from '@/constants/gameData';
import { PressableScale } from '@/components/PressableScale';
import { FadeSlideIn } from '@/components/FadeSlideIn';
import { GlowPulse } from '@/components/GlowPulse';

const BUILDING_ICONS: Record<string, string> = {
  mine: 'tool', lab: 'cpu', habitat: 'home', defense: 'shield',
  storage: 'database', refinery: 'activity', temple: 'star', trade_post: 'repeat',
};

const ERA_NAMES = ['', 'STONE AGE', 'BRONZE AGE', 'INDUSTRIAL', 'ATOMIC'];
const CATEGORY_COLORS: Record<string, string> = {
  mining: '#FFB800', military: '#E74C3C', research: '#4DA8DA',
  diplomacy: '#3ECFB2', construction: '#9B59B6',
};

type Section = 'structures' | 'research';

export default function CommandScreen() {
  const { state, constructBuilding, upgradeBuilding, demolishBuilding, startResearch, getElementQuantity } = useGame();
  const colors = useColors();
  const [section, setSection] = useState<Section>('structures');
  const [selectedBuilding, setSelectedBuilding] = useState<string | null>(null);
  const [selectedEra, setSelectedEra] = useState(1);

  const paddingBottom = Platform.OS === 'web' ? 34 : 0;

  const currentResearchTech = state.technologies.find(t => t.id === state.currentResearch);
  const researchProgress = currentResearchTech
    ? state.researchProgress / currentResearchTech.researchTime : 0;

  const getUpgradeCost = (building: Building) => {
    const cost: Record<string, number> = {};
    Object.entries(building.baseCost).forEach(([k, v]) => {
      cost[k] = Math.floor(v * Math.pow(building.upgradeMultiplier, building.level));
    });
    return cost;
  };

  const canAffordBuilding = (building: Building) => {
    const cost = building.level === 0 ? building.baseCost : getUpgradeCost(building);
    return Object.entries(cost).every(([id, amount]) => getElementQuantity(id) >= amount);
  };

  const canAffordTech = (tech: Technology) =>
    Object.entries(tech.cost).every(([id, amount]) => getElementQuantity(id) >= amount);

  const prereqsMet = (tech: Technology) =>
    tech.prerequisites.every(p => state.technologies.find(t => t.id === p)?.researched);

  const handleBuildAction = (buildingId: string, action: 'build' | 'upgrade' | 'demolish') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (action === 'demolish') {
      Alert.alert('DEMOLISH', 'Resources will not be refunded. Proceed?', [
        { text: 'CANCEL', style: 'cancel' },
        { text: 'DEMOLISH', style: 'destructive', onPress: () => { demolishBuilding(buildingId); setSelectedBuilding(null); } },
      ]);
      return;
    }
    const result = action === 'build' ? constructBuilding(buildingId) : upgradeBuilding(buildingId);
    if (!result.success) Alert.alert('UNABLE TO BUILD', result.message);
  };

  const handleResearch = (techId: string) => {
    const result = startResearch(techId);
    if (!result.success) {
      Alert.alert('RESEARCH BLOCKED', result.message);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <BlueprintGrid />
      <Starfield count={45} opacity={0.5} />

      <View style={styles.topSection}>
        <View style={styles.pillRow}>
          {(['structures', 'research'] as Section[]).map(s => (
            <PressableScale
              key={s}
              style={[
                styles.pill,
                {
                  backgroundColor: section === s ? colors.primary : colors.card,
                  borderColor: section === s ? colors.primary : colors.border,
                },
              ]}
              onPress={() => { setSection(s); Haptics.selectionAsync(); }}
              glow={section === s}
              glowColor={colors.primary}
              scaleTo={0.94}
            >
              <Feather
                name={s === 'structures' ? 'home' : 'cpu'}
                size={12}
                color={section === s ? '#FFFFFF' : colors.mutedForeground}
              />
              <Text style={[styles.pillText, { color: section === s ? '#FFFFFF' : colors.mutedForeground }]}>
                {s === 'structures' ? 'STRUCTURES' : 'RESEARCH'}
              </Text>
            </PressableScale>
          ))}
        </View>

        {section === 'research' && currentResearchTech && (
          <FadeSlideIn key={currentResearchTech.id} duration={360} offset={8}>
          <GlowPulse color={colors.primary} intensity={0.35} duration={2000}>
          <View style={[styles.researchActive, { backgroundColor: colors.primary + '14', borderColor: colors.primary }]}>
            <View style={styles.researchActiveHeader}>
              <Feather name="loader" size={12} color={colors.primary} />
              <Text style={[styles.researchActiveLabel, { color: colors.primary }]}>RESEARCH IN PROGRESS</Text>
              <Text style={[styles.researchActivePct, { color: colors.primary, fontFamily: 'SpaceMono_700Bold' }]}>
                {Math.floor(researchProgress * 100)}%
              </Text>
            </View>
            <Text style={[styles.researchActiveName, { color: colors.foreground }]}>
              {currentResearchTech.name.toUpperCase()}
            </Text>
            <ProgressBar progress={researchProgress} color={colors.secondary} height={3} />
          </View>
          </GlowPulse>
          </FadeSlideIn>
        )}

        {section === 'research' && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.eraScroll} contentContainerStyle={styles.eraScrollContent}>
            {[1, 2, 3].map(era => {
              const done = state.technologies.filter(t => t.era === era && t.researched).length;
              const total = state.technologies.filter(t => t.era === era).length;
              return (
                <PressableScale
                  key={era}
                  style={[
                    styles.eraChip,
                    {
                      borderColor: selectedEra === era ? colors.primary : colors.border,
                      backgroundColor: selectedEra === era ? colors.primary + '14' : colors.card,
                    },
                  ]}
                  onPress={() => { setSelectedEra(era); Haptics.selectionAsync(); }}
                  glow={selectedEra === era}
                  glowColor={colors.primary}
                  scaleTo={0.95}
                >
                  <Text style={[styles.eraChipLabel, { color: selectedEra === era ? colors.primary : colors.mutedForeground }]}>
                    ERA {era}
                  </Text>
                  <Text style={[styles.eraChipName, { color: selectedEra === era ? colors.primary : colors.mutedForeground }]}>
                    {ERA_NAMES[era]}
                  </Text>
                  <Text style={[styles.eraChipProgress, { color: colors.secondary, fontFamily: 'SpaceMono_400Regular' }]}>
                    {done}/{total}
                  </Text>
                </PressableScale>
              );
            })}
          </ScrollView>
        )}
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: 100 + paddingBottom }]}
        showsVerticalScrollIndicator={false}
      >
        {section === 'structures' && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>STRUCTURES</Text>
              <Text style={[styles.sectionCount, { color: colors.primary, fontFamily: 'SpaceMono_700Bold' }]}>
                {state.buildings.filter(b => b.level > 0).length} ACTIVE
              </Text>
            </View>

            {state.buildings.map((building, idx) => {
              const isSelected = selectedBuilding === building.id;
              const canAfford = canAffordBuilding(building);
              const isMaxLevel = building.level >= building.maxLevel;
              const cost = building.level === 0 ? building.baseCost : getUpgradeCost(building);

              return (
                <FadeSlideIn key={building.id} delay={idx * 35} duration={300} offset={8}>
                <PressableScale
                  style={[
                    styles.buildingCard,
                    {
                      borderColor: isSelected ? colors.primary : building.level > 0 ? colors.primary + '44' : colors.border,
                      backgroundColor: colors.card,
                    },
                  ]}
                  onPress={() => { setSelectedBuilding(isSelected ? null : building.id); Haptics.selectionAsync(); }}
                  glow={isSelected}
                  glowColor={colors.primary}
                  scaleTo={0.98}
                >
                  <View style={styles.buildingRow}>
                    <View style={[styles.buildingIconBox, { borderColor: colors.border, backgroundColor: colors.muted }]}>
                      <Feather name={BUILDING_ICONS[building.type] as any} size={18} color={building.level > 0 ? colors.primary : colors.mutedForeground} />
                    </View>
                    <View style={styles.buildingInfo}>
                      <Text style={[styles.buildingName, { color: colors.foreground }]}>{building.name.toUpperCase()}</Text>
                      <Text style={[styles.buildingEffect, { color: colors.mutedForeground }]}>{building.effect}</Text>
                    </View>
                    <View style={styles.levelDots}>
                      {Array.from({ length: Math.min(building.maxLevel, 5) }).map((_, i) => (
                        <View
                          key={i}
                          style={[
                            styles.levelDot,
                            {
                              backgroundColor: i < building.level
                                ? colors.primary
                                : colors.border,
                            },
                          ]}
                        />
                      ))}
                      {building.level === 0 && (
                        <Text style={[styles.notBuilt, { color: colors.mutedForeground }]}>—</Text>
                      )}
                    </View>
                  </View>

                  {isSelected && (
                    <FadeSlideIn key={`exp-${building.id}`} duration={280} offset={8}>
                    <View style={[styles.buildingExpanded, { borderTopColor: colors.border }]}>
                      <Text style={[styles.buildingDesc, { color: colors.mutedForeground }]}>{building.description}</Text>

                      {!isMaxLevel && (
                        <View style={styles.costBlock}>
                          <Text style={[styles.costBlockLabel, { color: colors.mutedForeground }]}>
                            {building.level === 0 ? 'CONSTRUCTION COST' : `UPGRADE TO LV${building.level + 1}`}
                          </Text>
                          <View style={styles.costItems}>
                            {Object.entries(cost).map(([elemId, amount]) => {
                              const have = getElementQuantity(elemId);
                              const enough = have >= amount;
                              return (
                                <View key={elemId} style={[styles.costItem, { borderColor: enough ? colors.secondary : colors.destructive, backgroundColor: enough ? colors.secondary + '12' : colors.destructive + '12' }]}>
                                  <Text style={[styles.costElem, { color: enough ? colors.secondary : colors.destructive, fontFamily: 'SpaceMono_700Bold' }]}>{elemId}</Text>
                                  <Text style={[styles.costAmt, { color: colors.mutedForeground, fontFamily: 'SpaceMono_400Regular' }]}>{have}/{amount}</Text>
                                </View>
                              );
                            })}
                          </View>
                        </View>
                      )}

                      <View style={styles.actionRow}>
                        {building.level === 0 && (
                          <PressableScale
                            style={[styles.actionBtn, { backgroundColor: canAfford ? colors.primary : colors.muted, borderColor: canAfford ? colors.primary : colors.border }]}
                            onPress={() => handleBuildAction(building.id, 'build')}
                            disabled={!canAfford}
                            glow={canAfford}
                            glowColor={colors.primary}
                            scaleTo={0.96}
                          >
                            <Feather name="plus" size={13} color={canAfford ? '#FFFFFF' : colors.mutedForeground} />
                            <Text style={[styles.actionBtnText, { color: canAfford ? '#FFFFFF' : colors.mutedForeground }]}>CONSTRUCT</Text>
                          </PressableScale>
                        )}
                        {building.level > 0 && !isMaxLevel && (
                          <PressableScale
                            style={[styles.actionBtn, { backgroundColor: canAfford ? colors.secondary : colors.muted, borderColor: canAfford ? colors.secondary : colors.border }]}
                            onPress={() => handleBuildAction(building.id, 'upgrade')}
                            disabled={!canAfford}
                            glow={canAfford}
                            glowColor={colors.secondary}
                            scaleTo={0.96}
                          >
                            <Feather name="arrow-up" size={13} color={canAfford ? '#FFFFFF' : colors.mutedForeground} />
                            <Text style={[styles.actionBtnText, { color: canAfford ? '#FFFFFF' : colors.mutedForeground }]}>UPGRADE</Text>
                          </PressableScale>
                        )}
                        {isMaxLevel && (
                          <View style={[styles.actionBtn, { borderColor: colors.secondary, backgroundColor: colors.secondary + '14' }]}>
                            <Feather name="check" size={13} color={colors.secondary} />
                            <Text style={[styles.actionBtnText, { color: colors.secondary }]}>MAX LEVEL</Text>
                          </View>
                        )}
                        {building.level > 0 && (
                          <PressableScale
                            style={[styles.demolishBtn, { borderColor: colors.destructive }]}
                            onPress={() => handleBuildAction(building.id, 'demolish')}
                            scaleTo={0.9}
                          >
                            <Feather name="trash-2" size={14} color={colors.destructive} />
                          </PressableScale>
                        )}
                      </View>
                    </View>
                    </FadeSlideIn>
                  )}
                </PressableScale>
                </FadeSlideIn>
              );
            })}
          </>
        )}

        {section === 'research' && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>TECHNOLOGY TREE — ERA {selectedEra}</Text>
            </View>

            {state.technologies.filter(t => t.era === selectedEra).map((tech, idx) => {
              const meetsPrereqs = prereqsMet(tech);
              const affordable = canAffordTech(tech);
              const isResearching = state.currentResearch === tech.id;
              const catColor = CATEGORY_COLORS[tech.category] ?? colors.primary;
              const available = meetsPrereqs && !tech.researched && !state.currentResearch;

              return (
                <FadeSlideIn key={tech.id} delay={idx * 35} duration={300} offset={8}>
                <View
                  style={[
                    styles.techCard,
                    {
                      borderColor: tech.researched ? catColor + '88' : isResearching ? colors.primary : meetsPrereqs ? colors.border : colors.border,
                      backgroundColor: colors.card,
                      opacity: (!meetsPrereqs && !tech.researched) ? 0.55 : 1,
                    },
                  ]}
                >
                  {tech.researched && (
                    <View style={[styles.techResearchedBar, { backgroundColor: catColor }]} />
                  )}
                  {isResearching && (
                    <View style={[styles.techResearchedBar, { backgroundColor: colors.primary }]} />
                  )}

                  <View style={styles.techHeader}>
                    <View style={styles.techInfo}>
                      <Text style={[styles.techName, { color: tech.researched ? catColor : colors.foreground }]}>
                        {tech.name.toUpperCase()}
                      </Text>
                      <Text style={[styles.techEffect, { color: colors.mutedForeground }]}>{tech.effect}</Text>
                    </View>
                    {tech.researched && (
                      <View style={[styles.statusBadge, { borderColor: catColor, backgroundColor: catColor + '18' }]}>
                        <Feather name="check" size={10} color={catColor} />
                        <Text style={[styles.statusBadgeText, { color: catColor }]}>COMPLETE</Text>
                      </View>
                    )}
                    {isResearching && (
                      <View style={[styles.statusBadge, { borderColor: colors.primary, backgroundColor: colors.primary + '18' }]}>
                        <Text style={[styles.statusBadgeText, { color: colors.primary, fontFamily: 'SpaceMono_700Bold' }]}>
                          {Math.floor(researchProgress * 100)}%
                        </Text>
                      </View>
                    )}
                  </View>

                  <Text style={[styles.techDesc, { color: colors.mutedForeground }]}>{tech.description}</Text>

                  {tech.prerequisites.length > 0 && (
                    <View style={styles.prereqRow}>
                      <Text style={[styles.prereqLabel, { color: colors.mutedForeground }]}>REQUIRES:</Text>
                      {tech.prerequisites.map(p => {
                        const prereq = state.technologies.find(t => t.id === p);
                        const done = prereq?.researched ?? false;
                        return (
                          <View key={p} style={[styles.prereqTag, { borderColor: done ? colors.secondary : colors.warning, backgroundColor: done ? colors.secondary + '14' : colors.warning + '14' }]}>
                            <Text style={[styles.prereqTagText, { color: done ? colors.secondary : colors.warning }]}>
                              {prereq?.name ?? p}
                            </Text>
                          </View>
                        );
                      })}
                    </View>
                  )}

                  {!tech.researched && (
                    <View style={styles.costRow}>
                      <Text style={[styles.costBlockLabel, { color: colors.mutedForeground }]}>COST:</Text>
                      {Object.entries(tech.cost).map(([elemId, amount]) => {
                        const have = getElementQuantity(elemId);
                        const enough = have >= amount;
                        return (
                          <View key={elemId} style={[styles.costItem, { borderColor: enough ? colors.secondary : colors.destructive, backgroundColor: enough ? colors.secondary + '12' : colors.destructive + '12' }]}>
                            <Text style={[styles.costElem, { color: enough ? colors.secondary : colors.destructive, fontFamily: 'SpaceMono_700Bold' }]}>{elemId}</Text>
                            <Text style={[styles.costAmt, { color: colors.mutedForeground, fontFamily: 'SpaceMono_400Regular' }]}>{have}/{amount}</Text>
                          </View>
                        );
                      })}
                    </View>
                  )}

                  {available && (
                    <PressableScale
                      style={[styles.researchBtn, { backgroundColor: affordable ? catColor : colors.muted, borderColor: affordable ? catColor : colors.border }]}
                      onPress={() => handleResearch(tech.id)}
                      disabled={!affordable}
                      glow={affordable}
                      glowColor={catColor}
                      scaleTo={0.96}
                    >
                      <Feather name="cpu" size={13} color={affordable ? '#FFFFFF' : colors.mutedForeground} />
                      <Text style={[styles.researchBtnText, { color: affordable ? '#FFFFFF' : colors.mutedForeground }]}>
                        {affordable ? 'BEGIN RESEARCH' : 'INSUFFICIENT RESOURCES'}
                      </Text>
                    </PressableScale>
                  )}

                  {!meetsPrereqs && !tech.researched && (
                    <View style={[styles.lockedRow, { borderColor: colors.border }]}>
                      <Feather name="lock" size={11} color={colors.mutedForeground} />
                      <Text style={[styles.lockedText, { color: colors.mutedForeground }]}>
                        COMPLETE PREREQUISITES TO UNLOCK
                      </Text>
                    </View>
                  )}
                </View>
                </FadeSlideIn>
              );
            })}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topSection: { gap: 0, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 0 },
  pillRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 7, borderWidth: 1.5, borderRadius: 6,
  },
  pillText: { fontSize: 10, fontFamily: 'Inter_700Bold', letterSpacing: 1 },
  researchActive: {
    borderWidth: 1, borderRadius: 6, padding: 10, gap: 6, marginBottom: 10,
  },
  researchActiveHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  researchActiveLabel: { fontSize: 9, fontFamily: 'Inter_700Bold', letterSpacing: 1, flex: 1 },
  researchActivePct: { fontSize: 11 },
  researchActiveName: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  eraScroll: { marginBottom: 10 },
  eraScrollContent: { flexDirection: 'row', gap: 8, paddingVertical: 2 },
  eraChip: { paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderRadius: 6, alignItems: 'center', gap: 2 },
  eraChipLabel: { fontSize: 9, fontFamily: 'Inter_700Bold', letterSpacing: 1 },
  eraChipName: { fontSize: 9, fontFamily: 'Inter_400Regular' },
  eraChipProgress: { fontSize: 9 },
  scroll: { flex: 1 },
  content: { padding: 16, gap: 10, paddingTop: 4 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 },
  sectionTitle: { fontSize: 11, fontFamily: 'Inter_700Bold', letterSpacing: 2 },
  sectionCount: { fontSize: 11 },

  buildingCard: { borderWidth: 1, borderRadius: 8, padding: 14, gap: 0 },
  buildingRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  buildingIconBox: { width: 42, height: 42, borderRadius: 6, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  buildingInfo: { flex: 1, gap: 2 },
  buildingName: { fontSize: 12, fontFamily: 'Inter_700Bold', letterSpacing: 0.5 },
  buildingEffect: { fontSize: 10, fontFamily: 'Inter_400Regular' },
  levelDots: { flexDirection: 'row', gap: 3, alignItems: 'center' },
  levelDot: { width: 6, height: 6, borderRadius: 3 },
  notBuilt: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  buildingExpanded: { borderTopWidth: StyleSheet.hairlineWidth, marginTop: 12, paddingTop: 12, gap: 10 },
  buildingDesc: { fontSize: 11, fontFamily: 'Inter_400Regular', lineHeight: 17 },
  costBlock: { gap: 6 },
  costBlockLabel: { fontSize: 8, fontFamily: 'Inter_700Bold', letterSpacing: 1.5 },
  costItems: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  costRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  costItem: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 7, paddingVertical: 3, borderWidth: 1, borderRadius: 4 },
  costElem: { fontSize: 11 },
  costAmt: { fontSize: 10 },
  actionRow: { flexDirection: 'row', gap: 8 },
  actionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 9, borderRadius: 5, borderWidth: 1.5,
  },
  actionBtnText: { fontSize: 11, fontFamily: 'Inter_700Bold', letterSpacing: 1 },
  demolishBtn: { paddingHorizontal: 12, paddingVertical: 9, borderRadius: 5, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },

  techCard: { borderWidth: 1, borderRadius: 8, padding: 14, gap: 8, overflow: 'hidden' },
  techResearchedBar: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 3 },
  techHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  techInfo: { flex: 1, gap: 2 },
  techName: { fontSize: 12, fontFamily: 'Inter_700Bold', letterSpacing: 0.5 },
  techEffect: { fontSize: 10, fontFamily: 'Inter_400Regular' },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 7, paddingVertical: 3, borderWidth: 1, borderRadius: 4 },
  statusBadgeText: { fontSize: 9, fontFamily: 'Inter_700Bold', letterSpacing: 0.5 },
  techDesc: { fontSize: 11, fontFamily: 'Inter_400Regular', lineHeight: 16 },
  prereqRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  prereqLabel: { fontSize: 8, fontFamily: 'Inter_700Bold', letterSpacing: 1 },
  prereqTag: { paddingHorizontal: 7, paddingVertical: 3, borderWidth: 1, borderRadius: 4 },
  prereqTagText: { fontSize: 9, fontFamily: 'Inter_600SemiBold' },
  researchBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 7, paddingVertical: 10, borderRadius: 5, borderWidth: 1.5,
  },
  researchBtnText: { fontSize: 11, fontFamily: 'Inter_700Bold', letterSpacing: 1 },
  lockedRow: { flexDirection: 'row', alignItems: 'center', gap: 7, padding: 8, borderTopWidth: StyleSheet.hairlineWidth, borderStyle: 'dashed' },
  lockedText: { fontSize: 9, fontFamily: 'Inter_600SemiBold', letterSpacing: 0.5 },
});
