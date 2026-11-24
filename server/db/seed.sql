-- Retire the temporary starter catalog from the initial storefront prototype.
UPDATE products
SET is_active = FALSE, featured = FALSE, updated_at = NOW()
WHERE slug IN (
  'macbook-pro-14-m3-pro',
  'thinkpad-x1-carbon-gen-11',
  'asus-rog-zephyrus-g14',
  'dell-xps-13-plus',
  'logitech-mx-master-3s',
  'keychron-k2-pro',
  'samsung-27-inch-4k-monitor',
  'anker-737-power-bank'
);

INSERT INTO products
  (slug, name, brand, category, description, processor, ram_gb, storage_gb,
   price_kes, image_url, stock_quantity, featured)
VALUES
  ('thinkpad-t480', 'ThinkPad T480', 'Lenovo', 'Laptops', 'Refurbished business laptop', 'Intel Core i5 8th Gen', 8, 256, 18000, 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?auto=format&fit=crop&w=700&q=85', 5, TRUE),
  ('elitebook-840-g5', 'EliteBook 840 G5', 'HP', 'Laptops', 'Refurbished business laptop', 'Intel Core i5 8th Gen', 8, 256, 22000, 'https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?auto=format&fit=crop&w=700&q=85', 4, TRUE),
  ('latitude-5420', 'Latitude 5420', 'Dell', 'Laptops', 'Refurbished business laptop', 'Intel Core i5 11th Gen', 16, 256, 38000, 'https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?auto=format&fit=crop&w=700&q=85', 4, TRUE),
  ('thinkpad-t14-gen-2', 'ThinkPad T14 Gen 2', 'Lenovo', 'Laptops', 'Refurbished business laptop', 'Intel Core i5 11th Gen', 16, 512, 48000, 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?auto=format&fit=crop&w=700&q=85', 3, TRUE),
  ('ideapad-slim-3', 'IdeaPad Slim 3', 'Lenovo', 'Laptops', 'Everyday laptop', 'Intel Core i3', 8, 256, 46000, 'https://images.unsplash.com/photo-1593642632823-8f785ba67e45?auto=format&fit=crop&w=700&q=85', 3, TRUE),
  ('vivobook-15', 'VivoBook 15', 'ASUS', 'Laptops', 'Everyday productivity laptop', 'Intel Core i5', 8, 512, 63000, 'https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?auto=format&fit=crop&w=700&q=85', 2, TRUE),
  ('macbook-air-m1', 'MacBook Air M1', 'Apple', 'Laptops', 'Refurbished Apple laptop', 'Apple M1', 8, 256, 75000, 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=700&q=85', 2, TRUE),
  ('hp-victus-15', 'HP Victus 15', 'HP', 'Laptops', 'Gaming laptop', 'Configuration varies', 16, 512, 105000, 'https://images.unsplash.com/photo-1593642632823-8f785ba67e45?auto=format&fit=crop&w=700&q=85', 2, TRUE)
ON CONFLICT (slug) DO NOTHING;
