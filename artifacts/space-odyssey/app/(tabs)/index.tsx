import React, { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Dimensions, Animated, Platform, Modal,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useGame } from '@/context/GameContext';
import { useColors } from '@/hooks/useColors';
import { BlueprintGrid } from '@/components/BlueprintGrid';
import { Starfield } from '@/components/Starfield';
import { ScanPulse } from '@/components/ScanPulse';
import { PlanetIcon } from '@/components/PlanetIcon';
import { FadeSlideIn } from '@/components/FadeSlideIn';
import { PressableScale } from '@/components/PressableScale';
import { GlowPulse } from '@/components/GlowPulse';
import { Shimmer } from '@/components/Shimmer';
import { PLANET_ZONES } from '@/constants/gameData';

const { width } = Dimensions.get('window');

type MiningType = 'safe' | 'aggressive' | 'deep';

const MINING_TYPES: { type: MiningType; label: string; icon: string; color: string; desc: string; risk: string }[] = [
  { type: 'safe', label: 'SAFE EXTRACT', icon: 'shield', color: '#3ECFB2', desc: 'Standard protocol', risk: '0% RISK' },
  { type: 'aggressive', label: 'AGGRESSIVE', icon: 'zap', color: '#FFB800', desc: 'High-yield operation', risk: '25% RISK' },
  { type: 'deep', label: 'DEEP CORE', icon: 'activity', color: '#E74C3C', desc: 'Maximum extraction', risk: '50% RISK' },
];

function getRarityColor(rarity: string, colors: any) {
  switch (rarity) {
    case 'legendary': return colors.legendary;
    case 'epic': return colors.epic;
    case 'rare': return colors.rare;
    case 'uncommon': return colors.uncommon;
    default: return colors.common;
  }
}

export default function PlanetScreen() {
  const { state, mineZone } = useGame();
  const colors = useColors();
  const [selectedZone, setSelectedZone] = useState<string | null>(null);
  const [miningType, setMiningType] = useState<MiningType>('safe');
  const [result, setResult] = useState<{ success: boolean; message: string; rewards?: Record<string, number> } | null>(null);
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const bounceAnim = useRef(new Animated.Value(1)).current;

  const selectedZoneData = PLANET_ZONES.find(z => z.id === selectedZone);
  const paddingBottom = Platform.OS === 'web' ? 34 : 0;

  const handleMine = () => {
    if (!selectedZone) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const mineResult = mineZone(selectedZone, miningType);
    setResult(mineResult);

    if (mineResult.success) {
      Animated.sequence([
        Animated.spring(bounceAnim, { toValue: 1.02, useNativeDriver: true }),
        Animated.spring(bounceAnim, { toValue: 1, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.sequence([
        Animated.timing(shakeAnim, { toValue: 6, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -6, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 3, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
      ]).start();
    }

    setTimeout(() => setResult(null), 3000);
  };

  const unlockedCount = state.planetZones.filter(z => z.unlocked).length;
  const discoveredCount = state.elements.filter(e => e.discovered).length;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <BlueprintGrid />
      <Starfield count={55} opacity={0.7} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: 100 + paddingBottom }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.pageHeader}>
          <View>
            <Text style={[styles.pageTitle, { color: colors.foreground }]}>PLANETARY SURVEY</Text>
            <Text style={[styles.pageSubtitle, { color: colors.mutedForeground }]}>
              {unlockedCount}/{state.planetZones.length} ZONES ACCESSIBLE
            </Text>
          </View>
          <View style={[styles.statusTag, { borderColor: colors.secondary, backgroundColor: colors.secondary + '18' }]}>
            <View style={[styles.statusDot, { backgroundColor: colors.secondary }]} />
            <Text style={[styles.statusText, { color: colors.secondary }]}>ACTIVE</Text>
          </View>
        </View>

        <View style={[styles.schematicMap, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.mapHeader}>
            <Text style={[styles.mapLabel, { color: colors.mutedForeground }]}>SURFACE SCHEMATIC</Text>
            <Text style={[styles.mapCoords, { color: colors.mutedForeground }]}>SYS·ALPHA·IV</Text>
          </View>

          <View style={styles.mapArea}>
            {PLANET_ZONES.map((zone, idx) => {
              const zoneState = state.planetZones.find(z => z.id === zone.id);
              const isUnlocked = zoneState?.unlocked ?? false;
              const isSelected = selectedZone === zone.id;
              const onCooldown = Date.now() - (zoneState?.lastMined ?? 0) < 3000;

              const borderColor = isSelected
                ? colors.secondary
                : isUnlocked
                ? colors.primary
                : colors.border;

              const bgColor = isSelected
                ? colors.secondary + '22'
                : isUnlocked
                ? colors.primary + '12'
                : colors.muted;

              return (
                <View
                  key={zone.id}
                  style={{
                    position: 'absolute',
                    left: `${zone.x}%` as any,
                    top: `${zone.y}%` as any,
                  }}
                  pointerEvents="box-none"
                >
                  {isSelected && (
                    <View style={styles.pulseHost} pointerEvents="none">
                      <ScanPulse color={colors.secondary} size={36} rings={2} duration={1600} />
                    </View>
                  )}
                  <PressableScale
                    style={[
                      styles.zoneNode,
                      {
                        borderColor,
                        backgroundColor: bgColor,
                        borderStyle: isUnlocked ? 'solid' : 'dashed',
                      },
                    ]}
                    onPress={() => {
                      if (isUnlocked) {
                        setSelectedZone(isSelected ? null : zone.id);
                        Haptics.selectionAsync();
                      }
                    }}
                    disabled={!isUnlocked}
                    glow={isUnlocked}
                    glowColor={borderColor}
                    scaleTo={0.9}
                  >
                    <Text style={[styles.zoneNodeText, { color: isUnlocked ? borderColor : colors.mutedForeground }]}>
                      {isUnlocked ? (onCooldown ? '⏱' : `Z${idx + 1}`) : '🔒'}
                    </Text>
                  </PressableScale>
                </View>
              );
            })}

            <View style={styles.planetCore} pointerEvents="none">
              <PlanetIcon type="terran" size={56} glowColor={colors.primary} rotationDuration={56_000} />
            </View>
          </View>

          <View style={styles.legendRow}>
            <LegendItem color={colors.primary} label="UNLOCKED" />
            <LegendItem color={colors.secondary} label="SELECTED" />
            <LegendItem color={colors.border} label="LOCKED" dashed />
          </View>
        </View>

        {selectedZoneData && (
          <FadeSlideIn key={selectedZoneData.id} duration={320} offset={10}>
          <Animated.View
            style={[
              styles.zonePanel,
              { borderColor: colors.primary, backgroundColor: colors.card },
              { transform: [{ translateX: shakeAnim }, { scale: bounceAnim }] },
            ]}
          >
            <View style={styles.zonePanelHeader}>
              <View>
                <Text style={[styles.zonePanelTitle, { color: colors.primary, fontFamily: 'SpaceMono_700Bold' }]}>
                  {selectedZoneData.name.toUpperCase()}
                </Text>
                <Text style={[styles.zonePanelId, { color: colors.mutedForeground }]}>
                  ZONE · BASE YIELD {selectedZoneData.baseYield}
                </Text>
              </View>
              <PressableScale onPress={() => setSelectedZone(null)} scaleTo={0.85}>
                <Feather name="x" size={16} color={colors.mutedForeground} />
              </PressableScale>
            </View>

            <View style={[styles.separator, { backgroundColor: colors.border }]} />

            <Text style={[styles.panelSectionLabel, { color: colors.mutedForeground }]}>ELEMENT PAYLOAD</Text>
            <View style={styles.zoneElements}>
              {selectedZoneData.elements.map(elemId => {
                const elem = state.elements.find(e => e.id === elemId);
                if (!elem) return null;
                return (
                  <View key={elemId} style={[styles.elemPill, { borderColor: colors.border, backgroundColor: colors.muted }]}>
                    <Text style={[styles.elemPillSymbol, { color: colors.primary, fontFamily: 'SpaceMono_700Bold' }]}>
                      {elem.symbol}
                    </Text>
                    {elem.discovered && (
                      <Text style={[styles.elemPillQty, { color: colors.mutedForeground, fontFamily: 'SpaceMono_400Regular' }]}>
                        {elem.quantity}
                      </Text>
                    )}
                  </View>
                );
              })}
            </View>

            <Text style={[styles.panelSectionLabel, { color: colors.mutedForeground, marginTop: 4 }]}>
              EXTRACTION PROTOCOL
            </Text>
            <View style={styles.miningRow}>
              {MINING_TYPES.map(mt => (
                <PressableScale
                  key={mt.type}
                  style={[
                    styles.miningBtn,
                    {
                      borderColor: miningType === mt.type ? mt.color : colors.border,
                      backgroundColor: miningType === mt.type ? mt.color + '18' : colors.card,
                    },
                  ]}
                  onPress={() => { setMiningType(mt.type); Haptics.selectionAsync(); }}
                  glow={miningType === mt.type}
                  glowColor={mt.color}
                  scaleTo={0.95}
                >
                  <Feather name={mt.icon as any} size={13} color={miningType === mt.type ? mt.color : colors.mutedForeground} />
                  <Text style={[styles.miningBtnLabel, { color: miningType === mt.type ? mt.color : colors.mutedForeground }]}>
                    {mt.label}
                  </Text>
                  <Text style={[styles.miningBtnRisk, { color: miningType === mt.type ? mt.color : colors.mutedForeground }]}>
                    {mt.risk}
                  </Text>
                </PressableScale>
              ))}
            </View>

            <PressableScale
              style={[styles.initiateBtn, { backgroundColor: colors.primary, borderColor: colors.primary }]}
              onPress={handleMine}
              glow
              glowColor={colors.primary}
              scaleTo={0.97}
            >
              <Feather name="activity" size={16} color="#FFFFFF" />
              <Text style={[styles.initiateBtnText, { color: '#FFFFFF', fontFamily: 'SpaceMono_700Bold' }]}>
                INITIATE EXTRACTION
              </Text>
            </PressableScale>

            {result && (
              <FadeSlideIn duration={260} offset={6}>
              <View style={[
                styles.resultBanner,
                {
                  backgroundColor: result.success ? colors.secondary + '18' : colors.destructive + '18',
                  borderColor: result.success ? colors.secondary : colors.destructive,
                },
              ]}>
                <Feather
                  name={result.success ? 'check-circle' : 'alert-circle'}
                  size={13}
                  color={result.success ? colors.secondary : colors.destructive}
                />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.resultMsg, { color: result.success ? colors.secondary : colors.destructive }]}>
                    {result.success ? 'EXTRACTION SUCCESSFUL' : 'EXTRACTION FAILED'}
                  </Text>
                  {result.success && result.rewards && (
                    <Text style={[styles.resultRewards, { color: colors.foreground, fontFamily: 'SpaceMono_400Regular' }]}>
                      {Object.entries(result.rewards).map(([id, qty]) => `+${qty} ${id}`).join('  ')}
                    </Text>
                  )}
                </View>
              </View>
              </FadeSlideIn>
            )}
          </Animated.View>
          </FadeSlideIn>
        )}

        {!selectedZone && (
          <View style={[styles.noSelection, { borderColor: colors.border }]}>
            <Feather name="crosshair" size={28} color={colors.mutedForeground} />
            <Text style={[styles.noSelectionText, { color: colors.mutedForeground }]}>
              SELECT A ZONE ON THE SCHEMATIC TO BEGIN EXTRACTION
            </Text>
          </View>
        )}

        <View style={styles.codexSection}>
          <View style={styles.codexHeader}>
            <Text style={[styles.codexTitle, { color: colors.foreground }]}>ELEMENT CODEX</Text>
            <Text style={[styles.codexCount, { color: colors.primary, fontFamily: 'SpaceMono_700Bold' }]}>
              {discoveredCount}/{state.elements.length}
            </Text>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.codexScroll} contentContainerStyle={styles.codexContent}>
            {state.elements.map((elem, i) => {
              const rarityColor = getRarityColor(elem.rarity, colors);
              const isRare = elem.discovered && (elem.rarity === 'legendary' || elem.rarity === 'epic');
              const cell = (
                <View
                  style={[
                    styles.periodicCell,
                    {
                      borderColor: elem.discovered ? rarityColor : colors.border,
                      backgroundColor: elem.discovered ? rarityColor + '12' : colors.muted,
                      overflow: 'hidden',
                    },
                  ]}
                >
                  <Text style={[styles.atomicNum, { color: colors.mutedForeground, fontFamily: 'SpaceMono_400Regular' }]}>
                    {elem.atomicNumber}
                  </Text>
                  <Text style={[styles.elemSymbolLarge, { color: elem.discovered ? rarityColor : colors.border, fontFamily: 'SpaceMono_700Bold' }]}>
                    {elem.discovered ? elem.symbol : '??'}
                  </Text>
                  <Text style={[styles.elemNameSmall, { color: colors.mutedForeground }]}>
                    {elem.discovered ? elem.name.slice(0, 6).toUpperCase() : '??????'}
                  </Text>
                  {elem.discovered && (
                    <Text style={[styles.elemQtySmall, { color: colors.mutedForeground, fontFamily: 'SpaceMono_400Regular' }]}>
                      {elem.quantity > 999 ? `${Math.floor(elem.quantity / 1000)}K` : elem.quantity}
                    </Text>
                  )}
                  {isRare && <Shimmer color={rarityColor} duration={2800} intensity={0.22} />}
                </View>
              );
              return (
                <FadeSlideIn key={elem.id} delay={Math.min(i, 14) * 22} duration={320} offset={6}>
                  {isRare ? (
                    <GlowPulse color={rarityColor} duration={2600} min={0.1} max={0.45}>
                      {cell}
                    </GlowPulse>
                  ) : cell}
                </FadeSlideIn>
              );
            })}
          </ScrollView>
        </View>
      </ScrollView>
    </View>
  );
}

function LegendItem({ color, label, dashed }: { color: string; label: string; dashed?: boolean }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { borderColor: color, borderStyle: dashed ? 'dashed' : 'solid' }]} />
      <Text style={{ fontSize: 8, fontFamily: 'Inter_400Regular', color, letterSpacing: 0.5 }}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flex: 1 },
  content: { padding: 16, gap: 14 },

  pageHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pageTitle: { fontSize: 13, fontFamily: 'Inter_700Bold', letterSpacing: 2 },
  pageSubtitle: { fontSize: 10, fontFamily: 'Inter_400Regular', letterSpacing: 0.5, marginTop: 2 },
  statusTag: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderRadius: 4 },
  statusDot: { width: 5, height: 5, borderRadius: 3 },
  statusText: { fontSize: 9, fontFamily: 'Inter_700Bold', letterSpacing: 1 },

  schematicMap: { borderWidth: 1, borderRadius: 8, padding: 12, gap: 10 },
  mapHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  mapLabel: { fontSize: 9, fontFamily: 'Inter_700Bold', letterSpacing: 1.5 },
  mapCoords: { fontSize: 9, fontFamily: 'SpaceMono_400Regular' },
  mapArea: { height: 190, position: 'relative', overflow: 'hidden' },

  zoneNode: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -15,
    marginTop: -15,
  },
  pulseHost: {
    position: 'absolute',
    width: 36,
    height: 36,
    left: -18,
    top: -18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoneNodeText: { fontSize: 9, fontFamily: 'Inter_700Bold' },

  planetCore: {
    position: 'absolute', left: '50%', top: '50%',
    width: 56, height: 56, marginLeft: -28, marginTop: -28,
    alignItems: 'center', justifyContent: 'center',
  },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 10, height: 10, borderRadius: 5, borderWidth: 1.5 },

  zonePanel: { borderWidth: 1.5, borderRadius: 8, padding: 14, gap: 10 },
  zonePanelHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  zonePanelTitle: { fontSize: 13, letterSpacing: 1 },
  zonePanelId: { fontSize: 9, fontFamily: 'Inter_400Regular', marginTop: 2, letterSpacing: 0.5 },
  separator: { height: StyleSheet.hairlineWidth },
  panelSectionLabel: { fontSize: 8, fontFamily: 'Inter_700Bold', letterSpacing: 1.5 },
  zoneElements: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  elemPill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderRadius: 4 },
  elemPillSymbol: { fontSize: 13 },
  elemPillQty: { fontSize: 10 },

  miningRow: { flexDirection: 'row', gap: 6 },
  miningBtn: {
    flex: 1, alignItems: 'center', gap: 2,
    paddingVertical: 8, borderWidth: 1.5, borderRadius: 6,
  },
  miningBtnLabel: { fontSize: 9, fontFamily: 'Inter_700Bold', letterSpacing: 0.5 },
  miningBtnRisk: { fontSize: 8, fontFamily: 'Inter_400Regular' },

  initiateBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 13, borderRadius: 6, borderWidth: 1.5,
  },
  initiateBtnText: { fontSize: 12, letterSpacing: 1.5 },

  resultBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    padding: 10, borderWidth: 1, borderRadius: 6,
  },
  resultMsg: { fontSize: 11, fontFamily: 'Inter_700Bold', letterSpacing: 0.5 },
  resultRewards: { fontSize: 11, marginTop: 2 },

  noSelection: {
    borderWidth: 1, borderStyle: 'dashed', borderRadius: 8,
    padding: 28, alignItems: 'center', gap: 10,
  },
  noSelectionText: { fontSize: 10, fontFamily: 'Inter_700Bold', textAlign: 'center', letterSpacing: 1.5 },

  codexSection: { gap: 10 },
  codexHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  codexTitle: { fontSize: 11, fontFamily: 'Inter_700Bold', letterSpacing: 2 },
  codexCount: { fontSize: 11 },
  codexScroll: {},
  codexContent: { gap: 6, paddingVertical: 2 },
  periodicCell: {
    width: 64, alignItems: 'center', paddingVertical: 6, paddingHorizontal: 4,
    borderWidth: 1, borderRadius: 4, gap: 1,
  },
  atomicNum: { fontSize: 7, alignSelf: 'flex-end', marginRight: 2 },
  elemSymbolLarge: { fontSize: 18 },
  elemNameSmall: { fontSize: 6, fontFamily: 'Inter_400Regular', letterSpacing: 0.3, textAlign: 'center' },
  elemQtySmall: { fontSize: 8 },
});
