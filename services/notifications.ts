// ============================================
// GREPRE SMART LIFE - NOTIFICATION SERVICE
// Handles push notifications and reminders
// ============================================

import type { Bill, Document, NotificationPayload, Reminder } from '@/types';
import { ReminderType } from '@/types';
import { format, isAfter, isBefore, startOfDay, subDays } from 'date-fns';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import uuid from 'react-native-uuid';
import { reminderStorage } from './storage';

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export const notificationService = {
  /**
   * Request notification permissions
   */
  async requestPermissions(): Promise<boolean> {
    try {
      if (!Device.isDevice) {
        console.log('Push notifications require a physical device');
        return false;
      }

      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.log('Failed to get push notification permissions');
        return false;
      }

      // Set up Android notification channel
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('bills', {
          name: 'Bill Reminders',
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#1E3A5F',
        });

        await Notifications.setNotificationChannelAsync('documents', {
          name: 'Document Expiry',
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#FF6B6B',
        });
      }

      return true;
    } catch (error) {
      console.error('Error requesting notification permissions:', error);
      return false;
    }
  },

  /**
   * Schedule a notification
   */
  async scheduleNotification(payload: NotificationPayload): Promise<string | null> {
    try {
      const trigger = payload.trigger.date;
      
      // Don't schedule notifications in the past
      if (isBefore(trigger, new Date())) {
        return null;
      }

      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: payload.title,
          body: payload.body,
          data: payload.data,
          sound: true,
          priority: Notifications.AndroidNotificationPriority.HIGH,
        },
        trigger: {
          date: trigger,
        },
      });

      return notificationId;
    } catch (error) {
      console.error('Error scheduling notification:', error);
      return null;
    }
  },

  /**
   * Cancel a scheduled notification
   */
  async cancelNotification(notificationId: string): Promise<void> {
    try {
      await Notifications.cancelScheduledNotificationAsync(notificationId);
    } catch (error) {
      console.error('Error canceling notification:', error);
    }
  },

  /**
   * Cancel all scheduled notifications
   */
  async cancelAllNotifications(): Promise<void> {
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
    } catch (error) {
      console.error('Error canceling all notifications:', error);
    }
  },

  /**
   * Get all scheduled notifications
   */
  async getScheduledNotifications(): Promise<Notifications.NotificationRequest[]> {
    try {
      return await Notifications.getAllScheduledNotificationsAsync();
    } catch (error) {
      console.error('Error getting scheduled notifications:', error);
      return [];
    }
  },

  /**
   * Schedule reminders for a bill
   */
  async scheduleBillReminders(bill: Bill): Promise<Reminder[]> {
    const reminders: Reminder[] = [];
    const dueDate = new Date(bill.nextDueDate);

    for (const daysBefore of bill.reminderDays) {
      const reminderDate = subDays(startOfDay(dueDate), daysBefore);
      
      // Set reminder for 9 AM
      reminderDate.setHours(9, 0, 0, 0);

      if (isAfter(reminderDate, new Date())) {
        const title = daysBefore === 0 
          ? `💸 ${bill.name} is due today!`
          : `📅 ${bill.name} due in ${daysBefore} day${daysBefore > 1 ? 's' : ''}`;
        
        const message = `Amount: ${bill.currency} ${bill.amount.toLocaleString()}`;

        const notificationId = await this.scheduleNotification({
          id: uuid.v4() as string,
          title,
          body: message,
          data: {
            type: ReminderType.BILL_DUE,
            referenceId: bill.id,
            screen: 'BillDetail',
          },
          trigger: { date: reminderDate },
        });

        if (notificationId) {
          const reminder: Reminder = {
            id: uuid.v4() as string,
            type: ReminderType.BILL_DUE,
            referenceId: bill.id,
            title,
            message,
            scheduledDate: reminderDate.toISOString(),
            isRead: false,
            isSent: false,
            notificationId,
            createdAt: new Date().toISOString(),
          };

          reminders.push(reminder);
          await reminderStorage.add(reminder);
        }
      }
    }

    return reminders;
  },

  /**
   * Schedule reminders for a document expiry
   */
  async scheduleDocumentReminders(document: Document): Promise<Reminder[]> {
    if (!document.expiryDate) {
      return [];
    }

    const reminders: Reminder[] = [];
    const expiryDate = new Date(document.expiryDate);

    for (const daysBefore of document.reminderDays) {
      const reminderDate = subDays(startOfDay(expiryDate), daysBefore);
      
      // Set reminder for 9 AM
      reminderDate.setHours(9, 0, 0, 0);

      if (isAfter(reminderDate, new Date())) {
        const title = daysBefore === 0 
          ? `⚠️ ${document.name} expires today!`
          : `📋 ${document.name} expires in ${daysBefore} day${daysBefore > 1 ? 's' : ''}`;
        
        const message = `Expiry date: ${format(expiryDate, 'MMMM d, yyyy')}`;

        const notificationId = await this.scheduleNotification({
          id: uuid.v4() as string,
          title,
          body: message,
          data: {
            type: ReminderType.DOCUMENT_EXPIRY,
            referenceId: document.id,
            screen: 'DocumentDetail',
          },
          trigger: { date: reminderDate },
        });

        if (notificationId) {
          const reminder: Reminder = {
            id: uuid.v4() as string,
            type: ReminderType.DOCUMENT_EXPIRY,
            referenceId: document.id,
            title,
            message,
            scheduledDate: reminderDate.toISOString(),
            isRead: false,
            isSent: false,
            notificationId,
            createdAt: new Date().toISOString(),
          };

          reminders.push(reminder);
          await reminderStorage.add(reminder);
        }
      }
    }

    return reminders;
  },

  /**
   * Cancel all reminders for a bill or document
   */
  async cancelRemindersForItem(referenceId: string): Promise<void> {
    const allReminders = await reminderStorage.getAll();
    const itemReminders = allReminders.filter((r) => r.referenceId === referenceId);

    for (const reminder of itemReminders) {
      if (reminder.notificationId) {
        await this.cancelNotification(reminder.notificationId);
      }
      await reminderStorage.delete(reminder.id);
    }
  },

  /**
   * Listen for notification responses (when user taps notification)
   */
  addNotificationResponseListener(
    callback: (response: Notifications.NotificationResponse) => void
  ): Notifications.Subscription {
    return Notifications.addNotificationResponseReceivedListener(callback);
  },

  /**
   * Listen for incoming notifications (when app is foregrounded)
   */
  addNotificationReceivedListener(
    callback: (notification: Notifications.Notification) => void
  ): Notifications.Subscription {
    return Notifications.addNotificationReceivedListener(callback);
  },

  /**
   * Get badge count
   */
  async getBadgeCount(): Promise<number> {
    return await Notifications.getBadgeCountAsync();
  },

  /**
   * Set badge count
   */
  async setBadgeCount(count: number): Promise<void> {
    await Notifications.setBadgeCountAsync(count);
  },

  /**
   * Clear badge
   */
  async clearBadge(): Promise<void> {
    await Notifications.setBadgeCountAsync(0);
  },
};
