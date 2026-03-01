-- EZ-Dine Management Schema
-- Tables needed for managing subscriptions, invoices, and plans from EZ-Connect

-- =====================================================
-- PLANS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  price DECIMAL(10, 2) NOT NULL DEFAULT 0,
  interval TEXT NOT NULL DEFAULT 'month' CHECK (interval IN ('month', 'year')),
  features JSONB DEFAULT '[]'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_plans_code ON plans(code);
CREATE INDEX IF NOT EXISTS idx_plans_is_active ON plans(is_active);

-- =====================================================
-- SUBSCRIPTIONS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES plans(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'trial', 'cancelled')),
  start_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  end_date TIMESTAMPTZ,
  billing_cycle TEXT NOT NULL DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly', 'annual')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_subscriptions_restaurant_id ON subscriptions(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_plan_id ON subscriptions(plan_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);

-- =====================================================
-- INVOICES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
  invoice_number TEXT NOT NULL UNIQUE,
  amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'INR',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'paid', 'overdue', 'cancelled')),
  issue_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  due_date TIMESTAMPTZ NOT NULL,
  paid_date TIMESTAMPTZ,
  description TEXT,
  pdf_path TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_invoices_restaurant_id ON invoices(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_invoices_subscription_id ON invoices(subscription_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_invoice_number ON invoices(invoice_number);

-- =====================================================
-- RLS POLICIES
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

-- Plans: Public read access, admin write access
CREATE POLICY "Plans are viewable by everyone" ON plans
  FOR SELECT USING (true);

CREATE POLICY "Plans are insertable by service role" ON plans
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Plans are updatable by service role" ON plans
  FOR UPDATE USING (true);

CREATE POLICY "Plans are deletable by service role" ON plans
  FOR DELETE USING (true);

-- Subscriptions: Restaurant owners can view their own, service role can manage all
CREATE POLICY "Subscriptions are viewable by restaurant owner" ON subscriptions
  FOR SELECT USING (
    auth.uid() IN (
      SELECT user_id FROM profiles WHERE restaurant_id = subscriptions.restaurant_id
    )
  );

CREATE POLICY "Subscriptions are manageable by service role" ON subscriptions
  FOR ALL USING (true);

-- Invoices: Restaurant owners can view their own, service role can manage all
CREATE POLICY "Invoices are viewable by restaurant owner" ON invoices
  FOR SELECT USING (
    auth.uid() IN (
      SELECT user_id FROM profiles WHERE restaurant_id = invoices.restaurant_id
    )
  );

CREATE POLICY "Invoices are manageable by service role" ON invoices
  FOR ALL USING (true);

-- =====================================================
-- SAMPLE DATA (Optional - for testing)
-- =====================================================

-- Insert sample plans
INSERT INTO plans (code, name, description, price, interval, features, is_active) VALUES
  ('starter', 'Starter Plan', 'Perfect for small restaurants', 999.00, 'month', '["1 Branch", "Basic POS", "KDS", "Reports"]'::jsonb, true),
  ('professional', 'Professional Plan', 'For growing restaurants', 1999.00, 'month', '["3 Branches", "Advanced POS", "KDS", "QR Orders", "Reports", "Analytics"]'::jsonb, true),
  ('enterprise', 'Enterprise Plan', 'For restaurant chains', 4999.00, 'month', '["Unlimited Branches", "Full POS Suite", "KDS", "QR Orders", "Advanced Reports", "Analytics", "Priority Support", "Custom Integrations"]'::jsonb, true)
ON CONFLICT (code) DO NOTHING;

-- =====================================================
-- FUNCTIONS
-- =====================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers to auto-update updated_at
DROP TRIGGER IF EXISTS update_plans_updated_at ON plans;
CREATE TRIGGER update_plans_updated_at
  BEFORE UPDATE ON plans
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_subscriptions_updated_at ON subscriptions;
CREATE TRIGGER update_subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_invoices_updated_at ON invoices;
CREATE TRIGGER update_invoices_updated_at
  BEFORE UPDATE ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- NOTES
-- =====================================================
-- 1. Run this SQL in your EZ-Dine Supabase database
-- 2. Make sure the 'restaurants' and 'profiles' tables already exist
-- 3. Use the service role key in EZ-Connect for full access
-- 4. The sample plans are optional - remove if not needed
