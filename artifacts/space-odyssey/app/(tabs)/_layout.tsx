import { Tabs } from "expo-router";
import { Feather } from "@expo/vector-icons";
import React from "react";
import { Platform, StyleSheet, View } from "react-native";
import { useColors } from "@/hooks/useColors";
import { AnimatedTabIcon } from "@/components/AnimatedTabIcon";

function ClassicTabLayout() {
  const colors = useColors();
  const isWeb = Platform.OS === "web";

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedForeground,
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopWidth: 1.5,
          borderTopColor: colors.primary + '55',
          elevation: 0,
          height: isWeb ? 84 : 62,
          shadowOpacity: 0,
        },
        tabBarBackground: () => (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.card }]} />
        ),
        tabBarLabelStyle: {
          fontSize: 9,
          fontFamily: 'Inter_700Bold',
          letterSpacing: 1.5,
          textTransform: 'uppercase',
          marginBottom: 2,
        },
        tabBarIndicatorStyle: {
          backgroundColor: colors.secondary,
          height: 2,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Planet",
          tabBarIcon: ({ color, focused }) => <AnimatedTabIcon name="globe" color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="command"
        options={{
          title: "Command",
          tabBarIcon: ({ color, focused }) => <AnimatedTabIcon name="sliders" color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="intel"
        options={{
          title: "Intel",
          tabBarIcon: ({ color, focused }) => <AnimatedTabIcon name="radio" color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen name="planet" options={{ href: null }} />
      <Tabs.Screen name="buildings" options={{ href: null }} />
      <Tabs.Screen name="tech" options={{ href: null }} />
      <Tabs.Screen name="events" options={{ href: null }} />
      <Tabs.Screen name="combat" options={{ href: null }} />
      <Tabs.Screen name="achievements" options={{ href: null }} />
      <Tabs.Screen name="settings" options={{ href: null }} />
    </Tabs>
  );
}

export default function TabLayout() {
  return <ClassicTabLayout />;
}
