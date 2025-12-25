// ============================================
// GREPRE SMART LIFE - BIOMETRIC SERVICE
// Handles Face ID / Touch ID / Fingerprint
// ============================================

import { STORAGE_KEYS } from '@/constants';
import * as LocalAuthentication from 'expo-local-authentication';
import { secureStorage } from './storage';

export interface BiometricStatus {
  isAvailable: boolean;
  isEnrolled: boolean;
  biometricType: 'fingerprint' | 'facial' | 'iris' | 'none';
  securityLevel: 'none' | 'secret' | 'biometric';
}

export const biometricService = {
  /**
   * Check if biometric authentication is available on the device
   */
  async checkAvailability(): Promise<BiometricStatus> {
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      const supportedTypes = await LocalAuthentication.supportedAuthenticationTypesAsync();
      const securityLevel = await LocalAuthentication.getEnrolledLevelAsync();

      let biometricType: BiometricStatus['biometricType'] = 'none';

      if (supportedTypes.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
        biometricType = 'facial';
      } else if (supportedTypes.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
        biometricType = 'fingerprint';
      } else if (supportedTypes.includes(LocalAuthentication.AuthenticationType.IRIS)) {
        biometricType = 'iris';
      }

      let securityLevelString: BiometricStatus['securityLevel'] = 'none';
      if (securityLevel === LocalAuthentication.SecurityLevel.BIOMETRIC) {
        securityLevelString = 'biometric';
      } else if (securityLevel === LocalAuthentication.SecurityLevel.SECRET) {
        securityLevelString = 'secret';
      }

      return {
        isAvailable: hasHardware,
        isEnrolled,
        biometricType,
        securityLevel: securityLevelString,
      };
    } catch (error) {
      console.error('Error checking biometric availability:', error);
      return {
        isAvailable: false,
        isEnrolled: false,
        biometricType: 'none',
        securityLevel: 'none',
      };
    }
  },

  /**
   * Authenticate the user with biometrics
   */
  async authenticate(promptMessage?: string): Promise<{ success: boolean; error?: string }> {
    try {
      const status = await this.checkAvailability();

      if (!status.isAvailable) {
        return { success: false, error: 'Biometric authentication is not available on this device' };
      }

      if (!status.isEnrolled) {
        return { success: false, error: 'No biometric credentials enrolled. Please set up Face ID or fingerprint in your device settings.' };
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: promptMessage || 'Authenticate to access GrePre Smart Life',
        fallbackLabel: 'Use Passcode',
        cancelLabel: 'Cancel',
        disableDeviceFallback: false,
      });

      if (result.success) {
        return { success: true };
      } else {
        let errorMessage = 'Authentication failed';
        
        if (result.error === 'user_cancel') {
          errorMessage = 'Authentication cancelled';
        } else if (result.error === 'user_fallback') {
          errorMessage = 'User chose to use passcode';
        } else if (result.error === 'lockout') {
          errorMessage = 'Too many failed attempts. Please try again later.';
        } else if (result.error === 'not_enrolled') {
          errorMessage = 'No biometric credentials enrolled';
        }

        return { success: false, error: errorMessage };
      }
    } catch (error) {
      console.error('Biometric authentication error:', error);
      return { success: false, error: 'An error occurred during authentication' };
    }
  },

  /**
   * Check if biometric is enabled in app settings
   */
  async isBiometricEnabled(): Promise<boolean> {
    const value = await secureStorage.get(STORAGE_KEYS.BIOMETRIC_ENABLED);
    return value === 'true';
  },

  /**
   * Enable/disable biometric authentication
   */
  async setBiometricEnabled(enabled: boolean): Promise<void> {
    await secureStorage.set(STORAGE_KEYS.BIOMETRIC_ENABLED, enabled.toString());
  },

  /**
   * Get the friendly name for the biometric type
   */
  getBiometricTypeName(type: BiometricStatus['biometricType']): string {
    switch (type) {
      case 'facial':
        return 'Face ID';
      case 'fingerprint':
        return 'Touch ID / Fingerprint';
      case 'iris':
        return 'Iris Scan';
      default:
        return 'Biometric';
    }
  },

  /**
   * Authenticate before viewing sensitive documents
   */
  async authenticateForDocument(documentName: string): Promise<boolean> {
    const isEnabled = await this.isBiometricEnabled();
    
    if (!isEnabled) {
      return true; // If biometric is not enabled, allow access
    }

    const result = await this.authenticate(`Authenticate to view "${documentName}"`);
    return result.success;
  },
};
