// ============================================
// GREPRE SMART LIFE - ESCALATION SERVICE
// Grace Period & Smart Reminder Escalation
// Moves app from "notebook" to "accountant"
// ============================================

import { Bill, ESCALATION_LEVELS, Reminder, ReminderType } from '@/types';
import { addDays, differenceInDays, format } from 'date-fns';
import * as Notifications from 'expo-notifications';
import { storageService } from './storage';

// Escalation notification templates
const ESCALATION_TEMPLATES = {
  0: {
    title: (bill: Bill) => `📋 Upcoming: ${bill.name}`,
    body: (bill: Bill, daysUntil: number) => 
      `${bill.name} is due in ${daysUntil} days (${format(new Date(bill.dueDate), 'MMM d')})`,
  },
  1: {
    title: (bill: Bill) => `⚠️ Due Today: ${bill.name}`,
    body: (bill: Bill) => 
      `${bill.name} (${formatCurrency(bill.amount, bill.currency)}) is due TODAY. Did you pay it?`,
  },
  2: {
    title: (bill: Bill) => `🔴 Overdue: ${bill.name}`,
    body: (bill: Bill, daysOverdue: number) => 
      `${bill.name} is ${daysOverdue} day${daysOverdue > 1 ? 's' : ''} overdue! Please confirm payment.`,
  },
  3: {
    title: (bill: Bill) => `🚨 URGENT: ${bill.name}`,
    body: (bill: Bill, daysOverdue: number) => 
      `${bill.name} is ${daysOverdue} days overdue! Take action now to avoid penalties.`,
  },
};

// Simple currency formatter
function formatCurrency(amount: number, currency: string): string {
  const symbols: Record<string, string> = { NGN: '₦', USD: '$', EUR: '€', GBP: '£' };
  return `${symbols[currency] || currency}${amount.toLocaleString()}`;
}

export const escalationService = {
  /**
   * Check all bills and escalate reminders as needed
   * This should run daily (via background task or when app opens)
   */
  async checkAndEscalate(userId: string, bills: Bill[]): Promise<void> {
    const today = new Date();
    
    for (const bill of bills) {
      if (!bill.isActive || bill.status === 'paid') continue;
      
      const dueDate = new Date(bill.dueDate);
      const daysDiff = differenceInDays(dueDate, today);
      
      // Calculate appropriate escalation level
      const newLevel = this.calculateEscalationLevel(daysDiff);
      const currentLevel = bill.escalationLevel || 0;
      
      // Only escalate if level increased
      if (newLevel > currentLevel) {
        await this.escalateBill(bill, newLevel, daysDiff);
      }
    }
  },

  /**
   * Calculate escalation level based on days until/past due date
   */
  calculateEscalationLevel(daysDiff: number): number {
    if (daysDiff > 7) return 0;      // More than a week away - normal
    if (daysDiff > 0) return 0;       // Still has time - normal
    if (daysDiff === 0) return 1;     // Due today
    if (daysDiff >= -3) return 2;     // 1-3 days overdue
    return 3;                          // More than 3 days overdue - critical
  },

  /**
   * Escalate a bill to a new level
   */
  async escalateBill(bill: Bill, newLevel: number, daysDiff: number): Promise<void> {
    const levelConfig = ESCALATION_LEVELS[newLevel];
    const template = ESCALATION_TEMPLATES[newLevel as keyof typeof ESCALATION_TEMPLATES];
    
    // Create escalated notification
    const daysOverdue = Math.abs(daysDiff);
    const title = template.title(bill);
    const body = newLevel === 0 
      ? template.body(bill, daysDiff)
      : template.body(bill, daysOverdue);

    // Send immediate notification for escalated bills
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: {
          type: 'bill_escalation',
          billId: bill.id,
          escalationLevel: newLevel,
          requiresConfirmation: newLevel >= 1,
        },
        priority: levelConfig.notificationPriority as any,
        sound: newLevel >= 2 ? 'default' : undefined,
        badge: newLevel >= 2 ? 1 : 0,
      },
      trigger: null, // Send immediately
    });

    // Update bill escalation level
    // This would typically call the store or database
    console.log(`Escalated ${bill.name} to level ${newLevel}`);
  },

  /**
   * Handle "Did you pay this?" confirmation
   * Returns true if user confirmed payment
   */
  async requestPaymentConfirmation(bill: Bill): Promise<boolean> {
    // This would show an in-app modal or action notification
    // For now, we create a reminder that requires confirmation
    
    const reminder: Partial<Reminder> = {
      type: ReminderType.BILL_DUE,
      referenceId: bill.id,
      title: `Did you pay ${bill.name}?`,
      message: `Please confirm if you've paid ${formatCurrency(bill.amount, bill.currency)}`,
      scheduledDate: new Date().toISOString(),
      requiresConfirmation: true,
      escalationLevel: bill.escalationLevel,
    };

    // Save reminder for tracking
    await this.saveConfirmationReminder(reminder);
    
    return false; // User needs to respond
  },

  /**
   * Process user's payment confirmation
   */
  async confirmPayment(billId: string, confirmed: boolean): Promise<void> {
    if (confirmed) {
      // User confirmed they paid - mark as paid
      // This would update the bill status and reset escalation
      console.log(`Payment confirmed for bill ${billId}`);
    } else {
      // User said they didn't pay - continue escalation
      console.log(`Payment not confirmed for bill ${billId}, continuing escalation`);
    }
  },

  /**
   * Get all bills requiring escalation attention
   */
  async getEscalatedBills(bills: Bill[]): Promise<{
    dueToday: Bill[];
    overdue: Bill[];
    critical: Bill[];
  }> {
    const today = new Date();
    
    const dueToday: Bill[] = [];
    const overdue: Bill[] = [];
    const critical: Bill[] = [];

    for (const bill of bills) {
      if (!bill.isActive || bill.status === 'paid') continue;
      
      const dueDate = new Date(bill.dueDate);
      const daysDiff = differenceInDays(dueDate, today);
      
      if (daysDiff === 0) {
        dueToday.push(bill);
      } else if (daysDiff < 0 && daysDiff >= -3) {
        overdue.push(bill);
      } else if (daysDiff < -3) {
        critical.push(bill);
      }
    }

    return { dueToday, overdue, critical };
  },

  /**
   * Schedule next escalation check
   */
  async scheduleNextCheck(): Promise<void> {
    // Schedule for tomorrow morning
    const tomorrow = addDays(new Date(), 1);
    tomorrow.setHours(8, 0, 0, 0);

    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Daily Bill Check',
        body: 'Checking your bills for today...',
        data: { type: 'daily_check' },
      },
      trigger: {
        date: tomorrow,
        repeats: true,
      },
    });
  },

  /**
   * Get escalation badge color for UI
   */
  getEscalationBadge(bill: Bill): { color: string; text: string } | null {
    const level = bill.escalationLevel || 0;
    
    if (level === 0) return null;
    
    const config = ESCALATION_LEVELS[level];
    return {
      color: config.badgeColor || config.color,
      text: config.name,
    };
  },

  /**
   * Save confirmation reminder
   */
  async saveConfirmationReminder(reminder: Partial<Reminder>): Promise<void> {
    // This would save to storage/database
    const reminders = await storageService.reminderStorage.getAll();
    reminders.push({
      ...reminder,
      id: Date.now().toString(),
      isRead: false,
      isSent: true,
      createdAt: new Date().toISOString(),
    } as Reminder);
    await storageService.reminderStorage.saveAll(reminders);
  },
};

export default escalationService;
