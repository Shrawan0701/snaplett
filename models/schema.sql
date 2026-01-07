-- NO pgvector locally

CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255),
  google_id VARCHAR(255) UNIQUE,
  country VARCHAR(10) DEFAULT 'IN',
  is_paid BOOLEAN DEFAULT FALSE,
  free_uploads_used INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE files (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  file_type VARCHAR(50) NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  extracted_text TEXT,
  embedding FLOAT8[], -- 👈 local fallback
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE payments (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  razorpay_order_id VARCHAR(255),
  razorpay_payment_id VARCHAR(255),
  razorpay_signature VARCHAR(255),
  amount DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(10) NOT NULL,
  status VARCHAR(50) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_files_user_id ON files(user_id);
CREATE INDEX idx_files_created_at ON files(created_at DESC);
CREATE INDEX idx_payments_user_id ON payments(user_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_google_id ON users(google_id);

-- =========================
-- NEW FEATURES (APPENDED)
-- =========================

-- Add folder column to files table
ALTER TABLE files
ADD COLUMN IF NOT EXISTS folder VARCHAR(50) DEFAULT 'general';

-- Create folders table
CREATE TABLE IF NOT EXISTS folders (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    folder_name VARCHAR(50) NOT NULL,
    icon VARCHAR(10) DEFAULT '📁',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, folder_name)
);

-- Create default folders for existing users
INSERT INTO folders (user_id, folder_name, icon)
SELECT id, 'payments', '💳' FROM users
UNION ALL
SELECT id, 'jobs', '💼' FROM users
UNION ALL
SELECT id, 'education', '🎓' FROM users
UNION ALL
SELECT id, 'travel', '✈️' FROM users
UNION ALL
SELECT id, 'health', '🏥' FROM users
UNION ALL
SELECT id, 'receipts', '🧾' FROM users
UNION ALL
SELECT id, 'personal', '👤' FROM users
UNION ALL
SELECT id, 'general', '📁' FROM users
ON CONFLICT (user_id, folder_name) DO NOTHING;

-- Add subscription expiry column
ALTER TABLE users
ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMP;

-- Backfill paid users
UPDATE users
SET subscription_expires_at = NOW() + INTERVAL '1 year'
WHERE is_paid = true
  AND subscription_expires_at IS NULL;

-- Indexes for new features
CREATE INDEX IF NOT EXISTS idx_files_folder ON files(folder);
CREATE INDEX IF NOT EXISTS idx_folders_user_id ON folders(user_id);
