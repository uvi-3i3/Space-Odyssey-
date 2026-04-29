import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts as useInterFonts,
} from "@expo-google-fonts/inter";
import {
  SpaceMono_400Regular,
  SpaceMono_700Bold,
} from "@expo-google-fonts/space-mono";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { Pressable, Text, View } from "react-native";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { GameProvider, useGame } from "@/context/GameContext";
import { ResourceBar } from "@/components/ResourceBar";
import { OnboardingFlow } from "@/components/OnboardingFlow";
import { InYourAbsenceModal } from "@/components/InYourAbsenceModal";

// Phase 3 — small toast that surfaces save/load failures from GameContext.
// Lives inside GameProvider so it can subscribe to `lastError`. Sits above
// the app via `position: 'absolute'` and high zIndex.
function SaveErrorBanner() {
  const { lastError, clearError } = useGame();
  if (!lastError) return null;
  return (
    <View
      pointerEvents="box-none"
      style={{
        position: "absolute",
        top: 60,
        left: 12,
        right: 12,
        zIndex: 9999,
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        padding: 12,
        backgroundColor: "#7A1F1F",
        borderColor: "#FF6868",
        borderWidth: 1,
        borderRadius: 8,
      }}
    >
      <Text style={{ flex: 1, color: "#FFE5E5", fontSize: 13 }}>{lastError}</Text>
      <Pressable
        onPress={clearError}
        hitSlop={8}
        style={{ paddingHorizontal: 8, paddingVertical: 2 }}
      >
        <Text style={{ color: "#FFFFFF", fontWeight: "700" }}>×</Text>
      </Pressable>
    </View>
  );
}

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function RootLayoutNav() {
  // Phase 6 — Onboarding gate. Until the player completes the intro, we
  // render the full-screen narrative flow; tabs + HUD are entirely hidden.
  const { state } = useGame();
  if (!state.onboarded) {
    return <OnboardingFlow />;
  }
  return (
    <>
      <Stack screenOptions={{ headerBackTitle: "Back" }}>
        <Stack.Screen
          name="(tabs)"
          options={{
            headerShown: true,
            header: () => <ResourceBar />,
          }}
        />
      </Stack>
      {/* Phase 6 — surface the In-Your-Absence narrative once per session. */}
      <InYourAbsenceModal />
    </>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useInterFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    SpaceMono_400Regular,
    SpaceMono_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <GestureHandlerRootView style={{ flex: 1 }}>
            <KeyboardProvider>
              <GameProvider>
                <RootLayoutNav />
                <SaveErrorBanner />
              </GameProvider>
            </KeyboardProvider>
          </GestureHandlerRootView>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
