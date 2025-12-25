// ============================================
// GREPRE SMART LIFE - APP ENTRY POINT
// Main application component
// ============================================

import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { RootNavigator } from '@/navigation';
import { useAppStore } from '@/stores';
import { LoadingScreen } from '@/components';
import { useTheme } from '@/hooks';

function AppContent() {
  const { colors, isDark } = useTheme();
  const { isInitialized, isLoading, initialize } = useAppStore();

  useEffect(() => {
    initialize();
  }, []);

  if (!isInitialized || isLoading) {
    return <LoadingScreen message="Loading GrePre..." />;
  }

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <RootNavigator />
    </>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AppContent />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
