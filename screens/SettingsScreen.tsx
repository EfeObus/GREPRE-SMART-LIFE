// ============================================
// GREPRE SMART LIFE - SETTINGS SCREEN
// App settings and preferences
// ============================================

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks';
import { useAppStore } from '@/stores';
import { Card, Divider, Button } from '@/components';
import { LAYOUT, CURRENCY_OPTIONS, APP_VERSION } from '@/constants';

export function SettingsScreen({ navigation }: any) {
  const { colors } = useTheme();
  const { settings, updateSettings, user, biometricStatus } = useAppStore();

  const handleToggleBiometric = async (value: boolean) => {
    if (!biometricStatus.isAvailable) {
      Alert.alert(
        'Not Available',
        'Biometric authentication is not available on this device.'
      );
      return;
    }

    if (!biometricStatus.isEnrolled) {
      Alert.alert(
        'Not Enrolled',
        'Please set up Face ID or fingerprint in your device settings first.'
      );
      return;
    }

    await updateSettings({ biometricEnabled: value });
  };

  const handleToggleNotifications = async (value: boolean) => {
    await updateSettings({ notificationsEnabled: value });
  };

  const handleThemeChange = (theme: 'light' | 'dark' | 'system') => {
    updateSettings({ theme });
  };

  const handleCurrencyChange = () => {
    Alert.alert(
      'Select Currency',
      undefined,
      CURRENCY_OPTIONS.slice(0, 5).map((currency) => ({
        text: `${currency.symbol} ${currency.name}`,
        onPress: () => updateSettings({ currency: currency.code }),
      })).concat([{ text: 'Cancel', style: 'cancel' }]) as any
    );
  };

  const handleClearData = () => {
    Alert.alert(
      'Clear All Data',
      'This will delete all your bills, documents, and settings. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Everything',
          style: 'destructive',
          onPress: () => {
            // TODO: Implement data clearing
            Alert.alert('Data Cleared', 'All your data has been deleted.');
          },
        },
      ]
    );
  };

  const getBiometricLabel = () => {
    switch (biometricStatus.biometricType) {
      case 'facial':
        return 'Face ID';
      case 'fingerprint':
        return 'Touch ID / Fingerprint';
      case 'iris':
        return 'Iris Scan';
      default:
        return 'Biometric';
    }
  };

  const SettingRow = ({
    icon,
    label,
    value,
    onPress,
    showArrow = true,
    rightComponent,
  }: {
    icon: string;
    label: string;
    value?: string;
    onPress?: () => void;
    showArrow?: boolean;
    rightComponent?: React.ReactNode;
  }) => (
    <TouchableOpacity
      style={styles.settingRow}
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={onPress ? 0.7 : 1}
    >
      <View style={[styles.settingIcon, { backgroundColor: colors.surfaceVariant }]}>
        <Ionicons name={icon as any} size={20} color={colors.primary} />
      </View>
      <View style={styles.settingContent}>
        <Text style={[styles.settingLabel, { color: colors.text }]}>{label}</Text>
        {value && (
          <Text style={[styles.settingValue, { color: colors.textSecondary }]}>{value}</Text>
        )}
      </View>
      {rightComponent}
      {showArrow && onPress && (
        <Ionicons name="chevron-forward" size={20} color={colors.textLight} />
      )}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Settings</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Profile Section */}
        <Card style={styles.section}>
          <TouchableOpacity
            style={styles.profileRow}
            onPress={() => navigation.navigate('Profile')}
          >
            <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
              <Text style={styles.avatarText}>
                {user?.name?.charAt(0).toUpperCase() || 'U'}
              </Text>
            </View>
            <View style={styles.profileInfo}>
              <Text style={[styles.profileName, { color: colors.text }]}>
                {user?.name || 'Set up your profile'}
              </Text>
              <Text style={[styles.profileEmail, { color: colors.textSecondary }]}>
                {user?.email || 'Tap to add details'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textLight} />
          </TouchableOpacity>
        </Card>

        {/* Security Section */}
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>SECURITY</Text>
        <Card style={styles.section}>
          <SettingRow
            icon="finger-print"
            label={getBiometricLabel()}
            showArrow={false}
            rightComponent={
              <Switch
                value={settings.biometricEnabled}
                onValueChange={handleToggleBiometric}
                trackColor={{ true: colors.primary }}
              />
            }
          />
        </Card>

        {/* Notifications Section */}
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>NOTIFICATIONS</Text>
        <Card style={styles.section}>
          <SettingRow
            icon="notifications"
            label="Push Notifications"
            showArrow={false}
            rightComponent={
              <Switch
                value={settings.notificationsEnabled}
                onValueChange={handleToggleNotifications}
                trackColor={{ true: colors.primary }}
              />
            }
          />
          <Divider />
          <SettingRow
            icon="alarm"
            label="Default Reminders"
            value={`${settings.defaultReminderDays.length} reminders set`}
            onPress={() => {}}
          />
        </Card>

        {/* Preferences Section */}
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>PREFERENCES</Text>
        <Card style={styles.section}>
          <SettingRow
            icon="moon"
            label="Theme"
            value={settings.theme.charAt(0).toUpperCase() + settings.theme.slice(1)}
            onPress={() =>
              Alert.alert('Select Theme', undefined, [
                { text: 'Light', onPress: () => handleThemeChange('light') },
                { text: 'Dark', onPress: () => handleThemeChange('dark') },
                { text: 'System', onPress: () => handleThemeChange('system') },
                { text: 'Cancel', style: 'cancel' },
              ])
            }
          />
          <Divider />
          <SettingRow
            icon="cash"
            label="Currency"
            value={settings.currency}
            onPress={handleCurrencyChange}
          />
        </Card>

        {/* Data Section */}
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>DATA</Text>
        <Card style={styles.section}>
          <SettingRow
            icon="cloud-upload"
            label="Backup & Sync"
            value={settings.backupEnabled ? 'Enabled' : 'Disabled'}
            onPress={() => {}}
          />
          <Divider />
          <SettingRow
            icon="download"
            label="Export Data"
            onPress={() => {}}
          />
          <Divider />
          <SettingRow
            icon="trash"
            label="Clear All Data"
            onPress={handleClearData}
          />
        </Card>

        {/* About Section */}
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>ABOUT</Text>
        <Card style={styles.section}>
          <SettingRow
            icon="information-circle"
            label="Version"
            value={APP_VERSION}
            showArrow={false}
          />
          <Divider />
          <SettingRow
            icon="document-text"
            label="Terms of Service"
            onPress={() => {}}
          />
          <Divider />
          <SettingRow
            icon="shield-checkmark"
            label="Privacy Policy"
            onPress={() => {}}
          />
          <Divider />
          <SettingRow
            icon="help-circle"
            label="Help & Support"
            onPress={() => {}}
          />
        </Card>

        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: colors.textLight }]}>
            GrePre Smart Life
          </Text>
          <Text style={[styles.footerSubtext, { color: colors.textLight }]}>
            Track Bills • Store Documents • Never Miss Deadlines
          </Text>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: LAYOUT.padding,
    paddingVertical: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
  },
  content: {
    flex: 1,
    paddingHorizontal: LAYOUT.padding,
  },
  section: {
    marginBottom: 8,
    padding: 4,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '600',
  },
  profileInfo: {
    flex: 1,
    marginLeft: 12,
  },
  profileName: {
    fontSize: 18,
    fontWeight: '600',
  },
  profileEmail: {
    fontSize: 14,
    marginTop: 2,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  settingIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingContent: {
    flex: 1,
    marginLeft: 12,
  },
  settingLabel: {
    fontSize: 16,
  },
  settingValue: {
    fontSize: 13,
    marginTop: 2,
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  footerText: {
    fontSize: 14,
    fontWeight: '600',
  },
  footerSubtext: {
    fontSize: 12,
    marginTop: 4,
  },
});
