// ============================================
// GREPRE SMART LIFE - TYPE DEFINITIONS
// ============================================

// ============ CORE ENUMS ============

export enum BillCategory {
  RENT = 'rent',
  UTILITIES = 'utilities',
  SUBSCRIPTION = 'subscription',
  INSURANCE = 'insurance',
  SCHOOL_FEES = 'school_fees',
  LOAN = 'loan',
  CREDIT_CARD = 'credit_card',
  OTHER = 'other',
}

export enum BillFrequency {
  ONCE = 'once',
  WEEKLY = 'weekly',
  BIWEEKLY = 'biweekly',
  MONTHLY = 'monthly',
  QUARTERLY = 'quarterly',
  BIANNUALLY = 'biannually',
  ANNUALLY = 'annually',
}

export enum BillStatus {
  PENDING = 'pending',
  PAID = 'paid',
  OVERDUE = 'overdue',
  UPCOMING = 'upcoming',
  DUE_SOON = 'due_soon',
}

export enum DocumentCategory {
  ID = 'id',
  VISA = 'visa',
  PASSPORT = 'passport',
  PERMIT = 'permit',
  LICENSE = 'license',
  WARRANTY = 'warranty',
  INSURANCE = 'insurance',
  CERTIFICATE = 'certificate',
  CONTRACT = 'contract',
  RECEIPT = 'receipt',
  OTHER = 'other',
}

export enum ReminderType {
  BILL_DUE = 'bill_due',
  DOCUMENT_EXPIRY = 'document_expiry',
  CUSTOM = 'custom',
}

export enum ReminderFrequency {
  ON_DAY = 'on_day',
  ONE_DAY_BEFORE = '1_day_before',
  THREE_DAYS_BEFORE = '3_days_before',
  ONE_WEEK_BEFORE = '1_week_before',
  TWO_WEEKS_BEFORE = '2_weeks_before',
  ONE_MONTH_BEFORE = '1_month_before',
}

// ============ CORE INTERFACES ============

export interface Bill {
  id: string;
  name: string;
  category: BillCategory;
  amount: number;
  currency: string;
  frequency: BillFrequency;
  dueDate: string; // ISO date string
  nextDueDate: string;
  status: BillStatus;
  autopay: boolean;
  isAutoPay?: boolean; // Alias for autopay (database compatibility)
  isActive?: boolean; // Whether the bill is active
  notes?: string;
  reminderDays: number[]; // Days before due date to remind
  paymentHistory: PaymentRecord[];
  // NEW: Smart linking to documents
  linkedDocumentId?: string;
  linkedDocument?: Document;
  // NEW: Grace period escalation
  gracePeriodDays?: number;
  escalationLevel?: number; // 0 = normal, 1 = due today, 2 = 1 day late, 3 = critical
  lastReminderSent?: string;
  // NEW: OCR extracted data
  ocrData?: OCRBillData;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentRecord {
  id: string;
  billId: string;
  amount: number;
  paidDate: string;
  method?: string;
  notes?: string;
}

export interface Document {
  id: string;
  name: string;
  category: DocumentCategory;
  description?: string;
  notes?: string; // Additional notes about the document
  fileUri: string;
  thumbnailUri?: string;
  fileType: string;
  fileSize: number;
  expiryDate?: string; // ISO date string, optional for non-expiring docs
  issueDate?: string;
  documentNumber?: string;
  issuingAuthority?: string;
  isEncrypted: boolean;
  requiresBiometric?: boolean;
  reminderDays: number[]; // Days before expiry to remind
  tags: string[];
  // NEW: Smart linking to bills
  linkedBillId?: string;
  linkedBill?: Bill;
  // NEW: OCR extracted data
  ocrData?: OCRDocumentData;
  createdAt: string;
  updatedAt: string;
}

export interface Reminder {
  id: string;
  type: ReminderType;
  referenceId: string; // Bill ID or Document ID
  title: string;
  message: string;
  scheduledDate: string;
  isRead: boolean;
  isSent: boolean;
  isDismissed?: boolean;
  // NEW: Grace period confirmation
  requiresConfirmation?: boolean;
  confirmedAt?: string;
  escalationLevel?: number;
  notificationId?: string;
  createdAt: string;
}

// ============ OCR TYPES ============

export interface OCRBillData {
  billerName?: string;
  amount?: number;
  dueDate?: string;
  accountNumber?: string;
  confidence: number;
  rawText: string;
  extractedAt: string;
}

export interface OCRDocumentData {
  documentType?: string;
  documentNumber?: string;
  name?: string;
  expiryDate?: string;
  issueDate?: string;
  issuingAuthority?: string;
  confidence: number;
  rawText: string;
  extractedAt: string;
}

export interface OCRScanResult {
  success: boolean;
  data: OCRBillData | OCRDocumentData;
  imageUri: string;
  processingTimeMs: number;
}

// ============ BACKUP & EXPORT TYPES ============

export interface BackupData {
  version: string;
  createdAt: string;
  user: Partial<UserProfile>;
  bills: Bill[];
  documents: DocumentMetadata[]; // Metadata only, files separate
  reminders: Reminder[];
  settings: AppSettings;
}

export interface DocumentMetadata {
  id: string;
  name: string;
  category: DocumentCategory;
  fileType: string;
  fileName: string;
  expiryDate?: string;
}

export interface BackupRecord {
  id: string;
  backupType: 'local' | 'cloud' | 'manual';
  fileName: string;
  fileSize: number;
  filePath?: string;
  cloudProvider?: 'google_drive' | 'icloud' | 'dropbox';
  cloudUrl?: string;
  isEncrypted: boolean;
  encryptionHint?: string;
  itemsCount: {
    bills: number;
    documents: number;
    reminders: number;
  };
  status: 'pending' | 'completed' | 'failed';
  createdAt: string;
}

export interface ExportOptions {
  format: 'json' | 'csv' | 'zip';
  includeBills: boolean;
  includeDocuments: boolean;
  includeDocumentFiles: boolean;
  includeReminders: boolean;
  includeSettings: boolean;
  encrypt: boolean;
  password?: string;
}

// ============ GRACE PERIOD / ESCALATION TYPES ============

export interface EscalationConfig {
  level: number;
  name: string;
  description: string;
  color: string;
  icon: string;
  notificationPriority: 'low' | 'default' | 'high';
  badgeColor?: string;
}

export const ESCALATION_LEVELS: EscalationConfig[] = [
  { level: 0, name: 'Normal', description: 'Bill is upcoming', color: '#3B82F6', icon: 'time-outline', notificationPriority: 'default' },
  { level: 1, name: 'Due Today', description: 'Bill is due today', color: '#F59E0B', icon: 'alert-outline', notificationPriority: 'high' },
  { level: 2, name: 'Overdue', description: 'Bill is 1-3 days late', color: '#EF4444', icon: 'warning-outline', notificationPriority: 'high', badgeColor: '#EF4444' },
  { level: 3, name: 'Critical', description: 'Bill is more than 3 days late', color: '#DC2626', icon: 'alert-circle-outline', notificationPriority: 'high', badgeColor: '#DC2626' },
];

// ============ DASHBOARD TYPES ============

export interface DashboardSummary {
  upcomingBills: Bill[];
  overdueBills: Bill[];
  expiringDocuments: Document[];
  totalMonthlyExpenses: number;
  paidThisMonth: number;
  pendingThisMonth: number;
  upcomingReminders: Reminder[];
}

export interface MonthlyExpense {
  month: string;
  amount: number;
  billCount: number;
}

export interface CategoryBreakdown {
  category: BillCategory;
  amount: number;
  percentage: number;
  count: number;
}

// ============ USER & SETTINGS ============

export interface UserProfile {
  id: string;
  name: string;
  email?: string;
  avatar?: string;
  avatarUrl?: string; // Alias for avatar (database compatibility)
  phone?: string;
  currency: string;
  preferredCurrency?: string; // Alias for currency (database compatibility)
  timezone: string;
  theme?: 'light' | 'dark' | 'system';
  notificationsEnabled?: boolean;
  biometricEnabled?: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface AppSettings {
  theme: 'light' | 'dark' | 'system';
  biometricEnabled: boolean;
  notificationsEnabled: boolean;
  defaultReminderDays: number[];
  currency: string;
  language: string;
  backupEnabled: boolean;
  lastBackupDate?: string;
}

// ============ NOTIFICATION TYPES ============

export interface NotificationPayload {
  id: string;
  title: string;
  body: string;
  data: {
    type: ReminderType;
    referenceId: string;
    screen?: string;
  };
  trigger: {
    date: Date;
  };
}

// ============ API/STORAGE TYPES ============

export interface StorageKeys {
  BILLS: 'grepre_bills';
  DOCUMENTS: 'grepre_documents';
  REMINDERS: 'grepre_reminders';
  USER_PROFILE: 'grepre_user_profile';
  SETTINGS: 'grepre_settings';
  ONBOARDING_COMPLETE: 'grepre_onboarding_complete';
}

// ============ FORM TYPES ============

export interface BillFormData {
  name: string;
  category: BillCategory;
  amount: string;
  currency: string;
  frequency: BillFrequency;
  dueDate: Date;
  autopay: boolean;
  notes?: string;
  reminderDays: number[];
}

export interface DocumentFormData {
  name: string;
  category: DocumentCategory;
  description?: string;
  expiryDate?: Date;
  issueDate?: Date;
  documentNumber?: string;
  issuingAuthority?: string;
  tags: string[];
  reminderDays: number[];
}

// ============ NAVIGATION TYPES ============

export type RootStackParamList = {
  Home: undefined;
  Bills: undefined;
  BillDetail: { billId: string };
  AddBill: { billId?: string };
  Documents: undefined;
  DocumentDetail: { documentId: string };
  AddDocument: { documentId?: string };
  Reminders: undefined;
  Settings: undefined;
  Profile: undefined;
  Onboarding: undefined;
};

export type TabParamList = {
  Dashboard: undefined;
  Bills: undefined;
  Documents: undefined;
  Reminders: undefined;
  Settings: undefined;
};
