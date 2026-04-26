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
import { Building } from '@/constants/gameData';

const BUILDING_ICONS: Record<string, string> = {
  mine: 'tool',
  lab: 'cpu',
  habitat: 'home',
  defense: 'shield',
  storage: 'database',
  refinery: 'activity',
  temple: 'star',
  trade_post: 'repeat',
};

const BUILDING_COLORS: Record<string, string> = {
  mine: '#FFB800',
  lab: '#00D4FF',
  habitat: '#00FF88',
  defense: '#FF4444',
  storage: '#9B59B6',
  refinery: '#FF6B00',
  temple: '#FFD700',
  trade_post: '#00FF88',
};

export default function BuildingsScreen() {
  const { state, constructBuilding, upgradeBuilding, demolishBuilding, getElementQuantity } = useGame();
  const colors = useColors();
  const [selectedBuilding, setSelectedBuilding] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('all');

  const filters = ['all', 'mine', 'lab', 'habitat', 'defense', 'storage'];

  const filteredBuildings = state.buildings.filter(b =>
    filter === 'all' || b.type === filter
  );

  const getBuildingColor = (type: string) => BUILDING_COLORS[type] ?? colors.primary;

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

  const handleAction = (buildingId: string, action: 'build' | 'upgrade' | 'demolish') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (action === 'demolish') {
      Alert.alert('Demolish Building', 'Are you sure? Resources will not be refunded.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Demolish', style: 'destructive', onPress: () => { demolishBuilding(buildingId); setSelectedBuilding(null); } },
      ]);
      return;
    }

    const result = action === 'build' ? constructBuilding(buildingId) : upgradeBuilding(buildingId);
    if (!result.success) {
      Alert.alert('Cannot Build', result.message);
    }
  };

  const paddingBottom = Platform.OS === 'web' ? 34 : 0;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <BlueprintGrid />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={[styles.filterBar, { borderBottomColor: colors.border }]}
        contentContainerStyle={styles.filterContent}
      >
        {filters.map(f => (
          <TouchableOpacity
            key={f}
            style={[
              styles.filterBtn,
              { borderColor: filter === f ? colors.primary : colors.border, backgroundColor: filter === f ? colors.primary + '22' : 'transparent' },
            ]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterText, { color: filter === f ? colors.primary : colors.mutedForeground }]}>
              {f.replace('_', ' ').toUpperCase()}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: 100 + paddingBottom }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.primary }]}>BASE MANAGEMENT</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            {state.buildings.filter(b => b.level > 0).length} STRUCTURES ACTIVE
          </Text>
        </View>

        {filteredBuildings.map(building => {
          const isSelected = selectedBuilding === building.id;
          const color = getBuildingColor(building.type);
          const canAfford = canAffordBuilding(building);
          const upgradeProgress = building.level / building.maxLevel;
          const isMaxLevel = building.level >= building.maxLevel;

          return (
            <TouchableOpacity
              key={building.id}
              style={[
                styles.buildingCard,
                { borderColor: isSelected ? color : building.level > 0 ? color + '55' : colors.border, backgroundColor: colors.card },
              ]}
              onPress={() => { setSelectedBuilding(isSelected ? null : building.id); Haptics.selectionAsync(); }}
            >
              <View style={styles.cardHeader}>
                <View style={[styles.iconBox, { backgroundColor: color + '22', borderColor: color + '55' }]}>
                  <Feather name={BUILDING_ICONS[building.type] as any} size={20} color={color} />
                </View>
                <View style={styles.cardInfo}>
                  <Text style={[styles.buildingName, { color: colors.foreground }]}>{building.name}</Text>
                  <Text style={[styles.buildingEffect, { color: colors.mutedForeground }]}>{building.effect}</Text>
                </View>
                <View style={styles.levelBadge}>
                  {building.level > 0 ? (
                    <>
                      <Text style={[styles.levelNum, { color }]}>LV{building.level}</Text>
                      <ProgressBar progress={upgradeProgress} color={color} height={3} />
                    </>
                  ) : (
                    <Text style={[styles.levelNum, { color: colors.mutedForeground }]}>NOT BUILT</Text>
                  )}
                </View>
              </View>

              {isSelected && (
                <View style={styles.cardExpanded}>
                  <Text style={[styles.buildingDesc, { color: colors.mutedForeground }]}>{building.description}</Text>

                  {!isMaxLevel && (
                    <View style={styles.costRow}>
                      <Text style={[styles.costLabel, { color: colors.mutedForeground }]}>
                        {building.level === 0 ? 'BUILD COST:' : `UPGRADE LV${building.level + 1} COST:`}
                      </Text>
                      <View style={styles.costItems}>
                        {Object.entries(building.level === 0 ? building.baseCost : getUpgradeCost(building)).map(([elemId, amount]) => {
                          const have = getElementQuantity(elemId);
                          const enough = have >= amount;
                          return (
                            <View key={elemId} style={styles.costItem}>
                              <Text style={[styles.costElem, { color: enough ? colors.success : colors.destructive }]}>
                                {elemId}
                              </Text>
                              <Text style={[styles.costAmount, { color: enough ? colors.foreground : colors.destructive }]}>
                                {have}/{amount}
                              </Text>
                            </View>
                          );
                        })}
                      </View>
                    </View>
                  )}

                  <View style={styles.actionRow}>
                    {building.level === 0 && (
                      <TouchableOpacity
                        style={[styles.actionBtn, { backgroundColor: canAfford ? color : colors.muted }]}
                        onPress={() => handleAction(building.id, 'build')}
                        disabled={!canAfford}
                      >
                        <Feather name="plus" size={14} color={canAfford ? colors.background : colors.mutedForeground} />
                        <Text style={[styles.actionBtnText, { color: canAfford ? colors.background : colors.mutedForeground }]}>
                          BUILD
                        </Text>
                      </TouchableOpacity>
                    )}
                    {building.level > 0 && !isMaxLevel && (
                      <TouchableOpacity
                        style={[styles.actionBtn, { backgroundColor: canAfford ? color : colors.muted }]}
                        onPress={() => handleAction(building.id, 'upgrade')}
                        disabled={!canAfford}
                      >
                        <Feather name="arrow-up" size={14} color={canAfford ? colors.background : colors.mutedForeground} />
                        <Text style={[styles.actionBtnText, { color: canAfford ? colors.background : colors.mutedForeground }]}>
                          UPGRADE
                        </Text>
                      </TouchableOpacity>
                    )}
                    {isMaxLevel && (
                      <View style={[styles.actionBtn, { backgroundColor: color + '22', borderColor: color, borderWidth: 1 }]}>
                        <Feather name="star" size={14} color={color} />
                        <Text style={[styles.actionBtnText, { color }]}>MAX LEVEL</Text>
                      </View>
                    )}
                    {building.level > 0 && (
                      <TouchableOpacity
                        style={[styles.demolishBtn, { borderColor: colors.destructive }]}
                        onPress={() => handleAction(building.id, 'demolish')}
                      >
                        <Feather name="trash-2" size={14} color={colors.destructive} />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  filterBar: { borderBottomWidth: 1, maxHeight: 52 },
  filterContent: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 10 },
  filterBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 4, borderWidth: 1 },
  filterText: { fontSize: 10, fontFamily: 'Inter_600SemiBold', letterSpacing: 0.5 },
  scroll: { flex: 1 },
  content: { padding: 16, gap: 10 },
  header: { gap: 4, marginBottom: 4 },
  title: { fontSize: 14, fontFamily: 'Inter_700Bold', letterSpacing: 2 },
  subtitle: { fontSize: 11, fontFamily: 'Inter_400Regular' },
  buildingCard: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 14,
    gap: 12,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardInfo: { flex: 1, gap: 2 },
  buildingName: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  buildingEffect: { fontSize: 11, fontFamily: 'Inter_400Regular' },
  levelBadge: { alignItems: 'flex-end', gap: 4, minWidth: 60 },
  levelNum: { fontSize: 11, fontFamily: 'Inter_700Bold', letterSpacing: 0.5 },
  cardExpanded: { gap: 12, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#1E3A5F' },
  buildingDesc: { fontSize: 12, fontFamily: 'Inter_400Regular', lineHeight: 18 },
  costRow: { gap: 6 },
  costLabel: { fontSize: 10, fontFamily: 'Inter_600SemiBold', letterSpacing: 1 },
  costItems: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  costItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  costElem: { fontSize: 12, fontFamily: 'Inter_700Bold' },
  costAmount: { fontSize: 11, fontFamily: 'Inter_400Regular' },
  actionRow: { flexDirection: 'row', gap: 8 },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 6,
  },
  actionBtnText: { fontSize: 12, fontFamily: 'Inter_700Bold', letterSpacing: 1 },
  demolishBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
