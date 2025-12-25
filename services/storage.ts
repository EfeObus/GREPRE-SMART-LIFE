// ============================================
// GREPRE SMART LIFE - STORAGE SERVICE
// Handles secure & regular data persistence
// ============================================

import { STORAGE_KEYS } from '@/constants';
import type { AppSettings, Bill, Document, Reminder, UserProfile } from '@/types';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

// ============ REGULAR STORAGE (AsyncStorage) ============

export const storage = {
  /**
   * Store a value in AsyncStorage
   */
  async set<T>(key: string, value: T): Promise<void> {
    try {
      const jsonValue = JSON.stringify(value);
      await AsyncStorage.setItem(key, jsonValue);
    } catch (error) {
      console.error(`Error storing ${key}:`, error);
      throw error;
    }
  },

  /**
   * Retrieve a value from AsyncStorage
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const jsonValue = await AsyncStorage.getItem(key);
      return jsonValue != null ? JSON.parse(jsonValue) : null;
    } catch (error) {
      console.error(`Error retrieving ${key}:`, error);
      throw error;
    }
  },

  /**
   * Remove a value from AsyncStorage
   */
  async remove(key: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(key);
    } catch (error) {
      console.error(`Error removing ${key}:`, error);
      throw error;
    }
  },

  /**
   * Clear all AsyncStorage data
   */
  async clear(): Promise<void> {
    try {
      await AsyncStorage.clear();
    } catch (error) {
      console.error('Error clearing storage:', error);
      throw error;
    }
  },

  /**
   * Get all keys from AsyncStorage
   */
  async getAllKeys(): Promise<readonly string[]> {
    try {
      return await AsyncStorage.getAllKeys();
    } catch (error) {
      console.error('Error getting all keys:', error);
      throw error;
    }
  },

  /**
   * Get multiple values at once
   */
  async multiGet<T>(keys: string[]): Promise<Map<string, T | null>> {
    try {
      const pairs = await AsyncStorage.multiGet(keys);
      const result = new Map<string, T | null>();
      pairs.forEach(([key, value]) => {
        result.set(key, value ? JSON.parse(value) : null);
      });
      return result;
    } catch (error) {
      console.error('Error multi-getting:', error);
      throw error;
    }
  },
};

// ============ SECURE STORAGE (SecureStore) ============

export const secureStorage = {
  /**
   * Store a value securely (encrypted)
   */
  async set(key: string, value: string): Promise<void> {
    try {
      await SecureStore.setItemAsync(key, value);
    } catch (error) {
      console.error(`Error securely storing ${key}:`, error);
      throw error;
    }
  },

  /**
   * Retrieve a value from secure storage
   */
  async get(key: string): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(key);
    } catch (error) {
      console.error(`Error securely retrieving ${key}:`, error);
      throw error;
    }
  },

  /**
   * Remove a value from secure storage
   */
  async remove(key: string): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(key);
    } catch (error) {
      console.error(`Error securely removing ${key}:`, error);
      throw error;
    }
  },

  /**
   * Store an object securely (JSON stringified)
   */
  async setObject<T>(key: string, value: T): Promise<void> {
    try {
      const jsonValue = JSON.stringify(value);
      await SecureStore.setItemAsync(key, jsonValue);
    } catch (error) {
      console.error(`Error securely storing object ${key}:`, error);
      throw error;
    }
  },

  /**
   * Retrieve an object from secure storage
   */
  async getObject<T>(key: string): Promise<T | null> {
    try {
      const jsonValue = await SecureStore.getItemAsync(key);
      return jsonValue ? JSON.parse(jsonValue) : null;
    } catch (error) {
      console.error(`Error securely retrieving object ${key}:`, error);
      throw error;
    }
  },
};

// ============ TYPED STORAGE HELPERS ============

export const billStorage = {
  async getAll(): Promise<Bill[]> {
    return (await storage.get<Bill[]>(STORAGE_KEYS.BILLS)) || [];
  },

  async save(bills: Bill[]): Promise<void> {
    await storage.set(STORAGE_KEYS.BILLS, bills);
  },

  async saveAll(bills: Bill[]): Promise<void> {
    await this.save(bills);
  },

  async add(bill: Bill): Promise<void> {
    const bills = await this.getAll();
    bills.push(bill);
    await this.save(bills);
  },

  async update(billId: string, updates: Partial<Bill>): Promise<void> {
    const bills = await this.getAll();
    const index = bills.findIndex((b) => b.id === billId);
    if (index !== -1) {
      bills[index] = { ...bills[index], ...updates, updatedAt: new Date().toISOString() };
      await this.save(bills);
    }
  },

  async delete(billId: string): Promise<void> {
    const bills = await this.getAll();
    const filtered = bills.filter((b) => b.id !== billId);
    await this.save(filtered);
  },

  async getById(billId: string): Promise<Bill | undefined> {
    const bills = await this.getAll();
    return bills.find((b) => b.id === billId);
  },
};

export const documentStorage = {
  async getAll(): Promise<Document[]> {
    return (await storage.get<Document[]>(STORAGE_KEYS.DOCUMENTS)) || [];
  },

  async save(documents: Document[]): Promise<void> {
    await storage.set(STORAGE_KEYS.DOCUMENTS, documents);
  },

  async saveAll(documents: Document[]): Promise<void> {
    await this.save(documents);
  },

  async add(document: Document): Promise<void> {
    const documents = await this.getAll();
    documents.push(document);
    await this.save(documents);
  },

  async update(documentId: string, updates: Partial<Document>): Promise<void> {
    const documents = await this.getAll();
    const index = documents.findIndex((d) => d.id === documentId);
    if (index !== -1) {
      documents[index] = { ...documents[index], ...updates, updatedAt: new Date().toISOString() };
      await this.save(documents);
    }
  },

  async delete(documentId: string): Promise<void> {
    const documents = await this.getAll();
    const filtered = documents.filter((d) => d.id !== documentId);
    await this.save(filtered);
  },

  async getById(documentId: string): Promise<Document | undefined> {
    const documents = await this.getAll();
    return documents.find((d) => d.id === documentId);
  },
};

export const reminderStorage = {
  async getAll(): Promise<Reminder[]> {
    return (await storage.get<Reminder[]>(STORAGE_KEYS.REMINDERS)) || [];
  },

  async save(reminders: Reminder[]): Promise<void> {
    await storage.set(STORAGE_KEYS.REMINDERS, reminders);
  },

  async saveAll(reminders: Reminder[]): Promise<void> {
    await this.save(reminders);
  },

  async add(reminder: Reminder): Promise<void> {
    const reminders = await this.getAll();
    reminders.push(reminder);
    await this.save(reminders);
  },

  async delete(reminderId: string): Promise<void> {
    const reminders = await this.getAll();
    const filtered = reminders.filter((r) => r.id !== reminderId);
    await this.save(filtered);
  },

  async markAsRead(reminderId: string): Promise<void> {
    const reminders = await this.getAll();
    const index = reminders.findIndex((r) => r.id === reminderId);
    if (index !== -1) {
      reminders[index].isRead = true;
      await this.save(reminders);
    }
  },
};

export const userStorage = {
  async getProfile(): Promise<UserProfile | null> {
    return storage.get<UserProfile>(STORAGE_KEYS.USER_PROFILE);
  },

  async saveProfile(profile: UserProfile): Promise<void> {
    await storage.set(STORAGE_KEYS.USER_PROFILE, profile);
  },

  async getSettings(): Promise<AppSettings | null> {
    return storage.get<AppSettings>(STORAGE_KEYS.SETTINGS);
  },

  async saveSettings(settings: AppSettings): Promise<void> {
    await storage.set(STORAGE_KEYS.SETTINGS, settings);
  },

  async isOnboardingComplete(): Promise<boolean> {
    const value = await storage.get<boolean>(STORAGE_KEYS.ONBOARDING_COMPLETE);
    return value === true;
  },

  async setOnboardingComplete(): Promise<void> {
    await storage.set(STORAGE_KEYS.ONBOARDING_COMPLETE, true);
  },
};

// Combined storage service for backward compatibility
export const storageService = {
  storage,
  secureStorage,
  billStorage,
  documentStorage,
  reminderStorage,
  userStorage,
};
