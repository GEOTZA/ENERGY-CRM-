-- ============================================================
-- Energy CRM — Supabase Tables
-- Πηγαίνε στο: Supabase Dashboard → SQL Editor → New Query
-- Πατήστε Run
-- ============================================================

-- Πίνακας χρήστων
CREATE TABLE IF NOT EXISTS users (
  id bigint PRIMARY KEY,
  email text,
  password text,
  name text,
  role text DEFAULT 'agent',
  createdBy bigint,
  superUserId bigint,
  assignedAgents jsonb DEFAULT '[]'
);

-- Πίνακας πελάτων
CREATE TABLE IF NOT EXISTS customers (
  id bigint PRIMARY KEY,
  name text,
  surname text,
  phone text,
  email text,
  afm text,
  provider text,
  agentId bigint,
  agentName text,
  installationAddress text,
  billingAddress text,
  submissionDate text,
  status text DEFAULT 'σε αναμονή',
  activationDate text,
  idNumber text,
  birthDate text,
  files jsonb DEFAULT '{}',
  contract jsonb,
  contractLink text,
  contractSentDate text,
  contractSentVia text,
  commentHistory jsonb DEFAULT '[]'
);

-- Πίνακας custom fields
CREATE TABLE IF NOT EXISTS custom_fields (
  id bigint PRIMARY KEY,
  label text,
  type text DEFAULT 'text',
  required boolean DEFAULT false
);

-- Ανοιχτή πρόσβαση (anon) — για demo. Σε production βάλε Row Level Security.
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_fields ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon full access on users" ON users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon full access on customers" ON customers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon full access on custom_fields" ON custom_fields FOR ALL USING (true) WITH CHECK (true);
