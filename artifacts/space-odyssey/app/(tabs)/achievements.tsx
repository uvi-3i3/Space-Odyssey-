import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useGame } from '@/context/GameContext';
import { useColors } from '@/hooks/useColors';
import { BlueprintGrid } from '@/components/BlueprintGrid';
import { ProgressBar } from '@/components/ProgressBar';
import { RarityBadge } from '@/components/RarityBadge';

const DAY_REWARDS = [
  { day: 1, rewards: 'Credits +50, Fe +20' },
  { day: 2, rewards: 'Credits +100, Fe +40' },
  { day: 3, rewards: 'Credits +150, Fe +60' },
  { day: 4, rewards: 'Credits +200, Fe +80' },
  { day: 5, rewards: 'Credits +250, Fe +100' },
  { day: 6, rewards: 'Credits +300, Fe +120' },
  { day: 7, rewards: 'Prestige Token + Credits +500' },
];

export default function AchievementsScreen() {
  const { state, claimDailyReward } = useGame();
  const colors = useColors();
  const [tab, setTab] = useState<'achievements' | 'daily'>('achievements');
  const [claimResult, setClaimResult] = useState<{ success: boolean; message: string } | null>(null);

  const unlocked = state.achievements.filter(a => a.unlocked);
  const locked = state.achievements.filter(a => !a.unlocked);

  const getRarityColor = (rarity: string) => {
    switch (rarity) {
      case 'legendary': return colors.legendary;
      case 'epic': return colors.epic;
      case 'rare': return colors.rare;
      case 'uncommon': return colors.uncommon;
      default: return colors.common;
    }
  };

  const handleClaimDaily = () => {
    const result = claimDailyReward();
    if (result.success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setClaimResult({ success: true, message: `Day ${Math.min(state.loginStreak, 7)} reward claimed!` });
    } else {
      setClaimResult({ success: false, message: 'Already claimed today. Come back tomorrow!' });
    }
    setTimeout(() => setClaimResult(null), 3000);
  };

  const paddingBottom = Platform.OS === 'web' ? 34 : 0;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <BlueprintGrid />

      <View style={[styles.tabRow, { borderBottomColor: colors.border }]}>
        {(['achievements', 'daily'] as const).map(t => (
          <TouchableOpacity
            key={t}
            style={[styles.tabBtn, { borderBottomColor: tab === t ? colors.primary : 'transparent' }]}
            onPress={() => setTab(t)}
          >
            <Text style={[styles.tabText, { color: tab === t ? colors.primary : colors.mutedForeground }]}>
              {t.toUpperCase()}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: 100 + paddingBottom }]}
        showsVerticalScrollIndicator={false}
      >
        {tab === 'achievements' && (
          <>
            <View style={styles.header}>
              <Text style={[styles.title, { color: colors.primary }]}>ACHIEVEMENT LOG</Text>
              <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
                {unlocked.length}/{state.achievements.length} UNLOCKED
              </Text>
              <ProgressBar progress={unlocked.length / state.achievements.length} color={colors.primary} height={4} />
            </View>

            <View style={styles.prestRow}>
              <View style={[styles.prestStat, { borderColor: colors.legendary }]}>
                <Feather name="award" size={16} color={colors.legendary} />
                <Text style={[styles.prestNum, { color: colors.legendary }]}>{state.prestigePoints}</Text>
                <Text style={[styles.prestLabel, { color: colors.mutedForeground }]}>PRESTIGE PTS</Text>
              </View>
              <View style={[styles.prestStat, { borderColor: colors.primary }]}>
                <Feather name="repeat" size={16} color={colors.primary} />
                <Text style={[styles.prestNum, { color: colors.primary }]}>{state.prestigeLevel}</Text>
                <Text style={[styles.prestLabel, { color: colors.mutedForeground }]}>PRESTIGE LVL</Text>
              </View>
            </View>

            {unlocked.length > 0 && (
              <>
                <Text style={[styles.sectionLabel, { color: colors.success }]}>// UNLOCKED</Text>
                {unlocked.map(a => (
                  <View key={a.id} style={[styles.achievCard, { borderColor: getRarityColor(a.rarity), backgroundColor: colors.card }]}>
                    <View style={[styles.achIcon, { backgroundColor: getRarityColor(a.rarity) + '22', borderColor: getRarityColor(a.rarity) }]}>
                      <Feather name="check" size={18} color={getRarityColor(a.rarity)} />
                    </View>
                    <View style={styles.achInfo}>
                      <View style={styles.achHeader}>
                        <Text style={[styles.achName, { color: colors.foreground }]}>{a.name}</Text>
                        <RarityBadge rarity={a.rarity} />
                      </View>
                      <Text style={[styles.achDesc, { color: colors.mutedForeground }]}>{a.description}</Text>
                      <Text style={[styles.achReward, { color: getRarityColor(a.rarity) }]}>+{a.reward} prestige pts</Text>
                    </View>
                  </View>
                ))}
              </>
            )}

            {locked.length > 0 && (
              <>
                <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>// LOCKED</Text>
                {locked.map(a => (
                  <View key={a.id} style={[styles.achievCard, { borderColor: colors.border, backgroundColor: colors.card, opacity: 0.8 }]}>
                    <View style={[styles.achIcon, { backgroundColor: colors.muted, borderColor: colors.border }]}>
                      <Feather name="lock" size={18} color={colors.mutedForeground} />
                    </View>
                    <View style={styles.achInfo}>
                      <View style={styles.achHeader}>
                        <Text style={[styles.achName, { color: colors.foreground }]}>{a.name}</Text>
                        <RarityBadge rarity={a.rarity} />
                      </View>
                      <Text style={[styles.achDesc, { color: colors.mutedForeground }]}>{a.description}</Text>
                      <View style={styles.achProgress}>
                        <ProgressBar progress={a.progress / a.target} color={getRarityColor(a.rarity)} height={4} />
                        <Text style={[styles.achProgressText, { color: colors.mutedForeground }]}>
                          {a.progress}/{a.target}
                        </Text>
                      </View>
                    </View>
                  </View>
                ))}
              </>
            )}
          </>
        )}

        {tab === 'daily' && (
          <>
            <View style={styles.header}>
              <Text style={[styles.title, { color: colors.primary }]}>DAILY REWARDS</Text>
              <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
                LOGIN STREAK: {state.loginStreak} DAYS
              </Text>
            </View>

            <View style={styles.streakRow}>
              {DAY_REWARDS.map((day, i) => {
                const dayNum = i + 1;
                const isPast = dayNum < Math.min(state.loginStreak, 7);
                const isCurrent = dayNum === Math.min(state.loginStreak, 7);
                const isFuture = dayNum > Math.min(state.loginStreak, 7);

                return (
                  <View
                    key={dayNum}
                    style={[
                      styles.dayCell,
                      {
                        borderColor: isCurrent ? colors.primary : isPast ? colors.success : colors.border,
                        backgroundColor: isCurrent ? colors.primary + '22' : isPast ? colors.success + '11' : colors.card,
                      },
                    ]}
                  >
                    <Text style={[styles.dayNum, { color: isCurrent ? colors.primary : isPast ? colors.success : colors.mutedForeground }]}>
                      D{dayNum}
                    </Text>
                    {isPast && <Feather name="check" size={14} color={colors.success} />}
                    {isCurrent && <Feather name="gift" size={14} color={colors.primary} />}
                    {isFuture && <Feather name="lock" size={12} color={colors.mutedForeground} />}
                  </View>
                );
              })}
            </View>

            <View style={[styles.currentReward, { borderColor: colors.primary, backgroundColor: colors.card }]}>
              <Feather name="gift" size={24} color={colors.primary} />
              <Text style={[styles.currentRewardTitle, { color: colors.primary }]}>
                DAY {Math.min(state.loginStreak, 7)} REWARD
              </Text>
              <Text style={[styles.currentRewardDesc, { color: colors.foreground }]}>
                {DAY_REWARDS[Math.min(state.loginStreak - 1, 6)]?.rewards}
              </Text>

              <TouchableOpacity
                style={[
                  styles.claimBtn,
                  { backgroundColor: state.dailyRewardClaimed ? colors.muted : colors.primary },
                ]}
                onPress={handleClaimDaily}
                disabled={state.dailyRewardClaimed}
              >
                <Feather
                  name={state.dailyRewardClaimed ? 'check' : 'gift'}
                  size={16}
                  color={state.dailyRewardClaimed ? colors.mutedForeground : colors.background}
                />
                <Text style={[
                  styles.claimBtnText,
                  { color: state.dailyRewardClaimed ? colors.mutedForeground : colors.background },
                ]}>
                  {state.dailyRewardClaimed ? 'CLAIMED' : 'CLAIM REWARD'}
                </Text>
              </TouchableOpacity>

              {claimResult && (
                <Text style={[styles.claimResult, { color: claimResult.success ? colors.success : colors.warning }]}>
                  {claimResult.message}
                </Text>
              )}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  tabRow: { flexDirection: 'row', borderBottomWidth: 1 },
  tabBtn: { flex: 1, paddingVertical: 12, alignItems: 'center', borderBottomWidth: 2 },
  tabText: { fontSize: 11, fontFamily: 'Inter_700Bold', letterSpacing: 1 },
  scroll: { flex: 1 },
  content: { padding: 16, gap: 14 },
  header: { gap: 6 },
  title: { fontSize: 14, fontFamily: 'Inter_700Bold', letterSpacing: 2 },
  subtitle: { fontSize: 11, fontFamily: 'Inter_400Regular' },
  prestRow: { flexDirection: 'row', gap: 12 },
  prestStat: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    paddingVertical: 16,
    borderWidth: 1,
    borderRadius: 8,
  },
  prestNum: { fontSize: 24, fontFamily: 'Inter_700Bold' },
  prestLabel: { fontSize: 9, fontFamily: 'Inter_600SemiBold', letterSpacing: 1 },
  sectionLabel: { fontSize: 11, fontFamily: 'Inter_700Bold', letterSpacing: 2 },
  achievCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, borderWidth: 1, borderRadius: 8, padding: 14 },
  achIcon: { width: 44, height: 44, borderRadius: 8, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  achInfo: { flex: 1, gap: 4 },
  achHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  achName: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  achDesc: { fontSize: 11, fontFamily: 'Inter_400Regular', lineHeight: 16 },
  achReward: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  achProgress: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  achProgressText: { fontSize: 10, fontFamily: 'Inter_400Regular', minWidth: 36 },
  streakRow: { flexDirection: 'row', gap: 8 },
  dayCell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderWidth: 1,
    borderRadius: 8,
    gap: 4,
  },
  dayNum: { fontSize: 10, fontFamily: 'Inter_700Bold' },
  currentReward: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 20,
    alignItems: 'center',
    gap: 10,
  },
  currentRewardTitle: { fontSize: 14, fontFamily: 'Inter_700Bold', letterSpacing: 1 },
  currentRewardDesc: { fontSize: 13, fontFamily: 'Inter_500Medium', textAlign: 'center', lineHeight: 20 },
  claimBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 6,
  },
  claimBtnText: { fontSize: 13, fontFamily: 'Inter_700Bold', letterSpacing: 1 },
  claimResult: { fontSize: 12, fontFamily: 'Inter_500Medium', textAlign: 'center' },
});
