// ============================================
// GREPRE SMART LIFE - BACKUP & EXPORT SERVICE
// Data Portability - The "Trust" Builder
// Users can export their data anytime
// ============================================

import {
    AppSettings,
    BackupData,
    BackupRecord,
    Bill,
    Document,
    DocumentMetadata,
    ExportOptions,
    Reminder
} from '@/types';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import JSZip from 'jszip';
import { storageService } from './storage';

const BACKUP_VERSION = '1.0.0';
const BACKUP_DIR = FileSystem.documentDirectory + 'backups/';

export const backupService = {
  /**
   * Initialize backup directory
   */
  async initialize(): Promise<void> {
    const dirInfo = await FileSystem.getInfoAsync(BACKUP_DIR);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(BACKUP_DIR, { intermediates: true });
    }
  },

  /**
   * Create a full backup of all user data
   * This is the key "Trust Builder" feature
   */
  async createBackup(
    options: ExportOptions = {
      format: 'zip',
      includeBills: true,
      includeDocuments: true,
      includeDocumentFiles: true,
      includeReminders: true,
      includeSettings: true,
      encrypt: false,
    }
  ): Promise<BackupRecord> {
    await this.initialize();
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `grepre-backup-${timestamp}`;
    
    try {
      // Gather all data
      const bills = options.includeBills ? await storageService.billStorage.getAll() : [];
      const documents = options.includeDocuments ? await storageService.documentStorage.getAll() : [];
      const reminders = options.includeReminders ? await storageService.reminderStorage.getAll() : [];
      const settings = options.includeSettings ? await storageService.userStorage.getSettings() : null;
      const user = await storageService.userStorage.getProfile();

      // Create backup data structure
      const backupData: BackupData = {
        version: BACKUP_VERSION,
        createdAt: new Date().toISOString(),
        user: user || {},
        bills,
        documents: documents.map(d => this.createDocumentMetadata(d)),
        reminders,
        settings: settings || {} as AppSettings,
      };

      let filePath: string;
      let fileSize: number;

      if (options.format === 'zip' && options.includeDocumentFiles) {
        // Create ZIP with JSON + document files
        const result = await this.createZipBackup(fileName, backupData, documents);
        filePath = result.filePath;
        fileSize = result.fileSize;
      } else if (options.format === 'csv') {
        // Create CSV exports
        const result = await this.createCsvBackup(fileName, bills, documents);
        filePath = result.filePath;
        fileSize = result.fileSize;
      } else {
        // Create JSON backup
        const result = await this.createJsonBackup(fileName, backupData);
        filePath = result.filePath;
        fileSize = result.fileSize;
      }

      // Create backup record
      const record: BackupRecord = {
        id: Date.now().toString(),
        backupType: 'manual',
        fileName: fileName + (options.format === 'zip' ? '.zip' : options.format === 'csv' ? '.csv' : '.json'),
        fileSize,
        filePath,
        isEncrypted: options.encrypt,
        encryptionHint: options.encrypt ? 'User-defined password' : undefined,
        itemsCount: {
          bills: bills.length,
          documents: documents.length,
          reminders: reminders.length,
        },
        status: 'completed',
        createdAt: new Date().toISOString(),
      };

      // Save backup record
      await this.saveBackupRecord(record);

      return record;
    } catch (error) {
      console.error('Backup creation failed:', error);
      throw error;
    }
  },

  /**
   * Create a ZIP backup with all files
   */
  async createZipBackup(
    fileName: string,
    data: BackupData,
    documents: Document[]
  ): Promise<{ filePath: string; fileSize: number }> {
    const zip = new JSZip();

    // Add JSON data
    zip.file('data.json', JSON.stringify(data, null, 2));

    // Add document files
    const docsFolder = zip.folder('documents');
    if (docsFolder) {
      for (const doc of documents) {
        try {
          if (doc.fileUri && await this.fileExists(doc.fileUri)) {
            const fileContent = await FileSystem.readAsStringAsync(doc.fileUri, {
              encoding: FileSystem.EncodingType.Base64,
            });
            const extension = doc.fileType || 'pdf';
            docsFolder.file(`${doc.id}.${extension}`, fileContent, { base64: true });
          }
        } catch (error) {
          console.warn(`Could not include document ${doc.id}:`, error);
        }
      }
    }

    // Generate ZIP
    const zipContent = await zip.generateAsync({ type: 'base64' });
    const filePath = BACKUP_DIR + fileName + '.zip';
    
    await FileSystem.writeAsStringAsync(filePath, zipContent, {
      encoding: FileSystem.EncodingType.Base64,
    });

    const fileInfo = await FileSystem.getInfoAsync(filePath);
    
    return {
      filePath,
      fileSize: fileInfo.exists ? (fileInfo as any).size || 0 : 0,
    };
  },

  /**
   * Create a JSON-only backup
   */
  async createJsonBackup(
    fileName: string,
    data: BackupData
  ): Promise<{ filePath: string; fileSize: number }> {
    const filePath = BACKUP_DIR + fileName + '.json';
    const content = JSON.stringify(data, null, 2);
    
    await FileSystem.writeAsStringAsync(filePath, content);
    
    const fileInfo = await FileSystem.getInfoAsync(filePath);
    
    return {
      filePath,
      fileSize: fileInfo.exists ? (fileInfo as any).size || content.length : content.length,
    };
  },

  /**
   * Create CSV exports for spreadsheet compatibility
   */
  async createCsvBackup(
    fileName: string,
    bills: Bill[],
    documents: Document[]
  ): Promise<{ filePath: string; fileSize: number }> {
    const zip = new JSZip();

    // Bills CSV
    const billsCsv = this.billsToCsv(bills);
    zip.file('bills.csv', billsCsv);

    // Documents CSV
    const docsCsv = this.documentsToCsv(documents);
    zip.file('documents.csv', docsCsv);

    const zipContent = await zip.generateAsync({ type: 'base64' });
    const filePath = BACKUP_DIR + fileName + '-csv.zip';
    
    await FileSystem.writeAsStringAsync(filePath, zipContent, {
      encoding: FileSystem.EncodingType.Base64,
    });

    const fileInfo = await FileSystem.getInfoAsync(filePath);
    
    return {
      filePath,
      fileSize: fileInfo.exists ? (fileInfo as any).size || 0 : 0,
    };
  },

  /**
   * Share/export backup file
   */
  async shareBackup(record: BackupRecord): Promise<void> {
    if (!record.filePath) {
      throw new Error('Backup file path not found');
    }

    const isAvailable = await Sharing.isAvailableAsync();
    if (!isAvailable) {
      throw new Error('Sharing is not available on this device');
    }

    await Sharing.shareAsync(record.filePath, {
      mimeType: record.fileName.endsWith('.zip') 
        ? 'application/zip' 
        : 'application/json',
      dialogTitle: 'Export GrePre Backup',
    });
  },

  /**
   * Restore from backup file
   */
  async restoreFromBackup(backupUri: string): Promise<{
    success: boolean;
    itemsRestored: { bills: number; documents: number; reminders: number };
    errors: string[];
  }> {
    const errors: string[] = [];
    let bills: Bill[] = [];
    let documents: Document[] = [];
    let reminders: Reminder[] = [];

    try {
      const fileContent = await FileSystem.readAsStringAsync(backupUri);
      const backupData: BackupData = JSON.parse(fileContent);

      // Validate version
      if (!backupData.version) {
        throw new Error('Invalid backup file format');
      }

      // Restore data
      if (backupData.bills?.length) {
        await storageService.billStorage.saveAll(backupData.bills);
        bills = backupData.bills;
      }

      if (backupData.reminders?.length) {
        await storageService.reminderStorage.saveAll(backupData.reminders);
        reminders = backupData.reminders;
      }

      if (backupData.settings) {
        await storageService.userStorage.saveSettings(backupData.settings);
      }

      // Note: Document files need to be handled separately for ZIP backups

      return {
        success: true,
        itemsRestored: {
          bills: bills.length,
          documents: documents.length,
          reminders: reminders.length,
        },
        errors,
      };
    } catch (error) {
      return {
        success: false,
        itemsRestored: { bills: 0, documents: 0, reminders: 0 },
        errors: [(error as Error).message],
      };
    }
  },

  /**
   * Get backup history
   */
  async getBackupHistory(): Promise<BackupRecord[]> {
    try {
      const data = await storageService.storage.get<BackupRecord[]>('backup_history');
      return data || [];
    } catch {
      return [];
    }
  },

  /**
   * Delete old backups to save space
   */
  async cleanupOldBackups(keepCount: number = 5): Promise<void> {
    const history = await this.getBackupHistory();
    
    if (history.length <= keepCount) return;

    // Sort by date, oldest first
    const sorted = [...history].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    // Delete oldest backups
    const toDelete = sorted.slice(0, history.length - keepCount);
    
    for (const record of toDelete) {
      if (record.filePath) {
        try {
          await FileSystem.deleteAsync(record.filePath, { idempotent: true });
        } catch {
          // Ignore deletion errors
        }
      }
    }

    // Update history
    const remaining = sorted.slice(history.length - keepCount);
    await storageService.storage.set('backup_history', remaining);
  },

  // ============================================
  // HELPER METHODS
  // ============================================

  createDocumentMetadata(doc: Document): DocumentMetadata {
    return {
      id: doc.id,
      name: doc.name,
      category: doc.category,
      fileType: doc.fileType,
      fileName: `${doc.id}.${doc.fileType}`,
      expiryDate: doc.expiryDate,
    };
  },

  billsToCsv(bills: Bill[]): string {
    const headers = [
      'ID', 'Name', 'Category', 'Amount', 'Currency', 'Due Date', 
      'Frequency', 'Status', 'Auto-Pay', 'Notes', 'Created'
    ];
    
    const rows = bills.map(b => [
      b.id,
      `"${b.name}"`,
      b.category,
      b.amount,
      b.currency,
      b.dueDate,
      b.frequency,
      b.status,
      b.autopay ? 'Yes' : 'No',
      `"${b.notes || ''}"`,
      b.createdAt,
    ]);

    return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  },

  documentsToCsv(documents: Document[]): string {
    const headers = [
      'ID', 'Name', 'Category', 'Document Number', 'Issue Date', 
      'Expiry Date', 'File Type', 'Tags', 'Created'
    ];
    
    const rows = documents.map(d => [
      d.id,
      `"${d.name}"`,
      d.category,
      d.documentNumber || '',
      d.issueDate || '',
      d.expiryDate || '',
      d.fileType,
      `"${d.tags?.join(', ') || ''}"`,
      d.createdAt,
    ]);

    return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  },

  async fileExists(uri: string): Promise<boolean> {
    try {
      const info = await FileSystem.getInfoAsync(uri);
      return info.exists;
    } catch {
      return false;
    }
  },

  async saveBackupRecord(record: BackupRecord): Promise<void> {
    const history = await this.getBackupHistory();
    history.push(record);
    await storageService.storage.set('backup_history', history);
  },
};

export default backupService;
