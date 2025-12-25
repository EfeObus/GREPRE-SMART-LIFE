// ============================================
// GREPRE SMART LIFE - BILL SERVICE
// Handles bill management and tracking
// ============================================

import uuid from 'react-native-uuid';
import { addDays, addWeeks, addMonths, addYears, isAfter, isBefore, startOfMonth, endOfMonth, format } from 'date-fns';
import type { Bill, BillFormData, PaymentRecord, MonthlyExpense, CategoryBreakdown } from '@/types';
import { BillCategory, BillFrequency, BillStatus } from '@/types';
import { billStorage } from './storage';
import { notificationService } from './notifications';
import { BILL_FREQUENCY_CONFIG } from '@/constants';

export const billService = {
  /**
   * Calculate the next due date based on frequency
   */
  calculateNextDueDate(currentDueDate: Date, frequency: BillFrequency): Date {
    switch (frequency) {
      case BillFrequency.ONCE:
        return currentDueDate;
      case BillFrequency.WEEKLY:
        return addWeeks(currentDueDate, 1);
      case BillFrequency.BIWEEKLY:
        return addWeeks(currentDueDate, 2);
      case BillFrequency.MONTHLY:
        return addMonths(currentDueDate, 1);
      case BillFrequency.QUARTERLY:
        return addMonths(currentDueDate, 3);
      case BillFrequency.BIANNUALLY:
        return addMonths(currentDueDate, 6);
      case BillFrequency.ANNUALLY:
        return addYears(currentDueDate, 1);
      default:
        return currentDueDate;
    }
  },

  /**
   * Determine bill status based on due date
   */
  determineBillStatus(dueDate: Date, isPaid: boolean = false): BillStatus {
    if (isPaid) return BillStatus.PAID;
    
    const now = new Date();
    const dueDateStart = new Date(dueDate);
    dueDateStart.setHours(0, 0, 0, 0);

    const today = new Date(now);
    today.setHours(0, 0, 0, 0);

    if (isBefore(dueDateStart, today)) {
      return BillStatus.OVERDUE;
    }
    
    const sevenDaysFromNow = addDays(today, 7);
    if (isBefore(dueDateStart, sevenDaysFromNow)) {
      return BillStatus.UPCOMING;
    }
    
    return BillStatus.PENDING;
  },

  /**
   * Create a new bill
   */
  async createBill(formData: BillFormData): Promise<Bill> {
    try {
      const now = new Date().toISOString();
      const dueDate = formData.dueDate;
      
      const bill: Bill = {
        id: uuid.v4() as string,
        name: formData.name,
        category: formData.category,
        amount: parseFloat(formData.amount),
        currency: formData.currency,
        frequency: formData.frequency,
        dueDate: dueDate.toISOString(),
        nextDueDate: dueDate.toISOString(),
        status: this.determineBillStatus(dueDate),
        autopay: formData.autopay,
        notes: formData.notes,
        reminderDays: formData.reminderDays,
        paymentHistory: [],
        createdAt: now,
        updatedAt: now,
      };

      // Save to storage
      await billStorage.add(bill);

      // Schedule reminders
      await notificationService.scheduleBillReminders(bill);

      return bill;
    } catch (error) {
      console.error('Error creating bill:', error);
      throw error;
    }
  },

  /**
   * Update a bill
   */
  async updateBill(billId: string, updates: Partial<BillFormData>): Promise<void> {
    try {
      const existingBill = await billStorage.getById(billId);
      if (!existingBill) throw new Error('Bill not found');

      const updateData: Partial<Bill> = {};
      
      if (updates.name !== undefined) updateData.name = updates.name;
      if (updates.category !== undefined) updateData.category = updates.category;
      if (updates.amount !== undefined) updateData.amount = parseFloat(updates.amount);
      if (updates.currency !== undefined) updateData.currency = updates.currency;
      if (updates.frequency !== undefined) updateData.frequency = updates.frequency;
      if (updates.autopay !== undefined) updateData.autopay = updates.autopay;
      if (updates.notes !== undefined) updateData.notes = updates.notes;
      if (updates.reminderDays !== undefined) updateData.reminderDays = updates.reminderDays;
      
      if (updates.dueDate !== undefined) {
        updateData.dueDate = updates.dueDate.toISOString();
        updateData.nextDueDate = updates.dueDate.toISOString();
        updateData.status = this.determineBillStatus(updates.dueDate);
      }

      await billStorage.update(billId, updateData);

      // Reschedule reminders
      await notificationService.cancelRemindersForItem(billId);
      const updatedBill = await billStorage.getById(billId);
      if (updatedBill) {
        await notificationService.scheduleBillReminders(updatedBill);
      }
    } catch (error) {
      console.error('Error updating bill:', error);
      throw error;
    }
  },

  /**
   * Delete a bill
   */
  async deleteBill(billId: string): Promise<void> {
    try {
      await notificationService.cancelRemindersForItem(billId);
      await billStorage.delete(billId);
    } catch (error) {
      console.error('Error deleting bill:', error);
      throw error;
    }
  },

  /**
   * Mark a bill as paid
   */
  async markAsPaid(billId: string, paymentDetails?: { method?: string; notes?: string }): Promise<void> {
    try {
      const bill = await billStorage.getById(billId);
      if (!bill) throw new Error('Bill not found');

      const paymentRecord: PaymentRecord = {
        id: uuid.v4() as string,
        billId,
        amount: bill.amount,
        paidDate: new Date().toISOString(),
        method: paymentDetails?.method,
        notes: paymentDetails?.notes,
      };

      const paymentHistory = [...bill.paymentHistory, paymentRecord];
      
      // Calculate next due date for recurring bills
      let nextDueDate = new Date(bill.nextDueDate);
      let status = BillStatus.PAID;

      if (bill.frequency !== BillFrequency.ONCE) {
        nextDueDate = this.calculateNextDueDate(nextDueDate, bill.frequency);
        status = this.determineBillStatus(nextDueDate);
      }

      await billStorage.update(billId, {
        status,
        nextDueDate: nextDueDate.toISOString(),
        paymentHistory,
      });

      // Cancel old reminders and schedule new ones for recurring bills
      await notificationService.cancelRemindersForItem(billId);
      
      if (bill.frequency !== BillFrequency.ONCE) {
        const updatedBill = await billStorage.getById(billId);
        if (updatedBill) {
          await notificationService.scheduleBillReminders(updatedBill);
        }
      }
    } catch (error) {
      console.error('Error marking bill as paid:', error);
      throw error;
    }
  },

  /**
   * Get all bills
   */
  async getAllBills(): Promise<Bill[]> {
    const bills = await billStorage.getAll();
    
    // Update statuses based on current date
    const updatedBills = bills.map((bill) => ({
      ...bill,
      status: bill.status === BillStatus.PAID && bill.frequency === BillFrequency.ONCE
        ? BillStatus.PAID
        : this.determineBillStatus(new Date(bill.nextDueDate)),
    }));

    return updatedBills.sort((a, b) => 
      new Date(a.nextDueDate).getTime() - new Date(b.nextDueDate).getTime()
    );
  },

  /**
   * Get bills by category
   */
  async getBillsByCategory(category: BillCategory): Promise<Bill[]> {
    const all = await this.getAllBills();
    return all.filter((bill) => bill.category === category);
  },

  /**
   * Get upcoming bills (due within n days)
   */
  async getUpcomingBills(days: number = 7): Promise<Bill[]> {
    const all = await this.getAllBills();
    const now = new Date();
    const futureDate = addDays(now, days);

    return all.filter((bill) => {
      if (bill.status === BillStatus.PAID && bill.frequency === BillFrequency.ONCE) return false;
      const dueDate = new Date(bill.nextDueDate);
      return dueDate >= now && dueDate <= futureDate;
    });
  },

  /**
   * Get overdue bills
   */
  async getOverdueBills(): Promise<Bill[]> {
    const all = await this.getAllBills();
    return all.filter((bill) => bill.status === BillStatus.OVERDUE);
  },

  /**
   * Get monthly expenses for a specific month
   */
  async getMonthlyExpenses(year: number, month: number): Promise<MonthlyExpense> {
    const all = await this.getAllBills();
    const startDate = startOfMonth(new Date(year, month - 1));
    const endDate = endOfMonth(startDate);

    const monthlyBills = all.filter((bill) => {
      const dueDate = new Date(bill.nextDueDate);
      return dueDate >= startDate && dueDate <= endDate;
    });

    const amount = monthlyBills.reduce((sum, bill) => sum + bill.amount, 0);

    return {
      month: format(startDate, 'MMMM yyyy'),
      amount,
      billCount: monthlyBills.length,
    };
  },

  /**
   * Get expense breakdown by category
   */
  async getCategoryBreakdown(): Promise<CategoryBreakdown[]> {
    const all = await this.getAllBills();
    const totalAmount = all.reduce((sum, bill) => sum + bill.amount, 0);

    const categoryMap = new Map<BillCategory, { amount: number; count: number }>();

    all.forEach((bill) => {
      const existing = categoryMap.get(bill.category) || { amount: 0, count: 0 };
      categoryMap.set(bill.category, {
        amount: existing.amount + bill.amount,
        count: existing.count + 1,
      });
    });

    const breakdown: CategoryBreakdown[] = [];
    categoryMap.forEach((value, category) => {
      breakdown.push({
        category,
        amount: value.amount,
        percentage: totalAmount > 0 ? (value.amount / totalAmount) * 100 : 0,
        count: value.count,
      });
    });

    return breakdown.sort((a, b) => b.amount - a.amount);
  },

  /**
   * Get total monthly expenses
   */
  async getTotalMonthlyExpenses(): Promise<number> {
    const all = await this.getAllBills();
    
    return all.reduce((total, bill) => {
      switch (bill.frequency) {
        case BillFrequency.WEEKLY:
          return total + (bill.amount * 4.33); // Average weeks per month
        case BillFrequency.BIWEEKLY:
          return total + (bill.amount * 2.17);
        case BillFrequency.MONTHLY:
          return total + bill.amount;
        case BillFrequency.QUARTERLY:
          return total + (bill.amount / 3);
        case BillFrequency.BIANNUALLY:
          return total + (bill.amount / 6);
        case BillFrequency.ANNUALLY:
          return total + (bill.amount / 12);
        case BillFrequency.ONCE:
        default:
          return total;
      }
    }, 0);
  },

  /**
   * Search bills by name
   */
  async searchBills(query: string): Promise<Bill[]> {
    const all = await this.getAllBills();
    const lowerQuery = query.toLowerCase();
    
    return all.filter((bill) => 
      bill.name.toLowerCase().includes(lowerQuery) ||
      bill.notes?.toLowerCase().includes(lowerQuery)
    );
  },

  /**
   * Get payment history for a bill
   */
  async getPaymentHistory(billId: string): Promise<PaymentRecord[]> {
    const bill = await billStorage.getById(billId);
    return bill?.paymentHistory || [];
  },

  /**
   * Get amount paid this month
   */
  async getAmountPaidThisMonth(): Promise<number> {
    const all = await this.getAllBills();
    const now = new Date();
    const startDate = startOfMonth(now);
    const endDate = endOfMonth(now);

    let totalPaid = 0;

    all.forEach((bill) => {
      bill.paymentHistory.forEach((payment) => {
        const paidDate = new Date(payment.paidDate);
        if (paidDate >= startDate && paidDate <= endDate) {
          totalPaid += payment.amount;
        }
      });
    });

    return totalPaid;
  },
};
