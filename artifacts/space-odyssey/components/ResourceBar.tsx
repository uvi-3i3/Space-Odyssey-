import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useGame } from '@/context/GameContext';
import { useColors } from '@/hooks/useColors';
import { StabilityTier, STORAGE_PULSE_RATIO } from '@/constants/gameData';
import { EnergyBar } from '@/components/EnergyBar';
import { GlowPulse } from '@/components/GlowPulse';

// Phase 4 — single source of truth for stability tier visuals.
function stabilityVisual(tier: StabilityTier, colors: any) {
  switch (tier) {
    case 'high':     return { color: colors.secondary, label: 'STABLE' };
    case 'medium':   return { color: colors.warning ?? '#FFB800', label: 'STRAINED' };
    case 'low':      return { color: colors.destructive, label: 'UNSTABLE' };
    case 'critical': return { color: colors.destructive, label: 'CRITICAL' };
  }
}

/** Format a credit count as a tight K-string above 1000. */
function formatCredits(n: number): string {
  if (n < 1000) return Math.floor(n).toString();
  if (n < 10000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  return Math.floor(n / 1000) + 'K';
}

/**
 * Phase 6 — restructured HUD.
 *
 * Top row: Era + Planet name + Stability badge + Prestige.
 * Stat row: Credits | Energy bar | Crew (pop/max) | Storage % | Stability mini.
 *
 * Storage % pulses amber when at/over the 90% threshold and turns red at 100%
 * so the player feels the vault filling up before mining gets locked out.
 */
export function ResourceBar() {
  const { state, stabilityTier, storageFillRatio } = useGame();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const stab = stabilityVisual(stabilityTier, colors);

  const eraNames = ['', 'STONE AGE', 'BRONZE AGE', 'INDUSTRIAL', 'ATOMIC'];

  const storagePct = Math.min(100, Math.round(storageFillRatio * 100));
  const storageWarn = storageFillRatio >= STORAGE_PULSE_RATIO;
  const storageFull = storageFillRatio >= 1;
  const storageColor = storageFull ? colors.destructive
    : storageWarn ? (colors.warning ?? '#FFB800')
    : colors.foreground;

  const planetLabel = state.planetName ? state.planetName.toUpperCase() : 'UNCHARTED';

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
          <Text style={[styles.eraName, { color: colors.mutedForeground }]} numberOfLines={1}>
            {eraNames[state.era] ?? 'ADVANCED'} · {planetLabel}
          </Text>
        </View>
        <View style={styles.bannerRight}>
          <View style={[styles.stabilityTag, { borderColor: stab.color, backgroundColor: stab.color + '20' }]}>
            <Feather name="activity" size={10} color={stab.color} />
            <Text style={[styles.stabilityValue, { color: stab.color, fontFamily: 'SpaceMono_700Bold' }]}>
              {Math.round(state.stability)}%
            </Text>
            <Text style={[styles.stabilityLabel, { color: stab.color }]}>{stab.label}</Text>
          </View>
          {state.prestigeLevel > 0 && (
            <View style={[styles.prestigeTag, { borderColor: colors.legendary, backgroundColor: colors.legendary + '18' }]}>
              <Feather name="repeat" size={9} color={colors.legendary} />
              <Text style={[styles.prestigeText, { color: colors.legendary }]}>P{state.prestigeLevel}</Text>
            </View>
          )}
        </View>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.creditsCell}>
          <Feather name="credit-card" size={10} color={colors.primary} />
          <Text style={[styles.statValue, { color: colors.foreground, fontFamily: 'SpaceMono_700Bold' }]}>
            {formatCredits(state.credits)}
          </Text>
        </View>
        <View style={[styles.divider, { backgroundColor: colors.border }]} />

        {/* Phase 6 — Energy bar inline in the HUD; the most-used new metric. */}
        <View style={styles.energyCell}>
          <EnergyBar energy={state.energy} maxEnergy={state.maxEnergy} compact />
          <Text style={[styles.miniValue, { color: colors.foreground, fontFamily: 'SpaceMono_700Bold' }]}>
            {Math.floor(state.energy)}/{state.maxEnergy}
          </Text>
        </View>
        <View style={[styles.divider, { backgroundColor: colors.border }]} />

        <View style={styles.smallCell}>
          <Feather name="users" size={10} color={colors.secondary} />
          <Text style={[styles.statValue, { color: colors.foreground, fontFamily: 'SpaceMono_700Bold' }]}>
            {state.population}/{state.maxPopulation}
          </Text>
        </View>
        <View style={[styles.divider, { backgroundColor: colors.border }]} />

        {/* Phase 6 — Storage % with amber pulse near full / red at full. */}
        {storageWarn ? (
          <GlowPulse color={storageColor} duration={1200} min={0.2} max={0.6}>
            <View style={styles.smallCell}>
              <Feather name="database" size={10} color={storageColor} />
              <Text style={[styles.statValue, { color: storageColor, fontFamily: 'SpaceMono_700Bold' }]}>
                {storagePct}%
              </Text>
            </View>
          </GlowPulse>
        ) : (
          <View style={styles.smallCell}>
            <Feather name="database" size={10} color={colors.mutedForeground} />
            <Text style={[styles.statValue, { color: colors.foreground, fontFamily: 'SpaceMono_700Bold' }]}>
              {storagePct}%
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderBottomWidth: 1.5,
    paddingBottom: 8,
    paddingHorizontal: 14,
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
    flex: 1,
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
    flex: 1,
  },
  bannerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  stabilityTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1.5,
    borderRadius: 4,
  },
  stabilityValue: {
    fontSize: 11,
    letterSpacing: 0.5,
  },
  stabilityLabel: {
    fontSize: 8,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 1,
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
    gap: 4,
    paddingTop: 2,
  },
  creditsCell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
  },
  energyCell: {
    flex: 1.4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 4,
  },
  smallCell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
  },
  statValue: {
    fontSize: 12,
  },
  miniValue: {
    fontSize: 9,
    minWidth: 38,
    textAlign: 'right',
  },
  divider: {
    width: 1,
    height: 18,
  },
});
