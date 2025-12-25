// ============================================
// GREPRE SMART LIFE - BILL STORE
// State management for bills
// ============================================

import { billService } from '@/services';
import type { Bill, BillFormData, CategoryBreakdown } from '@/types';
import { BillCategory, BillStatus } from '@/types';
import { create } from 'zustand';

interface BillState {
  // Data
  bills: Bill[];
  selectedBill: Bill | null;
  isLoading: boolean;
  error: string | null;

  // Computed values
  upcomingBills: Bill[];
  overdueBills: Bill[];
  totalMonthlyExpenses: number;
  categoryBreakdown: CategoryBreakdown[];

  // Actions
  fetchBills: () => Promise<void>;
  addBill: (formData: BillFormData) => Promise<Bill>;
  updateBill: (billId: string, updates: Partial<BillFormData>) => Promise<void>;
  deleteBill: (billId: string) => Promise<void>;
  markAsPaid: (billId: string, paymentDetails?: { method?: string; notes?: string }) => Promise<void>;
  markBillAsPaid: (billId: string, paymentDetails?: { method?: string; notes?: string }) => Promise<void>; // Alias
  selectBill: (bill: Bill | null) => void;
  getBillById: (billId: string) => Bill | undefined;
  getBillsByCategory: (category: BillCategory) => Bill[];
  searchBills: (query: string) => Bill[];
  clearError: () => void;
}

export const useBillStore = create<BillState>((set, get) => ({
  // Initial state
  bills: [],
  selectedBill: null,
  isLoading: false,
  error: null,
  upcomingBills: [],
  overdueBills: [],
  totalMonthlyExpenses: 0,
  categoryBreakdown: [],

  // Fetch all bills
  fetchBills: async () => {
    set({ isLoading: true, error: null });
    try {
      const bills = await billService.getAllBills();
      const upcomingBills = bills.filter((b) => b.status === BillStatus.UPCOMING);
      const overdueBills = bills.filter((b) => b.status === BillStatus.OVERDUE);
      const totalMonthlyExpenses = await billService.getTotalMonthlyExpenses();
      const categoryBreakdown = await billService.getCategoryBreakdown();

      set({
        bills,
        upcomingBills,
        overdueBills,
        totalMonthlyExpenses,
        categoryBreakdown,
        isLoading: false,
      });
    } catch (error) {
      set({ error: 'Failed to fetch bills', isLoading: false });
      console.error('Error fetching bills:', error);
    }
  },

  // Add a new bill
  addBill: async (formData: BillFormData) => {
    set({ isLoading: true, error: null });
    try {
      const newBill = await billService.createBill(formData);
      await get().fetchBills(); // Refresh all data
      return newBill;
    } catch (error) {
      set({ error: 'Failed to add bill', isLoading: false });
      throw error;
    }
  },

  // Update a bill
  updateBill: async (billId: string, updates: Partial<BillFormData>) => {
    set({ isLoading: true, error: null });
    try {
      await billService.updateBill(billId, updates);
      await get().fetchBills(); // Refresh all data
    } catch (error) {
      set({ error: 'Failed to update bill', isLoading: false });
      throw error;
    }
  },

  // Delete a bill
  deleteBill: async (billId: string) => {
    set({ isLoading: true, error: null });
    try {
      await billService.deleteBill(billId);
      await get().fetchBills(); // Refresh all data
    } catch (error) {
      set({ error: 'Failed to delete bill', isLoading: false });
      throw error;
    }
  },

  // Mark bill as paid
  markAsPaid: async (billId: string, paymentDetails?: { method?: string; notes?: string }) => {
    set({ isLoading: true, error: null });
    try {
      await billService.markAsPaid(billId, paymentDetails);
      await get().fetchBills(); // Refresh all data
    } catch (error) {
      set({ error: 'Failed to mark bill as paid', isLoading: false });
      throw error;
    }
  },

  // Alias for markAsPaid
  markBillAsPaid: async (billId: string, paymentDetails?: { method?: string; notes?: string }) => {
    return get().markAsPaid(billId, paymentDetails);
  },

  // Select a bill
  selectBill: (bill: Bill | null) => {
    set({ selectedBill: bill });
  },

  // Get bill by ID
  getBillById: (billId: string) => {
    return get().bills.find((b) => b.id === billId);
  },

  // Get bills by category
  getBillsByCategory: (category: BillCategory) => {
    return get().bills.filter((b) => b.category === category);
  },

  // Search bills
  searchBills: (query: string) => {
    const lowerQuery = query.toLowerCase();
    return get().bills.filter(
      (b) =>
        b.name.toLowerCase().includes(lowerQuery) ||
        b.notes?.toLowerCase().includes(lowerQuery)
    );
  },

  // Clear error
  clearError: () => {
    set({ error: null });
  },
}));
