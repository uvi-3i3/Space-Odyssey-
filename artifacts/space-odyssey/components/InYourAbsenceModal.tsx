import React from 'react';
import { Modal, View, Text, StyleSheet, ScrollView } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useGame } from '@/context/GameContext';
import { useColors } from '@/hooks/useColors';
import { PressableScale } from '@/components/PressableScale';
import { Starfield } from '@/components/Starfield';

/**
 * Phase 6 — "In Your Absence" return narrative.
 *
 * Shown once per session (on app load) when the player has been gone for >4
 * hours. The body text is built deterministically in `GameContext.loadGame`
 * so we always have grounded numbers + crew names, never raw deltas.
 */
export function InYourAbsenceModal() {
  const { state, dismissReturnEvent } = useGame();
  const colors = useColors();
  const visible = !!state.lastReturnEvent;
  const planetName = state.planetName || 'the colony';

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={dismissReturnEvent}
    >
      <View style={[styles.backdrop, { backgroundColor: colors.background + 'EE' }]}>
        <Starfield count={45} opacity={0.4} />
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.primary }]}>
          <View style={styles.headerRow}>
            <Feather name="clock" size={14} color={colors.primary} />
            <Text style={[styles.eyebrow, { color: colors.primary }]}>IN YOUR ABSENCE</Text>
          </View>
          <Text style={[styles.title, { color: colors.foreground }]}>
            {planetName.toUpperCase()} — STATUS REPORT
          </Text>

          <ScrollView style={styles.bodyScroll} contentContainerStyle={styles.bodyContent}>
            <Text style={[styles.body, { color: colors.foreground }]}>
              {state.lastReturnEvent}
            </Text>
          </ScrollView>

          <PressableScale
            style={[styles.dismissBtn, { backgroundColor: colors.primary, borderColor: colors.primary }]}
            onPress={dismissReturnEvent}
            glow
            glowColor={colors.primary}
            scaleTo={0.97}
          >
            <Feather name="check" size={14} color="#FFFFFF" />
            <Text style={[styles.dismissText, { color: '#FFFFFF' }]}>RESUME COMMAND</Text>
          </PressableScale>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 440,
    borderWidth: 1.5,
    borderRadius: 10,
    padding: 18,
    gap: 12,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  eyebrow: { fontSize: 10, fontFamily: 'Inter_700Bold', letterSpacing: 2 },
  title: { fontSize: 14, fontFamily: 'Inter_700Bold', letterSpacing: 1 },
  bodyScroll: { maxHeight: 320 },
  bodyContent: { paddingVertical: 4 },
  body: {
    fontSize: 13,
    lineHeight: 20,
    fontFamily: 'Inter_400Regular',
  },
  dismissBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderWidth: 1,
    borderRadius: 6,
    marginTop: 4,
  },
  dismissText: { fontSize: 11, fontFamily: 'Inter_700Bold', letterSpacing: 1.5 },
});
