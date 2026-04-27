import React, { useEffect, useRef } from 'react';
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

  useEffect(() => {
    if (!visible || !resolution) {
      fade.setValue(0);
      slide.setValue(40);
      flash.setValue(0);
      critPulse.setValue(0);
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

    if (resolution.critical) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(critPulse, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
          Animated.timing(critPulse, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
        ])
      ).start();
    }

    if (!readOnly) {
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
  }, [visible, resolution]);

  if (!resolution) return null;

  const typeColor = TYPE_COLORS[resolution.eventType] ?? colors.primary;
  const typeIcon = TYPE_ICONS[resolution.eventType] ?? 'radio';
  const headlines = TYPE_HEADLINES[resolution.eventType] ?? TYPE_HEADLINES.random;
  const headline = resolution.netScore > 5
    ? headlines.positive
    : resolution.netScore < -5
    ? headlines.negative
    : headlines.neutral;
  const accent = resolution.critical ? '#FFD700' : typeColor;

  const resourceEntries = Object.entries(resolution.resourceChanges || {});

  const flashOpacity = flash.interpolate({ inputRange: [0, 1], outputRange: [0, 0.45] });
  const critGlow = critPulse.interpolate({ inputRange: [0, 1], outputRange: [0.25, 0.7] });

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

          <Text style={[styles.sectionLabel, { color: colors.mutedForeground, marginTop: 14 }]}>// AFTERMATH</Text>
          <Typewriter
            text={resolution.consequence}
            enabled={!readOnly}
            speed={14}
            startDelay={readOnly ? 0 : 280}
            style={[styles.consequence, { color: colors.foreground }]}
          />

          {(resourceEntries.length > 0 || resolution.reputationChange) && (
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

          {resourceEntries.length === 0 && !resolution.reputationChange && (
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
            <Feather name="check" size={14} color={accent} />
            <Text style={[styles.continueText, { color: accent }]}>
              {readOnly ? 'CLOSE LOG' : 'ACKNOWLEDGE'}
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
});
