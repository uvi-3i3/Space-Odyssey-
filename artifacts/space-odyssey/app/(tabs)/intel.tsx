import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform, Animated,
  Modal, Alert,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useGame, CombatEntry, EventResolution } from '@/context/GameContext';
import { useColors } from '@/hooks/useColors';
import { BlueprintGrid } from '@/components/BlueprintGrid';
import { Starfield } from '@/components/Starfield';
import { ProgressBar } from '@/components/ProgressBar';
import { RarityBadge } from '@/components/RarityBadge';
import { PressableScale } from '@/components/PressableScale';
import { FadeSlideIn } from '@/components/FadeSlideIn';
import { Typewriter } from '@/components/Typewriter';
import { GlowPulse } from '@/components/GlowPulse';
import { EventOutcomeModal } from '@/components/EventOutcomeModal';

type IntelSection = 'events' | 'combat' | 'factions';
type CombatStrategy = 'attack' | 'defend' | 'retreat';
type EspionageMission = 'scan' | 'spy' | 'disrupt' | 'fake';

const EVENT_TYPE_COLORS: Record<string, string> = {
  random: '#FFB800', story: '#4DA8DA', discovery: '#3ECFB2', threat: '#E74C3C',
};
const EVENT_TYPE_ICONS: Record<string, string> = {
  random: 'shuffle', story: 'book', discovery: 'search', threat: 'alert-triangle',
};

const STRATEGIES: { type: CombatStrategy; label: string; icon: string; color: string; desc: string }[] = [
  { type: 'attack', label: 'ALL-OUT ATTACK', icon: 'zap', color: '#E74C3C', desc: '+30% power, higher risk' },
  { type: 'defend', label: 'DEFENSIVE', icon: 'shield', color: '#4DA8DA', desc: 'Balanced approach' },
  { type: 'retreat', label: 'ABORT MISSION', icon: 'log-out', color: '#FFB800', desc: 'No casualties, no gain' },
];

const MISSIONS: { type: EspionageMission; label: string; icon: string; color: string; rate: number; desc: string }[] = [
  { type: 'scan', label: 'SCAN BASE', icon: 'eye', color: '#4DA8DA', rate: 90, desc: 'Intel recon sweep' },
  { type: 'spy', label: 'PLANT AGENT', icon: 'user-check', color: '#3ECFB2', rate: 60, desc: 'Embed operative' },
  { type: 'disrupt', label: 'DISRUPT OPS', icon: 'zap-off', color: '#FFB800', rate: 50, desc: 'Sabotage production' },
  { type: 'fake', label: 'FALSE SIGNAL', icon: 'radio', color: '#9B59B6', rate: 70, desc: 'Disinformation op' },
];

const DAY_REWARDS = [
  { day: 1, rewards: 'CREDITS +50 · Fe +20' },
  { day: 2, rewards: 'CREDITS +100 · Fe +40' },
  { day: 3, rewards: 'CREDITS +150 · Fe +60' },
  { day: 4, rewards: 'CREDITS +200 · Fe +80' },
  { day: 5, rewards: 'CREDITS +250 · Fe +100' },
  { day: 6, rewards: 'CREDITS +300 · Fe +120' },
  { day: 7, rewards: 'PRESTIGE TOKEN +1 · CREDITS +500' },
];

export default function IntelScreen() {
  const {
    state, resolveEvent, generateEvent, generatingEvent,
    engageCombat, runEspionage, recruitUnits, getElementQuantity,
    claimDailyReward, performPrestige, getFactionRelationship,
    getCombatCooldownRemaining, formatCooldown,
    dismissResolvedReport, getPendingReportRemaining,
    recruitmentOffers, recruitCrew,
  } = useGame();
  const colors = useColors();
  const [section, setSection] = useState<IntelSection>('events');
  const [selectedFaction, setSelectedFaction] = useState<string | null>(null);
  const [strategy, setStrategy] = useState<CombatStrategy>('attack');
  const [lastCombat, setLastCombat] = useState<CombatEntry | null>(null);
  const [combatMode, setCombatMode] = useState<'combat' | 'espionage' | 'fleet'>('combat');
  const [showAwards, setShowAwards] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [claimMsg, setClaimMsg] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<EventResolution | null>(null);
  const [outcomeReadOnly, setOutcomeReadOnly] = useState(false);
  const [resolving, setResolving] = useState<{ eventId: string; choiceId: string; color: string } | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const suspenseAnim = useRef(new Animated.Value(0)).current;
  const paddingBottom = Platform.OS === 'web' ? 34 : 0;

  useEffect(() => {
    if (generatingEvent) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 0.35, duration: 700, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulseAnim.stopAnimation();
      pulseAnim.setValue(1);
    }
  }, [generatingEvent]);

  useEffect(() => {
    if (resolving) {
      suspenseAnim.setValue(0);
      Animated.timing(suspenseAnim, {
        toValue: 1, duration: 280, useNativeDriver: true,
      }).start();
    } else {
      suspenseAnim.setValue(0);
    }
  }, [resolving]);

  // Phase 3 — auto-popup the most-recently-resolved report. The tick / offline
  // catch-up sets `lastResolvedReport` whenever a queued consequence lands;
  // we surface it once with a heavy haptic, then clear it so it doesn't
  // re-fire on every render. The full ledger view runs (readOnly: false) so
  // the player gets the full count-up animation reveal.
  useEffect(() => {
    if (state.lastResolvedReport && !outcome) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
      setOutcomeReadOnly(false);
      setOutcome(state.lastResolvedReport);
      dismissResolvedReport();
    }
  }, [state.lastResolvedReport, outcome, dismissResolvedReport]);

  // Phase 3 — drive the Pending Reports countdown badges. Cheap re-render
  // every 30s; the displayed strings are formatted in the render body.
  const [, forcePendingTick] = useState(0);
  useEffect(() => {
    if (state.pendingReports.length === 0) return;
    const id = setInterval(() => forcePendingTick(n => n + 1), 30000);
    return () => clearInterval(id);
  }, [state.pendingReports.length]);

  // Phase 3 — short formatter for the inline badges ("3h 12m", "47s").
  const formatPendingShort = (ms: number): string => {
    if (ms <= 0) return 'imminent';
    const totalSec = Math.floor(ms / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m`;
    return `${s}s`;
  };

  const handleChoosePath = (eventId: string, choiceId: string, color: string) => {
    if (resolving) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
    setResolving({ eventId, choiceId, color });
    setTimeout(() => {
      const result = resolveEvent(eventId, choiceId);
      setResolving(null);
      if (result) {
        setOutcomeReadOnly(false);
        setOutcome(result);
      }
    }, 750);
  };

  const handleCombat = () => {
    if (!selectedFaction) return;
    // Phase 6 — cooldown + military gating happens inside engageCombat;
    // it returns a 'cooldown' or 'no-units' outcome we surface to the player.
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    const result = engageCombat(selectedFaction, strategy);
    setLastCombat(result);
  };

  // Phase 6 — total military strength across all unit rows. Used to gate
  // the "ENGAGE FLEET" button: you can't attack with zero units.
  const totalUnits = state.units.reduce((s, u) => s + u.count, 0);

  // Phase 6 — 5-pip trust meter mapped from -100..+100 reputation.
  // Bins: -100..-61 (0 lit), -60..-21 (1), -20..+20 (2), +21..+60 (3), +61..+100 (4),
  // capped to 5 only at 100.
  const trustPipsLit = (rep: number): number => {
    if (rep >= 100) return 5;
    if (rep >= 61) return 4;
    if (rep >= 21) return 3;
    if (rep >= -20) return 2;
    if (rep >= -60) return 1;
    return 0;
  };

  const TrustPips = ({ rep, color }: { rep: number; color: string }) => {
    const lit = trustPipsLit(rep);
    return (
      <View style={{ flexDirection: 'row', gap: 3 }}>
        {[0, 1, 2, 3, 4].map(i => (
          <View
            key={i}
            style={{
              width: 8, height: 8, borderRadius: 2,
              borderWidth: 1,
              borderColor: i < lit ? color : colors.border,
              backgroundColor: i < lit ? color : 'transparent',
            }}
          />
        ))}
      </View>
    );
  };

  const handleEspionage = (mission: EspionageMission) => {
    if (!selectedFaction) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    runEspionage(selectedFaction, mission);
  };

  const handleRecruit = (unitId: string) => {
    const result = recruitUnits(unitId, 5);
    if (result.success) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleClaimDaily = () => {
    const result = claimDailyReward();
    if (result.success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setClaimMsg(`DAY ${Math.min(state.loginStreak, 7)} REWARD CLAIMED`);
    } else {
      setClaimMsg('ALREADY CLAIMED — RETURN TOMORROW');
    }
    setTimeout(() => setClaimMsg(null), 3000);
  };

  const handlePrestige = () => {
    Alert.alert(
      'PRESTIGE RESET',
      `Reset civilization for a permanent +${(state.prestigeLevel + 1) * 10}% resource bonus?\n\nAll buildings, tech, and elements will be lost.`,
      [
        { text: 'ABORT', style: 'cancel' },
        {
          text: 'CONFIRM PRESTIGE',
          style: 'destructive',
          onPress: () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            performPrestige();
          },
        },
      ]
    );
  };

  const getRelColor = (rel: string) => {
    if (rel === 'allied') return colors.secondary;
    if (rel === 'friendly') return colors.primary;
    if (rel === 'hostile') return colors.destructive;
    return colors.warning;
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <BlueprintGrid />
      <Starfield count={45} opacity={0.5} />

      <View style={styles.topBar}>
        <View style={styles.pillRow}>
          {(['events', 'combat', 'factions'] as IntelSection[]).map(s => (
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
                name={s === 'events' ? 'radio' : s === 'combat' ? 'crosshair' : 'users'}
                size={11}
                color={section === s ? '#FFFFFF' : colors.mutedForeground}
              />
              <Text style={[styles.pillText, { color: section === s ? '#FFFFFF' : colors.mutedForeground }]}>
                {s.toUpperCase()}
              </Text>
            </PressableScale>
          ))}
        </View>

        <View style={styles.pillActions}>
          <PressableScale
            style={[styles.iconAction, { borderColor: colors.border }]}
            onPress={() => setShowAwards(true)}
            scaleTo={0.88}
          >
            <Feather name="award" size={15} color={colors.primary} />
          </PressableScale>
          <PressableScale
            style={[styles.iconAction, { borderColor: colors.border }]}
            onPress={() => setShowSettings(true)}
            scaleTo={0.88}
          >
            <Feather name="settings" size={15} color={colors.mutedForeground} />
          </PressableScale>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: 100 + paddingBottom }]}
        showsVerticalScrollIndicator={false}
      >
        {section === 'events' && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>SIGNAL INTERCEPTS</Text>
              <View style={[styles.aiBadge, { borderColor: colors.secondary, backgroundColor: colors.secondary + '14' }]}>
                <Feather name="radio" size={9} color={colors.secondary} />
                <Text style={[styles.aiBadgeText, { color: colors.secondary }]}>LIVE FEED</Text>
              </View>
            </View>

            {generatingEvent && (
              <Animated.View style={[styles.generatingCard, { borderColor: colors.primary, backgroundColor: colors.card, opacity: pulseAnim }]}>
                <Feather name="radio" size={18} color={colors.primary} />
                <View style={{ flex: 1, gap: 3 }}>
                  <Text style={[styles.generatingTitle, { color: colors.primary }]}>TUNING ARRAY...</Text>
                  <Text style={[styles.generatingDesc, { color: colors.mutedForeground }]}>
                    Locking onto the next deep-space transmission for your civilization.
                  </Text>
                </View>
              </Animated.View>
            )}

            {state.activeEvents.length === 0 && !generatingEvent && (
              <View style={[styles.emptyState, { borderColor: colors.border }]}>
                <Feather name="radio" size={32} color={colors.mutedForeground} />
                <Text style={[styles.emptyTitle, { color: colors.mutedForeground }]}>NO SIGNALS ACQUIRED</Text>
                <Text style={[styles.emptyDesc, { color: colors.mutedForeground }]}>
                  Tune the long-range array to receive the next chapter of your campaign and choose your colony's path.
                </Text>
                <PressableScale
                  style={[styles.scanBtn, { borderColor: colors.primary, backgroundColor: colors.primary + '14' }]}
                  onPress={() => { generateEvent(); Haptics.selectionAsync(); }}
                  glow
                  glowColor={colors.primary}
                  scaleTo={0.96}
                >
                  <Feather name="zap" size={13} color={colors.primary} />
                  <Text style={[styles.scanBtnText, { color: colors.primary }]}>TUNE ARRAY</Text>
                </PressableScale>
              </View>
            )}

            {state.activeEvents.length > 0 && !generatingEvent && (
              <PressableScale
                style={[styles.scanAgain, { borderColor: colors.primary + '55' }]}
                onPress={() => { generateEvent(); Haptics.selectionAsync(); }}
                scaleTo={0.97}
              >
                <Feather name="zap" size={11} color={colors.primary} />
                <Text style={[styles.scanAgainText, { color: colors.primary }]}>TUNE FOR MORE SIGNALS</Text>
              </PressableScale>
            )}

            {state.activeEvents.map((event, eventIdx) => {
              const typeColor = EVENT_TYPE_COLORS[event.type] ?? colors.primary;
              const typeIcon = EVENT_TYPE_ICONS[event.type] ?? 'radio';
              // Phase 5 — every active event is now sourced from the
              // pre-generated story tree (id prefix `story_`). Run them
              // through the typewriter for a dramatic title reveal.
              const isStoryEvent = String(event.id).startsWith('story_');

              return (
                <FadeSlideIn key={event.id} delay={eventIdx * 60} duration={420} offset={14}>
                <View
                  style={[styles.eventCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                >
                  <View style={[styles.eventLeftBorder, { backgroundColor: typeColor }]} />
                  <View style={styles.eventBody}>
                    <View style={styles.eventMeta}>
                      <View style={[styles.typeTag, { borderColor: typeColor, backgroundColor: typeColor + '18' }]}>
                        <Feather name={typeIcon as any} size={9} color={typeColor} />
                        <Text style={[styles.typeTagText, { color: typeColor }]}>{event.type.toUpperCase()}</Text>
                      </View>
                      <Text style={[styles.eventTime, { color: colors.mutedForeground, fontFamily: 'SpaceMono_400Regular' }]}>
                        {new Date(event.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </Text>
                    </View>

                    <Typewriter
                      text={event.title}
                      enabled={isStoryEvent}
                      speed={14}
                      style={[styles.eventTitle, { color: colors.foreground }]}
                    />
                    <Text style={[styles.eventDesc, { color: colors.mutedForeground }]}>{event.description}</Text>

                    <Text style={[styles.choiceLabel, { color: typeColor }]}>// SELECT RESPONSE:</Text>

                    {event.choices.map((choice, idx) => {
                      const isLockedIn = resolving?.eventId === event.id && resolving.choiceId === choice.id;
                      const isFading = !!resolving && resolving.eventId === event.id && resolving.choiceId !== choice.id;
                      return (
                      <FadeSlideIn key={choice.id} delay={120 + idx * 40} duration={300} offset={6}>
                      <PressableScale
                        style={[
                          styles.choiceBtn,
                          {
                            borderColor: isLockedIn ? typeColor : typeColor + '55',
                            backgroundColor: isLockedIn ? typeColor + '22' : typeColor + '0C',
                            opacity: isFading ? 0.35 : 1,
                          },
                        ]}
                        onPress={() => handleChoosePath(event.id, choice.id, typeColor)}
                        glow={isLockedIn || !resolving}
                        glowColor={typeColor}
                        scaleTo={0.98}
                        disabled={!!resolving}
                      >
                        <View style={[styles.choiceNum, { borderColor: typeColor, backgroundColor: typeColor + '22' }]}>
                          {isLockedIn ? (
                            <Feather name="check" size={11} color={typeColor} />
                          ) : (
                            <Text style={[styles.choiceNumText, { color: typeColor, fontFamily: 'SpaceMono_700Bold' }]}>{idx + 1}</Text>
                          )}
                        </View>
                        <View style={{ flex: 1, gap: 3 }}>
                          <Text style={[styles.choiceText, { color: colors.foreground }]}>{choice.text}</Text>
                          <View style={styles.choiceHints}>
                            {choice.resourceChanges && Object.entries(choice.resourceChanges).slice(0, 3).map(([k, v]) => (
                              <Text key={k} style={[styles.choiceHint, { color: v > 0 ? colors.secondary : colors.destructive, fontFamily: 'SpaceMono_400Regular' }]}>
                                {v > 0 ? '+' : ''}{v} {k}
                              </Text>
                            ))}
                            {choice.reputationChange && (
                              <Text style={[styles.choiceHint, { color: choice.reputationChange > 0 ? colors.secondary : colors.destructive, fontFamily: 'SpaceMono_400Regular' }]}>
                                REP {choice.reputationChange > 0 ? '+' : ''}{choice.reputationChange}
                              </Text>
                            )}
                          </View>
                        </View>
                        <Feather name={isLockedIn ? 'loader' : 'chevron-right'} size={14} color={typeColor} />
                      </PressableScale>
                      </FadeSlideIn>
                      );
                    })}
                  </View>
                </View>
                </FadeSlideIn>
              );
            })}

            {state.pendingReports.length > 0 && (
              <View style={styles.completedSection}>
                {/* Phase 3 — Pending Reports queue. Each row shows the type
                   badge, original event title, the locked-in choice, and a
                   live countdown to when consequences land. Non-interactive
                   on purpose — the player committed; all that's left is to
                   wait for the report to arrive. */}
                <Text style={[styles.completedLabel, { color: colors.mutedForeground }]}>
                  PENDING REPORTS ({state.pendingReports.length})
                </Text>
                {state.pendingReports
                  .slice()
                  .sort((a, b) => a.resolveAt - b.resolveAt)
                  .map((report, i) => {
                    const c = EVENT_TYPE_COLORS[report.eventType] ?? colors.primary;
                    const ic = EVENT_TYPE_ICONS[report.eventType] ?? 'radio';
                    const remaining = getPendingReportRemaining(report.id);
                    const totalDelay = Math.max(1, report.resolveAt - report.decidedAt);
                    const elapsedRatio = Math.min(1, 1 - remaining / totalDelay);
                    const resolveLabel = new Date(report.resolveAt).toLocaleTimeString([], {
                      hour: '2-digit', minute: '2-digit',
                    });
                    return (
                      <FadeSlideIn key={report.id} delay={i * 40} duration={280} offset={6}>
                        <View
                          style={[
                            styles.pendingCard,
                            { borderColor: c + '66', backgroundColor: colors.card },
                          ]}
                        >
                          <View style={[styles.pendingStripe, { backgroundColor: c }]} />
                          <View style={{ flex: 1, gap: 5 }}>
                            <View style={styles.pendingHeaderRow}>
                              <View style={[styles.pendingTypeTag, { borderColor: c, backgroundColor: c + '18' }]}>
                                <Feather name={ic as any} size={9} color={c} />
                                <Text style={[styles.pendingTypeText, { color: c }]}>
                                  {report.eventType.toUpperCase()}
                                </Text>
                              </View>
                              <View style={[styles.pendingClockTag, { borderColor: c + '55', backgroundColor: c + '12' }]}>
                                <Feather name="clock" size={9} color={c} />
                                <Text style={[styles.pendingCountdownText, { color: c }]}>
                                  {formatPendingShort(remaining)}
                                </Text>
                              </View>
                            </View>
                            <Text style={[styles.pendingTitle, { color: colors.foreground }]} numberOfLines={1}>
                              {report.eventTitle}
                            </Text>
                            <Text style={[styles.pendingChoice, { color: colors.mutedForeground }]} numberOfLines={1}>
                              &gt; {report.choiceText}
                            </Text>
                            <View style={[styles.pendingTrack, { backgroundColor: colors.border }]}>
                              <View
                                style={[
                                  styles.pendingFill,
                                  { backgroundColor: c, width: `${Math.round(elapsedRatio * 100)}%` },
                                ]}
                              />
                            </View>
                            <Text style={[styles.pendingFooter, { color: colors.mutedForeground }]}>
                              Resolves at {resolveLabel}
                            </Text>
                          </View>
                        </View>
                      </FadeSlideIn>
                    );
                  })}
              </View>
            )}

            {state.eventLog.length > 0 && (
              <View style={styles.completedSection}>
                <Text style={[styles.completedLabel, { color: colors.mutedForeground }]}>
                  AFTERMATH LOG ({state.eventLog.length})
                </Text>
                {state.eventLog.slice(0, 6).map((entry, i) => {
                  const c = EVENT_TYPE_COLORS[entry.eventType] ?? colors.primary;
                  const accent = entry.critical ? '#FFD700' : c;
                  const tone = entry.netScore > 5
                    ? colors.secondary
                    : entry.netScore < -5
                    ? colors.destructive
                    : colors.mutedForeground;
                  return (
                    <FadeSlideIn key={entry.id} delay={i * 40} duration={280} offset={6}>
                      <PressableScale
                        style={[
                          styles.logRow,
                          {
                            borderColor: accent + '55',
                            backgroundColor: colors.card,
                          },
                        ]}
                        onPress={() => {
                          Haptics.selectionAsync().catch(() => {});
                          setOutcomeReadOnly(true);
                          setOutcome(entry);
                        }}
                        scaleTo={0.98}
                      >
                        <View style={[styles.logStripe, { backgroundColor: accent }]} />
                        <View style={{ flex: 1, gap: 3 }}>
                          <View style={styles.logHeader}>
                            <Text style={[styles.logType, { color: c }]}>
                              {entry.eventType.toUpperCase()}
                            </Text>
                            {entry.critical && (
                              <Text style={[styles.logCrit, { color: '#FFD700' }]}>CRITICAL</Text>
                            )}
                            <Text style={[styles.logTime, { color: colors.mutedForeground, fontFamily: 'SpaceMono_400Regular' }]}>
                              {new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </Text>
                          </View>
                          <Text style={[styles.logTitle, { color: colors.foreground }]} numberOfLines={1}>
                            {entry.eventTitle}
                          </Text>
                          <Text style={[styles.logChoice, { color: colors.mutedForeground }]} numberOfLines={1}>
                            &gt; {entry.choiceText}
                          </Text>
                          <View style={styles.logDeltas}>
                            {Object.entries(entry.resourceChanges).slice(0, 4).map(([k, v]) => (
                              <Text
                                key={k}
                                style={[
                                  styles.logDelta,
                                  {
                                    color: v > 0 ? colors.secondary : colors.destructive,
                                    fontFamily: 'SpaceMono_700Bold',
                                  },
                                ]}
                              >
                                {v > 0 ? '+' : ''}{v} {k === 'credits' ? 'CR' : k.toUpperCase()}
                              </Text>
                            ))}
                            {entry.reputationChange ? (
                              <Text style={[styles.logDelta, { color: entry.reputationChange > 0 ? colors.secondary : colors.destructive, fontFamily: 'SpaceMono_700Bold' }]}>
                                REP {entry.reputationChange > 0 ? '+' : ''}{entry.reputationChange}
                              </Text>
                            ) : null}
                          </View>
                        </View>
                        <Feather name="chevron-right" size={14} color={tone} />
                      </PressableScale>
                    </FadeSlideIn>
                  );
                })}
              </View>
            )}
          </>
        )}

        {section === 'combat' && (
          <>
            <View style={styles.combatSubTabs}>
              {(['combat', 'espionage', 'fleet'] as const).map(m => (
                <TouchableOpacity
                  key={m}
                  style={[
                    styles.subTab,
                    {
                      borderBottomColor: combatMode === m ? colors.secondary : 'transparent',
                    },
                  ]}
                  onPress={() => setCombatMode(m)}
                >
                  <Text style={[styles.subTabText, { color: combatMode === m ? colors.secondary : colors.mutedForeground }]}>
                    {m.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {(combatMode === 'combat' || combatMode === 'espionage') && (
              <>
                <Text style={[styles.sectionTitle, { color: colors.foreground, marginBottom: 4 }]}>
                  {combatMode === 'combat' ? 'SELECT TARGET FACTION' : 'SELECT OPERATION TARGET'}
                </Text>

                {state.factions.filter(f => f.discovered).length === 0 ? (
                  <View style={[styles.emptyState, { borderColor: colors.border }]}>
                    <Feather name="users" size={28} color={colors.mutedForeground} />
                    <Text style={[styles.emptyTitle, { color: colors.mutedForeground }]}>NO FACTIONS DISCOVERED</Text>
                    <Text style={[styles.emptyDesc, { color: colors.mutedForeground }]}>
                      Continue exploring to make first contact with alien civilizations.
                    </Text>
                  </View>
                ) : (
                  state.factions.filter(f => f.discovered).map((faction, fIdx) => {
                    const relationship = getFactionRelationship(faction.id);
                    const relColor = getRelColor(relationship);
                    const isSelected = selectedFaction === faction.id;
                    const repProgress = (faction.reputation + 100) / 200;

                    return (
                      <FadeSlideIn key={faction.id} delay={fIdx * 50} duration={320} offset={10}>
                      <PressableScale
                        style={[
                          styles.factionCard,
                          { borderColor: isSelected ? relColor : colors.border, backgroundColor: colors.card },
                        ]}
                        onPress={() => { setSelectedFaction(isSelected ? null : faction.id); Haptics.selectionAsync(); }}
                        glow={isSelected}
                        glowColor={relColor}
                        scaleTo={0.98}
                      >
                        <View style={styles.factionTop}>
                          {/* Phase 6 — hostile factions get a faint red pulse so
                              the threat is visible at a glance from the list. */}
                          {relationship === 'hostile' ? (
                            <GlowPulse color={relColor} duration={1400} min={0.15} max={0.55}>
                              <View style={[styles.factionIcon, { borderColor: relColor, backgroundColor: relColor + '20' }]}>
                                <Feather name="alert-triangle" size={16} color={relColor} />
                              </View>
                            </GlowPulse>
                          ) : (
                            <View style={[styles.factionIcon, { borderColor: relColor + '55', backgroundColor: relColor + '14' }]}>
                              <Feather name="users" size={16} color={relColor} />
                            </View>
                          )}
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.factionName, { color: colors.foreground }]}>{faction.name}</Text>
                            <Text style={[styles.factionDesc, { color: colors.mutedForeground }]}>{faction.description}</Text>
                          </View>
                          <View style={[styles.relBadge, { borderColor: relColor, backgroundColor: relColor + '14' }]}>
                            <Text style={[styles.relBadgeText, { color: relColor }]}>{relationship.toUpperCase()}</Text>
                          </View>
                        </View>
                        <View style={styles.repRow}>
                          <Text style={[styles.repLabel, { color: colors.mutedForeground, fontFamily: 'SpaceMono_400Regular' }]}>
                            TRUST  {faction.reputation > 0 ? '+' : ''}{faction.reputation}
                          </Text>
                          <TrustPips rep={faction.reputation} color={relColor} />
                        </View>
                      </PressableScale>
                      </FadeSlideIn>
                    );
                  })
                )}
              </>
            )}

            {combatMode === 'combat' && selectedFaction && (
              <FadeSlideIn key={`strat-${selectedFaction}`} duration={360} offset={12}>
                <Text style={[styles.sectionTitle, { color: colors.foreground, marginTop: 4 }]}>COMBAT STRATEGY</Text>
                {STRATEGIES.map((s, idx) => (
                  <FadeSlideIn key={s.type} delay={idx * 40} duration={280} offset={6}>
                  <PressableScale
                    style={[
                      styles.stratCard,
                      {
                        borderColor: strategy === s.type ? s.color : colors.border,
                        backgroundColor: strategy === s.type ? s.color + '14' : colors.card,
                      },
                    ]}
                    onPress={() => { setStrategy(s.type); Haptics.selectionAsync(); }}
                    glow={strategy === s.type}
                    glowColor={s.color}
                    scaleTo={0.97}
                  >
                    <Feather name={s.icon as any} size={18} color={strategy === s.type ? s.color : colors.mutedForeground} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.stratName, { color: strategy === s.type ? s.color : colors.foreground }]}>{s.label}</Text>
                      <Text style={[styles.stratDesc, { color: colors.mutedForeground }]}>{s.desc}</Text>
                    </View>
                    {strategy === s.type && <Feather name="check-circle" size={14} color={s.color} />}
                  </PressableScale>
                  </FadeSlideIn>
                ))}

                {/* Phase 6 — gate the attack button on cooldown + having any
                    military units. We surface both states inline so the player
                    knows WHY they can't attack rather than getting a silent fail. */}
                {(() => {
                  const cdRemaining = selectedFaction ? getCombatCooldownRemaining(selectedFaction) : 0;
                  const onCooldown = cdRemaining > 0;
                  const noMilitary = totalUnits === 0;
                  const blocked = onCooldown || noMilitary;
                  if (blocked) {
                    const blockColor = onCooldown ? colors.warning : colors.mutedForeground;
                    const icon = onCooldown ? 'clock' : 'shield-off';
                    const title = onCooldown
                      ? `FLEET RECHARGING — ${formatCooldown(cdRemaining)}`
                      : 'NO MILITARY UNITS';
                    const sub = onCooldown
                      ? 'Combat exhausts the fleet. They need time to rearm.'
                      : 'Build at least one unit in FLEET before engaging.';
                    return (
                      <View style={[styles.engageBlockedBanner, { borderColor: blockColor, backgroundColor: blockColor + '14' }]}>
                        <Feather name={icon as any} size={16} color={blockColor} />
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.engageBlockedTitle, { color: blockColor, fontFamily: 'SpaceMono_700Bold' }]}>
                            {title}
                          </Text>
                          <Text style={[styles.engageBlockedSub, { color: colors.mutedForeground }]}>{sub}</Text>
                        </View>
                      </View>
                    );
                  }
                  return (
                    <GlowPulse color={colors.destructive} duration={1800}>
                      <PressableScale
                        style={[styles.engageBtn, { backgroundColor: colors.destructive }]}
                        onPress={handleCombat}
                        glow
                        glowColor={colors.destructive}
                        scaleTo={0.95}
                      >
                        <Feather name="crosshair" size={16} color="#FFFFFF" />
                        <Text style={[styles.engageBtnText, { color: '#FFFFFF', fontFamily: 'SpaceMono_700Bold' }]}>
                          ENGAGE FLEET
                        </Text>
                      </PressableScale>
                    </GlowPulse>
                  );
                })()}

                {lastCombat && (
                  <FadeSlideIn key={`combat-${lastCombat.timestamp}`} duration={420} offset={10}>
                  <View style={[
                    styles.combatResult,
                    {
                      borderColor: lastCombat.outcome === 'win' ? colors.secondary : lastCombat.outcome === 'loss' ? colors.destructive : colors.warning,
                      backgroundColor: colors.card,
                    },
                  ]}>
                    <Feather
                      name={lastCombat.outcome === 'win' ? 'award' : lastCombat.outcome === 'loss' ? 'x-circle' : 'minus-circle'}
                      size={16}
                      color={lastCombat.outcome === 'win' ? colors.secondary : lastCombat.outcome === 'loss' ? colors.destructive : colors.warning}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.combatResultTitle, { color: colors.foreground }]}>
                        {lastCombat.outcome.toUpperCase()}
                      </Text>
                      <Text style={[styles.combatResultDesc, { color: colors.mutedForeground }]}>{lastCombat.details}</Text>
                    </View>
                  </View>
                  </FadeSlideIn>
                )}
              </FadeSlideIn>
            )}

            {combatMode === 'espionage' && selectedFaction && (
              <FadeSlideIn key={`esp-${selectedFaction}`} duration={360} offset={12}>
                <Text style={[styles.sectionTitle, { color: colors.foreground, marginTop: 4 }]}>COVERT OPERATIONS</Text>
                {MISSIONS.map((m, idx) => (
                  <FadeSlideIn key={m.type} delay={idx * 40} duration={300} offset={6}>
                  <PressableScale
                    style={[styles.missionCard, { borderColor: m.color + '55', backgroundColor: colors.card }]}
                    onPress={() => handleEspionage(m.type)}
                    glow
                    glowColor={m.color}
                    scaleTo={0.97}
                  >
                    <View style={[styles.missionIcon, { borderColor: m.color, backgroundColor: m.color + '14' }]}>
                      <Feather name={m.icon as any} size={16} color={m.color} />
                    </View>
                    <View style={{ flex: 1, gap: 4 }}>
                      <Text style={[styles.missionName, { color: colors.foreground }]}>{m.label}</Text>
                      <Text style={[styles.missionDesc, { color: colors.mutedForeground }]}>{m.desc}</Text>
                      <View style={styles.missionRateRow}>
                        <Text style={[styles.missionRateLabel, { color: colors.mutedForeground }]}>SUCCESS RATE</Text>
                        <View style={styles.missionRateBar}>
                          <ProgressBar progress={m.rate / 100} color={m.color} height={3} />
                        </View>
                        <Text style={[styles.missionRatePct, { color: m.color, fontFamily: 'SpaceMono_700Bold' }]}>{m.rate}%</Text>
                      </View>
                    </View>
                    <Feather name="chevron-right" size={14} color={m.color} />
                  </PressableScale>
                  </FadeSlideIn>
                ))}

                {state.espionageLog.slice(0, 3).map((entry, idx) => (
                  <FadeSlideIn key={entry.id} delay={idx * 40} duration={260} offset={4}>
                  <View style={[styles.logEntry, { borderColor: colors.border }]}>
                    <Feather name={entry.success ? 'check-circle' : 'x-circle'} size={12} color={entry.success ? colors.secondary : colors.destructive} />
                    <Text style={[styles.logText, { color: colors.mutedForeground }]}>{entry.details}</Text>
                  </View>
                  </FadeSlideIn>
                ))}
              </FadeSlideIn>
            )}

            {combatMode === 'fleet' && (
              <FadeSlideIn key="fleet" duration={360} offset={12}>
                {/* Phase 4 — Recruitment Opportunities. Shown above the crew
                    roster ONLY when at least one candidate's unlock condition
                    is met. Each card has the candidate's name, role, hook
                    text, ability, full backstory, and a RECRUIT button. */}
                {recruitmentOffers.length > 0 && (
                  <>
                    <View style={styles.recruitHeader}>
                      <Feather name="user-plus" size={11} color={colors.legendary} />
                      <Text style={[styles.sectionTitle, { color: colors.legendary, marginLeft: 6 }]}>
                        RECRUITMENT OPPORTUNITIES ({recruitmentOffers.length})
                      </Text>
                    </View>
                    {recruitmentOffers.map((offer, idx) => {
                      const m = offer.member;
                      const roleColor =
                        m.role === 'engineer' ? colors.primary
                        : m.role === 'soldier' ? colors.destructive
                        : m.role === 'scientist' ? colors.secondary
                        : m.role === 'diplomat' ? colors.legendary
                        : colors.warning;
                      const icon =
                        m.role === 'engineer' ? 'tool'
                        : m.role === 'soldier' ? 'shield'
                        : m.role === 'scientist' ? 'cpu'
                        : m.role === 'diplomat' ? 'message-circle'
                        : 'eye';
                      return (
                        <FadeSlideIn key={offer.member.id} delay={idx * 50} duration={320} offset={8}>
                          <View style={[styles.recruitCard, { borderColor: colors.legendary, backgroundColor: colors.card }]}>
                            <View style={styles.recruitTopRow}>
                              <View style={[styles.crewIcon, { borderColor: roleColor, backgroundColor: roleColor + '14' }]}>
                                <Feather name={icon as any} size={14} color={roleColor} />
                              </View>
                              <View style={{ flex: 1 }}>
                                <Text style={[styles.crewName, { color: colors.foreground }]}>
                                  {m.name.toUpperCase()}
                                </Text>
                                <Text style={[styles.crewRole, { color: roleColor }]}>
                                  {m.role.toUpperCase()}
                                </Text>
                              </View>
                              <View style={[styles.recruitBadge, { borderColor: colors.legendary, backgroundColor: colors.legendary + '18' }]}>
                                <Text style={[styles.recruitBadgeText, { color: colors.legendary }]}>OFFER</Text>
                              </View>
                            </View>
                            <Text style={[styles.recruitHook, { color: colors.legendary }]}>
                              {offer.offerHook}
                            </Text>
                            <Text style={[styles.crewBio, { color: colors.mutedForeground }]}>
                              {m.backstory}
                            </Text>
                            <Text style={[styles.crewBio, { color: colors.secondary, marginTop: 2 }]}>
                              ✦ {m.ability}
                            </Text>
                            <PressableScale
                              style={[styles.recruitAcceptBtn, { backgroundColor: colors.legendary }]}
                              onPress={() => {
                                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
                                recruitCrew(offer.member.id);
                              }}
                              glow
                              glowColor={colors.legendary}
                              scaleTo={0.94}
                            >
                              <Feather name="user-plus" size={12} color="#FFFFFF" />
                              <Text style={[styles.recruitAcceptText, { color: '#FFFFFF' }]}>
                                RECRUIT {m.name.toUpperCase()}
                              </Text>
                            </PressableScale>
                          </View>
                        </FadeSlideIn>
                      );
                    })}
                  </>
                )}

                {/* Phase 6 + Phase 4 — Crew roster. These are story characters,
                    not combat units. Now also shows live status badge (active
                    / on mission / injured / lost) and a 1-5 experience pip
                    bar that grows through relevant activity. Always at least
                    one (Kael). */}
                {state.crew.length > 0 && (
                  <>
                    <Text style={[styles.sectionTitle, { color: colors.foreground, marginTop: recruitmentOffers.length > 0 ? 12 : 0 }]}>
                      COMMAND CREW ({state.crew.length}/8)
                    </Text>
                    {state.crew.map((member, idx) => {
                      const roleColor =
                        member.role === 'engineer' ? colors.primary
                        : member.role === 'soldier' ? colors.destructive
                        : member.role === 'scientist' ? colors.secondary
                        : member.role === 'diplomat' ? colors.legendary
                        : colors.warning;
                      const icon =
                        member.role === 'engineer' ? 'tool'
                        : member.role === 'soldier' ? 'shield'
                        : member.role === 'scientist' ? 'cpu'
                        : member.role === 'diplomat' ? 'message-circle'
                        : 'eye';
                      // Phase 4 — derive status display.
                      const isActive = member.status === 'active';
                      const statusColor =
                        member.status === 'active' ? colors.secondary
                        : member.status === 'on_mission' ? colors.primary
                        : member.status === 'injured' ? colors.warning
                        : colors.destructive;
                      const statusLabel =
                        member.status === 'active' ? 'ACTIVE'
                        : member.status === 'on_mission' ? 'ON MISSION'
                        : member.status === 'injured' ? 'INJURED'
                        : 'LOST';
                      // Format the recovery countdown ("returns in 22m") if
                      // there's a timer. Pure-derived; refreshes on re-render.
                      const recoveryUntil = member.status === 'on_mission'
                        ? member.missionUntil
                        : member.status === 'injured'
                          ? member.injuredUntil
                          : undefined;
                      const recoveryRemaining = recoveryUntil
                        ? Math.max(0, recoveryUntil - Date.now())
                        : 0;
                      const recoveryLabel = recoveryRemaining > 0
                        ? `recovers in ${formatPendingShort(recoveryRemaining)}`
                        : null;
                      return (
                        <FadeSlideIn key={member.id} delay={idx * 40} duration={300} offset={6}>
                          <View style={[styles.crewCard, {
                            borderColor: roleColor + '55',
                            backgroundColor: colors.card,
                            opacity: isActive ? 1 : 0.78,
                          }]}>
                            <View style={[styles.crewIcon, { borderColor: roleColor, backgroundColor: roleColor + '14' }]}>
                              <Feather name={icon as any} size={14} color={roleColor} />
                            </View>
                            <View style={{ flex: 1 }}>
                              <View style={styles.crewHeaderRow}>
                                <Text style={[styles.crewName, { color: colors.foreground }]}>
                                  {member.name.toUpperCase()}
                                </Text>
                                <View style={[styles.crewStatusBadge, { borderColor: statusColor, backgroundColor: statusColor + '14' }]}>
                                  <Text style={[styles.crewStatusText, { color: statusColor }]}>{statusLabel}</Text>
                                </View>
                              </View>
                              <View style={styles.crewSubRow}>
                                <Text style={[styles.crewRole, { color: roleColor }]}>
                                  {member.role.toUpperCase()}
                                </Text>
                                {/* Phase 4 — experience pips. 5 dots, filled per level. */}
                                <View style={styles.crewExpRow}>
                                  {[1, 2, 3, 4, 5].map(i => (
                                    <View
                                      key={i}
                                      style={[
                                        styles.crewExpPip,
                                        {
                                          backgroundColor: i <= member.experienceLevel ? roleColor : colors.border,
                                          borderColor: i <= member.experienceLevel ? roleColor : colors.border,
                                        },
                                      ]}
                                    />
                                  ))}
                                </View>
                              </View>
                              <Text style={[styles.crewBio, { color: colors.mutedForeground }]}>
                                {member.backstory}
                              </Text>
                              <Text style={[styles.crewBio, { color: colors.secondary, marginTop: 2 }]}>
                                ✦ {member.ability}
                              </Text>
                              {recoveryLabel && (
                                <Text style={[styles.crewRecovery, { color: statusColor }]}>
                                  ⌛ {recoveryLabel}
                                </Text>
                              )}
                            </View>
                          </View>
                        </FadeSlideIn>
                      );
                    })}
                  </>
                )}

                <Text style={[styles.sectionTitle, { color: colors.foreground, marginTop: 8 }]}>FLEET MANAGEMENT</Text>
                {state.units.map((unit, idx) => {
                  const canAffordUnit = Object.entries(unit.cost).every(([id, amt]) => getElementQuantity(id) >= amt * 5);
                  return (
                    <FadeSlideIn key={unit.id} delay={idx * 50} duration={320} offset={8}>
                    <View style={[styles.unitCard, { borderColor: colors.border, backgroundColor: colors.card }]}>
                      <View style={[styles.unitIcon, { borderColor: colors.primary, backgroundColor: colors.primary + '14' }]}>
                        <Feather name="navigation" size={16} color={colors.primary} />
                      </View>
                      <View style={{ flex: 1, gap: 4 }}>
                        <Text style={[styles.unitName, { color: colors.foreground }]}>{unit.name.toUpperCase()}</Text>
                        <View style={styles.unitStats}>
                          <StatChip label="ATK" value={String(unit.attack)} color={colors.destructive} />
                          <StatChip label="DEF" value={String(unit.defense)} color={colors.primary} />
                          <StatChip label="COUNT" value={String(unit.count)} color={colors.secondary} />
                        </View>
                        <View style={styles.unitCostRow}>
                          {Object.entries(unit.cost).map(([id, amt]) => (
                            <Text key={id} style={[styles.unitCostText, { color: colors.mutedForeground, fontFamily: 'SpaceMono_400Regular' }]}>
                              {id}:{amt * 5}
                            </Text>
                          ))}
                        </View>
                      </View>
                      <PressableScale
                        style={[styles.recruitBtn, { backgroundColor: canAffordUnit ? colors.primary : colors.muted }]}
                        onPress={() => handleRecruit(unit.id)}
                        disabled={!canAffordUnit}
                        glow={canAffordUnit}
                        glowColor={colors.primary}
                        scaleTo={0.92}
                      >
                        <Text style={[styles.recruitBtnText, { color: canAffordUnit ? '#FFFFFF' : colors.mutedForeground }]}>+5</Text>
                      </PressableScale>
                    </View>
                    </FadeSlideIn>
                  );
                })}
              </FadeSlideIn>
            )}
          </>
        )}

        {section === 'factions' && (
          <>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>ALLIANCE STATUS</Text>
            {state.factions.map((faction, idx) => {
              const relationship = getFactionRelationship(faction.id);
              const relColor = getRelColor(relationship);
              const repProgress = (faction.reputation + 100) / 200;

              return (
                <FadeSlideIn key={faction.id} delay={idx * 60} duration={360} offset={12}>
                <View style={[styles.factionDetailCard, { borderColor: colors.border, backgroundColor: colors.card }]}>
                  <View style={styles.factionTop}>
                    <View style={[styles.factionIconLarge, { borderColor: relColor, backgroundColor: relColor + '14' }]}>
                      <Feather name="users" size={20} color={relColor} />
                    </View>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={[styles.factionName, { color: colors.foreground }]}>{faction.name}</Text>
                      <Text style={[styles.factionPersonality, { color: colors.mutedForeground }]}>
                        {faction.personality.toUpperCase()} CIVILIZATION
                      </Text>
                    </View>
                    <View style={[styles.relBadge, { borderColor: relColor, backgroundColor: relColor + '14' }]}>
                      <Text style={[styles.relBadgeText, { color: relColor }]}>{relationship.toUpperCase()}</Text>
                    </View>
                  </View>

                  <Text style={[styles.factionDesc, { color: colors.mutedForeground }]}>{faction.description}</Text>

                  {!faction.discovered && (
                    <View style={[styles.unknownBanner, { borderColor: colors.border }]}>
                      <Feather name="eye-off" size={12} color={colors.mutedForeground} />
                      <Text style={[styles.unknownText, { color: colors.mutedForeground }]}>NOT YET DISCOVERED</Text>
                    </View>
                  )}

                  {faction.discovered && (
                    <View style={styles.repBlock}>
                      <View style={styles.repBlockHeader}>
                        <Text style={[styles.repBlockLabel, { color: colors.mutedForeground }]}>TRUST</Text>
                        <Text style={[styles.repBlockValue, { color: relColor, fontFamily: 'SpaceMono_700Bold' }]}>
                          {faction.reputation > 0 ? '+' : ''}{faction.reputation}
                        </Text>
                      </View>
                      {/* Phase 6 — 5-pip trust meter is faster to read than a
                          continuous bar; tier change is the meaningful event. */}
                      <View style={{ marginVertical: 6 }}>
                        <TrustPips rep={faction.reputation} color={relColor} />
                      </View>
                      <View style={styles.repScale}>
                        <Text style={[styles.repScaleLabel, { color: colors.destructive }]}>HOSTILE</Text>
                        <Text style={[styles.repScaleLabel, { color: colors.mutedForeground }]}>NEUTRAL</Text>
                        <Text style={[styles.repScaleLabel, { color: colors.secondary }]}>ALLIED</Text>
                      </View>
                    </View>
                  )}
                </View>
                </FadeSlideIn>
              );
            })}
          </>
        )}
      </ScrollView>

      <Modal visible={showAwards} animationType="slide" transparent onRequestClose={() => setShowAwards(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.dragHandle, { backgroundColor: colors.border }]} />
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={[styles.modalTitle, { color: colors.foreground }]}>MISSION AWARDS</Text>

              <View style={styles.dailySection}>
                <Text style={[styles.modalSubtitle, { color: colors.primary }]}>DAILY REWARD</Text>
                <Text style={[styles.streakLabel, { color: colors.mutedForeground }]}>
                  LOGIN STREAK: {state.loginStreak} DAYS
                </Text>
                <View style={styles.streakRow}>
                  {DAY_REWARDS.map((d, i) => {
                    const dayNum = i + 1;
                    const isCurrent = dayNum === Math.min(state.loginStreak, 7);
                    const isPast = dayNum < Math.min(state.loginStreak, 7);
                    return (
                      <View key={dayNum} style={[
                        styles.dayCell,
                        {
                          borderColor: isCurrent ? colors.primary : isPast ? colors.secondary : colors.border,
                          backgroundColor: isCurrent ? colors.primary + '18' : isPast ? colors.secondary + '12' : colors.muted,
                        },
                      ]}>
                        <Text style={[styles.dayCellNum, { color: isCurrent ? colors.primary : isPast ? colors.secondary : colors.mutedForeground }]}>
                          D{dayNum}
                        </Text>
                        <Feather
                          name={isPast ? 'check' : isCurrent ? 'gift' : 'lock'}
                          size={10}
                          color={isCurrent ? colors.primary : isPast ? colors.secondary : colors.mutedForeground}
                        />
                      </View>
                    );
                  })}
                </View>
                <Text style={[styles.dayRewardText, { color: colors.foreground }]}>
                  {DAY_REWARDS[Math.min(state.loginStreak - 1, 6)]?.rewards}
                </Text>
                <PressableScale
                  style={[styles.claimBtn, { backgroundColor: state.dailyRewardClaimed ? colors.muted : colors.primary }]}
                  onPress={handleClaimDaily}
                  disabled={state.dailyRewardClaimed}
                  glow={!state.dailyRewardClaimed}
                  glowColor={colors.primary}
                  scaleTo={0.95}
                >
                  <Feather name={state.dailyRewardClaimed ? 'check' : 'gift'} size={14} color={state.dailyRewardClaimed ? colors.mutedForeground : '#FFFFFF'} />
                  <Text style={[styles.claimBtnText, { color: state.dailyRewardClaimed ? colors.mutedForeground : '#FFFFFF' }]}>
                    {state.dailyRewardClaimed ? 'CLAIMED' : 'CLAIM REWARD'}
                  </Text>
                </PressableScale>
                {claimMsg && (
                  <FadeSlideIn key={claimMsg} duration={280} offset={6}>
                  <Text style={[styles.claimMsg, { color: colors.secondary }]}>{claimMsg}</Text>
                  </FadeSlideIn>
                )}
              </View>

              <Text style={[styles.modalSubtitle, { color: colors.primary, marginTop: 16 }]}>
                ACHIEVEMENTS — {state.achievements.filter(a => a.unlocked).length}/{state.achievements.length}
              </Text>
              <ProgressBar progress={state.achievements.filter(a => a.unlocked).length / state.achievements.length} color={colors.primary} height={3} />

              {state.achievements.map((a, idx) => {
                const rarityColors: Record<string, string> = { legendary: colors.legendary, epic: colors.epic, rare: colors.rare, uncommon: colors.secondary, common: colors.common };
                const color = rarityColors[a.rarity] ?? colors.common;
                return (
                  <FadeSlideIn key={a.id} delay={idx * 25} duration={260} offset={6}>
                  <View style={[styles.achievRow, { borderColor: a.unlocked ? color + '55' : colors.border, backgroundColor: a.unlocked ? color + '0C' : colors.muted }]}>
                    <Feather name={a.unlocked ? 'check-circle' : 'lock'} size={14} color={a.unlocked ? color : colors.mutedForeground} />
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={[styles.achievName, { color: a.unlocked ? colors.foreground : colors.mutedForeground }]}>{a.name}</Text>
                      <Text style={[styles.achievDesc, { color: colors.mutedForeground }]}>{a.description}</Text>
                      {!a.unlocked && <ProgressBar progress={a.progress / a.target} color={color} height={2} />}
                    </View>
                    <RarityBadge rarity={a.rarity} />
                  </View>
                  </FadeSlideIn>
                );
              })}
            </ScrollView>
            <PressableScale style={[styles.closeSheet, { borderColor: colors.border }]} onPress={() => setShowAwards(false)} scaleTo={0.96}>
              <Text style={[styles.closeSheetText, { color: colors.primary }]}>CLOSE</Text>
            </PressableScale>
          </View>
        </View>
      </Modal>

      <Modal visible={showSettings} animationType="slide" transparent onRequestClose={() => setShowSettings(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.dragHandle, { backgroundColor: colors.border }]} />
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={[styles.modalTitle, { color: colors.foreground }]}>COMMAND CENTER</Text>

              <View style={[styles.civCard, { borderColor: colors.primary, backgroundColor: colors.primary + '0A' }]}>
                <Text style={[styles.modalSubtitle, { color: colors.primary }]}>CIVILIZATION STATUS</Text>
                <View style={styles.civGrid}>
                  {[
                    { label: 'ERA', value: String(state.era) },
                    { label: 'CREDITS', value: Math.floor(state.credits).toLocaleString() },
                    { label: 'POPULATION', value: String(state.population) },
                    { label: 'BUILDINGS', value: String(state.buildings.filter(b => b.level > 0).length) },
                    { label: 'TECHS', value: String(state.technologies.filter(t => t.researched).length) },
                    { label: 'DEFENSE', value: String(state.defensePower) },
                  ].map(item => (
                    <View key={item.label} style={[styles.civCell, { borderColor: colors.border }]}>
                      <Text style={[styles.civCellValue, { color: colors.foreground, fontFamily: 'SpaceMono_700Bold' }]}>{item.value}</Text>
                      <Text style={[styles.civCellLabel, { color: colors.mutedForeground }]}>{item.label}</Text>
                    </View>
                  ))}
                </View>
              </View>

              <View style={[styles.settingsRow, { borderColor: colors.border }]}>
                <Text style={[styles.settingsLabel, { color: colors.mutedForeground }]}>Mining Multiplier</Text>
                <Text style={[styles.settingsValue, { color: colors.primary, fontFamily: 'SpaceMono_700Bold' }]}>{state.miningMultiplier.toFixed(1)}×</Text>
              </View>
              <View style={[styles.settingsRow, { borderColor: colors.border }]}>
                <Text style={[styles.settingsLabel, { color: colors.mutedForeground }]}>Research Speed</Text>
                <Text style={[styles.settingsValue, { color: colors.primary, fontFamily: 'SpaceMono_700Bold' }]}>{state.researchSpeed.toFixed(1)}×</Text>
              </View>
              <View style={[styles.settingsRow, { borderColor: colors.border }]}>
                <Text style={[styles.settingsLabel, { color: colors.mutedForeground }]}>Storage</Text>
                <Text style={[styles.settingsValue, { color: colors.primary, fontFamily: 'SpaceMono_700Bold' }]}>
                  {state.elements.reduce((s, e) => s + e.quantity, 0).toLocaleString()}/{state.storageCapacity.toLocaleString()}
                </Text>
              </View>
              <View style={[styles.settingsRow, { borderColor: colors.border }]}>
                <Text style={[styles.settingsLabel, { color: colors.mutedForeground }]}>Login Streak</Text>
                <Text style={[styles.settingsValue, { color: colors.primary, fontFamily: 'SpaceMono_700Bold' }]}>{state.loginStreak} DAYS</Text>
              </View>

              <View style={[styles.prestigeBlock, { borderColor: colors.legendary }]}>
                <View style={styles.prestigeHeader}>
                  <Feather name="repeat" size={16} color={colors.legendary} />
                  <Text style={[styles.prestigeTitle, { color: colors.legendary }]}>PRESTIGE RESET</Text>
                </View>
                <Text style={[styles.prestigeDesc, { color: colors.mutedForeground }]}>
                  Reset all progress for a permanent +{(state.prestigeLevel + 1) * 10}% resource bonus.
                  Login streak and achievements persist.
                </Text>
                <View style={styles.prestigeStats}>
                  <Text style={[styles.prestigeStatText, { color: colors.mutedForeground }]}>
                    Current bonus: <Text style={{ color: colors.legendary, fontFamily: 'SpaceMono_700Bold' }}>+{state.prestigeLevel * 10}%</Text>
                  </Text>
                  <Text style={[styles.prestigeStatText, { color: colors.mutedForeground }]}>
                    After prestige: <Text style={{ color: colors.legendary, fontFamily: 'SpaceMono_700Bold' }}>+{(state.prestigeLevel + 1) * 10}%</Text>
                  </Text>
                  <Text style={[styles.prestigeStatText, { color: colors.mutedForeground }]}>
                    Prestige points: <Text style={{ color: colors.legendary, fontFamily: 'SpaceMono_700Bold' }}>{state.prestigePoints} → {state.prestigePoints + 5}</Text>
                  </Text>
                </View>
                <GlowPulse color={colors.legendary} intensity={0.4} duration={2400}>
                <PressableScale
                  style={[styles.prestigeBtn, { borderColor: colors.legendary, backgroundColor: colors.legendary + '14' }]}
                  onPress={() => { setShowSettings(false); setTimeout(handlePrestige, 300); }}
                  scaleTo={0.96}
                >
                  <Feather name="repeat" size={14} color={colors.legendary} />
                  <Text style={[styles.prestigeBtnText, { color: colors.legendary }]}>INITIATE PRESTIGE</Text>
                </PressableScale>
                </GlowPulse>
              </View>

              <Text style={[styles.aboutText, { color: colors.mutedForeground }]}>
                Space Odyssey: Galactic Evolution · v1.0.0 · April 2026
              </Text>
            </ScrollView>
            <PressableScale style={[styles.closeSheet, { borderColor: colors.border }]} onPress={() => setShowSettings(false)} scaleTo={0.96}>
              <Text style={[styles.closeSheetText, { color: colors.primary }]}>CLOSE</Text>
            </PressableScale>
          </View>
        </View>
      </Modal>

      {resolving && (
        <Animated.View
          style={[
            styles.suspenseOverlay,
            { backgroundColor: 'rgba(5, 12, 22, 0.78)', opacity: suspenseAnim },
          ]}
          pointerEvents="auto"
        >
          <View style={[styles.suspenseCard, { borderColor: resolving.color, backgroundColor: colors.card }]}>
            <Animated.View
              style={[
                styles.suspenseRing,
                {
                  borderColor: resolving.color,
                  transform: [{
                    rotate: suspenseAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }),
                  }],
                },
              ]}
            />
            <Feather name="cpu" size={26} color={resolving.color} />
            <Text style={[styles.suspenseText, { color: resolving.color }]}>PROCESSING DECISION</Text>
            <Text style={[styles.suspenseSub, { color: colors.mutedForeground }]}>
              CALCULATING TIMELINE BRANCH...
            </Text>
          </View>
        </Animated.View>
      )}

      <EventOutcomeModal
        visible={!!outcome}
        resolution={outcome}
        readOnly={outcomeReadOnly}
        onClose={() => { setOutcome(null); setOutcomeReadOnly(false); }}
      />
    </View>
  );
}

function StatChip({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
      <Text style={{ fontSize: 8, fontFamily: 'Inter_700Bold', color, letterSpacing: 0.5 }}>{label}</Text>
      <Text style={{ fontSize: 10, fontFamily: 'SpaceMono_700Bold', color }}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 10, gap: 10 },
  pillRow: { flex: 1, flexDirection: 'row', gap: 6 },
  pill: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 7, borderWidth: 1.5, borderRadius: 6 },
  pillText: { fontSize: 9, fontFamily: 'Inter_700Bold', letterSpacing: 1 },
  pillActions: { flexDirection: 'row', gap: 6 },
  iconAction: { width: 34, height: 34, borderWidth: 1, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },

  scroll: { flex: 1 },
  content: { padding: 16, gap: 10, paddingTop: 4 },

  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { fontSize: 11, fontFamily: 'Inter_700Bold', letterSpacing: 2 },
  aiBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 7, paddingVertical: 3, borderWidth: 1, borderRadius: 4 },
  aiBadgeText: { fontSize: 8, fontFamily: 'Inter_700Bold', letterSpacing: 0.5 },

  generatingCard: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1.5, borderStyle: 'dashed', borderRadius: 8, padding: 16 },
  generatingTitle: { fontSize: 12, fontFamily: 'Inter_700Bold', letterSpacing: 1 },
  generatingDesc: { fontSize: 11, fontFamily: 'Inter_400Regular', lineHeight: 16 },

  emptyState: { borderWidth: 1, borderStyle: 'dashed', borderRadius: 8, padding: 28, alignItems: 'center', gap: 10 },
  emptyTitle: { fontSize: 11, fontFamily: 'Inter_700Bold', letterSpacing: 1.5 },
  emptyDesc: { fontSize: 11, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 17 },
  scanBtn: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 18, paddingVertical: 9, borderWidth: 1.5, borderRadius: 6 },
  scanBtnText: { fontSize: 11, fontFamily: 'Inter_700Bold', letterSpacing: 1 },
  scanAgain: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, padding: 9, borderWidth: 1, borderRadius: 6 },
  scanAgainText: { fontSize: 10, fontFamily: 'Inter_600SemiBold', letterSpacing: 1 },

  eventCard: { borderWidth: 1, borderRadius: 8, overflow: 'hidden', flexDirection: 'row' },
  eventLeftBorder: { width: 4 },
  eventBody: { flex: 1, padding: 14, gap: 10 },
  eventMeta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  typeTag: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 6, paddingVertical: 3, borderWidth: 1, borderRadius: 3 },
  typeTagText: { fontSize: 8, fontFamily: 'Inter_700Bold', letterSpacing: 0.5 },
  aiTag: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 5, paddingVertical: 3, borderWidth: 1, borderRadius: 3 },
  aiTagText: { fontSize: 8, fontFamily: 'Inter_700Bold', letterSpacing: 0.5 },
  eventTime: { fontSize: 9, marginLeft: 'auto' },
  eventTitle: { fontSize: 15, fontFamily: 'Inter_700Bold', lineHeight: 22 },
  eventDesc: { fontSize: 12, fontFamily: 'Inter_400Regular', lineHeight: 18 },
  choiceLabel: { fontSize: 9, fontFamily: 'Inter_700Bold', letterSpacing: 1.5 },
  choiceBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 5, borderWidth: 1 },
  choiceNum: { width: 22, height: 22, borderRadius: 11, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  choiceNumText: { fontSize: 10 },
  choiceText: { fontSize: 12, fontFamily: 'Inter_500Medium', lineHeight: 17 },
  choiceHints: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choiceHint: { fontSize: 10 },
  completedSection: { gap: 6 },
  completedLabel: { fontSize: 9, fontFamily: 'Inter_700Bold', letterSpacing: 1.5 },
  completedItem: { flexDirection: 'row', alignItems: 'center', gap: 7, padding: 8, borderWidth: 1, borderRadius: 5 },
  completedText: { fontSize: 11, fontFamily: 'Inter_400Regular' },
  logRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: 10, paddingLeft: 0, borderWidth: 1, borderRadius: 6, overflow: 'hidden',
  },
  logStripe: { width: 3, alignSelf: 'stretch', marginRight: 8 },
  logHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logType: { fontSize: 9, fontFamily: 'SpaceMono_700Bold', letterSpacing: 1 },
  logCrit: { fontSize: 9, fontFamily: 'SpaceMono_700Bold', letterSpacing: 1 },
  logTime: { fontSize: 9, marginLeft: 'auto' },
  logTitle: { fontSize: 12, fontFamily: 'Inter_700Bold' },
  logChoice: { fontSize: 11, fontFamily: 'Inter_400Regular', fontStyle: 'italic' },
  logDeltas: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 2 },
  logDelta: { fontSize: 10 },
  // Phase 3 — Pending Reports queue styles.
  pendingCard: {
    flexDirection: 'row', alignItems: 'stretch', gap: 10,
    padding: 10, paddingLeft: 0, borderWidth: 1, borderRadius: 6, overflow: 'hidden',
    marginBottom: 6,
  },
  pendingStripe: { width: 3, alignSelf: 'stretch', marginRight: 8 },
  pendingHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  pendingTypeTag: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, borderWidth: 1,
  },
  pendingTypeText: { fontSize: 9, fontFamily: 'SpaceMono_700Bold', letterSpacing: 1 },
  pendingClockTag: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, borderWidth: 1,
    marginLeft: 'auto',
  },
  pendingCountdownText: { fontSize: 10, fontFamily: 'SpaceMono_700Bold', letterSpacing: 1 },
  pendingTitle: { fontSize: 12, fontFamily: 'Inter_700Bold' },
  pendingChoice: { fontSize: 11, fontFamily: 'Inter_400Regular', fontStyle: 'italic' },
  pendingTrack: { height: 3, borderRadius: 2, overflow: 'hidden', marginTop: 2 },
  pendingFill: { height: '100%', borderRadius: 2 },
  pendingFooter: { fontSize: 9, fontFamily: 'SpaceMono_400Regular', letterSpacing: 0.5, marginTop: 1 },
  suspenseOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center', justifyContent: 'center', zIndex: 99,
  },
  suspenseCard: {
    paddingHorizontal: 28, paddingVertical: 22,
    borderWidth: 1, borderRadius: 8, gap: 8,
    alignItems: 'center', minWidth: 220,
  },
  suspenseRing: {
    position: 'absolute', top: 6, right: 6,
    width: 16, height: 16, borderWidth: 2, borderRightColor: 'transparent', borderRadius: 8,
  },
  suspenseText: { fontSize: 12, fontFamily: 'SpaceMono_700Bold', letterSpacing: 2, marginTop: 4 },
  suspenseSub: { fontSize: 9, fontFamily: 'SpaceMono_400Regular', letterSpacing: 1 },

  combatSubTabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#D6E8F0', marginBottom: 10 },
  subTab: { flex: 1, paddingVertical: 9, alignItems: 'center', borderBottomWidth: 2 },
  subTabText: { fontSize: 10, fontFamily: 'Inter_700Bold', letterSpacing: 1 },

  factionCard: { borderWidth: 1, borderRadius: 8, padding: 14, gap: 10 },
  factionDetailCard: { borderWidth: 1, borderRadius: 8, padding: 14, gap: 10 },
  factionTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  factionIcon: { width: 40, height: 40, borderRadius: 8, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  factionIconLarge: { width: 48, height: 48, borderRadius: 8, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  factionName: { fontSize: 13, fontFamily: 'Inter_700Bold' },
  factionPersonality: { fontSize: 9, fontFamily: 'Inter_400Regular', letterSpacing: 0.5 },
  factionDesc: { fontSize: 11, fontFamily: 'Inter_400Regular', lineHeight: 16 },
  relBadge: { paddingHorizontal: 7, paddingVertical: 3, borderWidth: 1, borderRadius: 4 },
  relBadgeText: { fontSize: 8, fontFamily: 'Inter_700Bold', letterSpacing: 0.5 },
  repRow: { gap: 4 },
  repLabel: { fontSize: 9 },
  repBar: {},
  repBlock: { gap: 6 },
  repBlockHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  repBlockLabel: { fontSize: 9, fontFamily: 'Inter_700Bold', letterSpacing: 1 },
  repBlockValue: { fontSize: 13 },
  repScale: { flexDirection: 'row', justifyContent: 'space-between' },
  repScaleLabel: { fontSize: 8, fontFamily: 'Inter_400Regular' },
  unknownBanner: { flexDirection: 'row', alignItems: 'center', gap: 7, padding: 8, borderWidth: 1, borderStyle: 'dashed', borderRadius: 5 },
  unknownText: { fontSize: 10, fontFamily: 'Inter_600SemiBold', letterSpacing: 0.5 },

  stratCard: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 8, padding: 12 },
  stratName: { fontSize: 12, fontFamily: 'Inter_700Bold' },
  stratDesc: { fontSize: 10, fontFamily: 'Inter_400Regular' },
  engageBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 13, borderRadius: 6 },
  engageBtnText: { fontSize: 13, letterSpacing: 1.5 },
  engageBlockedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderWidth: 1.5,
    borderRadius: 6,
  },
  engageBlockedTitle: { fontSize: 11, letterSpacing: 1.5 },
  engageBlockedSub: { fontSize: 10, fontFamily: 'Inter_400Regular', marginTop: 2 },
  crewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 11,
    borderWidth: 1,
    borderRadius: 6,
    marginBottom: 6,
  },
  crewIcon: {
    width: 32, height: 32, borderRadius: 16,
    borderWidth: 1.5, alignItems: 'center', justifyContent: 'center',
  },
  crewName: { fontSize: 12, fontFamily: 'Inter_700Bold', letterSpacing: 1 },
  crewRole: { fontSize: 9, fontFamily: 'Inter_400Regular', letterSpacing: 1, marginTop: 1 },
  crewBio: { fontSize: 10, fontFamily: 'Inter_400Regular', marginTop: 4, lineHeight: 14 },
  // Phase 4 — crew header row (name + status badge inline) and exp pip strip.
  crewHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  crewSubRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 1 },
  crewStatusBadge: {
    paddingHorizontal: 5, paddingVertical: 1.5, borderRadius: 3, borderWidth: 1,
  },
  crewStatusText: { fontSize: 8, fontFamily: 'SpaceMono_700Bold', letterSpacing: 1 },
  crewExpRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  crewExpPip: { width: 6, height: 6, borderRadius: 3, borderWidth: 1 },
  crewRecovery: { fontSize: 9, fontFamily: 'SpaceMono_400Regular', letterSpacing: 0.5, marginTop: 3 },
  // Phase 4 — recruitment offer cards.
  recruitHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 6, marginTop: 4 },
  recruitCard: {
    borderWidth: 1.5, borderRadius: 8, padding: 12, gap: 8, marginBottom: 8,
  },
  recruitTopRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  recruitBadge: {
    paddingHorizontal: 7, paddingVertical: 3, borderRadius: 4, borderWidth: 1,
  },
  recruitBadgeText: { fontSize: 9, fontFamily: 'SpaceMono_700Bold', letterSpacing: 1 },
  recruitHook: { fontSize: 11, fontFamily: 'Inter_500Medium', fontStyle: 'italic', lineHeight: 15 },
  recruitAcceptBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 11, borderRadius: 6, marginTop: 4,
  },
  recruitAcceptText: { fontSize: 12, fontFamily: 'Inter_700Bold', letterSpacing: 1.5 },
  combatResult: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 8, padding: 12 },
  combatResultTitle: { fontSize: 13, fontFamily: 'Inter_700Bold' },
  combatResultDesc: { fontSize: 11, fontFamily: 'Inter_400Regular', lineHeight: 16 },

  missionCard: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 8, padding: 12 },
  missionIcon: { width: 40, height: 40, borderRadius: 8, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  missionName: { fontSize: 12, fontFamily: 'Inter_700Bold' },
  missionDesc: { fontSize: 10, fontFamily: 'Inter_400Regular' },
  missionRateRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  missionRateLabel: { fontSize: 8, fontFamily: 'Inter_700Bold', letterSpacing: 0.5, width: 70 },
  missionRateBar: { flex: 1 },
  missionRatePct: { fontSize: 10, width: 30, textAlign: 'right' },

  logEntry: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 9, borderWidth: 1, borderRadius: 5 },
  logText: { fontSize: 11, fontFamily: 'Inter_400Regular', flex: 1, lineHeight: 16 },

  unitCard: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 8, padding: 12 },
  unitIcon: { width: 40, height: 40, borderRadius: 8, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  unitName: { fontSize: 12, fontFamily: 'Inter_700Bold' },
  unitStats: { flexDirection: 'row', gap: 12 },
  unitCostRow: { flexDirection: 'row', gap: 8 },
  unitCostText: { fontSize: 9 },
  recruitBtn: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 5, alignItems: 'center', justifyContent: 'center' },
  recruitBtnText: { fontSize: 13, fontFamily: 'Inter_700Bold' },

  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(26, 43, 60, 0.4)' },
  modalSheet: { borderTopWidth: 1.5, borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 20, maxHeight: '88%', gap: 12 },
  dragHandle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 8 },
  modalTitle: { fontSize: 14, fontFamily: 'Inter_700Bold', letterSpacing: 2 },
  modalSubtitle: { fontSize: 10, fontFamily: 'Inter_700Bold', letterSpacing: 1.5, marginBottom: 8 },

  dailySection: { gap: 10 },
  streakLabel: { fontSize: 10, fontFamily: 'Inter_400Regular' },
  streakRow: { flexDirection: 'row', gap: 6 },
  dayCell: { flex: 1, alignItems: 'center', paddingVertical: 10, borderWidth: 1, borderRadius: 6, gap: 4 },
  dayCellNum: { fontSize: 9, fontFamily: 'Inter_700Bold' },
  dayRewardText: { fontSize: 11, fontFamily: 'Inter_500Medium', textAlign: 'center' },
  claimBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingVertical: 11, borderRadius: 6 },
  claimBtnText: { fontSize: 12, fontFamily: 'Inter_700Bold', letterSpacing: 1 },
  claimMsg: { fontSize: 10, fontFamily: 'Inter_600SemiBold', textAlign: 'center', letterSpacing: 0.5 },

  achievRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 12, borderWidth: 1, borderRadius: 7, marginTop: 6 },
  achievName: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  achievDesc: { fontSize: 10, fontFamily: 'Inter_400Regular', lineHeight: 15 },

  civCard: { borderWidth: 1, borderRadius: 8, padding: 14, gap: 10, marginBottom: 12 },
  civGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  civCell: { flex: 1, minWidth: 90, alignItems: 'center', paddingVertical: 10, borderWidth: 1, borderRadius: 6, gap: 2 },
  civCellValue: { fontSize: 16 },
  civCellLabel: { fontSize: 8, fontFamily: 'Inter_600SemiBold', letterSpacing: 1 },
  settingsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  settingsLabel: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  settingsValue: { fontSize: 12 },
  prestigeBlock: { borderWidth: 1.5, borderRadius: 8, padding: 16, gap: 10, marginTop: 16 },
  prestigeHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  prestigeTitle: { fontSize: 13, fontFamily: 'Inter_700Bold', letterSpacing: 1.5 },
  prestigeDesc: { fontSize: 11, fontFamily: 'Inter_400Regular', lineHeight: 17 },
  prestigeStats: { gap: 4 },
  prestigeStatText: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  prestigeBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingVertical: 11, borderRadius: 6, borderWidth: 1.5 },
  prestigeBtnText: { fontSize: 12, fontFamily: 'Inter_700Bold', letterSpacing: 1 },
  aboutText: { fontSize: 10, fontFamily: 'Inter_400Regular', textAlign: 'center', marginTop: 12, marginBottom: 4 },

  closeSheet: { borderTopWidth: 1, paddingTop: 12, alignItems: 'center' },
  closeSheetText: { fontSize: 11, fontFamily: 'Inter_700Bold', letterSpacing: 1.5 },
});
