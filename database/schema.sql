-- ============================================
-- GREPRE SMART LIFE - DATABASE SCHEMA
-- PostgreSQL Database Schema
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- USERS TABLE
-- ============================================
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    avatar_url TEXT,
    phone VARCHAR(50),
    password_hash VARCHAR(255),
    is_biometric_enabled BOOLEAN DEFAULT false,
    preferred_currency VARCHAR(10) DEFAULT 'NGN',
    theme VARCHAR(20) DEFAULT 'system',
    notification_enabled BOOLEAN DEFAULT true,
    onboarding_completed BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- BILL CATEGORIES TABLE
-- ============================================
CREATE TABLE bill_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    icon VARCHAR(50) NOT NULL,
    color VARCHAR(20) NOT NULL,
    is_system BOOLEAN DEFAULT false,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default bill categories
INSERT INTO bill_categories (name, icon, color, is_system) VALUES
('Rent', 'home-outline', '#1E3A5F', true),
('Utilities', 'flash-outline', '#F59E0B', true),
('Subscription', 'refresh-outline', '#8B5CF6', true),
('Insurance', 'shield-checkmark-outline', '#10B981', true),
('School Fees', 'school-outline', '#3B82F6', true),
('Credit Card', 'card-outline', '#EF4444', true),
('Loan', 'cash-outline', '#EC4899', true),
('Other', 'ellipsis-horizontal-outline', '#6B7280', true);

-- ============================================
-- DOCUMENT CATEGORIES TABLE
-- ============================================
CREATE TABLE document_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    icon VARCHAR(50) NOT NULL,
    color VARCHAR(20) NOT NULL,
    is_system BOOLEAN DEFAULT false,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default document categories
INSERT INTO document_categories (name, icon, color, is_system) VALUES
('ID Card', 'id-card-outline', '#1E3A5F', true),
('Visa', 'airplane-outline', '#8B5CF6', true),
('Passport', 'earth-outline', '#10B981', true),
('Permit', 'document-text-outline', '#F59E0B', true),
('License', 'car-outline', '#3B82F6', true),
('Warranty', 'shield-outline', '#EC4899', true),
('Certificate', 'ribbon-outline', '#14B8A6', true),
('Contract', 'create-outline', '#6366F1', true),
('Other', 'folder-outline', '#6B7280', true);

-- ============================================
-- BILLS TABLE
-- ============================================
CREATE TABLE bills (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category_id UUID REFERENCES bill_categories(id),
    category VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    amount DECIMAL(15, 2) NOT NULL,
    currency VARCHAR(10) DEFAULT 'NGN',
    due_date DATE NOT NULL,
    frequency VARCHAR(20) NOT NULL DEFAULT 'monthly',
    status VARCHAR(20) DEFAULT 'upcoming',
    is_auto_pay BOOLEAN DEFAULT false,
    reminder_days INTEGER DEFAULT 3,
    notes TEXT,
    is_active BOOLEAN DEFAULT true,
    last_paid_date TIMESTAMP WITH TIME ZONE,
    next_due_date DATE,
    -- Grace period fields
    grace_period_days INTEGER DEFAULT 0,
    escalation_level INTEGER DEFAULT 0,
    last_reminder_sent TIMESTAMP WITH TIME ZONE,
    -- Linked document
    linked_document_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for faster queries
CREATE INDEX idx_bills_user_id ON bills(user_id);
CREATE INDEX idx_bills_due_date ON bills(due_date);
CREATE INDEX idx_bills_status ON bills(status);
CREATE INDEX idx_bills_category ON bills(category);

-- ============================================
-- PAYMENT HISTORY TABLE
-- ============================================
CREATE TABLE payment_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    bill_id UUID NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount DECIMAL(15, 2) NOT NULL,
    payment_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    payment_method VARCHAR(50),
    confirmation_number VARCHAR(100),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_payment_history_bill_id ON payment_history(bill_id);
CREATE INDEX idx_payment_history_user_id ON payment_history(user_id);

-- ============================================
-- DOCUMENTS TABLE
-- ============================================
CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category_id UUID REFERENCES document_categories(id),
    category VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    document_number VARCHAR(100),
    issue_date DATE,
    expiry_date DATE,
    file_uri TEXT NOT NULL,
    thumbnail_uri TEXT,
    file_type VARCHAR(20) NOT NULL,
    file_size INTEGER DEFAULT 0,
    requires_biometric BOOLEAN DEFAULT false,
    is_encrypted BOOLEAN DEFAULT false,
    tags TEXT[], -- PostgreSQL array for tags
    notes TEXT,
    -- Linked bill for smart linking
    linked_bill_id UUID,
    -- OCR extracted data
    ocr_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add foreign key for linked document in bills
ALTER TABLE bills ADD CONSTRAINT fk_bills_linked_document 
    FOREIGN KEY (linked_document_id) REFERENCES documents(id) ON DELETE SET NULL;

-- Add foreign key for linked bill in documents
ALTER TABLE documents ADD CONSTRAINT fk_documents_linked_bill 
    FOREIGN KEY (linked_bill_id) REFERENCES bills(id) ON DELETE SET NULL;

CREATE INDEX idx_documents_user_id ON documents(user_id);
CREATE INDEX idx_documents_category ON documents(category);
CREATE INDEX idx_documents_expiry_date ON documents(expiry_date);
CREATE INDEX idx_documents_tags ON documents USING GIN(tags);

-- ============================================
-- REMINDERS TABLE
-- ============================================
CREATE TABLE reminders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    bill_id UUID REFERENCES bills(id) ON DELETE CASCADE,
    document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL, -- 'bill', 'document', 'custom'
    title VARCHAR(255) NOT NULL,
    message TEXT,
    scheduled_date TIMESTAMP WITH TIME ZONE NOT NULL,
    is_sent BOOLEAN DEFAULT false,
    is_read BOOLEAN DEFAULT false,
    is_dismissed BOOLEAN DEFAULT false,
    -- Grace period escalation
    escalation_level INTEGER DEFAULT 0,
    requires_confirmation BOOLEAN DEFAULT false,
    confirmed_at TIMESTAMP WITH TIME ZONE,
    notification_id VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_reminders_user_id ON reminders(user_id);
CREATE INDEX idx_reminders_scheduled_date ON reminders(scheduled_date);
CREATE INDEX idx_reminders_is_sent ON reminders(is_sent);

-- ============================================
-- DATA BACKUPS TABLE
-- ============================================
CREATE TABLE data_backups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    backup_type VARCHAR(20) NOT NULL, -- 'local', 'cloud', 'manual'
    file_name VARCHAR(255) NOT NULL,
    file_size INTEGER,
    file_path TEXT,
    cloud_provider VARCHAR(50),
    cloud_url TEXT,
    is_encrypted BOOLEAN DEFAULT true,
    encryption_hint VARCHAR(255),
    items_count JSONB, -- {"bills": 10, "documents": 5, "reminders": 20}
    status VARCHAR(20) DEFAULT 'completed',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_data_backups_user_id ON data_backups(user_id);

-- ============================================
-- OCR SCAN HISTORY TABLE
-- ============================================
CREATE TABLE ocr_scans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    image_uri TEXT NOT NULL,
    scan_type VARCHAR(20) NOT NULL, -- 'bill', 'document'
    extracted_data JSONB NOT NULL,
    confidence_score DECIMAL(5, 4),
    was_used BOOLEAN DEFAULT false,
    created_bill_id UUID REFERENCES bills(id) ON DELETE SET NULL,
    created_document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_ocr_scans_user_id ON ocr_scans(user_id);

-- ============================================
-- USER SESSIONS TABLE (for web auth)
-- ============================================
CREATE TABLE user_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,
    device_info JSONB,
    ip_address VARCHAR(50),
    is_active BOOLEAN DEFAULT true,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX idx_user_sessions_token_hash ON user_sessions(token_hash);

-- ============================================
-- SYNC LOG TABLE (for cross-device sync)
-- ============================================
CREATE TABLE sync_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    entity_type VARCHAR(50) NOT NULL, -- 'bill', 'document', 'reminder'
    entity_id UUID NOT NULL,
    action VARCHAR(20) NOT NULL, -- 'create', 'update', 'delete'
    data_snapshot JSONB,
    device_id VARCHAR(100),
    synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_sync_log_user_id ON sync_log(user_id);
CREATE INDEX idx_sync_log_synced_at ON sync_log(synced_at);

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to update 'updated_at' timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for auto-updating timestamps
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bills_updated_at BEFORE UPDATE ON bills
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_documents_updated_at BEFORE UPDATE ON documents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to calculate next due date based on frequency
CREATE OR REPLACE FUNCTION calculate_next_due_date(
    current_due DATE,
    freq VARCHAR(20)
)
RETURNS DATE AS $$
BEGIN
    RETURN CASE freq
        WHEN 'weekly' THEN current_due + INTERVAL '7 days'
        WHEN 'biweekly' THEN current_due + INTERVAL '14 days'
        WHEN 'monthly' THEN current_due + INTERVAL '1 month'
        WHEN 'quarterly' THEN current_due + INTERVAL '3 months'
        WHEN 'yearly' THEN current_due + INTERVAL '1 year'
        ELSE current_due
    END;
END;
$$ LANGUAGE plpgsql;

-- Function to get escalation reminders (grace period logic)
CREATE OR REPLACE FUNCTION get_escalation_reminders(p_user_id UUID)
RETURNS TABLE (
    bill_id UUID,
    bill_name VARCHAR(255),
    due_date DATE,
    amount DECIMAL(15, 2),
    days_overdue INTEGER,
    escalation_level INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        b.id,
        b.name,
        b.due_date,
        b.amount,
        (CURRENT_DATE - b.due_date)::INTEGER as days_overdue,
        CASE 
            WHEN (CURRENT_DATE - b.due_date) <= 0 THEN 0
            WHEN (CURRENT_DATE - b.due_date) <= 1 THEN 1
            WHEN (CURRENT_DATE - b.due_date) <= 3 THEN 2
            ELSE 3
        END as escalation_level
    FROM bills b
    WHERE b.user_id = p_user_id
        AND b.status != 'paid'
        AND b.is_active = true
        AND b.due_date <= CURRENT_DATE + INTERVAL '7 days'
    ORDER BY b.due_date ASC;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- VIEWS
-- ============================================

-- Dashboard summary view
CREATE OR REPLACE VIEW dashboard_summary AS
SELECT 
    u.id as user_id,
    COUNT(DISTINCT b.id) FILTER (WHERE b.status = 'overdue') as overdue_bills,
    COUNT(DISTINCT b.id) FILTER (WHERE b.status = 'due_soon') as due_soon_bills,
    COALESCE(SUM(b.amount) FILTER (WHERE b.status IN ('upcoming', 'due_soon') 
        AND b.due_date >= DATE_TRUNC('month', CURRENT_DATE)
        AND b.due_date < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month'), 0) as monthly_expenses,
    COUNT(DISTINCT d.id) FILTER (WHERE d.expiry_date IS NOT NULL 
        AND d.expiry_date <= CURRENT_DATE + INTERVAL '30 days') as expiring_documents
FROM users u
LEFT JOIN bills b ON b.user_id = u.id AND b.is_active = true
LEFT JOIN documents d ON d.user_id = u.id
GROUP BY u.id;

-- ============================================
-- GRANTS (adjust based on your DB user)
-- ============================================
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO grepre_app;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO grepre_app;
