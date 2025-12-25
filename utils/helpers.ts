// ============================================
// GREPRE SMART LIFE - HELPER UTILITIES
// ============================================

import { BILL_CATEGORY_CONFIG, CURRENCY_OPTIONS, DOCUMENT_CATEGORY_CONFIG } from '@/constants';
import { BillCategory, BillStatus, DocumentCategory } from '@/types';
import { differenceInDays, format, formatDistanceToNow, isAfter, isBefore, parseISO } from 'date-fns';

// ============ DATE HELPERS ============

export const dateHelpers = {
  /**
   * Format a date for display
   */
  formatDate(date: string | Date, formatString: string = 'MMM d, yyyy'): string {
    const dateObj = typeof date === 'string' ? parseISO(date) : date;
    return format(dateObj, formatString);
  },

  /**
   * Format a date as relative time (e.g., "3 days ago", "in 2 weeks")
   */
  formatRelative(date: string | Date): string {
    const dateObj = typeof date === 'string' ? parseISO(date) : date;
    return formatDistanceToNow(dateObj, { addSuffix: true });
  },

  /**
   * Get days until a date (negative if past)
   */
  getDaysUntil(date: string | Date): number {
    const dateObj = typeof date === 'string' ? parseISO(date) : date;
    return differenceInDays(dateObj, new Date());
  },

  /**
   * Check if a date is in the past
   */
  isPast(date: string | Date): boolean {
    const dateObj = typeof date === 'string' ? parseISO(date) : date;
    return isBefore(dateObj, new Date());
  },

  /**
   * Check if a date is in the future
   */
  isFuture(date: string | Date): boolean {
    const dateObj = typeof date === 'string' ? parseISO(date) : date;
    return isAfter(dateObj, new Date());
  },

  /**
   * Get a human-readable urgency label
   */
  getUrgencyLabel(date: string | Date): { label: string; isUrgent: boolean; color: string } {
    const daysUntil = this.getDaysUntil(date);

    if (daysUntil < 0) {
      return { label: 'Overdue', isUrgent: true, color: '#EF4444' };
    } else if (daysUntil === 0) {
      return { label: 'Due Today', isUrgent: true, color: '#F59E0B' };
    } else if (daysUntil === 1) {
      return { label: 'Due Tomorrow', isUrgent: true, color: '#F59E0B' };
    } else if (daysUntil <= 7) {
      return { label: `Due in ${daysUntil} days`, isUrgent: true, color: '#3B82F6' };
    } else if (daysUntil <= 30) {
      return { label: `Due in ${daysUntil} days`, isUrgent: false, color: '#10B981' };
    } else {
      return { label: this.formatDate(date), isUrgent: false, color: '#6B7280' };
    }
  },
};

// ============ CURRENCY HELPERS ============

export const currencyHelpers = {
  /**
   * Format an amount with currency symbol
   */
  format(amount: number, currencyCode: string = 'USD'): string {
    const currency = CURRENCY_OPTIONS.find((c) => c.code === currencyCode);
    const symbol = currency?.symbol || currencyCode;
    
    return `${symbol}${amount.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  },

  /**
   * Format amount in compact form (e.g., 1.5K, 2.3M)
   */
  formatCompact(amount: number, currencyCode: string = 'USD'): string {
    const currency = CURRENCY_OPTIONS.find((c) => c.code === currencyCode);
    const symbol = currency?.symbol || currencyCode;

    if (amount >= 1000000) {
      return `${symbol}${(amount / 1000000).toFixed(1)}M`;
    } else if (amount >= 1000) {
      return `${symbol}${(amount / 1000).toFixed(1)}K`;
    }
    return `${symbol}${amount.toFixed(0)}`;
  },

  /**
   * Get currency info
   */
  getCurrencyInfo(code: string) {
    return CURRENCY_OPTIONS.find((c) => c.code === code);
  },
};

// ============ STATUS HELPERS ============

export const statusHelpers = {
  /**
   * Get status color
   */
  getBillStatusColor(status: BillStatus): string {
    switch (status) {
      case BillStatus.PAID:
        return '#10B981';
      case BillStatus.OVERDUE:
        return '#EF4444';
      case BillStatus.UPCOMING:
        return '#F59E0B';
      case BillStatus.PENDING:
      default:
        return '#3B82F6';
    }
  },

  /**
   * Get status label
   */
  getBillStatusLabel(status: BillStatus): string {
    switch (status) {
      case BillStatus.PAID:
        return 'Paid';
      case BillStatus.OVERDUE:
        return 'Overdue';
      case BillStatus.UPCOMING:
        return 'Due Soon';
      case BillStatus.PENDING:
      default:
        return 'Pending';
    }
  },

  /**
   * Get status icon
   */
  getBillStatusIcon(status: BillStatus): string {
    switch (status) {
      case BillStatus.PAID:
        return 'checkmark-circle';
      case BillStatus.OVERDUE:
        return 'alert-circle';
      case BillStatus.UPCOMING:
        return 'time';
      case BillStatus.PENDING:
      default:
        return 'ellipse-outline';
    }
  },
};

// ============ CATEGORY HELPERS ============

export const categoryHelpers = {
  /**
   * Get bill category config
   */
  getBillCategoryInfo(category: BillCategory) {
    return BILL_CATEGORY_CONFIG[category];
  },

  /**
   * Get document category config
   */
  getDocumentCategoryInfo(category: DocumentCategory) {
    return DOCUMENT_CATEGORY_CONFIG[category];
  },

  /**
   * Get all bill categories as options
   */
  getBillCategoryOptions() {
    return Object.entries(BILL_CATEGORY_CONFIG).map(([value, config]) => ({
      value,
      label: config.label,
      icon: config.icon,
      color: config.color,
    }));
  },

  /**
   * Get all document categories as options
   */
  getDocumentCategoryOptions() {
    return Object.entries(DOCUMENT_CATEGORY_CONFIG).map(([value, config]) => ({
      value,
      label: config.label,
      icon: config.icon,
      color: config.color,
    }));
  },
};

// ============ VALIDATION HELPERS ============

export const validationHelpers = {
  /**
   * Validate email format
   */
  isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  },

  /**
   * Validate amount (positive number)
   */
  isValidAmount(amount: string): boolean {
    const num = parseFloat(amount);
    return !isNaN(num) && num > 0;
  },

  /**
   * Validate required string
   */
  isNotEmpty(value: string): boolean {
    return value.trim().length > 0;
  },

  /**
   * Validate date is in the future
   */
  isFutureDate(date: Date): boolean {
    return isAfter(date, new Date());
  },
};

// ============ STRING HELPERS ============

export const stringHelpers = {
  /**
   * Truncate text with ellipsis
   */
  truncate(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength - 3) + '...';
  },

  /**
   * Capitalize first letter
   */
  capitalize(text: string): string {
    return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
  },

  /**
   * Generate initials from name
   */
  getInitials(name: string): string {
    return name
      .split(' ')
      .map((word) => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  },

  /**
   * Slugify a string
   */
  slugify(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  },
};

// ============ ARRAY HELPERS ============

export const arrayHelpers = {
  /**
   * Group array by a key
   */
  groupBy<T>(array: T[], keyFn: (item: T) => string): Record<string, T[]> {
    return array.reduce((acc, item) => {
      const key = keyFn(item);
      acc[key] = acc[key] || [];
      acc[key].push(item);
      return acc;
    }, {} as Record<string, T[]>);
  },

  /**
   * Sort array by date
   */
  sortByDate<T>(array: T[], dateFn: (item: T) => string, ascending: boolean = true): T[] {
    return [...array].sort((a, b) => {
      const dateA = new Date(dateFn(a)).getTime();
      const dateB = new Date(dateFn(b)).getTime();
      return ascending ? dateA - dateB : dateB - dateA;
    });
  },

  /**
   * Remove duplicates by key
   */
  uniqueBy<T>(array: T[], keyFn: (item: T) => string): T[] {
    const seen = new Set<string>();
    return array.filter((item) => {
      const key = keyFn(item);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  },
};

// ============ EXPORT ALL ============

export {
    arrayHelpers as array, categoryHelpers as category, currencyHelpers as currency, dateHelpers as date, statusHelpers as status, stringHelpers as string, validationHelpers as validation
};

// ============ CONVENIENCE EXPORTS ============
// These are direct function exports for easier imports

export const formatCurrency = currencyHelpers.format;
export const getDaysUntil = dateHelpers.getDaysUntil;
export const formatDate = dateHelpers.formatDate;

/**
 * Format file size in human-readable format
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${units[i]}`;
}

