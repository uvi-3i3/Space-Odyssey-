import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useGame, CombatEntry } from '@/context/GameContext';
import { useColors } from '@/hooks/useColors';
import { BlueprintGrid } from '@/components/BlueprintGrid';
import { ProgressBar } from '@/components/ProgressBar';

type Strategy = 'attack' | 'defend' | 'retreat';
type Mission = 'scan' | 'spy' | 'disrupt' | 'fake';

const STRATEGIES: { type: Strategy; label: string; icon: string; color: string; desc: string }[] = [
  { type: 'attack', label: 'All Out Attack', icon: 'zap', color: '#FF4444', desc: '+30% power, more risk' },
  { type: 'defend', label: 'Defensive', icon: 'shield', color: '#00D4FF', desc: 'Balanced approach' },
  { type: 'retreat', label: 'Retreat', icon: 'log-out', color: '#FFB800', desc: 'No risk, no reward' },
];

const MISSIONS: { type: Mission; label: string; icon: string; color: string; rate: number }[] = [
  { type: 'scan', label: 'Scan Base', icon: 'eye', color: '#00D4FF', rate: 90 },
  { type: 'spy', label: 'Plant Spy', icon: 'user-check', color: '#00FF88', rate: 60 },
  { type: 'disrupt', label: 'Disrupt', icon: 'zap-off', color: '#FFB800', rate: 50 },
  { type: 'fake', label: 'Fake Signals', icon: 'radio', color: '#9B59B6', rate: 70 },
];

const UNIT_ICONS: Record<string, string> = {
  fighter: 'navigation',
  bomber: 'crosshair',
  capital: 'anchor',
  scout: 'wind',
};

export default function CombatScreen() {
  const { state, engageCombat, runEspionage, recruitUnits, getElementQuantity } = useGame();
  const colors = useColors();
  const [tab, setTab] = useState<'combat' | 'espionage' | 'fleet'>('combat');
  const [selectedFaction, setSelectedFaction] = useState<string | null>(null);
  const [strategy, setStrategy] = useState<Strategy>('attack');
  const [lastResult, setLastResult] = useState<CombatEntry | null>(null);

  const discoveredFactions = state.factions.filter(f => f.discovered);

  const handleCombat = () => {
    if (!selectedFaction) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    const result = engageCombat(selectedFaction, strategy);
    setLastResult(result);
  };

  const handleEspionage = (mission: Mission) => {
    if (!selectedFaction) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    runEspionage(selectedFaction, mission);
  };

  const handleRecruit = (unitId: string) => {
    const result = recruitUnits(unitId, 5);
    if (result.success) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const getRelationshipColor = (rel: string) => {
    switch (rel) {
      case 'allied': return colors.success;
      case 'friendly': return '#00D4FF';
      case 'neutral': return colors.warning;
      case 'hostile': return colors.destructive;
      default: return colors.mutedForeground;
    }
  };

  const paddingBottom = Platform.OS === 'web' ? 34 : 0;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <BlueprintGrid />

      <View style={[styles.tabRow, { borderBottomColor: colors.border }]}>
        {(['combat', 'espionage', 'fleet'] as const).map(t => (
          <TouchableOpacity
            key={t}
            style={[
              styles.tabBtn,
              { borderBottomColor: tab === t ? colors.primary : 'transparent' },
            ]}
            onPress={() => setTab(t)}
          >
            <Text style={[styles.tabText, { color: tab === t ? colors.primary : colors.mutedForeground }]}>
              {t.toUpperCase()}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: 100 + paddingBottom }]}
        showsVerticalScrollIndicator={false}
      >
        {(tab === 'combat' || tab === 'espionage') && (
          <>
            <Text style={[styles.sectionTitle, { color: colors.primary }]}>
              {tab === 'combat' ? '// KNOWN FACTIONS' : '// SELECT TARGET'}
            </Text>

            {discoveredFactions.length === 0 ? (
              <View style={[styles.emptyState, { borderColor: colors.border }]}>
                <Feather name="users" size={32} color={colors.mutedForeground} />
                <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                  No factions discovered yet. Continue exploring to make contact.
                </Text>
              </View>
            ) : (
              discoveredFactions.map(faction => {
                const relColor = getRelationshipColor(faction.relationship);
                const isSelected = selectedFaction === faction.id;
                const reputationProgress = (faction.reputation + 100) / 200;

                return (
                  <TouchableOpacity
                    key={faction.id}
                    style={[
                      styles.factionCard,
                      { borderColor: isSelected ? relColor : colors.border, backgroundColor: colors.card },
                    ]}
                    onPress={() => { setSelectedFaction(isSelected ? null : faction.id); Haptics.selectionAsync(); }}
                  >
                    <View style={styles.factionHeader}>
                      <View style={[styles.factionIcon, { backgroundColor: relColor + '22', borderColor: relColor + '55' }]}>
                        <Feather name="users" size={18} color={relColor} />
                      </View>
                      <View style={styles.factionInfo}>
                        <Text style={[styles.factionName, { color: colors.foreground }]}>{faction.name}</Text>
                        <Text style={[styles.factionDesc, { color: colors.mutedForeground }]}>{faction.description}</Text>
                      </View>
                      <View style={[styles.relBadge, { borderColor: relColor, backgroundColor: relColor + '22' }]}>
                        <Text style={[styles.relText, { color: relColor }]}>{faction.relationship.toUpperCase()}</Text>
                      </View>
                    </View>

                    <View style={styles.reputationRow}>
                      <Text style={[styles.repLabel, { color: colors.mutedForeground }]}>REP: {faction.reputation}</Text>
                      <View style={styles.repBar}>
                        <ProgressBar progress={reputationProgress} color={relColor} height={4} />
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </>
        )}

        {tab === 'combat' && selectedFaction && (
          <>
            <Text style={[styles.sectionTitle, { color: colors.primary }]}>// COMBAT STRATEGY</Text>

            {STRATEGIES.map(s => (
              <TouchableOpacity
                key={s.type}
                style={[
                  styles.strategyCard,
                  { borderColor: strategy === s.type ? s.color : colors.border, backgroundColor: strategy === s.type ? s.color + '11' : colors.card },
                ]}
                onPress={() => setStrategy(s.type)}
              >
                <Feather name={s.icon as any} size={20} color={strategy === s.type ? s.color : colors.mutedForeground} />
                <View style={styles.stratInfo}>
                  <Text style={[styles.stratName, { color: strategy === s.type ? s.color : colors.foreground }]}>{s.label}</Text>
                  <Text style={[styles.stratDesc, { color: colors.mutedForeground }]}>{s.desc}</Text>
                </View>
                {strategy === s.type && <Feather name="check" size={16} color={s.color} />}
              </TouchableOpacity>
            ))}

            <TouchableOpacity style={[styles.engageBtn, { backgroundColor: colors.destructive }]} onPress={handleCombat}>
              <Feather name="crosshair" size={18} color={colors.background} />
              <Text style={[styles.engageBtnText, { color: colors.background }]}>ENGAGE FLEET</Text>
            </TouchableOpacity>

            {lastResult && (
              <View style={[
                styles.resultCard,
                { borderColor: lastResult.outcome === 'win' ? colors.success : lastResult.outcome === 'loss' ? colors.destructive : colors.warning, backgroundColor: colors.card },
              ]}>
                <View style={styles.resultHeader}>
                  <Feather
                    name={lastResult.outcome === 'win' ? 'award' : lastResult.outcome === 'loss' ? 'x-circle' : 'minus-circle'}
                    size={18}
                    color={lastResult.outcome === 'win' ? colors.success : lastResult.outcome === 'loss' ? colors.destructive : colors.warning}
                  />
                  <Text style={[styles.resultTitle, { color: colors.foreground }]}>
                    {lastResult.outcome.toUpperCase()}
                  </Text>
                </View>
                <Text style={[styles.resultDetails, { color: colors.mutedForeground }]}>{lastResult.details}</Text>
              </View>
            )}
          </>
        )}

        {tab === 'espionage' && selectedFaction && (
          <>
            <Text style={[styles.sectionTitle, { color: colors.primary }]}>// ESPIONAGE MISSIONS</Text>
            {MISSIONS.map(m => (
              <TouchableOpacity
                key={m.type}
                style={[styles.missionCard, { borderColor: m.color + '55', backgroundColor: colors.card }]}
                onPress={() => handleEspionage(m.type)}
              >
                <View style={[styles.missionIcon, { backgroundColor: m.color + '22', borderColor: m.color }]}>
                  <Feather name={m.icon as any} size={18} color={m.color} />
                </View>
                <View style={styles.missionInfo}>
                  <Text style={[styles.missionName, { color: colors.foreground }]}>{m.label}</Text>
                  <View style={styles.successRow}>
                    <Text style={[styles.successLabel, { color: colors.mutedForeground }]}>SUCCESS RATE:</Text>
                    <View style={styles.successBar}>
                      <ProgressBar progress={m.rate / 100} color={m.color} height={4} />
                    </View>
                    <Text style={[styles.successPct, { color: m.color }]}>{m.rate}%</Text>
                  </View>
                </View>
                <Feather name="chevron-right" size={16} color={m.color} />
              </TouchableOpacity>
            ))}
          </>
        )}

        {tab === 'fleet' && (
          <>
            <Text style={[styles.sectionTitle, { color: colors.primary }]}>// FLEET MANAGEMENT</Text>
            {state.units.map(unit => {
              const canAfford = Object.entries(unit.cost).every(([id, amount]) => getElementQuantity(id) >= amount * 5);

              return (
                <View key={unit.id} style={[styles.unitCard, { borderColor: colors.border, backgroundColor: colors.card }]}>
                  <View style={[styles.unitIcon, { backgroundColor: colors.primary + '22', borderColor: colors.primary }]}>
                    <Feather name={UNIT_ICONS[unit.type] as any} size={18} color={colors.primary} />
                  </View>
                  <View style={styles.unitInfo}>
                    <Text style={[styles.unitName, { color: colors.foreground }]}>{unit.name}</Text>
                    <View style={styles.unitStats}>
                      <Text style={[styles.unitStat, { color: colors.destructive }]}>ATK: {unit.attack}</Text>
                      <Text style={[styles.unitStat, { color: colors.rare }]}>DEF: {unit.defense}</Text>
                      <Text style={[styles.unitStat, { color: colors.success }]}>x{unit.count}</Text>
                    </View>
                    <View style={styles.unitCost}>
                      {Object.entries(unit.cost).map(([id, amt]) => (
                        <Text key={id} style={[styles.unitCostText, { color: colors.mutedForeground }]}>{id}: {amt * 5}</Text>
                      ))}
                    </View>
                  </View>
                  <TouchableOpacity
                    style={[styles.recruitBtn, { backgroundColor: canAfford ? colors.primary : colors.muted }]}
                    onPress={() => handleRecruit(unit.id)}
                    disabled={!canAfford}
                  >
                    <Text style={[styles.recruitBtnText, { color: canAfford ? colors.background : colors.mutedForeground }]}>
                      +5
                    </Text>
                  </TouchableOpacity>
                </View>
              );
            })}

            {state.combatLog.length > 0 && (
              <>
                <Text style={[styles.sectionTitle, { color: colors.primary }]}>// COMBAT LOG</Text>
                {state.combatLog.slice(0, 5).map(entry => (
                  <View key={entry.id} style={[styles.logEntry, { borderColor: colors.border }]}>
                    <Feather
                      name={entry.outcome === 'win' ? 'check-circle' : entry.outcome === 'loss' ? 'x-circle' : 'minus-circle'}
                      size={14}
                      color={entry.outcome === 'win' ? colors.success : entry.outcome === 'loss' ? colors.destructive : colors.warning}
                    />
                    <Text style={[styles.logText, { color: colors.mutedForeground }]}>{entry.details}</Text>
                  </View>
                ))}
              </>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  tabRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
  },
  tabText: { fontSize: 11, fontFamily: 'Inter_700Bold', letterSpacing: 1 },
  scroll: { flex: 1 },
  content: { padding: 16, gap: 12 },
  sectionTitle: { fontSize: 11, fontFamily: 'Inter_700Bold', letterSpacing: 2 },
  emptyState: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 8,
    padding: 32,
    alignItems: 'center',
    gap: 12,
  },
  emptyText: { fontSize: 13, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 18 },
  factionCard: { borderWidth: 1, borderRadius: 8, padding: 14, gap: 10 },
  factionHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  factionIcon: { width: 44, height: 44, borderRadius: 8, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  factionInfo: { flex: 1, gap: 2 },
  factionName: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  factionDesc: { fontSize: 11, fontFamily: 'Inter_400Regular' },
  relBadge: { paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderRadius: 4 },
  relText: { fontSize: 9, fontFamily: 'Inter_700Bold', letterSpacing: 0.5 },
  reputationRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  repLabel: { fontSize: 10, fontFamily: 'Inter_500Medium', width: 60 },
  repBar: { flex: 1 },
  strategyCard: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 8, padding: 14 },
  stratInfo: { flex: 1, gap: 2 },
  stratName: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  stratDesc: { fontSize: 11, fontFamily: 'Inter_400Regular' },
  engageBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 6 },
  engageBtnText: { fontSize: 14, fontFamily: 'Inter_700Bold', letterSpacing: 1.5 },
  resultCard: { borderWidth: 1, borderRadius: 8, padding: 14, gap: 8 },
  resultHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  resultTitle: { fontSize: 14, fontFamily: 'Inter_700Bold' },
  resultDetails: { fontSize: 12, fontFamily: 'Inter_400Regular', lineHeight: 18 },
  missionCard: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 8, padding: 14 },
  missionIcon: { width: 44, height: 44, borderRadius: 8, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  missionInfo: { flex: 1, gap: 6 },
  missionName: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  successRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  successLabel: { fontSize: 9, fontFamily: 'Inter_500Medium', letterSpacing: 0.5, width: 78 },
  successBar: { flex: 1 },
  successPct: { fontSize: 11, fontFamily: 'Inter_700Bold', width: 32, textAlign: 'right' },
  unitCard: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 8, padding: 14 },
  unitIcon: { width: 44, height: 44, borderRadius: 8, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  unitInfo: { flex: 1, gap: 4 },
  unitName: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  unitStats: { flexDirection: 'row', gap: 12 },
  unitStat: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  unitCost: { flexDirection: 'row', gap: 8 },
  unitCostText: { fontSize: 10, fontFamily: 'Inter_400Regular' },
  recruitBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  recruitBtnText: { fontSize: 14, fontFamily: 'Inter_700Bold' },
  logEntry: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 10, borderWidth: 1, borderRadius: 6 },
  logText: { fontSize: 12, fontFamily: 'Inter_400Regular', flex: 1, lineHeight: 18 },
});
