/**
 * Root layout — expo-router's entry point for the whole app.
 *
 * Owns three things no individual screen should have to: loading the app's
 * four font files before anything renders, configuring RevenueCat exactly
 * once, and the cold-start rule from docs/design-system.md (`grafts` #5 /
 * `interaction_states` LOADING) — a bare Paper screen for up to 150ms, and
 * only past that a single static "Haggle" wordmark that fades in once and
 * holds. Never a spinner, never a looping splash.
 */
import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { useFonts } from 'expo-font';
import { PublicSans_400Regular, PublicSans_600SemiBold } from '@expo-google-fonts/public-sans';
import { IBMPlexMono_400Regular, IBMPlexMono_500Medium } from '@expo-google-fonts/ibm-plex-mono';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { configurePurchases, PremiumProvider } from '../lib/purchases';
import { COLORS, useReducedMotion } from '../theme/tokens';
import { typography } from '../theme/typography';

// RevenueCat only needs configuring once per app session — `configurePurchases`
// guards itself against a second call (see lib/purchases.ts), so this and
// PremiumProvider's own bootstrap effect can't reconfigure the SDK mid-session.
// Doing it here too, at module load, means a missing
// EXPO_PUBLIC_REVENUECAT_TEST_KEY is logged the instant the app starts rather
// than only once a screen first reaches for `usePremium()`.
try {
  configurePurchases();
} catch (err) {
  // PremiumProvider surfaces this same failure through its `error` state for
  // the UI to react to; this call site only needs to make sure it can never
  // crash the root render before that provider has even mounted.
  if (__DEV__) {
    console.error('[haggle] configurePurchases failed at startup', err);
  }
}

/** How long the bare Paper screen is allowed to hold before the wordmark may appear. */
const COLD_START_HOLD_MS = 150;
/** How long the wordmark itself takes to fade in, once it appears. */
const WORDMARK_FADE_MS = 200;

/**
 * The screen shown while fonts are still loading. Bundled fonts typically
 * resolve in a handful of milliseconds, so `showWordmark` — and the wordmark
 * it gates — is a fallback for a genuinely slow start, not the expected path.
 */
function ColdStartScreen({ showWordmark }: { showWordmark: boolean }) {
  const reducedMotion = useReducedMotion();
  const opacity = useRef(new Animated.Value(reducedMotion ? 1 : 0)).current;

  useEffect(() => {
    if (!showWordmark) return;
    if (reducedMotion) {
      opacity.setValue(1);
      return;
    }
    Animated.timing(opacity, {
      toValue: 1,
      duration: WORDMARK_FADE_MS,
      useNativeDriver: true,
    }).start();
  }, [showWordmark, reducedMotion, opacity]);

  return (
    <View style={styles.coldStart}>
      {showWordmark && (
        <Animated.Text accessibilityRole="header" style={[typography.h1, { opacity }]}>
          Haggle
        </Animated.Text>
      )}
    </View>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    PublicSans_400Regular,
    PublicSans_600SemiBold,
    IBMPlexMono_400Regular,
    IBMPlexMono_500Medium,
  });

  // `ready` gates the real app tree; `showWordmark` gates the one element
  // allowed on the cold-start screen. Fonts finishing (or failing — a failed
  // font load still lets the app through, on the system font, rather than
  // hanging on a bare screen forever) both count as "done loading."
  const [ready, setReady] = useState(false);
  const [showWordmark, setShowWordmark] = useState(false);

  useEffect(() => {
    if (!fontsLoaded && !fontError) return;
    if (fontError && __DEV__) {
      console.error('[haggle] font load failed', fontError);
    }
    setReady(true);
  }, [fontsLoaded, fontError]);

  useEffect(() => {
    const timer = setTimeout(() => setShowWordmark(true), COLD_START_HOLD_MS);
    return () => clearTimeout(timer);
  }, []);

  if (!ready) {
    return <ColdStartScreen showWordmark={showWordmark} />;
  }

  return (
    <SafeAreaProvider>
      <PremiumProvider>
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: COLORS.paper },
          }}
        />
      </PremiumProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  coldStart: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.paper,
  },
});
