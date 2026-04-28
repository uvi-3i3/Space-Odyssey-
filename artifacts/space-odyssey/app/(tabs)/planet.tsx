import React, { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Dimensions, Animated, Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useGame } from '@/context/GameContext';
import { useColors } from '@/hooks/useColors';
import { BlueprintGrid } from '@/components/BlueprintGrid';
import { PlanetIcon } from '@/components/PlanetIcon';
import { RarityBadge } from '@/components/RarityBadge';
import { PLANET_ZONES } from '@/constants/gameData';

const { width } = Dimensions.get('window');

type MiningType = 'safe' | 'aggressive' | 'deep';

const MINING_TYPES: { type: MiningType; label: string; icon: string; color: string; desc: string }[] = [
  { type: 'safe', label: 'Safe', icon: 'shield', color: '#00FF88', desc: 'Low risk, steady yield' },
  { type: 'aggressive', label: 'Aggressive', icon: 'zap', color: '#FFB800', desc: 'High yield, some risk' },
  { type: 'deep', label: 'Deep Core', icon: 'activity', color: '#FF6B00', desc: 'Max yield, high risk' },
];

export default function PlanetScreen() {
  const { state, mineZone } = useGame();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [selectedZone, setSelectedZone] = useState<string | null>(null);
  const [miningType, setMiningType] = useState<MiningType>('safe');
  const [result, setResult] = useState<{ success: boolean; message: string; rewards?: Record<string, number> } | null>(null);
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const bounceAnim = useRef(new Animated.Value(1)).current;

  const selectedZoneData = PLANET_ZONES.find(z => z.id === selectedZone);

  const handleMine = () => {
    if (!selectedZone) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const mineResult = mineZone(selectedZone, miningType);
    setResult(mineResult);

    if (mineResult.success) {
      Animated.sequence([
        Animated.spring(bounceAnim, { toValue: 1.1, useNativeDriver: true }),
        Animated.spring(bounceAnim, { toValue: 1, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.sequence([
        Animated.timing(shakeAnim, { toValue: 8, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -8, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 4, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
      ]).start();
    }

    setTimeout(() => setResult(null), 2500);
  };

  const paddingBottom = Platform.OS === 'web' ? 34 : 0;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <BlueprintGrid />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: 100 + paddingBottom }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.planetHeader}>
          <Text style={[styles.planetTitle, { color: colors.primary }]}>PLANETARY SURVEY</Text>
          <Text style={[styles.planetSubtitle, { color: colors.mutedForeground }]}>
            {state.planetZones.filter(z => z.unlocked).length}/{state.planetZones.length} ZONES ACCESSIBLE
          </Text>
        </View>

        <View style={[styles.planetMap, { borderColor: colors.border, backgroundColor: colors.card }]}>
          <Text style={[styles.mapLabel, { color: colors.mutedForeground }]}>// PLANET SURFACE MAP</Text>
          <View style={styles.mapArea}>
            {PLANET_ZONES.map(zone => {
              const isUnlocked = state.planetZones.find(z => z.id === zone.id)?.unlocked ?? false;
              const isSelected = selectedZone === zone.id;
              const lastMined = state.planetZones.find(z => z.id === zone.id)?.lastMined ?? 0;
              const cooldown = Date.now() - lastMined;
              const isOnCooldown = cooldown < 3000;

              return (
                <TouchableOpacity
                  key={zone.id}
                  style={[
                    styles.zoneMarker,
                    {
                      left: `${zone.x}%` as any,
                      top: `${zone.y}%` as any,
                      borderColor: isSelected ? colors.primary : isUnlocked ? colors.border : colors.muted,
                      backgroundColor: isSelected ? colors.primary + '44' : isUnlocked ? colors.card : colors.muted + '44',
                    },
                  ]}
                  onPress={() => {
                    if (isUnlocked) {
                      setSelectedZone(isSelected ? null : zone.id);
                      Haptics.selectionAsync();
                    }
                  }}
                  disabled={!isUnlocked}
                >
                  <Feather
                    name={isUnlocked ? (isOnCooldown ? 'clock' : 'target') : 'lock'}
                    size={12}
                    color={isSelected ? colors.primary : isUnlocked ? colors.mutedForeground : colors.muted + '88'}
                  />
                </TouchableOpacity>
              );
            })}

            <View style={styles.planetCore} pointerEvents="none">
              <PlanetIcon type="terran" size={64} glowColor={colors.primary} rotationDuration={56_000} />
            </View>
          </View>
        </View>

        {selectedZoneData && (
          <Animated.View
            style={[
              styles.zoneDetail,
              { borderColor: colors.primary, backgroundColor: colors.card },
              { transform: [{ translateX: shakeAnim }, { scale: bounceAnim }] },
            ]}
          >
            <View style={styles.zoneHeader}>
              <Text style={[styles.zoneName, { color: colors.primary }]}>{selectedZoneData.name.toUpperCase()}</Text>
              <Feather name="target" size={16} color={colors.primary} />
            </View>

            <View style={styles.zoneElements}>
              <Text style={[styles.zoneLabel, { color: colors.mutedForeground }]}>ELEMENTS:</Text>
              {selectedZoneData.elements.map(elemId => {
                const elem = state.elements.find(e => e.id === elemId);
                if (!elem) return null;
                return (
                  <View key={elemId} style={[styles.elemTag, { borderColor: colors.border }]}>
                    <Text style={[styles.elemTagSymbol, { color: colors.primary }]}>{elem.symbol}</Text>
                    {elem.discovered && <Text style={[styles.elemTagQty, { color: colors.mutedForeground }]}>{elem.quantity}</Text>}
                  </View>
                );
              })}
            </View>

            <View style={styles.miningTypeRow}>
              {MINING_TYPES.map(mt => (
                <TouchableOpacity
                  key={mt.type}
                  style={[
                    styles.miningTypeBtn,
                    {
                      borderColor: miningType === mt.type ? mt.color : colors.border,
                      backgroundColor: miningType === mt.type ? mt.color + '22' : colors.card,
                    },
                  ]}
                  onPress={() => { setMiningType(mt.type); Haptics.selectionAsync(); }}
                >
                  <Feather name={mt.icon as any} size={14} color={miningType === mt.type ? mt.color : colors.mutedForeground} />
                  <Text style={[styles.miningTypeName, { color: miningType === mt.type ? mt.color : colors.mutedForeground }]}>
                    {mt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.miningDesc, { color: colors.mutedForeground }]}>
              {MINING_TYPES.find(m => m.type === miningType)?.desc}
            </Text>

            <TouchableOpacity
              style={[styles.mineBtn, { backgroundColor: colors.primary }]}
              onPress={handleMine}
            >
              <Feather name="activity" size={18} color={colors.background} />
              <Text style={[styles.mineBtnText, { color: colors.background }]}>INITIATE MINING</Text>
            </TouchableOpacity>

            {result && (
              <View style={[
                styles.resultBanner,
                { backgroundColor: result.success ? colors.success + '22' : colors.destructive + '22', borderColor: result.success ? colors.success : colors.destructive },
              ]}>
                <Feather name={result.success ? 'check-circle' : 'alert-circle'} size={14} color={result.success ? colors.success : colors.destructive} />
                <Text style={[styles.resultText, { color: result.success ? colors.success : colors.destructive }]}>
                  {result.message}
                </Text>
              </View>
            )}

            {result?.success && result.rewards && (
              <View style={styles.rewardsList}>
                {Object.entries(result.rewards).map(([elemId, qty]) => {
                  const elem = state.elements.find(e => e.id === elemId);
                  return (
                    <Text key={elemId} style={[styles.rewardItem, { color: colors.success }]}>
                      +{qty} {elem?.name ?? elemId}
                    </Text>
                  );
                })}
              </View>
            )}
          </Animated.View>
        )}

        {!selectedZone && (
          <View style={[styles.noSelection, { borderColor: colors.border }]}>
            <Feather name="map-pin" size={32} color={colors.mutedForeground} />
            <Text style={[styles.noSelectionText, { color: colors.mutedForeground }]}>
              Select a zone on the planet map to begin mining operations
            </Text>
          </View>
        )}

        <View style={styles.elementCodex}>
          <Text style={[styles.codexTitle, { color: colors.primary }]}>// ELEMENT CODEX</Text>
          <Text style={[styles.codexSubtitle, { color: colors.mutedForeground }]}>
            {state.elements.filter(e => e.discovered).length}/{state.elements.length} DISCOVERED
          </Text>

          <View style={styles.codexGrid}>
            {state.elements.map(elem => (
              <View
                key={elem.id}
                style={[
                  styles.codexCell,
                  {
                    borderColor: elem.discovered ? getRarityBorderColor(elem.rarity, colors) : colors.border,
                    backgroundColor: elem.discovered ? getRarityBorderColor(elem.rarity, colors) + '15' : colors.card,
                  },
                ]}
              >
                <Text style={[styles.codexAtomicNum, { color: colors.mutedForeground }]}>{elem.atomicNumber}</Text>
                <Text style={[styles.codexSymbol, { color: elem.discovered ? getRarityBorderColor(elem.rarity, colors) : colors.border }]}>
                  {elem.discovered ? elem.symbol : '??'}
                </Text>
                {elem.discovered && (
                  <Text style={[styles.codexQty, { color: colors.mutedForeground }]}>
                    {elem.quantity > 999 ? `${Math.floor(elem.quantity / 1000)}k` : elem.quantity}
                  </Text>
                )}
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

function getRarityBorderColor(rarity: string, colors: any) {
  switch (rarity) {
    case 'legendary': return colors.legendary;
    case 'epic': return colors.epic;
    case 'rare': return colors.rare;
    case 'uncommon': return colors.uncommon;
    default: return colors.common;
  }
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flex: 1 },
  content: { padding: 16, gap: 16 },
  planetHeader: { gap: 4 },
  planetTitle: { fontSize: 14, fontFamily: 'Inter_700Bold', letterSpacing: 2 },
  planetSubtitle: { fontSize: 11, fontFamily: 'Inter_400Regular' },
  planetMap: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    overflow: 'hidden',
  },
  mapLabel: { fontSize: 10, fontFamily: 'Inter_400Regular', marginBottom: 8, letterSpacing: 1 },
  mapArea: {
    height: 200,
    position: 'relative',
    borderRadius: 4,
    overflow: 'hidden',
  },
  zoneMarker: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -14,
    marginTop: -14,
  },
  planetCore: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    width: 64,
    height: 64,
    marginLeft: -32,
    marginTop: -32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoneDetail: {
    borderWidth: 1.5,
    borderRadius: 8,
    padding: 16,
    gap: 12,
  },
  zoneHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  zoneName: { fontSize: 13, fontFamily: 'Inter_700Bold', letterSpacing: 1.5 },
  zoneElements: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  zoneLabel: { fontSize: 10, fontFamily: 'Inter_500Medium', letterSpacing: 1 },
  elemTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderRadius: 4,
  },
  elemTagSymbol: { fontSize: 12, fontFamily: 'Inter_700Bold' },
  elemTagQty: { fontSize: 10, fontFamily: 'Inter_400Regular' },
  miningTypeRow: { flexDirection: 'row', gap: 8 },
  miningTypeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
    borderWidth: 1,
    borderRadius: 6,
  },
  miningTypeName: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  miningDesc: { fontSize: 11, fontFamily: 'Inter_400Regular', textAlign: 'center' },
  mineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 6,
  },
  mineBtnText: { fontSize: 14, fontFamily: 'Inter_700Bold', letterSpacing: 1.5 },
  resultBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderWidth: 1,
    borderRadius: 6,
  },
  resultText: { fontSize: 12, fontFamily: 'Inter_500Medium', flex: 1 },
  rewardsList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  rewardItem: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  noSelection: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 8,
    padding: 32,
    alignItems: 'center',
    gap: 12,
  },
  noSelectionText: { fontSize: 13, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 20 },
  elementCodex: { gap: 8 },
  codexTitle: { fontSize: 12, fontFamily: 'Inter_700Bold', letterSpacing: 2 },
  codexSubtitle: { fontSize: 11, fontFamily: 'Inter_400Regular' },
  codexGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  codexCell: {
    width: (width - 64) / 7,
    aspectRatio: 0.8,
    borderWidth: 1,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 2,
    gap: 1,
  },
  codexAtomicNum: { fontSize: 7, fontFamily: 'Inter_400Regular' },
  codexSymbol: { fontSize: 13, fontFamily: 'Inter_700Bold' },
  codexQty: { fontSize: 7, fontFamily: 'Inter_400Regular' },
});
