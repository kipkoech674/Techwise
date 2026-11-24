# TECHWISE Shop API

The API uses PostgreSQL for the product catalog and customer orders. Paystack is used for card checkout and Kenya M-PESA payments.

## Local setup

1. Install PostgreSQL and make sure its service is running.
2. Create a database named `laptop_shop`.
3. Copy `.env.example` to `.env`, then set `DATABASE_URL` to your local database connection. Keep `.env` private and do not commit or share it.
4. From this folder, create the tables and sample records:

   ```powershell
   psql -d laptop_shop -f db/schema.sql -f db/seed.sql
   ```

5. From the project root, install the client and server dependencies and start both services together:

   ```powershell
   npm --prefix server install
   npm --prefix client install
   npm run db:migrate
   npm run dev
   ```

   Open `http://localhost:5174`. The root command starts the API and storefront together, stops both if either one exits, and reports startup errors. Press Ctrl+C once to stop both. The API checks its PostgreSQL connection before it starts listening.

6. To enable payments, create a Paystack account and copy a **test secret key** from its dashboard into `PAYSTACK_SECRET_KEY` in your local `.env`. Never put the secret key in frontend code or share it in chat. Restart the API after editing `.env`.

The API listens on `http://localhost:4000`. The storefront proxies `/api` requests to it. Local development uses port 5174 so it does not silently switch to another app when the default Vite port is already occupied.

## Endpoints

- `GET /api/health` checks API and database connectivity.
- `POST /api/account/register`, `POST /api/account/login`, `POST /api/account/logout`, and `GET /api/account/me` manage customer accounts.
- `GET /api/account/orders` returns the signed-in customer's latest 50 orders.
- `GET /api/products` lists active products. Optional query parameters: `q`, `category`, `maxPrice`, `sort` (`featured`, `price-asc`, `price-desc`, or `rating`), `limit` (up to 48), and `offset`.
- `POST /api/orders` validates current product prices and stock, saves the order, then starts Paystack checkout when the secret key is configured.
- `GET /api/payments/verify?reference=...` checks the payment with Paystack before the app marks the order paid.
- `POST /api/payments/paystack-webhook` validates Paystack's signed webhook and confirms paid orders. Configure this URL in the Paystack dashboard after the API is deployed publicly; localhost cannot receive Paystack webhooks.

Card checkout redirects to Paystack-hosted checkout. M-PESA requests a phone authorization prompt. The app only marks an order paid after Paystack confirms the KES amount and transaction reference. Use test credentials and test payments until the full flow has been checked.

The seed catalog contains the eight laptop models and prices supplied for this shop. Its product pictures are temporary placeholders; replace them with your own product photos before launch. Re-running the seed does not overwrite stock counts for models that already exist.

Customers can shop without an account. Accounts use email and a password of at least 12 characters; passwords are stored as scrypt hashes and sign-in uses a private HTTP-only session cookie. Orders are linked to an account only when the customer is signed in at checkout. Run `npm run db:migrate` after updating the project to create or update the required tables.

Checkout reserves the requested stock while Paystack processes payment. Confirmed payments keep the stock deduction; failed payments release the reservation. Pending reservations older than `PAYMENT_RESERVATION_MINUTES` (default 30; allowed range 5–1440) are reconciled with Paystack every five minutes. Stock is released only after Paystack reports a terminal failure; if payment is still processing or cannot be checked, the reservation remains to prevent overselling. If a payment request times out, the order stays pending with its payment reference so its status can be checked before retrying checkout.

## Owner order manager

The private dashboard is available at `http://localhost:5173/admin`. It shows the latest 100 orders, customer delivery details, payment status, and item totals. It only allows paid orders to advance from processing to shipped and then delivered. Its Inventory section lets you update catalog prices and stock counts; changes apply to new checkouts, while existing orders keep their recorded prices.

Set `ADMIN_PASSWORD` in the server's private `.env` to a password with at least 12 characters. Set `ADMIN_SESSION_SECRET` to a random secret of at least 32 characters. You can generate one locally from this folder with:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Copy that generated value into `.env` as `ADMIN_SESSION_SECRET`; do not paste it into chat or commit `.env`. Restart the API after changing these values. Admin sessions use an HTTP-only cookie and expire after eight hours. In production, serve the dashboard and API over HTTPS.
