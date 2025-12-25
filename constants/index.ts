// ============================================
// GREPRE SMART LIFE - CONSTANTS
// ============================================

import { BillCategory, BillFrequency, DocumentCategory } from '@/types';

// ============ APP INFO ============

export const APP_NAME = 'GrePre Smart Life';
export const APP_VERSION = '1.0.0';
export const APP_TAGLINE = 'Bills, Documents & Deadlines - All in One Place';

// ============ COLORS ============

export const Colors = {
  light: {
    primary: '#1E3A5F',
    primaryLight: '#2E5A8F',
    primaryDark: '#0E2A4F',
    secondary: '#4ECDC4',
    secondaryLight: '#6EDDD4',
    accent: '#FF6B6B',
    accentLight: '#FF8B8B',
    background: '#F8F9FA',
    surface: '#FFFFFF',
    surfaceVariant: '#F1F3F4',
    text: '#1A1A1A',
    textSecondary: '#6B7280',
    textLight: '#9CA3AF',
    border: '#E5E7EB',
    success: '#10B981',
    warning: '#F59E0B',
    error: '#EF4444',
    info: '#3B82F6',
  },
  dark: {
    primary: '#3B82F6',
    primaryLight: '#60A5FA',
    primaryDark: '#1E40AF',
    secondary: '#4ECDC4',
    secondaryLight: '#6EDDD4',
    accent: '#FF6B6B',
    accentLight: '#FF8B8B',
    background: '#0F172A',
    surface: '#1E293B',
    surfaceVariant: '#334155',
    text: '#F8FAFC',
    textSecondary: '#94A3B8',
    textLight: '#64748B',
    border: '#334155',
    success: '#10B981',
    warning: '#F59E0B',
    error: '#EF4444',
    info: '#3B82F6',
  },
};

// ============ CATEGORY CONFIGURATIONS ============

export const BILL_CATEGORY_CONFIG: Record<BillCategory, { label: string; icon: string; color: string }> = {
  [BillCategory.RENT]: { label: 'Rent', icon: 'home', color: '#6366F1' },
  [BillCategory.UTILITIES]: { label: 'Utilities', icon: 'flash', color: '#F59E0B' },
  [BillCategory.SUBSCRIPTION]: { label: 'Subscriptions', icon: 'refresh', color: '#8B5CF6' },
  [BillCategory.INSURANCE]: { label: 'Insurance', icon: 'shield-checkmark', color: '#10B981' },
  [BillCategory.SCHOOL_FEES]: { label: 'School Fees', icon: 'school', color: '#3B82F6' },
  [BillCategory.LOAN]: { label: 'Loan', icon: 'cash', color: '#EF4444' },
  [BillCategory.CREDIT_CARD]: { label: 'Credit Card', icon: 'card', color: '#EC4899' },
  [BillCategory.OTHER]: { label: 'Other', icon: 'ellipsis-horizontal', color: '#6B7280' },
};

export const DOCUMENT_CATEGORY_CONFIG: Record<DocumentCategory, { label: string; icon: string; color: string }> = {
  [DocumentCategory.ID]: { label: 'ID Card', icon: 'id-card', color: '#3B82F6' },
  [DocumentCategory.VISA]: { label: 'Visa', icon: 'airplane', color: '#8B5CF6' },
  [DocumentCategory.PASSPORT]: { label: 'Passport', icon: 'globe', color: '#6366F1' },
  [DocumentCategory.PERMIT]: { label: 'Permit', icon: 'document-text', color: '#F59E0B' },
  [DocumentCategory.LICENSE]: { label: 'License', icon: 'car', color: '#10B981' },
  [DocumentCategory.WARRANTY]: { label: 'Warranty', icon: 'shield', color: '#14B8A6' },
  [DocumentCategory.INSURANCE]: { label: 'Insurance', icon: 'medical', color: '#EF4444' },
  [DocumentCategory.CERTIFICATE]: { label: 'Certificate', icon: 'ribbon', color: '#EC4899' },
  [DocumentCategory.CONTRACT]: { label: 'Contract', icon: 'create', color: '#6B7280' },
  [DocumentCategory.RECEIPT]: { label: 'Receipt', icon: 'receipt', color: '#84CC16' },
  [DocumentCategory.OTHER]: { label: 'Other', icon: 'folder', color: '#9CA3AF' },
};

export const BILL_FREQUENCY_CONFIG: Record<BillFrequency, { label: string; days: number }> = {
  [BillFrequency.ONCE]: { label: 'One Time', days: 0 },
  [BillFrequency.WEEKLY]: { label: 'Weekly', days: 7 },
  [BillFrequency.BIWEEKLY]: { label: 'Bi-Weekly', days: 14 },
  [BillFrequency.MONTHLY]: { label: 'Monthly', days: 30 },
  [BillFrequency.QUARTERLY]: { label: 'Quarterly', days: 90 },
  [BillFrequency.BIANNUALLY]: { label: 'Bi-Annually', days: 182 },
  [BillFrequency.ANNUALLY]: { label: 'Annually', days: 365 },
};

// ============ DEFAULT SETTINGS ============

export const DEFAULT_SETTINGS = {
  theme: 'system' as const,
  biometricEnabled: true,
  notificationsEnabled: true,
  defaultReminderDays: [1, 3, 7],
  currency: 'USD',
  language: 'en',
  backupEnabled: false,
};

export const DEFAULT_REMINDER_OPTIONS = [
  { label: 'On the day', value: 0 },
  { label: '1 day before', value: 1 },
  { label: '3 days before', value: 3 },
  { label: '1 week before', value: 7 },
  { label: '2 weeks before', value: 14 },
  { label: '1 month before', value: 30 },
];

// ============ CURRENCY OPTIONS ============

export const CURRENCY_OPTIONS = [
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
  { code: 'NGN', symbol: '₦', name: 'Nigerian Naira' },
  { code: 'KES', symbol: 'KSh', name: 'Kenyan Shilling' },
  { code: 'ZAR', symbol: 'R', name: 'South African Rand' },
  { code: 'GHS', symbol: 'GH₵', name: 'Ghanaian Cedi' },
  { code: 'INR', symbol: '₹', name: 'Indian Rupee' },
  { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar' },
];

// ============ STORAGE KEYS ============

export const STORAGE_KEYS = {
  BILLS: 'grepre_bills',
  DOCUMENTS: 'grepre_documents',
  REMINDERS: 'grepre_reminders',
  USER_PROFILE: 'grepre_user_profile',
  SETTINGS: 'grepre_settings',
  ONBOARDING_COMPLETE: 'grepre_onboarding_complete',
  BIOMETRIC_ENABLED: 'grepre_biometric_enabled',
  ENCRYPTION_KEY: 'grepre_encryption_key',
} as const;

// ============ API ENDPOINTS (for future backend) ============

export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'https://api.grepre.com';

export const API_ENDPOINTS = {
  AUTH: {
    LOGIN: '/auth/login',
    REGISTER: '/auth/register',
    REFRESH: '/auth/refresh',
    LOGOUT: '/auth/logout',
  },
  BILLS: {
    LIST: '/bills',
    CREATE: '/bills',
    UPDATE: '/bills/:id',
    DELETE: '/bills/:id',
  },
  DOCUMENTS: {
    LIST: '/documents',
    CREATE: '/documents',
    UPDATE: '/documents/:id',
    DELETE: '/documents/:id',
    UPLOAD: '/documents/upload',
  },
  SYNC: {
    PUSH: '/sync/push',
    PULL: '/sync/pull',
  },
};

// ============ LAYOUT CONSTANTS ============

export const LAYOUT = {
  padding: 16,
  borderRadius: 12,
  cardBorderRadius: 16,
  iconSize: 24,
  headerHeight: 60,
  tabBarHeight: 80,
  inputHeight: 48,
};

// ============ ANIMATION DURATIONS ============

export const ANIMATION = {
  fast: 150,
  normal: 300,
  slow: 500,
};
