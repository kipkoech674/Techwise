CREATE TABLE IF NOT EXISTS products (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  brand TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  processor TEXT NOT NULL DEFAULT '',
  ram_gb INTEGER,
  storage_gb INTEGER,
  price_kes INTEGER NOT NULL CHECK (price_kes >= 0),
  old_price_kes INTEGER CHECK (old_price_kes IS NULL OR old_price_kes >= price_kes),
  image_url TEXT NOT NULL DEFAULT '',
  rating NUMERIC(2, 1) NOT NULL DEFAULT 0 CHECK (rating >= 0 AND rating <= 5),
  review_count INTEGER NOT NULL DEFAULT 0 CHECK (review_count >= 0),
  stock_quantity INTEGER NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
  badge TEXT NOT NULL DEFAULT '',
  featured BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE products ADD COLUMN IF NOT EXISTS brand TEXT NOT NULL DEFAULT '';
ALTER TABLE products ADD COLUMN IF NOT EXISTS processor TEXT NOT NULL DEFAULT '';
ALTER TABLE products ADD COLUMN IF NOT EXISTS ram_gb INTEGER;
ALTER TABLE products ADD COLUMN IF NOT EXISTS storage_gb INTEGER;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'products_ram_gb_positive') THEN
    ALTER TABLE products ADD CONSTRAINT products_ram_gb_positive CHECK (ram_gb IS NULL OR ram_gb > 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'products_storage_gb_positive') THEN
    ALTER TABLE products ADD CONSTRAINT products_storage_gb_positive CHECK (storage_gb IS NULL OR storage_gb > 0);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS products_category_active_idx ON products (category, is_active);
CREATE INDEX IF NOT EXISTS products_price_active_idx ON products (price_kes, is_active);

CREATE TABLE IF NOT EXISTS customers (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS customer_sessions (
  token_hash TEXT PRIMARY KEY,
  customer_id BIGINT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS customer_sessions_expiry_idx ON customer_sessions (expires_at);

CREATE TABLE IF NOT EXISTS orders (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  customer_id BIGINT REFERENCES customers(id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL,
  county TEXT NOT NULL,
  town TEXT NOT NULL,
  delivery_address TEXT NOT NULL,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('mpesa', 'card')),
  subtotal_kes INTEGER NOT NULL CHECK (subtotal_kes >= 0),
  delivery_fee_kes INTEGER NOT NULL CHECK (delivery_fee_kes IN (100, 300, 600)),
  total_kes INTEGER NOT NULL CHECK (total_kes = subtotal_kes + delivery_fee_kes),
  payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'failed', 'cancelled')),
  fulfillment_status TEXT NOT NULL DEFAULT 'awaiting_payment' CHECK (fulfillment_status IN ('awaiting_payment', 'processing', 'shipped', 'delivered', 'cancelled')),
  payment_reference TEXT UNIQUE,
  stock_reserved BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_email TEXT NOT NULL DEFAULT '';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_id BIGINT REFERENCES customers(id) ON DELETE SET NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_reference TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS stock_reserved BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS fulfillment_status TEXT NOT NULL DEFAULT 'awaiting_payment';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_fulfillment_status_valid') THEN
    ALTER TABLE orders ADD CONSTRAINT orders_fulfillment_status_valid
      CHECK (fulfillment_status IN ('awaiting_payment', 'processing', 'shipped', 'delivered', 'cancelled'));
  END IF;
END $$;

UPDATE orders
SET fulfillment_status = 'processing'
WHERE payment_status = 'paid' AND fulfillment_status = 'awaiting_payment';

UPDATE orders
SET fulfillment_status = 'cancelled'
WHERE payment_status IN ('failed', 'cancelled') AND fulfillment_status = 'awaiting_payment';

CREATE TABLE IF NOT EXISTS order_items (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id BIGINT NOT NULL REFERENCES products(id),
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price_kes INTEGER NOT NULL CHECK (unit_price_kes >= 0),
  line_total_kes INTEGER NOT NULL CHECK (line_total_kes = quantity * unit_price_kes)
);

CREATE INDEX IF NOT EXISTS orders_created_at_idx ON orders (created_at DESC);
CREATE INDEX IF NOT EXISTS order_items_order_id_idx ON order_items (order_id);
CREATE UNIQUE INDEX IF NOT EXISTS orders_payment_reference_unique_idx ON orders (payment_reference) WHERE payment_reference IS NOT NULL;
