import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useGame } from '@/context/GameContext';
import { useColors } from '@/hooks/useColors';
import { PressableScale } from '@/components/PressableScale';
import { Starfield } from '@/components/Starfield';
import { BlueprintGrid } from '@/components/BlueprintGrid';
import { GlowPulse } from '@/components/GlowPulse';
import { FadeSlideIn } from '@/components/FadeSlideIn';
import { CommanderBackground, BACKGROUND_DETAILS } from '@/constants/gameData';

type Step = 'intro' | 'name' | 'background' | 'planet' | 'begin';

const STEPS: Step[] = ['intro', 'name', 'background', 'planet', 'begin'];

/**
 * Phase 6 — Onboarding gate.
 *
 * Renders fullscreen on first launch (state.onboarded === false) and walks
 * the player through five short, narrative scenes. Output is committed to
 * GameContext via completeOnboarding when they tap "BEGIN".
 *
 * Writing standard: SHOW, don't tell. No bullet lists, no game terms in
 * scene 1; we earn the right to use them by scene 4.
 */
export function OnboardingFlow() {
  const { completeOnboarding } = useGame();
  const colors = useColors();
  const [step, setStep] = useState<Step>('intro');
  const [commanderName, setCommanderName] = useState('');
  const [planetName, setPlanetName] = useState('');
  const [background, setBackground] = useState<CommanderBackground | null>(null);

  const goNext = () => {
    const idx = STEPS.indexOf(step);
    if (idx < STEPS.length - 1) setStep(STEPS[idx + 1]);
  };

  const finish = () => {
    if (!background) return;
    completeOnboarding({
      commanderName: commanderName.trim() || 'Commander',
      planetName: planetName.trim() || 'Kepler-186f',
      background,
    });
  };

  const stepIdx = STEPS.indexOf(step);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <BlueprintGrid />
      <Starfield count={70} opacity={0.6} />

      <KeyboardAvoidingView
        style={styles.kav}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.progressRow}>
            {STEPS.map((s, i) => (
              <View
                key={s}
                style={[
                  styles.progressDot,
                  {
                    backgroundColor: i <= stepIdx ? colors.primary : colors.border,
                    width: i === stepIdx ? 22 : 6,
                  },
                ]}
              />
            ))}
          </View>

          {step === 'intro' && (
            <FadeSlideIn duration={500} offset={12}>
              <View style={styles.scene}>
                <GlowPulse color={colors.primary} duration={3200} min={0.15} max={0.4}>
                  <Feather name="globe" size={64} color={colors.primary} />
                </GlowPulse>
                <Text style={[styles.eyebrow, { color: colors.primary }]}>YEAR 2387</Text>
                <Text style={[styles.title, { color: colors.foreground }]}>
                  THE LAST SHIP HAS LANDED
                </Text>
                <Text style={[styles.body, { color: colors.foreground }]}>
                  Earth fell in fire and silence. The Helios Drive carried 412 souls across
                  the dark to a planet you only knew from telescope smears.
                </Text>
                <Text style={[styles.body, { color: colors.foreground }]}>
                  The hull groans under foreign gravity. The dust outside the viewport is the
                  colour of old blood. Somewhere in the cargo bay, a child is crying.
                </Text>
                <Text style={[styles.body, { color: colors.foreground }]}>
                  Your name was on the manifest as Commander.
                </Text>
                <PrimaryButton onPress={goNext} label="STEP OUTSIDE" icon="arrow-right" />
              </View>
            </FadeSlideIn>
          )}

          {step === 'name' && (
            <FadeSlideIn duration={500} offset={12}>
              <View style={styles.scene}>
                <Feather name="user" size={48} color={colors.primary} />
                <Text style={[styles.eyebrow, { color: colors.primary }]}>IDENTIFY YOURSELF</Text>
                <Text style={[styles.title, { color: colors.foreground }]}>
                  COMMANDER, WHAT IS YOUR NAME?
                </Text>
                <Text style={[styles.body, { color: colors.mutedForeground }]}>
                  History will write it down. Make it brief.
                </Text>
                <TextInput
                  style={[styles.input, { borderColor: colors.primary, color: colors.foreground, backgroundColor: colors.card }]}
                  placeholder="ENTER YOUR NAME"
                  placeholderTextColor={colors.mutedForeground}
                  value={commanderName}
                  onChangeText={setCommanderName}
                  maxLength={24}
                  autoFocus
                  autoCapitalize="words"
                />
                <PrimaryButton
                  onPress={goNext}
                  label="CONTINUE"
                  icon="arrow-right"
                  disabled={commanderName.trim().length === 0}
                />
              </View>
            </FadeSlideIn>
          )}

          {step === 'background' && (
            <FadeSlideIn duration={500} offset={12}>
              <View style={styles.scene}>
                <Feather name="award" size={48} color={colors.primary} />
                <Text style={[styles.eyebrow, { color: colors.primary }]}>BEFORE THE FALL</Text>
                <Text style={[styles.title, { color: colors.foreground }]}>
                  WHO WERE YOU ON EARTH?
                </Text>
                <Text style={[styles.body, { color: colors.mutedForeground }]}>
                  This is the role the colonists know you for. It will shape your first hours
                  on the surface.
                </Text>

                {(['soldier', 'scientist', 'diplomat'] as CommanderBackground[]).map(bg => {
                  const d = BACKGROUND_DETAILS[bg];
                  const selected = background === bg;
                  return (
                    <PressableScale
                      key={bg}
                      style={[
                        styles.bgCard,
                        {
                          borderColor: selected ? colors.primary : colors.border,
                          backgroundColor: selected ? colors.primary + '14' : colors.card,
                        },
                      ]}
                      onPress={() => setBackground(bg)}
                      glow={selected}
                      glowColor={colors.primary}
                      scaleTo={0.97}
                    >
                      <Text style={[styles.bgLabel, { color: selected ? colors.primary : colors.foreground }]}>
                        {d.label}
                      </Text>
                      <Text style={[styles.bgTagline, { color: colors.foreground }]}>
                        {d.tagline}
                      </Text>
                      <Text style={[styles.bgBonus, { color: colors.secondary, fontFamily: 'SpaceMono_700Bold' }]}>
                        ✦ {d.bonus}
                      </Text>
                    </PressableScale>
                  );
                })}

                <PrimaryButton
                  onPress={goNext}
                  label="CONTINUE"
                  icon="arrow-right"
                  disabled={!background}
                />
              </View>
            </FadeSlideIn>
          )}

          {step === 'planet' && (
            <FadeSlideIn duration={500} offset={12}>
              <View style={styles.scene}>
                <Feather name="map-pin" size={48} color={colors.primary} />
                <Text style={[styles.eyebrow, { color: colors.primary }]}>NEW HOME</Text>
                <Text style={[styles.title, { color: colors.foreground }]}>
                  WHAT WILL WE CALL THIS WORLD?
                </Text>
                <Text style={[styles.body, { color: colors.mutedForeground }]}>
                  The catalogues called it Kepler-186f. The colonists are waiting for a real
                  name — yours.
                </Text>
                <TextInput
                  style={[styles.input, { borderColor: colors.primary, color: colors.foreground, backgroundColor: colors.card }]}
                  placeholder="NAME THE PLANET"
                  placeholderTextColor={colors.mutedForeground}
                  value={planetName}
                  onChangeText={setPlanetName}
                  maxLength={24}
                  autoFocus
                  autoCapitalize="words"
                />
                <PrimaryButton
                  onPress={goNext}
                  label="CONTINUE"
                  icon="arrow-right"
                  disabled={planetName.trim().length === 0}
                />
              </View>
            </FadeSlideIn>
          )}

          {step === 'begin' && (
            <FadeSlideIn duration={500} offset={12}>
              <View style={styles.scene}>
                <GlowPulse color={colors.secondary} duration={2400} min={0.2} max={0.55}>
                  <Feather name="check-circle" size={64} color={colors.secondary} />
                </GlowPulse>
                <Text style={[styles.eyebrow, { color: colors.secondary }]}>READY</Text>
                <Text style={[styles.title, { color: colors.foreground }]}>
                  COMMANDER {commanderName.trim().toUpperCase()},
                </Text>
                <Text style={[styles.body, { color: colors.foreground }]}>
                  The colonists of {planetName.trim()} are looking to you. Your engineer Kael
                  has the basic mine running. There is no other plan.
                </Text>
                <Text style={[styles.body, { color: colors.foreground }]}>
                  Get them to tomorrow.
                </Text>
                <PrimaryButton onPress={finish} label="BEGIN COMMAND" icon="play" highlight />
              </View>
            </FadeSlideIn>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function PrimaryButton({
  onPress, label, icon, disabled, highlight,
}: { onPress: () => void; label: string; icon: any; disabled?: boolean; highlight?: boolean }) {
  const colors = useColors();
  const bg = highlight ? colors.secondary : colors.primary;
  return (
    <PressableScale
      style={[styles.primaryBtn, {
        backgroundColor: disabled ? colors.muted : bg,
        borderColor: disabled ? colors.border : bg,
        opacity: disabled ? 0.55 : 1,
      }]}
      onPress={onPress}
      disabled={disabled}
      glow={!disabled}
      glowColor={bg}
      scaleTo={0.97}
    >
      <Feather name={icon} size={14} color="#FFFFFF" />
      <Text style={styles.primaryBtnText}>{label}</Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  kav: { flex: 1 },
  scroll: { padding: 22, paddingTop: 60, paddingBottom: 44, gap: 16 },
  progressRow: {
    flexDirection: 'row', gap: 5, alignItems: 'center', justifyContent: 'center',
    marginBottom: 20,
  },
  progressDot: {
    height: 6, borderRadius: 3,
  },
  scene: { gap: 14, alignItems: 'flex-start' },
  eyebrow: { fontSize: 10, fontFamily: 'Inter_700Bold', letterSpacing: 3, marginTop: 6 },
  title: {
    fontSize: 22, fontFamily: 'Inter_700Bold', letterSpacing: 1, lineHeight: 28,
  },
  body: {
    fontSize: 14, lineHeight: 22, fontFamily: 'Inter_400Regular',
  },
  input: {
    width: '100%',
    borderWidth: 1.5, borderRadius: 6, padding: 14,
    fontSize: 16, fontFamily: 'SpaceMono_400Regular', letterSpacing: 1,
    marginTop: 4,
  },
  bgCard: {
    width: '100%', borderWidth: 1.5, borderRadius: 8, padding: 14, gap: 6,
  },
  bgLabel: { fontSize: 13, fontFamily: 'Inter_700Bold', letterSpacing: 2 },
  bgTagline: { fontSize: 13, lineHeight: 19, fontFamily: 'Inter_400Regular' },
  bgBonus: { fontSize: 11, letterSpacing: 0.5 },
  primaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 14, paddingHorizontal: 22,
    borderWidth: 1.5, borderRadius: 6,
    width: '100%', marginTop: 8,
  },
  primaryBtnText: {
    color: '#FFFFFF', fontSize: 12, fontFamily: 'Inter_700Bold', letterSpacing: 2,
  },
});
