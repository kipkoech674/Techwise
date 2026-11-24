require('dotenv').config()

const crypto = require('node:crypto')

const cors = require('cors')
const express = require('express')
const helmet = require('helmet')
const pool = require('./db')

const app = express()
const port = Number(process.env.PORT) || 4000
const ADMIN_SESSION_COOKIE = 'laptop_shop_admin'
const ADMIN_SESSION_LIFETIME_MS = 8 * 60 * 60 * 1000
const CUSTOMER_SESSION_COOKIE = 'techwise_customer'
const CUSTOMER_SESSION_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000
const requestedReservationMinutes = Number(process.env.PAYMENT_RESERVATION_MINUTES)
const paymentReservationMinutes = Number.isInteger(requestedReservationMinutes) && requestedReservationMinutes >= 5 && requestedReservationMinutes <= 1440
  ? requestedReservationMinutes
  : 30
const adminLoginAttempts = new Map()
let staleOrderSweepRunning = false
const accountLoginAttempts = new Map()

const counties = new Set([
  'Baringo', 'Bomet', 'Bungoma', 'Busia', 'Elgeyo-Marakwet', 'Embu', 'Garissa', 'Homa Bay',
  'Isiolo', 'Kajiado', 'Kakamega', 'Kericho', 'Kiambu', 'Kilifi', 'Kirinyaga', 'Kisii',
  'Kisumu', 'Kitui', 'Kwale', 'Laikipia', 'Lamu', 'Machakos', 'Makueni', 'Mandera',
  'Marsabit', 'Meru', 'Migori', 'Mombasa', 'Murang’a', 'Nairobi', 'Nakuru', 'Nandi',
  'Narok', 'Nyamira', 'Nyandarua', 'Nyeri', 'Samburu', 'Siaya', 'Taita-Taveta',
  'Tana River', 'Tharaka-Nithi', 'Trans Nzoia', 'Turkana', 'Uasin Gishu', 'Vihiga',
  'Wajir', 'West Pokot',
])
const midFeeCounties = new Set([
  'Embu', 'Murang’a', 'Nyeri', 'Meru', 'Tharaka-Nithi', 'Kajiado', 'Kiambu', 'Machakos',
  'Kirinyaga', 'Makueni', 'Isiolo', 'Laikipia', 'Nyandarua', 'Samburu',
])
const feeForCounty = (county) => county === 'Nairobi' ? 100 : midFeeCounties.has(county) ? 300 : 600

app.disable('x-powered-by')
app.use(helmet())
app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173', credentials: true }))
app.use(express.json({
  limit: '32kb',
  verify: (request, _response, buffer) => { request.rawBody = buffer },
}))

async function paystackRequest(path, options = {}) {
  const response = await fetch(`https://api.paystack.co/${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
    signal: AbortSignal.timeout(15000),
  })
  const result = await response.json()
  // Paystack's response status flag is authoritative for charge flows (including pay_offline).
  if (!result.status) {
    const error = new Error(result.message || `Paystack request failed (HTTP ${response.status})`)
    error.definitive = true
    throw error
  }
  return result.data
}

function normalizeKenyanPhone(phone) {
  const digits = phone.replace(/\D/g, '')
  if (digits.startsWith('254')) return `+${digits}`
  if (digits.startsWith('0')) return `+254${digits.slice(1)}`
  if (digits.length === 9) return `+254${digits}`
  return ''
}

function createAdminSession(secret) {
  const payload = Buffer.from(JSON.stringify({ expiresAt: Date.now() + ADMIN_SESSION_LIFETIME_MS })).toString('base64url')
  const signature = crypto.createHmac('sha256', secret).update(payload).digest('base64url')
  return `${payload}.${signature}`
}

function isValidAdminSession(token, secret) {
  if (!token || !secret) return false
  const [payload, signature, extra] = token.split('.')
  if (!payload || !signature || extra !== undefined) return false
  const expected = crypto.createHmac('sha256', secret).update(payload).digest()
  const supplied = Buffer.from(signature, 'base64url')
  if (supplied.length !== expected.length || !crypto.timingSafeEqual(supplied, expected)) return false
  try {
    return JSON.parse(Buffer.from(payload, 'base64url').toString()).expiresAt > Date.now()
  } catch {
    return false
  }
}

function readCookie(request, name) {
  const prefix = `${name}=`
  const item = (request.headers.cookie || '').split(';').map((cookie) => cookie.trim()).find((cookie) => cookie.startsWith(prefix))
  if (!item) return ''
  try {
    return decodeURIComponent(item.slice(prefix.length))
  } catch {
    return ''
  }
}

function requireAdmin(request, response, next) {
  const secret = process.env.ADMIN_SESSION_SECRET
  if (!secret || secret.length < 32) {
    return response.status(503).json({ error: 'Admin sign-in is not configured on the server.' })
  }
  if (!isValidAdminSession(readCookie(request, ADMIN_SESSION_COOKIE), secret)) {
    return response.status(401).json({ error: 'Please sign in to manage orders.' })
  }
  return next()
}

function setAdminCookie(response, token, maxAgeSeconds) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : ''
  response.append('Set-Cookie', `${ADMIN_SESSION_COOKIE}=${encodeURIComponent(token)}; HttpOnly; SameSite=Strict; Path=/api/admin; Max-Age=${maxAgeSeconds}${secure}`)
}

function hashCustomerPassword(password, salt = crypto.randomBytes(16).toString('base64url')) {
  const derived = crypto.scryptSync(password, salt, 64).toString('base64url')
  return `${salt}.${derived}`
}

function verifyCustomerPassword(password, stored) {
  const [salt, encodedHash] = String(stored || '').split('.')
  if (!salt || !encodedHash) return false
  const expected = Buffer.from(encodedHash, 'base64url')
  const actual = Buffer.from(crypto.scryptSync(password, salt, 64).toString('base64url'), 'base64url')
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual)
}

function setCustomerCookie(response, token, maxAgeSeconds) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : ''
  response.append('Set-Cookie', `${CUSTOMER_SESSION_COOKIE}=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/api; Max-Age=${maxAgeSeconds}${secure}`)
}

async function loadCustomerFromRequest(request) {
  const rawToken = readCookie(request, CUSTOMER_SESSION_COOKIE)
  if (!rawToken) return null
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex')
  const result = await pool.query(
    `SELECT customer.id, customer.full_name AS "fullName", customer.email
     FROM customer_sessions AS session
     JOIN customers AS customer ON customer.id = session.customer_id
     WHERE session.token_hash = $1 AND session.expires_at > NOW()`,
    [tokenHash],
  )
  return result.rows[0] || null
}

async function requireCustomer(request, response, next) {
  try {
    request.customer = await loadCustomerFromRequest(request)
    if (!request.customer) return response.status(401).json({ error: 'Sign in to view your account.' })
    return next()
  } catch (error) {
    console.error('Customer session lookup failed:', error.message)
    return response.status(503).json({ error: 'Your account is temporarily unavailable.' })
  }
}

async function attachCustomer(request, response, next) {
  try {
    request.customer = await loadCustomerFromRequest(request)
    return next()
  } catch (error) {
    console.error('Customer session lookup failed during checkout:', error.message)
    return response.status(503).json({ error: 'Checkout is temporarily unavailable. Please try again.' })
  }
}

async function createCustomerSession(customerId, response) {
  const token = crypto.randomBytes(32).toString('base64url')
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex')
  const expiresAt = new Date(Date.now() + CUSTOMER_SESSION_LIFETIME_MS)
  await pool.query('INSERT INTO customer_sessions (token_hash, customer_id, expires_at) VALUES ($1, $2, $3)', [tokenHash, customerId, expiresAt])
  setCustomerCookie(response, token, CUSTOMER_SESSION_LIFETIME_MS / 1000)
}

app.get('/api/account/me', async (request, response) => {
  try {
    const customer = await loadCustomerFromRequest(request)
    response.set('Cache-Control', 'no-store')
    return response.json({ customer })
  } catch (error) {
    console.error('Customer session lookup failed:', error.message)
    return response.status(503).json({ error: 'Your account is temporarily unavailable.' })
  }
})

app.post('/api/account/register', async (request, response) => {
  const name = typeof request.body?.fullName === 'string' ? request.body.fullName.trim() : ''
  const email = typeof request.body?.email === 'string' ? request.body.email.trim().toLowerCase() : ''
  const password = typeof request.body?.password === 'string' ? request.body.password : ''
  if (name.length < 2 || name.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 || password.length < 12 || password.length > 128) {
    return response.status(400).json({ error: 'Enter your name, a valid email, and a password of at least 12 characters.' })
  }
  try {
    const result = await pool.query(
      'INSERT INTO customers (full_name, email, password_hash) VALUES ($1, $2, $3) RETURNING id, full_name AS "fullName", email',
      [name, email, hashCustomerPassword(password)],
    )
    await createCustomerSession(result.rows[0].id, response)
    response.set('Cache-Control', 'no-store')
    return response.status(201).json({ customer: result.rows[0] })
  } catch (error) {
    if (error.code === '23505') return response.status(409).json({ error: 'An account with that email already exists. Sign in instead.' })
    console.error('Customer registration failed:', error.message)
    return response.status(503).json({ error: 'We could not create your account right now.' })
  }
})

app.post('/api/account/login', async (request, response) => {
  const email = typeof request.body?.email === 'string' ? request.body.email.trim().toLowerCase() : ''
  const password = typeof request.body?.password === 'string' ? request.body.password : ''
  if (!email || email.length > 254 || password.length > 128) return response.status(400).json({ error: 'Enter your email and password.' })
  const now = Date.now()
  const attempt = accountLoginAttempts.get(request.socket.remoteAddress || 'unknown')
  if (attempt && attempt.resetAt <= now) accountLoginAttempts.delete(request.socket.remoteAddress || 'unknown')
  const current = accountLoginAttempts.get(request.socket.remoteAddress || 'unknown')
  if (current && current.count >= 10) return response.status(429).json({ error: 'Too many sign-in attempts. Wait 15 minutes and try again.' })
  const next = current || { count: 0, resetAt: now + 15 * 60 * 1000 }
  next.count += 1
  accountLoginAttempts.set(request.socket.remoteAddress || 'unknown', next)
  try {
    const result = await pool.query('SELECT id, full_name AS "fullName", email, password_hash FROM customers WHERE email = $1', [email])
    if (!result.rowCount || !verifyCustomerPassword(password, result.rows[0].password_hash)) {
      return response.status(401).json({ error: 'Email or password is incorrect.' })
    }
    accountLoginAttempts.delete(request.socket.remoteAddress || 'unknown')
    await createCustomerSession(result.rows[0].id, response)
    response.set('Cache-Control', 'no-store')
    return response.json({ customer: { id: result.rows[0].id, fullName: result.rows[0].fullName, email: result.rows[0].email } })
  } catch (error) {
    console.error('Customer sign-in failed:', error.message)
    return response.status(503).json({ error: 'We could not sign you in right now.' })
  }
})

app.post('/api/account/logout', async (request, response) => {
  const rawToken = readCookie(request, CUSTOMER_SESSION_COOKIE)
  if (rawToken) {
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex')
    await pool.query('DELETE FROM customer_sessions WHERE token_hash = $1', [tokenHash]).catch((error) => console.error('Customer sign-out failed:', error.message))
  }
  setCustomerCookie(response, '', 0)
  return response.json({ customer: null })
})

app.get('/api/account/orders', requireCustomer, async (request, response) => {
  response.set('Cache-Control', 'no-store')
  try {
    const result = await pool.query(
      `SELECT order_row.id, order_row.county, order_row.town, order_row.total_kes AS total,
              order_row.payment_status AS "paymentStatus", order_row.fulfillment_status AS "fulfillmentStatus",
              order_row.created_at AS "createdAt",
              COALESCE(json_agg(json_build_object('name', item.product_name, 'quantity', item.quantity)
                ORDER BY item.id) FILTER (WHERE item.id IS NOT NULL), '[]'::json) AS items
       FROM orders AS order_row LEFT JOIN order_items AS item ON item.order_id = order_row.id
       WHERE order_row.customer_id = $1 GROUP BY order_row.id ORDER BY order_row.created_at DESC LIMIT 50`,
      [request.customer.id],
    )
    return response.json({ orders: result.rows })
  } catch (error) {
    console.error('Customer order history failed:', error.message)
    return response.status(503).json({ error: 'Your order history could not be loaded right now.' })
  }
})

async function verifyPaystackReference(reference) {
  const result = await paystackRequest(`transaction/verify/${encodeURIComponent(reference)}`)
  const orderResult = await pool.query(
    'SELECT id, total_kes FROM orders WHERE payment_reference = $1',
    [reference],
  )
  if (!orderResult.rowCount) return { status: 'not_found' }
  const order = orderResult.rows[0]
  const isPaid = result.status === 'success' && result.currency === 'KES' &&
    Number(result.amount) === Number(order.total_kes) * 100 && result.reference === reference
  if (isPaid) {
    await updateOrderPaymentStatus(order.id, 'paid')
  } else if (['failed', 'abandoned', 'reversed'].includes(result.status)) {
    await updateOrderPaymentStatus(order.id, 'failed')
  }
  const current = await pool.query('SELECT payment_status FROM orders WHERE id = $1', [order.id])
  return { status: current.rows[0].payment_status }
}

async function updateOrderPaymentStatus(orderId, nextStatus) {
  const connection = await pool.connect()
  try {
    await connection.query('BEGIN')
    const orderResult = await connection.query(
      'SELECT payment_status, stock_reserved FROM orders WHERE id = $1 FOR UPDATE',
      [orderId],
    )
    if (!orderResult.rowCount || orderResult.rows[0].payment_status !== 'pending') {
      await connection.query('COMMIT')
      return
    }

    if (nextStatus === 'failed' && orderResult.rows[0].stock_reserved) {
      await connection.query(
        `UPDATE products AS product
         SET stock_quantity = product.stock_quantity + item.quantity
         FROM (
           SELECT product_id, SUM(quantity)::int AS quantity
           FROM order_items
           WHERE order_id = $1
           GROUP BY product_id
         ) AS item
         WHERE product.id = item.product_id`,
        [orderId],
      )
    }

    if (nextStatus === 'paid' && !orderResult.rows[0].stock_reserved) {
      const itemsResult = await connection.query(
        `SELECT product.id, product.stock_quantity, item.quantity
         FROM order_items AS item
         JOIN products AS product ON product.id = item.product_id
         WHERE item.order_id = $1
         FOR UPDATE OF product`,
        [orderId],
      )
      if (itemsResult.rows.some((item) => item.stock_quantity < item.quantity)) {
        throw new Error('Insufficient stock to confirm this paid order.')
      }
      for (const item of itemsResult.rows) {
        await connection.query(
          'UPDATE products SET stock_quantity = stock_quantity - $1 WHERE id = $2',
          [item.quantity, item.id],
        )
      }
    }

    await connection.query(
      `UPDATE orders
       SET payment_status = $1,
           fulfillment_status = CASE WHEN $1 = 'paid' THEN 'processing' ELSE 'cancelled' END,
           stock_reserved = FALSE
       WHERE id = $2`,
      [nextStatus, orderId],
    )
    await connection.query('COMMIT')
  } catch (error) {
    await connection.query('ROLLBACK').catch(() => {})
    throw error
  } finally {
    connection.release()
  }
}

async function reconcileStalePaymentReservations() {
  if (staleOrderSweepRunning || !process.env.PAYSTACK_SECRET_KEY) return
  staleOrderSweepRunning = true
  try {
    const result = await pool.query(
      `SELECT id, payment_reference
       FROM orders
       WHERE payment_status = 'pending'
         AND stock_reserved = TRUE
         AND created_at < NOW() - ($1 * INTERVAL '1 minute')
       ORDER BY created_at ASC
       LIMIT 25`,
      [paymentReservationMinutes],
    )
    for (const order of result.rows) {
      try {
        if (order.payment_reference) {
          await verifyPaystackReference(order.payment_reference)
        } else {
          await updateOrderPaymentStatus(order.id, 'failed')
        }
      } catch (error) {
        console.error(`Could not reconcile stale order ${order.id}:`, error.message)
      }
    }
  } catch (error) {
    console.error('Could not check stale payment reservations:', error.message)
  } finally {
    staleOrderSweepRunning = false
  }
}

app.post('/api/admin/login', (request, response) => {
  const adminPassword = process.env.ADMIN_PASSWORD
  const sessionSecret = process.env.ADMIN_SESSION_SECRET
  if (!adminPassword || adminPassword.length < 12 || !sessionSecret || sessionSecret.length < 32) {
    return response.status(503).json({ error: 'Admin sign-in is not configured on the server.' })
  }

  const now = Date.now()
  for (const [address, attempt] of adminLoginAttempts) {
    if (attempt.resetAt <= now) adminLoginAttempts.delete(address)
  }
  const address = request.socket.remoteAddress || 'unknown'
  const currentAttempt = adminLoginAttempts.get(address)
  if (currentAttempt && currentAttempt.resetAt > now && currentAttempt.count >= 5) {
    return response.status(429).json({ error: 'Too many sign-in attempts. Wait 15 minutes and try again.' })
  }
  const attempt = currentAttempt && currentAttempt.resetAt > now
    ? currentAttempt
    : { count: 0, resetAt: now + 15 * 60 * 1000 }
  attempt.count += 1
  adminLoginAttempts.set(address, attempt)

  const suppliedPassword = typeof request.body?.password === 'string' ? request.body.password : ''
  const expectedBuffer = Buffer.from(adminPassword)
  const suppliedBuffer = Buffer.from(suppliedPassword)
  const matches = suppliedBuffer.length === expectedBuffer.length && crypto.timingSafeEqual(suppliedBuffer, expectedBuffer)
  if (!matches) return response.status(401).json({ error: 'The password is incorrect.' })

  adminLoginAttempts.delete(address)
  setAdminCookie(response, createAdminSession(sessionSecret), ADMIN_SESSION_LIFETIME_MS / 1000)
  response.set('Cache-Control', 'no-store')
  return response.json({ authenticated: true })
})

app.post('/api/admin/logout', (_request, response) => {
  setAdminCookie(response, '', 0)
  return response.json({ authenticated: false })
})

app.get('/api/admin/orders', requireAdmin, async (_request, response) => {
  response.set('Cache-Control', 'no-store')
  try {
    const result = await pool.query(
      `SELECT order_row.id, order_row.customer_name AS "customerName",
              order_row.customer_email AS "customerEmail", order_row.phone,
              order_row.county, order_row.town,
              order_row.delivery_address AS "deliveryAddress",
              order_row.payment_method AS "paymentMethod",
              order_row.subtotal_kes AS subtotal,
              order_row.delivery_fee_kes AS "deliveryFee",
              order_row.total_kes AS total,
              order_row.payment_status AS "paymentStatus",
              order_row.fulfillment_status AS "fulfillmentStatus",
              order_row.payment_reference AS "paymentReference",
              order_row.created_at AS "createdAt",
              COALESCE(
                json_agg(json_build_object(
                  'name', item.product_name,
                  'quantity', item.quantity,
                  'unitPrice', item.unit_price_kes,
                  'lineTotal', item.line_total_kes
                ) ORDER BY item.id) FILTER (WHERE item.id IS NOT NULL),
                '[]'::json
              ) AS items
       FROM orders AS order_row
       LEFT JOIN order_items AS item ON item.order_id = order_row.id
       GROUP BY order_row.id
       ORDER BY order_row.created_at DESC
       LIMIT 100`,
    )
    return response.json({ orders: result.rows })
  } catch (error) {
    console.error('Admin order list failed:', error.message)
    return response.status(503).json({ error: 'Orders could not be loaded right now.' })
  }
})

app.get('/api/admin/products', requireAdmin, async (_request, response) => {
  response.set('Cache-Control', 'no-store')
  try {
    const result = await pool.query(
      `SELECT id, name, brand, category, description, processor,
              image_url AS "imageUrl", price_kes AS "priceKes",
              stock_quantity AS "stockQuantity", is_active AS "isActive"
       FROM products ORDER BY brand, name`,
    )
    return response.json({ products: result.rows })
  } catch (error) {
    console.error('Admin inventory load failed:', error.message)
    return response.status(503).json({ error: 'Inventory could not be loaded right now.' })
  }
})

app.post('/api/admin/products', requireAdmin, async (request, response) => {
  const body = request.body || {}
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const brand = typeof body.brand === 'string' ? body.brand.trim() : ''
  const category = typeof body.category === 'string' ? body.category.trim() : ''
  const description = typeof body.description === 'string' ? body.description.trim() : ''
  const processor = typeof body.processor === 'string' ? body.processor.trim() : ''
  const imageUrl = typeof body.imageUrl === 'string' ? body.imageUrl.trim() : ''
  const priceKes = body.priceKes
  const stockQuantity = body.stockQuantity
  if (!name || name.length > 160 || !brand || brand.length > 100 || !['Laptops', 'Phones', 'Accessories'].includes(category) ||
      description.length > 2000 || processor.length > 160 ||
      !Number.isSafeInteger(priceKes) || priceKes < 1 || priceKes > 100_000_000 ||
      !Number.isSafeInteger(stockQuantity) || stockQuantity < 0 || stockQuantity > 100_000 ||
      (imageUrl && (!/^https:\/\//i.test(imageUrl) || imageUrl.length > 1000))) {
    return response.status(400).json({ error: 'Enter a valid name, brand, category, price, stock count, and HTTPS image link.' })
  }
  const slug = name.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  if (!slug) return response.status(400).json({ error: 'Product name must include letters or numbers.' })
  try {
    const result = await pool.query(
      `INSERT INTO products (slug, name, brand, category, description, processor, price_kes, image_url, stock_quantity)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id, name, brand, category, description, processor, image_url AS "imageUrl",
                 price_kes AS "priceKes", stock_quantity AS "stockQuantity", is_active AS "isActive"`,
      [slug, name, brand, category, description, processor, priceKes, imageUrl, stockQuantity],
    )
    return response.status(201).json({ product: result.rows[0] })
  } catch (error) {
    if (error.code === '23505') return response.status(409).json({ error: 'A product with that name already exists. Add a distinguishing word or model number.' })
    console.error('Admin product creation failed:', error.message)
    return response.status(503).json({ error: 'Product could not be added right now.' })
  }
})

app.patch('/api/admin/products/:id', requireAdmin, async (request, response) => {
  const { id } = request.params
  const body = request.body || {}
  const brand = typeof body.brand === 'string' ? body.brand.trim() : ''
  const category = typeof body.category === 'string' ? body.category.trim() : ''
  const description = typeof body.description === 'string' ? body.description.trim() : ''
  const processor = typeof body.processor === 'string' ? body.processor.trim() : ''
  const imageUrl = typeof body.imageUrl === 'string' ? body.imageUrl.trim() : ''
  const { priceKes, stockQuantity, isActive } = body
  if (!/^\d+$/.test(id) || !brand || brand.length > 100 || !['Laptops', 'Phones', 'Accessories'].includes(category) ||
      description.length > 2000 || processor.length > 160 ||
      !Number.isSafeInteger(priceKes) || priceKes < 1 || priceKes > 100_000_000 ||
      !Number.isSafeInteger(stockQuantity) || stockQuantity < 0 || stockQuantity > 100_000 || typeof isActive !== 'boolean' ||
      (imageUrl && (!/^https:\/\//i.test(imageUrl) || imageUrl.length > 1000))) {
    return response.status(400).json({ error: 'Check the product details, HTTPS image link, price, and stock count.' })
  }
  try {
    const result = await pool.query(
      `UPDATE products SET brand = $1, category = $2, description = $3, processor = $4,
                           image_url = $5, price_kes = $6, stock_quantity = $7,
                           is_active = $8, updated_at = NOW()
       WHERE id = $9
       RETURNING id, name, brand, category, description, processor, image_url AS "imageUrl",
                 price_kes AS "priceKes", stock_quantity AS "stockQuantity", is_active AS "isActive"`,
      [brand, category, description, processor, imageUrl, priceKes, stockQuantity, isActive, id],
    )
    if (!result.rowCount) return response.status(404).json({ error: 'Product not found.' })
    return response.json({ product: result.rows[0] })
  } catch (error) {
    console.error('Admin inventory update failed:', error.message)
    return response.status(503).json({ error: 'Inventory could not be saved right now.' })
  }
})

app.patch('/api/admin/orders/:id/fulfillment', requireAdmin, async (request, response) => {
  const { id } = request.params
  const nextStatus = request.body?.fulfillmentStatus
  if (!/^\d+$/.test(id) || !['shipped', 'delivered'].includes(nextStatus)) {
    return response.status(400).json({ error: 'Choose a valid order and delivery status.' })
  }
  try {
    const update = await pool.query(
      `UPDATE orders
       SET fulfillment_status = $1
       WHERE id = $2 AND payment_status = 'paid'
         AND ((fulfillment_status = 'processing' AND $1 = 'shipped')
           OR (fulfillment_status = 'shipped' AND $1 = 'delivered'))
       RETURNING id, fulfillment_status AS "fulfillmentStatus"`,
      [nextStatus, id],
    )
    if (update.rowCount) return response.json({ order: update.rows[0] })

    const current = await pool.query(
      'SELECT payment_status AS "paymentStatus", fulfillment_status AS "fulfillmentStatus" FROM orders WHERE id = $1',
      [id],
    )
    if (!current.rowCount) return response.status(404).json({ error: 'Order not found.' })
    if (current.rows[0].paymentStatus !== 'paid') {
      return response.status(409).json({ error: 'Only paid orders can be marked for delivery.' })
    }
    return response.status(409).json({ error: 'Update delivery progress one step at a time.' })
  } catch (error) {
    console.error('Admin fulfillment update failed:', error.message)
    return response.status(503).json({ error: 'Delivery status could not be updated right now.' })
  }
})

app.get('/api/health', async (_request, response) => {
  try {
    await pool.query('SELECT 1')
    response.json({ status: 'ok', database: 'connected' })
  } catch (error) {
    console.error('Health check could not reach the database:', error.message)
    response.status(503).json({ status: 'degraded', database: 'unavailable' })
  }
})

app.get('/api/products', async (request, response) => {
  const query = typeof request.query.q === 'string' ? request.query.q.trim().slice(0, 100) : ''
  const category = typeof request.query.category === 'string' ? request.query.category.trim().slice(0, 80) : ''
  const maxPrice = Number(request.query.maxPrice)
  const hasMaxPrice = request.query.maxPrice !== undefined && Number.isFinite(maxPrice) && maxPrice >= 0
  const limitValue = Number(request.query.limit)
  const offsetValue = Number(request.query.offset)
  const limit = Number.isInteger(limitValue) ? Math.min(Math.max(limitValue, 1), 48) : 24
  const offset = Number.isInteger(offsetValue) ? Math.max(offsetValue, 0) : 0
  const sortOptions = {
    featured: 'featured DESC, created_at DESC',
    'price-asc': 'price_kes ASC',
    'price-desc': 'price_kes DESC',
    rating: 'rating DESC, review_count DESC',
  }
  const sort = typeof request.query.sort === 'string' ? request.query.sort : 'featured'
  const orderBy = sortOptions[sort] || sortOptions.featured
  const conditions = ['is_active = TRUE']
  const values = []

  if (query) {
    values.push(`%${query}%`)
    conditions.push(`(name ILIKE $${values.length} OR brand ILIKE $${values.length} OR processor ILIKE $${values.length} OR description ILIKE $${values.length} OR category ILIKE $${values.length})`)
  }
  if (category) {
    values.push(category)
    conditions.push(`category = $${values.length}`)
  }
  if (hasMaxPrice) {
    values.push(maxPrice)
    conditions.push(`price_kes <= $${values.length}`)
  }

  try {
    const countResult = await pool.query(
      `SELECT COUNT(*)::int AS total FROM products WHERE ${conditions.join(' AND ')}`,
      values,
    )
    const listValues = [...values, limit, offset]
    const productsResult = await pool.query(
      `SELECT id, slug, name, brand, category, description, processor,
              ram_gb AS "ramGb", storage_gb AS "storageGb", price_kes AS price,
              old_price_kes AS "oldPrice", image_url AS "imageUrl", rating,
              review_count AS "reviewCount", stock_quantity AS "stockQuantity",
              badge, featured
       FROM products
       WHERE ${conditions.join(' AND ')}
       ORDER BY ${orderBy}
       LIMIT $${listValues.length - 1} OFFSET $${listValues.length}`,
      listValues,
    )

    response.json({ products: productsResult.rows, total: countResult.rows[0].total, limit, offset })
  } catch (error) {
    console.error('Product listing failed:', error.message)
    response.status(503).json({ error: 'The product catalog is temporarily unavailable.' })
  }
})

app.get('/api/payments/verify', async (request, response) => {
  const reference = typeof request.query.reference === 'string' ? request.query.reference.trim() : ''
  if (!reference || reference.length > 100 || !process.env.PAYSTACK_SECRET_KEY) {
    return response.status(400).json({ error: 'A valid payment reference is required.' })
  }
  try {
    const result = await verifyPaystackReference(reference)
    if (result.status === 'not_found') return response.status(404).json({ error: 'Payment reference was not found.' })
    return response.json(result)
  } catch (error) {
    console.error('Paystack payment verification failed:', error.message)
    return response.status(503).json({ error: 'Payment status could not be checked yet.' })
  }
})

app.post('/api/payments/paystack-webhook', async (request, response) => {
  const secret = process.env.PAYSTACK_SECRET_KEY
  const signature = request.get('x-paystack-signature') || ''
  if (!secret || !request.rawBody || !signature) return response.sendStatus(401)

  const expected = crypto.createHmac('sha512', secret).update(request.rawBody).digest()
  let supplied
  try {
    supplied = Buffer.from(signature, 'hex')
  } catch {
    return response.sendStatus(401)
  }
  if (supplied.length !== expected.length || !crypto.timingSafeEqual(supplied, expected)) {
    return response.sendStatus(401)
  }

  const event = request.body
  if (['charge.success', 'charge.failed'].includes(event?.event) && event.data?.reference) {
    try {
      const reference = String(event.data.reference)
      const orderResult = await pool.query('SELECT id, total_kes FROM orders WHERE payment_reference = $1', [reference])
      if (orderResult.rowCount) {
        const order = orderResult.rows[0]
        if (event.event === 'charge.failed') {
          await updateOrderPaymentStatus(order.id, 'failed')
        } else if (event.data.currency === 'KES' && Number(event.data.amount) === Number(order.total_kes) * 100) {
          await updateOrderPaymentStatus(order.id, 'paid')
        }
      }
      return response.sendStatus(200)
    } catch (error) {
      console.error('Paystack webhook could not update order:', error.message)
      return response.sendStatus(500)
    }
  }
  return response.sendStatus(200)
})

app.post('/api/orders', attachCustomer, async (request, response) => {
  const body = request.body || {}
  const customerName = typeof body.customerName === 'string' ? body.customerName.trim() : ''
  const customerEmail = typeof body.customerEmail === 'string' ? body.customerEmail.trim().toLowerCase() : ''
  const phone = typeof body.phone === 'string' ? body.phone.trim() : ''
  const county = typeof body.county === 'string' ? body.county.trim() : ''
  const town = typeof body.town === 'string' ? body.town.trim() : ''
  const deliveryAddress = typeof body.deliveryAddress === 'string' ? body.deliveryAddress.trim() : ''
  const paymentMethod = body.paymentMethod
  const items = Array.isArray(body.items) ? body.items : []

  if (customerName.length < 2 || customerName.length > 120 || customerEmail.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail) || !/^\+?[0-9\s()-]{9,20}$/.test(phone) ||
      !counties.has(county) || town.length < 2 || town.length > 100 ||
      deliveryAddress.length < 5 || deliveryAddress.length > 300 ||
      !['mpesa', 'card'].includes(paymentMethod) || items.length < 1 || items.length > 30) {
    return response.status(400).json({ error: 'Enter valid contact, delivery, payment, and cart details.' })
  }
  if (paymentMethod === 'mpesa' && !/^\+254[17]\d{8}$/.test(normalizeKenyanPhone(phone))) {
    return response.status(400).json({ error: 'Enter a valid Kenyan mobile number for the M-Pesa prompt.' })
  }
  if (!process.env.PAYSTACK_SECRET_KEY) {
    return response.status(503).json({ error: 'Checkout is temporarily unavailable while payment setup is completed.' })
  }

  const quantities = new Map()
  for (const item of items) {
    const id = Number(item?.id)
    const quantity = Number(item?.quantity)
    if (!Number.isSafeInteger(id) || id < 1 || !Number.isSafeInteger(quantity) || quantity < 1 || quantity > 20) {
      return response.status(400).json({ error: 'Cart contains an invalid product or quantity.' })
    }
    quantities.set(id, (quantities.get(id) || 0) + quantity)
  }

  const connection = await pool.connect()
  try {
    await connection.query('BEGIN')
    const ids = [...quantities.keys()]
    const productsResult = await connection.query(
      'SELECT id, name, price_kes, stock_quantity FROM products WHERE is_active = TRUE AND id = ANY($1::bigint[]) FOR UPDATE',
      [ids],
    )
    if (productsResult.rowCount !== ids.length) {
      await connection.query('ROLLBACK')
      return response.status(409).json({ error: 'A product in your cart is no longer available.' })
    }
    for (const product of productsResult.rows) {
      if (quantities.get(Number(product.id)) > product.stock_quantity) {
        await connection.query('ROLLBACK')
        return response.status(409).json({ error: `${product.name} does not have enough stock for that quantity.` })
      }
    }
    const subtotal = productsResult.rows.reduce((sum, product) => sum + Number(product.price_kes) * quantities.get(Number(product.id)), 0)
    const deliveryFee = feeForCounty(county)
    const total = subtotal + deliveryFee
    const orderResult = await connection.query(
      `INSERT INTO orders (customer_id, customer_name, customer_email, phone, county, town, delivery_address, payment_method, subtotal_kes, delivery_fee_kes, total_kes, stock_reserved)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, TRUE) RETURNING id, total_kes AS total, payment_status AS "paymentStatus"`,
      [request.customer?.id || null, customerName, customerEmail, phone, county, town, deliveryAddress, paymentMethod, subtotal, deliveryFee, total],
    )
    const order = orderResult.rows[0]
    for (const product of productsResult.rows) {
      const quantity = quantities.get(Number(product.id))
      await connection.query(
        'UPDATE products SET stock_quantity = stock_quantity - $1 WHERE id = $2',
        [quantity, product.id],
      )
      await connection.query(
        `INSERT INTO order_items (order_id, product_id, product_name, quantity, unit_price_kes, line_total_kes)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [order.id, product.id, product.name, quantity, product.price_kes, Number(product.price_kes) * quantity],
      )
    }
    await connection.query('COMMIT')
    let payment = {}
    {
      const reference = `LAPTOP-${order.id}-${Date.now()}`
      try {
        await pool.query('UPDATE orders SET payment_reference = $1 WHERE id = $2', [reference, order.id])
        let paymentData
        if (paymentMethod === 'card') {
          paymentData = await paystackRequest('transaction/initialize', {
            method: 'POST',
            body: JSON.stringify({
              email: customerEmail,
              amount: total * 100,
              currency: 'KES',
              reference,
              callback_url: `${process.env.CLIENT_ORIGIN || 'http://localhost:5173'}/?payment=return`,
              channels: ['card'],
              metadata: { order_id: String(order.id) },
            }),
          })
          payment = { checkoutUrl: paymentData.authorization_url, reference: paymentData.reference }
        } else {
          paymentData = await paystackRequest('charge', {
            method: 'POST',
            body: JSON.stringify({
              email: customerEmail,
              amount: total * 100,
              currency: 'KES',
              reference,
              mobile_money: { phone: normalizeKenyanPhone(phone), provider: 'mpesa' },
              metadata: { order_id: String(order.id) },
            }),
          })
          payment = {
            displayText: paymentData.display_text || (paymentData.status === 'success'
              ? 'Paystack completed the test payment immediately.'
              : 'Approve the M-Pesa payment prompt on your phone.'),
            reference: paymentData.reference,
          }
        }
        if (paymentMethod === 'mpesa' && ['success', 'failed', 'timeout'].includes(paymentData.status)) {
          const verification = await verifyPaystackReference(payment.reference)
          payment.paymentStatus = verification.status
          if (verification.status === 'paid') payment.displayText = 'Test payment confirmed by Paystack.'
        }
      } catch (paymentError) {
        console.error('Paystack initialization failed:', paymentError.message)
        if (paymentError.definitive) {
          await updateOrderPaymentStatus(order.id, 'failed').catch((statusError) => {
            console.error('Could not release stock after payment setup failed:', statusError.message)
          })
          payment = {
            setupRequired: true,
            paymentStatus: 'failed',
            displayText: 'Payment could not be started. Your items are back in stock; please try checkout again.',
          }
        } else {
          payment = {
            reference,
            displayText: 'We could not confirm the payment request. Check its status before placing another order.',
          }
        }
      }
    }
    return response.status(201).json({
      order: {
        id: order.id,
        total: Number(order.total),
        paymentStatus: order.paymentStatus,
        deliveryFee,
        ...payment,
      },
    })
  } catch (error) {
    await connection.query('ROLLBACK').catch(() => {})
    console.error('Order creation failed:', error.message)
    return response.status(503).json({ error: 'We could not place your order. Please try again.' })
  } finally {
    connection.release()
  }
})

app.use((error, _request, response, _next) => {
  if (error.type === 'entity.too.large' || error.type === 'entity.parse.failed') {
    return response.status(error.type === 'entity.too.large' ? 413 : 400).json({ error: 'Invalid request body.' })
  }
  console.error('Unhandled request error:', error.message)
  return response.status(500).json({ error: 'An unexpected server error occurred.' })
})

let server

async function startServer() {
  try {
    await pool.query('SELECT 1')
    console.log('PostgreSQL connection ready.')
  } catch (error) {
    console.error(`Could not connect to PostgreSQL: ${error.message}`)
    console.error('Check that PostgreSQL is running and DATABASE_URL in server/.env is correct.')
    await pool.end().catch(() => {})
    process.exit(1)
  }

  server = app.listen(port, () => {
    console.log(`TECHWISE API listening on http://localhost:${port}`)
  })
  server.on('error', async (error) => {
    console.error(`TECHWISE API could not listen on port ${port}: ${error.message}`)
    await pool.end().catch(() => {})
    process.exit(1)
  })
}

startServer()

const reservationSweep = setInterval(reconcileStalePaymentReservations, 5 * 60 * 1000)
reservationSweep.unref()

async function shutdown(signal) {
  console.log(`${signal} received; closing the API server.`)
  if (!server) {
    await pool.end()
    process.exit(0)
  }
  server.close(async () => {
    await pool.end()
    process.exit(0)
  })
}

process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))
