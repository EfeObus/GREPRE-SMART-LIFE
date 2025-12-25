// ============================================
// GREPRE SMART LIFE - DATABASE SERVICE
// PostgreSQL database connection and queries
// ============================================

import { Bill, Document, UserProfile } from '@/types';
import { Pool, PoolClient } from 'pg';

// Environment variables (loaded from .env)
const DATABASE_CONFIG = {
  connectionString: process.env.DATABASE_URL,
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'grepre_smartlife',
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
};

// Create connection pool
let pool: Pool | null = null;

export const databaseService = {
  // ============================================
  // CONNECTION MANAGEMENT
  // ============================================
  
  /**
   * Initialize database connection pool
   */
  async initialize(): Promise<void> {
    if (pool) return;
    
    pool = new Pool(DATABASE_CONFIG);
    
    pool.on('error', (err) => {
      console.error('Unexpected error on idle client', err);
    });
    
    // Test connection
    const client = await pool.connect();
    try {
      await client.query('SELECT NOW()');
      console.log('Database connected successfully');
    } finally {
      client.release();
    }
  },

  /**
   * Get a client from the pool
   */
  async getClient(): Promise<PoolClient> {
    if (!pool) {
      await this.initialize();
    }
    return pool!.connect();
  },

  /**
   * Close all connections
   */
  async close(): Promise<void> {
    if (pool) {
      await pool.end();
      pool = null;
    }
  },

  // ============================================
  // USER OPERATIONS
  // ============================================

  async createUser(user: Partial<UserProfile>): Promise<UserProfile> {
    const client = await this.getClient();
    try {
      const result = await client.query(
        `INSERT INTO users (email, name, avatar_url, phone, preferred_currency, theme, notification_enabled)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [user.email, user.name, user.avatarUrl, user.phone, user.preferredCurrency, user.theme, user.notificationsEnabled]
      );
      return this.mapUserRow(result.rows[0]);
    } finally {
      client.release();
    }
  },

  async getUserById(userId: string): Promise<UserProfile | null> {
    const client = await this.getClient();
    try {
      const result = await client.query('SELECT * FROM users WHERE id = $1', [userId]);
      return result.rows[0] ? this.mapUserRow(result.rows[0]) : null;
    } finally {
      client.release();
    }
  },

  async updateUser(userId: string, updates: Partial<UserProfile>): Promise<UserProfile | null> {
    const client = await this.getClient();
    try {
      const result = await client.query(
        `UPDATE users SET 
          name = COALESCE($2, name),
          avatar_url = COALESCE($3, avatar_url),
          phone = COALESCE($4, phone),
          preferred_currency = COALESCE($5, preferred_currency),
          theme = COALESCE($6, theme),
          notification_enabled = COALESCE($7, notification_enabled),
          is_biometric_enabled = COALESCE($8, is_biometric_enabled)
         WHERE id = $1
         RETURNING *`,
        [userId, updates.name, updates.avatarUrl, updates.phone, 
         updates.preferredCurrency, updates.theme, updates.notificationsEnabled, 
         updates.biometricEnabled]
      );
      return result.rows[0] ? this.mapUserRow(result.rows[0]) : null;
    } finally {
      client.release();
    }
  },

  // ============================================
  // BILL OPERATIONS
  // ============================================

  async createBill(userId: string, bill: Partial<Bill>): Promise<Bill> {
    const client = await this.getClient();
    try {
      const result = await client.query(
        `INSERT INTO bills (
          user_id, category, name, amount, currency, due_date, frequency,
          is_auto_pay, reminder_days, notes, is_active, linked_document_id,
          grace_period_days
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
         RETURNING *`,
        [
          userId, bill.category, bill.name, bill.amount, bill.currency || 'NGN',
          bill.dueDate, bill.frequency, bill.isAutoPay, bill.reminderDays,
          bill.notes, bill.isActive ?? true, bill.linkedDocumentId, bill.gracePeriodDays || 0
        ]
      );
      return this.mapBillRow(result.rows[0]);
    } finally {
      client.release();
    }
  },

  async getBillsByUserId(userId: string): Promise<Bill[]> {
    const client = await this.getClient();
    try {
      const result = await client.query(
        `SELECT b.*, 
          COALESCE(
            (SELECT json_agg(json_build_object('date', ph.payment_date, 'amount', ph.amount))
             FROM payment_history ph WHERE ph.bill_id = b.id), '[]'
          ) as payment_history
         FROM bills b
         WHERE b.user_id = $1 AND b.is_active = true
         ORDER BY b.due_date ASC`,
        [userId]
      );
      return result.rows.map(row => this.mapBillRow(row));
    } finally {
      client.release();
    }
  },

  async updateBill(billId: string, updates: Partial<Bill>): Promise<Bill | null> {
    const client = await this.getClient();
    try {
      const result = await client.query(
        `UPDATE bills SET
          name = COALESCE($2, name),
          amount = COALESCE($3, amount),
          due_date = COALESCE($4, due_date),
          frequency = COALESCE($5, frequency),
          is_auto_pay = COALESCE($6, is_auto_pay),
          reminder_days = COALESCE($7, reminder_days),
          notes = COALESCE($8, notes),
          status = COALESCE($9, status),
          linked_document_id = COALESCE($10, linked_document_id),
          escalation_level = COALESCE($11, escalation_level)
         WHERE id = $1
         RETURNING *`,
        [billId, updates.name, updates.amount, updates.dueDate, updates.frequency,
         updates.isAutoPay, updates.reminderDays, updates.notes, updates.status,
         updates.linkedDocumentId, updates.escalationLevel]
      );
      return result.rows[0] ? this.mapBillRow(result.rows[0]) : null;
    } finally {
      client.release();
    }
  },

  async markBillAsPaid(billId: string, amount: number, paymentMethod?: string): Promise<Bill | null> {
    const client = await this.getClient();
    try {
      await client.query('BEGIN');
      
      // Record payment
      await client.query(
        `INSERT INTO payment_history (bill_id, user_id, amount, payment_method)
         SELECT id, user_id, $2, $3 FROM bills WHERE id = $1`,
        [billId, amount, paymentMethod]
      );
      
      // Update bill status and calculate next due date
      const result = await client.query(
        `UPDATE bills SET
          status = 'paid',
          last_paid_date = NOW(),
          escalation_level = 0,
          next_due_date = calculate_next_due_date(due_date, frequency),
          due_date = CASE 
            WHEN frequency != 'once' THEN calculate_next_due_date(due_date, frequency)
            ELSE due_date
          END
         WHERE id = $1
         RETURNING *`,
        [billId]
      );
      
      await client.query('COMMIT');
      return result.rows[0] ? this.mapBillRow(result.rows[0]) : null;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  async deleteBill(billId: string): Promise<boolean> {
    const client = await this.getClient();
    try {
      const result = await client.query(
        'UPDATE bills SET is_active = false WHERE id = $1',
        [billId]
      );
      return (result.rowCount ?? 0) > 0;
    } finally {
      client.release();
    }
  },

  // ============================================
  // DOCUMENT OPERATIONS
  // ============================================

  async createDocument(userId: string, doc: Partial<Document>): Promise<Document> {
    const client = await this.getClient();
    try {
      const result = await client.query(
        `INSERT INTO documents (
          user_id, category, name, document_number, issue_date, expiry_date,
          file_uri, thumbnail_uri, file_type, file_size, requires_biometric,
          tags, notes, linked_bill_id, ocr_data
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
         RETURNING *`,
        [
          userId, doc.category, doc.name, doc.documentNumber, doc.issueDate,
          doc.expiryDate, doc.fileUri, doc.thumbnailUri, doc.fileType,
          doc.fileSize, doc.requiresBiometric, doc.tags, doc.notes,
          doc.linkedBillId, doc.ocrData ? JSON.stringify(doc.ocrData) : null
        ]
      );
      return this.mapDocumentRow(result.rows[0]);
    } finally {
      client.release();
    }
  },

  async getDocumentsByUserId(userId: string): Promise<Document[]> {
    const client = await this.getClient();
    try {
      const result = await client.query(
        `SELECT * FROM documents WHERE user_id = $1 ORDER BY created_at DESC`,
        [userId]
      );
      return result.rows.map(row => this.mapDocumentRow(row));
    } finally {
      client.release();
    }
  },

  async updateDocument(docId: string, updates: Partial<Document>): Promise<Document | null> {
    const client = await this.getClient();
    try {
      const result = await client.query(
        `UPDATE documents SET
          name = COALESCE($2, name),
          document_number = COALESCE($3, document_number),
          expiry_date = COALESCE($4, expiry_date),
          requires_biometric = COALESCE($5, requires_biometric),
          tags = COALESCE($6, tags),
          notes = COALESCE($7, notes),
          linked_bill_id = COALESCE($8, linked_bill_id)
         WHERE id = $1
         RETURNING *`,
        [docId, updates.name, updates.documentNumber, updates.expiryDate,
         updates.requiresBiometric, updates.tags, updates.notes, updates.linkedBillId]
      );
      return result.rows[0] ? this.mapDocumentRow(result.rows[0]) : null;
    } finally {
      client.release();
    }
  },

  async deleteDocument(docId: string): Promise<boolean> {
    const client = await this.getClient();
    try {
      const result = await client.query('DELETE FROM documents WHERE id = $1', [docId]);
      return (result.rowCount ?? 0) > 0;
    } finally {
      client.release();
    }
  },

  // ============================================
  // REMINDER OPERATIONS (Grace Period Logic)
  // ============================================

  async getEscalationReminders(userId: string): Promise<any[]> {
    const client = await this.getClient();
    try {
      const result = await client.query(
        `SELECT * FROM get_escalation_reminders($1)`,
        [userId]
      );
      return result.rows;
    } finally {
      client.release();
    }
  },

  async escalateBillReminder(billId: string): Promise<void> {
    const client = await this.getClient();
    try {
      await client.query(
        `UPDATE bills SET 
          escalation_level = escalation_level + 1,
          last_reminder_sent = NOW()
         WHERE id = $1`,
        [billId]
      );
    } finally {
      client.release();
    }
  },

  async confirmBillPayment(billId: string): Promise<void> {
    const client = await this.getClient();
    try {
      await client.query(
        `UPDATE reminders SET 
          confirmed_at = NOW(),
          is_read = true
         WHERE bill_id = $1 AND requires_confirmation = true AND confirmed_at IS NULL`,
        [billId]
      );
    } finally {
      client.release();
    }
  },

  // ============================================
  // DASHBOARD / ANALYTICS
  // ============================================

  async getDashboardSummary(userId: string): Promise<any> {
    const client = await this.getClient();
    try {
      const result = await client.query(
        `SELECT * FROM dashboard_summary WHERE user_id = $1`,
        [userId]
      );
      return result.rows[0] || {
        overdueBills: 0,
        dueSoonBills: 0,
        monthlyExpenses: 0,
        expiringDocuments: 0
      };
    } finally {
      client.release();
    }
  },

  // ============================================
  // BACKUP OPERATIONS
  // ============================================

  async createBackupRecord(userId: string, backup: any): Promise<any> {
    const client = await this.getClient();
    try {
      const result = await client.query(
        `INSERT INTO data_backups (
          user_id, backup_type, file_name, file_size, file_path,
          cloud_provider, cloud_url, is_encrypted, encryption_hint, items_count
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING *`,
        [
          userId, backup.backupType, backup.fileName, backup.fileSize,
          backup.filePath, backup.cloudProvider, backup.cloudUrl,
          backup.isEncrypted, backup.encryptionHint, JSON.stringify(backup.itemsCount)
        ]
      );
      return result.rows[0];
    } finally {
      client.release();
    }
  },

  async getBackupHistory(userId: string): Promise<any[]> {
    const client = await this.getClient();
    try {
      const result = await client.query(
        `SELECT * FROM data_backups WHERE user_id = $1 ORDER BY created_at DESC LIMIT 10`,
        [userId]
      );
      return result.rows;
    } finally {
      client.release();
    }
  },

  // ============================================
  // OCR SCAN OPERATIONS
  // ============================================

  async saveOcrScan(userId: string, scan: any): Promise<any> {
    const client = await this.getClient();
    try {
      const result = await client.query(
        `INSERT INTO ocr_scans (user_id, image_uri, scan_type, extracted_data, confidence_score)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [userId, scan.imageUri, scan.scanType, JSON.stringify(scan.extractedData), scan.confidenceScore]
      );
      return result.rows[0];
    } finally {
      client.release();
    }
  },

  // ============================================
  // ROW MAPPERS
  // ============================================

  mapUserRow(row: any): UserProfile {
    return {
      id: row.id,
      email: row.email,
      name: row.name,
      avatar: row.avatar_url,
      avatarUrl: row.avatar_url,
      phone: row.phone,
      biometricEnabled: row.is_biometric_enabled,
      currency: row.preferred_currency || 'USD',
      preferredCurrency: row.preferred_currency,
      timezone: row.timezone || 'UTC',
      theme: row.theme,
      notificationsEnabled: row.notification_enabled,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  },

  mapBillRow(row: any): Bill & { userId?: string } {
    return {
      id: row.id,
      userId: row.user_id,
      category: row.category,
      name: row.name,
      amount: parseFloat(row.amount),
      currency: row.currency,
      dueDate: row.due_date,
      nextDueDate: row.next_due_date || row.due_date,
      frequency: row.frequency,
      status: row.status,
      autopay: row.is_auto_pay,
      isAutoPay: row.is_auto_pay,
      reminderDays: row.reminder_days || [],
      notes: row.notes,
      isActive: row.is_active,
      paymentHistory: row.payment_history || [],
      linkedDocumentId: row.linked_document_id,
      escalationLevel: row.escalation_level,
      gracePeriodDays: row.grace_period_days,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  },

  mapDocumentRow(row: any): Document & { userId?: string } {
    return {
      id: row.id,
      userId: row.user_id,
      category: row.category,
      name: row.name,
      documentNumber: row.document_number,
      issueDate: row.issue_date,
      expiryDate: row.expiry_date,
      fileUri: row.file_uri,
      thumbnailUri: row.thumbnail_uri,
      fileType: row.file_type,
      fileSize: row.file_size,
      requiresBiometric: row.requires_biometric,
      isEncrypted: row.is_encrypted,
      reminderDays: row.reminder_days || [],
      tags: row.tags || [],
      notes: row.notes,
      linkedBillId: row.linked_bill_id,
      ocrData: row.ocr_data,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  },
};

export default databaseService;
