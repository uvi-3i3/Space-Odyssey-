import React, { useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform, Animated,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useGame } from '@/context/GameContext';
import { useColors } from '@/hooks/useColors';
import { BlueprintGrid } from '@/components/BlueprintGrid';
import { EventChoice } from '@/constants/gameData';

const EVENT_TYPE_COLORS: Record<string, string> = {
  random: '#FFB800',
  story: '#00D4FF',
  discovery: '#00FF88',
  threat: '#FF4444',
};

const EVENT_TYPE_ICONS: Record<string, string> = {
  random: 'shuffle',
  story: 'book',
  discovery: 'search',
  threat: 'alert-triangle',
};

const FACTION_LABEL: Record<string, string> = {
  zorathi: 'Zorathi',
  krenn: 'Krenn',
  vael: 'Vael',
};

/**
 * Phase 5 — flatten a choice's effects into a list of short hint chips for
 * the choice button. Resources, faction reps, stability/population/defense,
 * and building level deltas all surface as their own chip with the right
 * sign + colour. Returns at most 5 chips so the UI stays readable.
 */
function buildChoiceHints(choice: EventChoice): { key: string; text: string; positive: boolean }[] {
  const out: { key: string; text: string; positive: boolean }[] = [];

  const resources = choice.effects?.resourceChanges ?? choice.resourceChanges ?? {};
  Object.entries(resources).forEach(([k, v]) => {
    if (!v) return;
    out.push({ key: `res_${k}`, text: `${v > 0 ? '+' : ''}${v} ${k}`, positive: v > 0 });
  });

  const reps = choice.effects?.reputationChanges ?? {};
  Object.entries(reps).forEach(([fid, v]) => {
    if (!v) return;
    const label = FACTION_LABEL[fid] ?? fid;
    out.push({ key: `rep_${fid}`, text: `${v > 0 ? '+' : ''}${v} ${label} rep`, positive: v > 0 });
  });
  if (choice.reputationChange && Object.keys(reps).length === 0) {
    out.push({
      key: 'rep_legacy',
      text: `${choice.reputationChange > 0 ? '+' : ''}${choice.reputationChange} reputation`,
      positive: choice.reputationChange > 0,
    });
  }

  const stab = choice.effects?.stabilityChange;
  if (stab) out.push({ key: 'stab', text: `${stab > 0 ? '+' : ''}${stab} stability`, positive: stab > 0 });

  const pop = choice.effects?.populationChange;
  if (pop) out.push({ key: 'pop', text: `${pop > 0 ? '+' : ''}${pop} population`, positive: pop > 0 });

  const def = choice.effects?.defensePowerChange;
  if (def) out.push({ key: 'def', text: `${def > 0 ? '+' : ''}${def} defense`, positive: def > 0 });

  const bldgs = choice.effects?.buildingLevelChanges ?? {};
  Object.entries(bldgs).forEach(([bid, v]) => {
    if (!v) return;
    const pretty = bid.replace(/_/g, ' ');
    out.push({ key: `bldg_${bid}`, text: `${v > 0 ? '+' : ''}${v} ${pretty} lvl`, positive: v > 0 });
  });

  return out.slice(0, 5);
}

export default function EventsScreen() {
  const { state, resolveEvent, generateEvent, generatingEvent } = useGame();
  const colors = useColors();
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const dimAnim = useRef(new Animated.Value(0)).current;

  const paddingBottom = Platform.OS === 'web' ? 34 : 0;
  const hasActiveEvent = state.activeEvents.length > 0;

  useEffect(() => {
    if (generatingEvent) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 0.4, duration: 600, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulseAnim.stopAnimation();
      pulseAnim.setValue(1);
    }
  }, [generatingEvent, pulseAnim]);

  // Phase 5 — when a transmission is on screen, fade in a translucent dim
  // overlay behind the cards so the player's eye is drawn to the decision.
  useEffect(() => {
    Animated.timing(dimAnim, {
      toValue: hasActiveEvent ? 1 : 0,
      duration: 280,
      useNativeDriver: true,
    }).start();
  }, [hasActiveEvent, dimAnim]);

  const handleChoice = (eventId: string, choiceId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    resolveEvent(eventId, choiceId);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <BlueprintGrid />

      <Animated.View
        pointerEvents="none"
        style={[styles.dimOverlay, { backgroundColor: colors.background, opacity: dimAnim }]}
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: 100 + paddingBottom }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.primary }]}>DEEP SPACE EVENTS</Text>
          <View style={styles.headerRow}>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
              {state.activeEvents.length} ACTIVE · {state.completedEvents.length} RESOLVED
            </Text>
            <View style={[styles.transmissionBadge, { borderColor: colors.primary + '55', backgroundColor: colors.primary + '11' }]}>
              <Feather name="radio" size={9} color={colors.primary} />
              <Text style={[styles.transmissionBadgeText, { color: colors.primary }]}>LIVE FEED</Text>
            </View>
          </View>
        </View>

        {generatingEvent && (
          <Animated.View style={[styles.generatingCard, { borderColor: colors.primary, backgroundColor: colors.card, opacity: pulseAnim }]}>
            <Feather name="zap" size={20} color={colors.primary} />
            <View style={styles.generatingTextCol}>
              <Text style={[styles.generatingTitle, { color: colors.primary }]}>TUNING ARRAY...</Text>
              <Text style={[styles.generatingDesc, { color: colors.mutedForeground }]}>
                Locking onto the next deep-space transmission for your civilization.
              </Text>
            </View>
          </Animated.View>
        )}

        {state.activeEvents.length === 0 && !generatingEvent && (
          <View style={[styles.emptyState, { borderColor: colors.border }]}>
            <Feather name="radio" size={40} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.mutedForeground }]}>NO INCOMING SIGNALS</Text>
            <Text style={[styles.emptyDesc, { color: colors.mutedForeground }]}>
              Tune the long-range array to receive the next chapter of your campaign and choose your colony's path.
            </Text>
            <TouchableOpacity
              style={[styles.generateBtn, { borderColor: colors.primary }]}
              onPress={() => { generateEvent(); Haptics.selectionAsync(); }}
            >
              <Feather name="zap" size={14} color={colors.primary} />
              <Text style={[styles.generateBtnText, { color: colors.primary }]}>TUNE ARRAY</Text>
            </TouchableOpacity>
          </View>
        )}

        {state.activeEvents.map(event => {
          const typeColor = EVENT_TYPE_COLORS[event.type] ?? colors.primary;
          const typeIcon = EVENT_TYPE_ICONS[event.type] ?? 'radio';

          return (
            <View key={event.id} style={[styles.eventCard, { borderColor: typeColor, backgroundColor: colors.card }]}>
              <View style={styles.eventMeta}>
                <View style={styles.eventTags}>
                  <View style={[styles.typeTag, { backgroundColor: typeColor + '22', borderColor: typeColor }]}>
                    <Feather name={typeIcon as any} size={11} color={typeColor} />
                    <Text style={[styles.typeTagText, { color: typeColor }]}>{event.type.toUpperCase()}</Text>
                  </View>
                </View>
                <Text style={[styles.timestamp, { color: colors.mutedForeground }]}>
                  {new Date(event.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>

              <Text style={[styles.eventTitle, { color: colors.foreground }]}>{event.title}</Text>
              <Text style={[styles.eventDesc, { color: colors.mutedForeground }]}>{event.description}</Text>

              <View style={styles.separator} />

              <Text style={[styles.choiceLabel, { color: typeColor }]}>// CHOOSE YOUR RESPONSE:</Text>

              {event.choices.map((choice, index) => {
                const hints = buildChoiceHints(choice);
                return (
                  <TouchableOpacity
                    key={choice.id}
                    style={[styles.choiceBtn, { borderColor: typeColor + '55', backgroundColor: typeColor + '11' }]}
                    onPress={() => handleChoice(event.id, choice.id)}
                  >
                    <View style={[styles.choiceNum, { backgroundColor: typeColor + '33', borderColor: typeColor }]}>
                      <Text style={[styles.choiceNumText, { color: typeColor }]}>{index + 1}</Text>
                    </View>
                    <View style={styles.choiceContent}>
                      <Text style={[styles.choiceText, { color: colors.foreground }]}>{choice.text}</Text>
                      {hints.length > 0 && (
                        <View style={styles.choicePreview}>
                          {hints.map(h => (
                            <Text
                              key={h.key}
                              style={[styles.choiceHint, { color: h.positive ? colors.success : colors.destructive }]}
                            >
                              {h.text}
                            </Text>
                          ))}
                        </View>
                      )}
                    </View>
                    <Feather name="chevron-right" size={16} color={typeColor} />
                  </TouchableOpacity>
                );
              })}
            </View>
          );
        })}

        {state.completedEvents.length > 0 && !hasActiveEvent && !generatingEvent && (
          <View style={styles.historySection}>
            <Text style={[styles.historyTitle, { color: colors.mutedForeground }]}>
              // RESOLVED TRANSMISSIONS ({state.completedEvents.length})
            </Text>
            {state.eventLog.slice(0, 5).map(entry => (
              <View key={entry.id} style={[styles.completedItem, { borderColor: colors.border }]}>
                <Feather name="check-circle" size={14} color={colors.success} />
                <View style={styles.completedTextCol}>
                  <Text style={[styles.completedTitle, { color: colors.foreground }]} numberOfLines={1}>
                    {entry.eventTitle}
                  </Text>
                  <Text style={[styles.completedSub, { color: colors.mutedForeground }]} numberOfLines={1}>
                    {entry.choiceText}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flex: 1 },
  content: { padding: 16, gap: 16 },
  dimOverlay: { ...StyleSheet.absoluteFillObject, opacity: 0.55 },
  header: { gap: 6 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 14, fontFamily: 'Inter_700Bold', letterSpacing: 2 },
  subtitle: { fontSize: 11, fontFamily: 'Inter_400Regular' },
  transmissionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderWidth: 1,
    borderRadius: 4,
  },
  transmissionBadgeText: { fontSize: 9, fontFamily: 'Inter_700Bold', letterSpacing: 0.5 },
  generatingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderRadius: 8,
    padding: 18,
  },
  generatingTextCol: { flex: 1, gap: 4 },
  generatingTitle: { fontSize: 13, fontFamily: 'Inter_700Bold', letterSpacing: 1 },
  generatingDesc: { fontSize: 12, fontFamily: 'Inter_400Regular', lineHeight: 17 },
  emptyState: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 8,
    padding: 32,
    alignItems: 'center',
    gap: 12,
  },
  emptyTitle: { fontSize: 13, fontFamily: 'Inter_700Bold', letterSpacing: 1.5 },
  emptyDesc: { fontSize: 12, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 18 },
  generateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderWidth: 1,
    borderRadius: 6,
    marginTop: 4,
  },
  generateBtnText: { fontSize: 12, fontFamily: 'Inter_600SemiBold', letterSpacing: 1 },
  eventCard: {
    borderWidth: 1.5,
    borderRadius: 8,
    padding: 16,
    gap: 12,
  },
  eventMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  eventTags: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  typeTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderRadius: 4,
  },
  typeTagText: { fontSize: 10, fontFamily: 'Inter_700Bold', letterSpacing: 0.5 },
  timestamp: { fontSize: 10, fontFamily: 'Inter_400Regular' },
  eventTitle: { fontSize: 17, fontFamily: 'Inter_700Bold', lineHeight: 24 },
  eventDesc: { fontSize: 13, fontFamily: 'Inter_400Regular', lineHeight: 20 },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: '#1E3A5F' },
  choiceLabel: { fontSize: 10, fontFamily: 'Inter_700Bold', letterSpacing: 1.5 },
  choiceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 6,
    borderWidth: 1,
  },
  choiceNum: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  choiceNumText: { fontSize: 11, fontFamily: 'Inter_700Bold' },
  choiceContent: { flex: 1, gap: 4 },
  choiceText: { fontSize: 13, fontFamily: 'Inter_500Medium', lineHeight: 18 },
  choicePreview: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choiceHint: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  historySection: { gap: 8 },
  historyTitle: { fontSize: 10, fontFamily: 'Inter_600SemiBold', letterSpacing: 1.5 },
  completedItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderWidth: 1,
    borderRadius: 6,
  },
  completedTextCol: { flex: 1, gap: 2 },
  completedTitle: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  completedSub: { fontSize: 11, fontFamily: 'Inter_400Regular' },
});
