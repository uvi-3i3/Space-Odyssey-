import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';

/**
 * Phase 6 — HUD Energy bar.
 * Amber fill against a dark track. Width scales with energy/maxEnergy.
 * Pulses faintly when low so the player notices their stamina draining.
 */
export function EnergyBar({
  energy,
  maxEnergy,
  compact = false,
}: {
  energy: number;
  maxEnergy: number;
  compact?: boolean;
}) {
  const colors = useColors();
  const ratio = Math.max(0, Math.min(1, energy / Math.max(1, maxEnergy)));
  const low = ratio < 0.2;
  const fillColor = low ? colors.destructive : '#FFB800';
  const widthPct = `${ratio * 100}%`;

  return (
    <View style={styles.wrap}>
      <Feather name="zap" size={11} color={fillColor} />
      <View style={[styles.track, { backgroundColor: colors.muted, borderColor: colors.border }]}>
        <View
          style={[
            styles.fill,
            { backgroundColor: fillColor, width: widthPct as any, opacity: low ? 0.85 : 1 },
          ]}
        />
      </View>
      {!compact && (
        <Text style={[styles.value, { color: fillColor, fontFamily: 'SpaceMono_700Bold' }]}>
          {Math.floor(energy)}/{maxEnergy}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flex: 1,
    minWidth: 80,
  },
  track: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    borderWidth: 1,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 2,
  },
  value: {
    fontSize: 9,
    letterSpacing: 0.5,
    minWidth: 38,
    textAlign: 'right',
  },
});
