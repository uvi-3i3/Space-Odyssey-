import React, { useEffect, useRef, useState } from 'react';
import {
  Modal, View, Text, StyleSheet, Animated, Easing, ScrollView, Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { Typewriter } from '@/components/Typewriter';
import { CountUpText } from '@/components/CountUpText';
import { PressableScale } from '@/components/PressableScale';
import { Shimmer } from '@/components/Shimmer';
import type { EventResolution } from '@/context/GameContext';

/**
 * Phase 3 — format an ms duration as "Xh Ym" / "Xm Ys" / "Xs". Used by the
 * "TRANSMISSION QUEUED" sub-view to count down to consequence resolution.
 */
function formatRemainingShort(ms: number): string {
  if (ms <= 0) return 'imminent';
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

const TYPE_COLORS: Record<string, string> = {
  random: '#FFB800', story: '#4DA8DA', discovery: '#3ECFB2', threat: '#E74C3C',
};

const TYPE_HEADLINES: Record<string, { positive: string; negative: string; neutral: string }> = {
  random: { positive: 'FORTUNE FAVORS YOU', negative: 'A COSTLY GAMBLE', neutral: 'OUTCOME LOGGED' },
  story: { positive: 'CHRONICLE ADVANCED', negative: 'THE STORY DARKENS', neutral: 'CHAPTER CLOSED' },
  discovery: { positive: 'BREAKTHROUGH', negative: 'EXPEDITION FAILED', neutral: 'DATA RECOVERED' },
  threat: { positive: 'THREAT NEUTRALIZED', negative: 'HEAVY LOSSES', neutral: 'STANDOFF RESOLVED' },
};

const TYPE_ICONS: Record<string, string> = {
  random: 'shuffle', story: 'book', discovery: 'search', threat: 'shield',
};

interface Props {
  visible: boolean;
  resolution: EventResolution | null;
  onClose: () => void;
  readOnly?: boolean;
}

export function EventOutcomeModal({ visible, resolution, onClose, readOnly = false }: Props) {
  const colors = useColors();
  const fade = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(40)).current;
  const flash = useRef(new Animated.Value(0)).current;
  const critPulse = useRef(new Animated.Value(0)).current;
  const pendingPulse = useRef(new Animated.Value(0)).current;

  // Phase 3 — drive the queued-view countdown. Re-renders once per second
  // while the pending modal is open; idle when the modal is closed or the
  // resolution has already landed.
  const [, forceTick] = useState(0);
  useEffect(() => {
    if (!visible || !resolution || !resolution.pending) return;
    const id = setInterval(() => forceTick(n => n + 1), 1000);
    return () => clearInterval(id);
  }, [visible, resolution]);

  useEffect(() => {
    if (!visible || !resolution) {
      fade.setValue(0);
      slide.setValue(40);
      flash.setValue(0);
      critPulse.setValue(0);
      pendingPulse.setValue(0);
      return;
    }
    Animated.parallel([
      Animated.timing(fade, {
        toValue: 1, duration: 280, easing: Easing.out(Easing.cubic), useNativeDriver: true,
      }),
      Animated.spring(slide, {
        toValue: 0, speed: 14, bounciness: 6, useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.timing(flash, { toValue: 1, duration: 240, useNativeDriver: false }),
        Animated.timing(flash, { toValue: 0, duration: 520, useNativeDriver: false }),
      ]),
    ]).start();

    if (resolution.critical && !resolution.pending) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(critPulse, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
          Animated.timing(critPulse, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
        ])
      ).start();
    }

    // Phase 3 — pending modals get a slow "transmitting" pulse on the
    // countdown badge. Fires regardless of critical roll because the
    // critical accent is hidden until Phase C.
    if (resolution.pending) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pendingPulse, { toValue: 1, duration: 1100, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
          Animated.timing(pendingPulse, { toValue: 0, duration: 1100, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
        ])
      ).start();
    }

    if (!readOnly) {
      // Phase 3 — pending choices get a soft "selection" tap (the player
      // hasn't earned a victory/loss yet — they've just committed). The
      // dramatic Success/Warning haptics fire when the report lands.
      if (resolution.pending) {
        Haptics.selectionAsync().catch(() => {});
      } else {
        const tone = resolution.netScore > 0
          ? Haptics.NotificationFeedbackType.Success
          : resolution.netScore < 0
          ? Haptics.NotificationFeedbackType.Warning
          : Haptics.NotificationFeedbackType.Success;
        Haptics.notificationAsync(tone).catch(() => {});
        if (resolution.critical) {
          setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {}), 220);
        }
      }
    }
  }, [visible, resolution]);

  if (!resolution) return null;

  const typeColor = TYPE_COLORS[resolution.eventType] ?? colors.primary;
  const typeIcon = TYPE_ICONS[resolution.eventType] ?? 'radio';
  const headlines = TYPE_HEADLINES[resolution.eventType] ?? TYPE_HEADLINES.random;
  const isPending = !!resolution.pending;
  const headline = isPending
    // Phase 3 — pending modals never reveal whether the choice was a win or
    // a loss. The narrative tension is the whole point of delaying the
    // consequences. Critical accents are also hidden until the report lands.
    ? 'TRANSMISSION QUEUED'
    : resolution.netScore > 5
    ? headlines.positive
    : resolution.netScore < -5
    ? headlines.negative
    : headlines.neutral;
  const accent = (!isPending && resolution.critical) ? '#FFD700' : typeColor;

  const resourceEntries = Object.entries(resolution.resourceChanges || {});

  const flashOpacity = flash.interpolate({ inputRange: [0, 1], outputRange: [0, 0.45] });
  const critGlow = critPulse.interpolate({ inputRange: [0, 1], outputRange: [0.25, 0.7] });
  const pendingGlow = pendingPulse.interpolate({ inputRange: [0, 1], outputRange: [0.25, 0.65] });

  // Phase 3 — countdown for the pending sub-view.
  const remainingMs = isPending && resolution.resolveAt ? Math.max(0, resolution.resolveAt - Date.now()) : 0;
  const totalDelayMs = isPending && resolution.resolveAt
    ? Math.max(1, resolution.resolveAt - resolution.timestamp)
    : 1;
  const elapsedRatio = isPending ? Math.min(1, 1 - remainingMs / totalDelayMs) : 0;
  const resolveAtLabel = isPending && resolution.resolveAt
    ? new Date(resolution.resolveAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '';

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Animated.View style={[styles.backdrop, { opacity: fade }]}>
        <Animated.View
          style={[
            styles.flashOverlay,
            { backgroundColor: accent, opacity: flashOpacity },
          ]}
          pointerEvents="none"
        />
        <Animated.View
          style={[
            styles.card,
            {
              backgroundColor: colors.card,
              borderColor: accent,
              transform: [{ translateY: slide }],
            },
            resolution.critical && Platform.OS !== 'web' ? {
              shadowColor: accent,
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: critGlow as any,
              shadowRadius: 22,
              elevation: 12,
            } : null,
          ]}
        >
          <View style={[styles.headerStripe, { backgroundColor: accent }]} />

          <View style={styles.headerRow}>
            <View style={[styles.typeBadge, { borderColor: typeColor, backgroundColor: typeColor + '22' }]}>
              <Feather name={typeIcon as any} size={10} color={typeColor} />
              <Text style={[styles.typeBadgeText, { color: typeColor }]}>
                {resolution.eventType.toUpperCase()}
              </Text>
            </View>
            {resolution.critical && (
              <View style={[styles.critBadge, { borderColor: accent, backgroundColor: accent + '22' }]}>
                <Shimmer color={accent} duration={1500} intensity={0.4} />
                <Feather name="zap" size={10} color={accent} />
                <Text style={[styles.critBadgeText, { color: accent }]}>CRITICAL</Text>
              </View>
            )}
          </View>

          <Text style={[styles.headline, { color: accent }]}>{headline}</Text>

          <Text style={[styles.eventTitle, { color: colors.foreground }]} numberOfLines={2}>
            {resolution.eventTitle}
          </Text>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>// YOUR DECISION</Text>
          <Text style={[styles.choiceText, { color: colors.foreground }]}>&gt; {resolution.choiceText}</Text>

          {isPending && (
            <>
              {/* Phase 3 — TRANSMISSION QUEUED sub-view. The aftermath text
                 stays sealed; we only confirm the lock-in and count down to
                 the resolveAt wallclock. */}
              <View style={[styles.divider, { backgroundColor: colors.border, marginTop: 14 }]} />
              <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>// STATUS</Text>
              <Text style={[styles.consequence, { color: colors.foreground, marginTop: 4 }]}>
                Choice locked in. Long-range consequences are still propagating across the system.
              </Text>

              <Animated.View
                style={[
                  styles.pendingBox,
                  {
                    borderColor: typeColor + '88',
                    backgroundColor: typeColor + '12',
                    shadowColor: typeColor,
                    shadowOpacity: Platform.OS !== 'web' ? (pendingGlow as any) : 0,
                    shadowOffset: { width: 0, height: 0 },
                    shadowRadius: 14,
                  },
                ]}
              >
                <View style={styles.pendingHeader}>
                  <Feather name="clock" size={14} color={typeColor} />
                  <Text style={[styles.pendingLabel, { color: typeColor }]}>REPORT INCOMING</Text>
                </View>
                <Text style={[styles.pendingCountdown, { color: colors.foreground }]}>
                  {formatRemainingShort(remainingMs)}
                </Text>
                <View style={[styles.pendingProgressTrack, { backgroundColor: colors.border }]}>
                  <View
                    style={[
                      styles.pendingProgressFill,
                      { backgroundColor: typeColor, width: `${Math.round(elapsedRatio * 100)}%` },
                    ]}
                  />
                </View>
                <Text style={[styles.pendingResolveAt, { color: colors.mutedForeground }]}>
                  Resolves at {resolveAtLabel} · check the Intel desk for the full report
                </Text>
              </Animated.View>
            </>
          )}

          {!isPending && (
            <>
              <Text style={[styles.sectionLabel, { color: colors.mutedForeground, marginTop: 14 }]}>// AFTERMATH</Text>
              <Typewriter
                text={resolution.consequence}
                enabled={!readOnly}
                speed={14}
                startDelay={readOnly ? 0 : 280}
                style={[styles.consequence, { color: colors.foreground }]}
              />
            </>
          )}

          {!isPending && (resourceEntries.length > 0 || resolution.reputationChange) && (
            <>
              <View style={[styles.divider, { backgroundColor: colors.border, marginTop: 14 }]} />
              <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>// LEDGER</Text>
              <ScrollView style={styles.ledger} contentContainerStyle={{ gap: 6 }}>
                {resourceEntries.map(([key, value], i) => {
                  const positive = value > 0;
                  const c = positive ? colors.secondary : colors.destructive;
                  const icon = positive ? 'arrow-up-right' : 'arrow-down-right';
                  return (
                    <View
                      key={key}
                      style={[
                        styles.ledgerRow,
                        { borderColor: c + '44', backgroundColor: c + '0E' },
                      ]}
                    >
                      <Feather name={icon as any} size={12} color={c} />
                      <Text style={[styles.ledgerKey, { color: colors.foreground }]}>
                        {key === 'credits' ? 'CREDITS' : key.toUpperCase()}
                      </Text>
                      <CountUpText
                        to={value}
                        duration={650}
                        startDelay={readOnly ? 0 : 380 + i * 90}
                        signed
                        style={[styles.ledgerVal, { color: c, fontFamily: 'SpaceMono_700Bold' }]}
                      />
                    </View>
                  );
                })}
                {resolution.reputationChange ? (
                  <View
                    style={[
                      styles.ledgerRow,
                      {
                        borderColor: (resolution.reputationChange > 0 ? colors.secondary : colors.destructive) + '44',
                        backgroundColor: (resolution.reputationChange > 0 ? colors.secondary : colors.destructive) + '0E',
                      },
                    ]}
                  >
                    <Feather
                      name={resolution.reputationChange > 0 ? 'trending-up' : 'trending-down'}
                      size={12}
                      color={resolution.reputationChange > 0 ? colors.secondary : colors.destructive}
                    />
                    <Text style={[styles.ledgerKey, { color: colors.foreground }]}>FACTION REPUTATION</Text>
                    <CountUpText
                      to={resolution.reputationChange}
                      duration={650}
                      startDelay={readOnly ? 0 : 380 + resourceEntries.length * 90}
                      signed
                      style={[
                        styles.ledgerVal,
                        {
                          color: resolution.reputationChange > 0 ? colors.secondary : colors.destructive,
                          fontFamily: 'SpaceMono_700Bold',
                        },
                      ]}
                    />
                  </View>
                ) : null}
              </ScrollView>
            </>
          )}

          {!isPending && resourceEntries.length === 0 && !resolution.reputationChange && (
            <Text style={[styles.noLedger, { color: colors.mutedForeground }]}>
              No material change. The galaxy moves on.
            </Text>
          )}

          <PressableScale
            style={[styles.continueBtn, { borderColor: accent, backgroundColor: accent + '14' }]}
            onPress={() => { Haptics.selectionAsync().catch(() => {}); onClose(); }}
            glow
            glowColor={accent}
            scaleTo={0.96}
          >
            <Feather name={isPending ? 'arrow-left' : 'check'} size={14} color={accent} />
            <Text style={[styles.continueText, { color: accent }]}>
              {isPending ? 'RETURN TO COMMAND' : (readOnly ? 'CLOSE LOG' : 'ACKNOWLEDGE')}
            </Text>
          </PressableScale>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1, backgroundColor: 'rgba(5, 12, 22, 0.85)',
    alignItems: 'center', justifyContent: 'center', padding: 18,
  },
  flashOverlay: { ...StyleSheet.absoluteFillObject },
  card: {
    width: '100%', maxWidth: 420, borderWidth: 1, borderRadius: 10,
    padding: 18, gap: 6, overflow: 'hidden',
  },
  headerStripe: {
    position: 'absolute', top: 0, left: 0, right: 0, height: 3,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  typeBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 7, paddingVertical: 3, borderRadius: 4, borderWidth: 1,
  },
  typeBadgeText: { fontSize: 9, fontFamily: 'SpaceMono_700Bold', letterSpacing: 1 },
  critBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 7, paddingVertical: 3, borderRadius: 4, borderWidth: 1,
    overflow: 'hidden',
  },
  critBadgeText: { fontSize: 9, fontFamily: 'SpaceMono_700Bold', letterSpacing: 1 },
  headline: {
    fontSize: 18, fontFamily: 'Inter_700Bold', letterSpacing: 1.2, marginTop: 8,
  },
  eventTitle: { fontSize: 13, fontFamily: 'Inter_400Regular', opacity: 0.85, marginTop: 2 },
  divider: { height: 1, marginVertical: 12, opacity: 0.5 },
  sectionLabel: { fontSize: 9, fontFamily: 'SpaceMono_700Bold', letterSpacing: 1.5, marginBottom: 4 },
  choiceText: { fontSize: 13, fontFamily: 'SpaceMono_400Regular', lineHeight: 19 },
  consequence: { fontSize: 13, fontFamily: 'Inter_400Regular', lineHeight: 20 },
  ledger: { maxHeight: 180, marginTop: 6 },
  ledgerRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 10, paddingVertical: 8, borderWidth: 1, borderRadius: 6,
  },
  ledgerKey: { flex: 1, fontSize: 11, fontFamily: 'SpaceMono_700Bold', letterSpacing: 1 },
  ledgerVal: { fontSize: 13 },
  noLedger: {
    fontSize: 11, fontStyle: 'italic', textAlign: 'center', marginTop: 10,
  },
  continueBtn: {
    marginTop: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 12, borderRadius: 6, borderWidth: 1,
  },
  continueText: { fontSize: 12, fontFamily: 'SpaceMono_700Bold', letterSpacing: 1.5 },
  // Phase 3 — TRANSMISSION QUEUED sub-view styles.
  pendingBox: {
    marginTop: 14, padding: 14, borderRadius: 8, borderWidth: 1, gap: 8,
  },
  pendingHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  pendingLabel: { fontSize: 10, fontFamily: 'SpaceMono_700Bold', letterSpacing: 1.5 },
  pendingCountdown: {
    fontSize: 28, fontFamily: 'SpaceMono_700Bold', letterSpacing: 2, textAlign: 'left',
  },
  pendingProgressTrack: {
    height: 4, borderRadius: 2, overflow: 'hidden',
  },
  pendingProgressFill: {
    height: '100%', borderRadius: 2,
  },
  pendingResolveAt: {
    fontSize: 10, fontFamily: 'SpaceMono_400Regular', letterSpacing: 0.5, marginTop: 2,
  },
});
