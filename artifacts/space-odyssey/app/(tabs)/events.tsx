import React from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useGame } from '@/context/GameContext';
import { useColors } from '@/hooks/useColors';
import { BlueprintGrid } from '@/components/BlueprintGrid';
import { GameEvent } from '@/constants/gameData';

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

export default function EventsScreen() {
  const { state, resolveEvent, generateEvent } = useGame();
  const colors = useColors();

  const paddingBottom = Platform.OS === 'web' ? 34 : 0;

  const handleChoice = (eventId: string, choiceId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    resolveEvent(eventId, choiceId);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <BlueprintGrid />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: 100 + paddingBottom }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.primary }]}>NARRATIVE EVENTS</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            {state.activeEvents.length} ACTIVE · {state.completedEvents.length} RESOLVED
          </Text>
        </View>

        {state.activeEvents.length === 0 && (
          <View style={[styles.emptyState, { borderColor: colors.border }]}>
            <Feather name="radio" size={40} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.mutedForeground }]}>NO INCOMING SIGNALS</Text>
            <Text style={[styles.emptyDesc, { color: colors.mutedForeground }]}>
              Events occur as you explore and mine. Continue your operations to trigger narrative encounters.
            </Text>
            <TouchableOpacity
              style={[styles.generateBtn, { borderColor: colors.primary }]}
              onPress={() => { generateEvent(); Haptics.selectionAsync(); }}
            >
              <Feather name="zap" size={14} color={colors.primary} />
              <Text style={[styles.generateBtnText, { color: colors.primary }]}>SCAN FOR SIGNALS</Text>
            </TouchableOpacity>
          </View>
        )}

        {state.activeEvents.map(event => {
          const typeColor = EVENT_TYPE_COLORS[event.type] ?? colors.primary;
          const typeIcon = EVENT_TYPE_ICONS[event.type] ?? 'radio';

          return (
            <View key={event.id} style={[styles.eventCard, { borderColor: typeColor, backgroundColor: colors.card }]}>
              <View style={styles.eventMeta}>
                <View style={[styles.typeTag, { backgroundColor: typeColor + '22', borderColor: typeColor }]}>
                  <Feather name={typeIcon as any} size={11} color={typeColor} />
                  <Text style={[styles.typeTagText, { color: typeColor }]}>{event.type.toUpperCase()}</Text>
                </View>
                <Text style={[styles.timestamp, { color: colors.mutedForeground }]}>
                  {new Date(event.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>

              <Text style={[styles.eventTitle, { color: colors.foreground }]}>{event.title}</Text>
              <Text style={[styles.eventDesc, { color: colors.mutedForeground }]}>{event.description}</Text>

              <View style={styles.separator} />

              <Text style={[styles.choiceLabel, { color: typeColor }]}>// CHOOSE YOUR RESPONSE:</Text>

              {event.choices.map((choice, index) => (
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
                    {choice.resourceChanges && (
                      <View style={styles.choicePreview}>
                        {Object.entries(choice.resourceChanges).slice(0, 3).map(([k, v]) => (
                          <Text key={k} style={[styles.choiceHint, { color: v > 0 ? colors.success : colors.destructive }]}>
                            {v > 0 ? '+' : ''}{v} {k}
                          </Text>
                        ))}
                      </View>
                    )}
                    {choice.reputationChange && (
                      <Text style={[styles.choiceHint, { color: choice.reputationChange > 0 ? colors.success : colors.destructive }]}>
                        Reputation {choice.reputationChange > 0 ? '+' : ''}{choice.reputationChange}
                      </Text>
                    )}
                  </View>
                  <Feather name="chevron-right" size={16} color={typeColor} />
                </TouchableOpacity>
              ))}
            </View>
          );
        })}

        {state.completedEvents.length > 0 && (
          <View style={styles.historySection}>
            <Text style={[styles.historyTitle, { color: colors.mutedForeground }]}>
              // COMPLETED EVENTS ({state.completedEvents.length})
            </Text>
            {state.completedEvents.slice(0, 5).map(eventId => (
              <View key={eventId} style={[styles.completedItem, { borderColor: colors.border }]}>
                <Feather name="check-circle" size={14} color={colors.success} />
                <Text style={[styles.completedText, { color: colors.mutedForeground }]}>
                  Event resolved
                </Text>
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
  header: { gap: 4 },
  title: { fontSize: 14, fontFamily: 'Inter_700Bold', letterSpacing: 2 },
  subtitle: { fontSize: 11, fontFamily: 'Inter_400Regular' },
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
    gap: 8,
    padding: 10,
    borderWidth: 1,
    borderRadius: 6,
  },
  completedText: { fontSize: 12, fontFamily: 'Inter_400Regular' },
});
