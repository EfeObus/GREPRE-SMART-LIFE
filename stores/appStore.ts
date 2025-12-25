// ============================================
// GREPRE SMART LIFE - APP STORE
// Global app state management
// ============================================

import { create } from 'zustand';
import type { UserProfile, AppSettings, Reminder } from '@/types';
import { userStorage, reminderStorage } from '@/services';
import { biometricService, notificationService } from '@/services';
import { DEFAULT_SETTINGS } from '@/constants';

interface AppState {
  // User & Settings
  user: UserProfile | null;
  settings: AppSettings;
  isOnboardingComplete: boolean;

  // Auth & Security
  isAuthenticated: boolean;
  biometricStatus: {
    isAvailable: boolean;
    isEnrolled: boolean;
    biometricType: 'fingerprint' | 'facial' | 'iris' | 'none';
  };

  // Reminders
  reminders: Reminder[];
  unreadReminderCount: number;

  // App State
  isLoading: boolean;
  isInitialized: boolean;
  error: string | null;

  // Theme
  colorScheme: 'light' | 'dark';

  // Actions
  initialize: () => Promise<void>;
  authenticate: () => Promise<boolean>;
  updateSettings: (settings: Partial<AppSettings>) => Promise<void>;
  updateProfile: (profile: Partial<UserProfile>) => Promise<void>;
  completeOnboarding: () => Promise<void>;
  fetchReminders: () => Promise<void>;
  markReminderAsRead: (reminderId: string) => Promise<void>;
  setColorScheme: (scheme: 'light' | 'dark') => void;
  clearError: () => void;
  logout: () => Promise<void>;
}

export const useAppStore = create<AppState>((set, get) => ({
  // Initial state
  user: null,
  settings: DEFAULT_SETTINGS,
  isOnboardingComplete: false,
  isAuthenticated: false,
  biometricStatus: {
    isAvailable: false,
    isEnrolled: false,
    biometricType: 'none',
  },
  reminders: [],
  unreadReminderCount: 0,
  isLoading: false,
  isInitialized: false,
  error: null,
  colorScheme: 'light',

  // Initialize the app
  initialize: async () => {
    set({ isLoading: true, error: null });
    try {
      // Check onboarding status
      const isOnboardingComplete = await userStorage.isOnboardingComplete();

      // Load user profile
      const user = await userStorage.getProfile();

      // Load settings
      const savedSettings = await userStorage.getSettings();
      const settings = { ...DEFAULT_SETTINGS, ...savedSettings };

      // Check biometric availability
      const biometricStatus = await biometricService.checkAvailability();

      // Request notification permissions
      await notificationService.requestPermissions();

      // Load reminders
      const reminders = await reminderStorage.getAll();
      const unreadReminderCount = reminders.filter((r) => !r.isRead).length;

      // Determine color scheme
      const colorScheme = settings.theme === 'system' ? 'light' : settings.theme;

      set({
        isOnboardingComplete,
        user,
        settings,
        biometricStatus,
        reminders,
        unreadReminderCount,
        colorScheme,
        isInitialized: true,
        isLoading: false,
      });
    } catch (error) {
      console.error('Error initializing app:', error);
      set({ error: 'Failed to initialize app', isLoading: false, isInitialized: true });
    }
  },

  // Authenticate with biometrics
  authenticate: async () => {
    const { settings, biometricStatus } = get();

    // If biometric is not enabled, skip authentication
    if (!settings.biometricEnabled || !biometricStatus.isAvailable) {
      set({ isAuthenticated: true });
      return true;
    }

    const result = await biometricService.authenticate();
    if (result.success) {
      set({ isAuthenticated: true });
      return true;
    } else {
      set({ error: result.error || 'Authentication failed' });
      return false;
    }
  },

  // Update settings
  updateSettings: async (newSettings: Partial<AppSettings>) => {
    try {
      const currentSettings = get().settings;
      const updatedSettings = { ...currentSettings, ...newSettings };
      
      await userStorage.saveSettings(updatedSettings);
      
      // Update biometric setting if changed
      if (newSettings.biometricEnabled !== undefined) {
        await biometricService.setBiometricEnabled(newSettings.biometricEnabled);
      }

      // Update color scheme if theme changed
      const colorScheme = updatedSettings.theme === 'system' ? 'light' : updatedSettings.theme;

      set({ settings: updatedSettings, colorScheme });
    } catch (error) {
      console.error('Error updating settings:', error);
      set({ error: 'Failed to update settings' });
    }
  },

  // Update profile
  updateProfile: async (profileUpdates: Partial<UserProfile>) => {
    try {
      const currentProfile = get().user;
      const updatedProfile = {
        ...currentProfile,
        ...profileUpdates,
      } as UserProfile;

      await userStorage.saveProfile(updatedProfile);
      set({ user: updatedProfile });
    } catch (error) {
      console.error('Error updating profile:', error);
      set({ error: 'Failed to update profile' });
    }
  },

  // Complete onboarding
  completeOnboarding: async () => {
    try {
      await userStorage.setOnboardingComplete();
      set({ isOnboardingComplete: true });
    } catch (error) {
      console.error('Error completing onboarding:', error);
      set({ error: 'Failed to complete onboarding' });
    }
  },

  // Fetch reminders
  fetchReminders: async () => {
    try {
      const reminders = await reminderStorage.getAll();
      const unreadReminderCount = reminders.filter((r) => !r.isRead).length;
      set({ reminders, unreadReminderCount });
    } catch (error) {
      console.error('Error fetching reminders:', error);
    }
  },

  // Mark reminder as read
  markReminderAsRead: async (reminderId: string) => {
    try {
      await reminderStorage.markAsRead(reminderId);
      await get().fetchReminders();
    } catch (error) {
      console.error('Error marking reminder as read:', error);
    }
  },

  // Set color scheme
  setColorScheme: (scheme: 'light' | 'dark') => {
    set({ colorScheme: scheme });
  },

  // Clear error
  clearError: () => {
    set({ error: null });
  },

  // Logout
  logout: async () => {
    set({
      isAuthenticated: false,
      user: null,
    });
  },
}));
