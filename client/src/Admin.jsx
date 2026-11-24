import { useEffect, useState } from 'react'
import './Admin.css'

const money = (amount) => `KSh ${Number(amount).toLocaleString('en-KE')}`
const label = (status) => status.replaceAll('_', ' ')
const dateTime = (value) => new Intl.DateTimeFormat('en-KE', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Africa/Nairobi',
}).format(new Date(value))
const emptyProduct = { name: '', brand: '', category: 'Laptops', description: '', processor: '', priceKes: '', stockQuantity: '', imageUrl: '' }

async function readResponse(response) {
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.error || 'The request could not be completed.')
  return data
}

function Admin() {
  const [password, setPassword] = useState('')
  const [orders, setOrders] = useState([])
  const [products, setProducts] = useState([])
  const [drafts, setDrafts] = useState({})
  const [newProduct, setNewProduct] = useState(emptyProduct)
  const [addingProduct, setAddingProduct] = useState(false)
  const [activeView, setActiveView] = useState('orders')
  const [orderSearch, setOrderSearch] = useState('')
  const [paymentFilter, setPaymentFilter] = useState('all')
  const [fulfillmentFilter, setFulfillmentFilter] = useState('all')
  const [inventorySearch, setInventorySearch] = useState('')
  const [authenticated, setAuthenticated] = useState(false)
  const [loading, setLoading] = useState(true)
  const [busyOrderId, setBusyOrderId] = useState(null)
  const [busyProductId, setBusyProductId] = useState(null)
  const [error, setError] = useState('')

  async function loadOrders() {
    setLoading(true)
    setError('')
    try {
      const [response, inventoryResponse] = await Promise.all([
        fetch('/api/admin/orders', { credentials: 'include' }),
        fetch('/api/admin/products', { credentials: 'include' }),
      ])
      if (response.status === 401) {
        setAuthenticated(false)
        setOrders([])
        setProducts([])
        return
      }
      const [data, inventory] = await Promise.all([readResponse(response), readResponse(inventoryResponse)])
      setOrders(data.orders)
      setProducts(inventory.products)
      setAuthenticated(true)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let active = true
    Promise.all([
      fetch('/api/admin/orders', { credentials: 'include' }),
      fetch('/api/admin/products', { credentials: 'include' }),
    ])
      .then(async ([response, inventoryResponse]) => response.status === 401 ? null : Promise.all([readResponse(response), readResponse(inventoryResponse)]))
      .then((data) => {
        if (!active || !data) return
        setOrders(data[0].orders)
        setProducts(data[1].products)
        setAuthenticated(true)
      })
      .catch((requestError) => {
        if (active) setError(requestError.message)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [])

  async function signIn(event) {
    event.preventDefault()
    setLoading(true)
    setError('')
    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ password }),
      })
      await readResponse(response)
      setPassword('')
      await loadOrders()
    } catch (requestError) {
      setError(requestError.message)
      setLoading(false)
    }
  }

  async function signOut() {
    await fetch('/api/admin/logout', { method: 'POST', credentials: 'include' }).catch(() => {})
    setAuthenticated(false)
    setOrders([])
    setProducts([])
    setError('')
  }

  function updateDraft(product, field, value) {
    setDrafts((current) => ({
      ...current,
      [product.id]: { ...product, ...current[product.id], [field]: value },
    }))
  }

  async function saveInventory(product) {
    const draft = drafts[product.id] || product
    setBusyProductId(product.id)
    setError('')
    try {
      const response = await fetch(`/api/admin/products/${product.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          ...draft,
          priceKes: Number(draft.priceKes),
          stockQuantity: Number(draft.stockQuantity),
        }),
      })
      const data = await readResponse(response)
      setProducts((current) => current.map((item) => item.id === product.id ? { ...item, ...data.product } : item))
      setDrafts((current) => { const next = { ...current }; delete next[product.id]; return next })
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setBusyProductId(null)
    }
  }

  async function createProduct(event) {
    event.preventDefault()
    setAddingProduct(true)
    setError('')
    try {
      const response = await fetch('/api/admin/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ ...newProduct, priceKes: Number(newProduct.priceKes), stockQuantity: Number(newProduct.stockQuantity) }),
      })
      const data = await readResponse(response)
      setProducts((current) => [...current, data.product].sort((a, b) => a.name.localeCompare(b.name)))
      setNewProduct(emptyProduct)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setAddingProduct(false)
    }
  }

  async function advanceDelivery(order) {
    const nextStatus = order.fulfillmentStatus === 'processing' ? 'shipped' : 'delivered'
    setBusyOrderId(order.id)
    setError('')
    try {
      const response = await fetch(`/api/admin/orders/${order.id}/fulfillment`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ fulfillmentStatus: nextStatus }),
      })
      const data = await readResponse(response)
      setOrders((current) => current.map((item) => item.id === order.id
        ? { ...item, fulfillmentStatus: data.order.fulfillmentStatus }
        : item))
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setBusyOrderId(null)
    }
  }

  const visibleOrders = orders.filter((order) => {
    const query = orderSearch.trim().toLowerCase()
    const matchesSearch = !query || [order.id, order.customerName, order.customerEmail, order.phone, order.town, order.county]
      .some((value) => String(value || '').toLowerCase().includes(query))
    return matchesSearch && (paymentFilter === 'all' || order.paymentStatus === paymentFilter) &&
      (fulfillmentFilter === 'all' || order.fulfillmentStatus === fulfillmentFilter)
  })
  const visibleProducts = products.filter((product) => {
    const query = inventorySearch.trim().toLowerCase()
    return !query || `${product.name} ${product.brand} ${product.category}`.toLowerCase().includes(query)
  })

  return (
    <main className="admin-page">
      <header className="admin-header">
        <a className="admin-brand" href="/">TECHWISE<small>ORDER MANAGER</small></a>
        {authenticated && <div className="admin-header-actions"><button onClick={loadOrders} disabled={loading}>Refresh</button><button onClick={signOut}>Sign out</button></div>}
      </header>

      {loading && !authenticated ? <section className="admin-login"><p role="status">Checking admin session…</p></section> : null}

      {!authenticated && !loading && (
        <section className="admin-login">
          <span className="admin-eyebrow">PRIVATE SHOP AREA</span>
          <h1>Manage orders</h1>
          <p>Sign in with the admin password configured on your server.</p>
          <form onSubmit={signIn}>
            <label htmlFor="admin-password">Admin password</label>
            <input id="admin-password" type="password" autoComplete="current-password" minLength="12" required value={password} onChange={(event) => setPassword(event.target.value)} />
            <button type="submit" disabled={loading}>{loading ? 'Signing in…' : 'Sign in'}</button>
          </form>
          {error && <p className="admin-error" role="alert">{error}</p>}
          <a className="back-to-shop" href="/">Back to shop</a>
        </section>
      )}

      {authenticated && <nav className="admin-tabs" aria-label="Admin sections">
        <button className={activeView === 'orders' ? 'active' : ''} onClick={() => setActiveView('orders')}>Orders</button>
        <button className={activeView === 'inventory' ? 'active' : ''} onClick={() => setActiveView('inventory')}>Inventory</button>
      </nav>}

      {authenticated && activeView === 'orders' && (
        <section className="admin-orders">
          <div className="admin-page-heading">
            <div><span className="admin-eyebrow">PRIVATE SHOP AREA</span><h1>Customer orders</h1><p>Showing the latest 100 orders. Dispatch paid orders only.</p></div>
            <span className="order-count">{visibleOrders.length} of {orders.length} orders</span>
          </div>
          {error && <p className="admin-error" role="alert">{error}</p>}
          {!loading && orders.length > 0 && <div className="admin-list-tools">
            <label>Search orders<input type="search" placeholder="Order, customer, phone, town…" value={orderSearch} onChange={(event) => setOrderSearch(event.target.value)} /></label>
            <label>Payment<select value={paymentFilter} onChange={(event) => setPaymentFilter(event.target.value)}><option value="all">All payments</option><option value="pending">Pending</option><option value="paid">Paid</option><option value="failed">Failed</option><option value="cancelled">Cancelled</option></select></label>
            <label>Delivery<select value={fulfillmentFilter} onChange={(event) => setFulfillmentFilter(event.target.value)}><option value="all">All delivery statuses</option><option value="awaiting_payment">Awaiting payment</option><option value="processing">Processing</option><option value="shipped">Shipped</option><option value="delivered">Delivered</option><option value="cancelled">Cancelled</option></select></label>
          </div>}
          {loading ? <p className="admin-empty" role="status">Loading orders…</p> : orders.length === 0 ? <p className="admin-empty">No orders yet.</p> : (
            visibleOrders.length ? <div className="admin-order-list">
              {visibleOrders.map((order) => (
                <article className="admin-order-card" key={order.id}>
                  <div className="admin-order-top">
                    <div><span className="admin-eyebrow">ORDER #{order.id}</span><p>{dateTime(order.createdAt)}</p></div>
                    <div className="admin-statuses"><span className={`admin-status payment-${order.paymentStatus}`}>{label(order.paymentStatus)}</span><span className={`admin-status fulfillment-${order.fulfillmentStatus}`}>{label(order.fulfillmentStatus)}</span></div>
                  </div>
                  <div className="admin-order-grid">
                    <section><h2>Customer</h2><strong>{order.customerName}</strong><a href={`tel:${order.phone}`}>{order.phone}</a><a href={`mailto:${order.customerEmail}`}>{order.customerEmail}</a></section>
                    <section><h2>Delivery</h2><strong>{order.town}, {order.county}</strong><p>{order.deliveryAddress}</p></section>
                    <section><h2>Payment</h2><strong>{order.paymentMethod === 'mpesa' ? 'M-Pesa' : 'Card'} · {label(order.paymentStatus)}</strong>{order.paymentReference && <small>Ref: {order.paymentReference}</small>}</section>
                  </div>
                  <div className="admin-items">
                    {order.items.map((item, index) => <div key={`${order.id}-${index}`}><span>{item.quantity} × {item.name}</span><strong>{money(item.lineTotal)}</strong></div>)}
                  </div>
                  <div className="admin-order-total"><span>Subtotal {money(order.subtotal)} + delivery {money(order.deliveryFee)}</span><strong>{money(order.total)}</strong></div>
                  <div className="admin-order-footer">
                    {order.paymentStatus !== 'paid'
                      ? <p>Payment is not confirmed. Do not dispatch.</p>
                      : order.fulfillmentStatus === 'delivered'
                        ? <p>Delivery complete.</p>
                        : <button onClick={() => advanceDelivery(order)} disabled={busyOrderId === order.id}>{busyOrderId === order.id ? 'Saving…' : order.fulfillmentStatus === 'processing' ? 'Mark as shipped' : 'Mark as delivered'}</button>}
                  </div>
                </article>
              ))}
            </div> : <p className="admin-empty">No orders match those filters.</p>
          )}
        </section>
      )}

      {authenticated && activeView === 'inventory' && (
        <section className="admin-orders">
          <div className="admin-page-heading">
            <div><span className="admin-eyebrow">PRIVATE SHOP AREA</span><h1>Product inventory</h1><p>Update selling prices and available stock. Changes apply to new checkouts.</p></div>
            <span className="order-count">{products.length} products</span>
          </div>
          {error && <p className="admin-error" role="alert">{error}</p>}
          {loading ? <p className="admin-empty" role="status">Loading inventory…</p> : (
            <>
            <div className="admin-list-tools inventory-tools"><label>Find a product<input type="search" placeholder="Name, brand, or category…" value={inventorySearch} onChange={(event) => setInventorySearch(event.target.value)} /></label><span>{visibleProducts.length} shown</span></div>
            <form className="new-product-form" onSubmit={createProduct}>
              <h2>Add a product</h2>
              <div className="new-product-fields">
                <label>Product name<input required maxLength="160" value={newProduct.name} onChange={(event) => setNewProduct({ ...newProduct, name: event.target.value })} /></label>
                <label>Brand<input required maxLength="100" value={newProduct.brand} onChange={(event) => setNewProduct({ ...newProduct, brand: event.target.value })} /></label>
                <label>Category<select value={newProduct.category} onChange={(event) => setNewProduct({ ...newProduct, category: event.target.value })}><option>Laptops</option><option>Phones</option><option>Accessories</option></select></label>
                <label>Price (KSh)<input required type="number" min="1" max="100000000" step="1" value={newProduct.priceKes} onChange={(event) => setNewProduct({ ...newProduct, priceKes: event.target.value })} /></label>
                <label>Stock<input required type="number" min="0" max="100000" step="1" value={newProduct.stockQuantity} onChange={(event) => setNewProduct({ ...newProduct, stockQuantity: event.target.value })} /></label>
                <label>Image link (optional)<input type="url" placeholder="https://…" value={newProduct.imageUrl} onChange={(event) => setNewProduct({ ...newProduct, imageUrl: event.target.value })} /></label>
                <label className="new-product-wide">Description<input maxLength="2000" value={newProduct.description} onChange={(event) => setNewProduct({ ...newProduct, description: event.target.value })} /></label>
                {newProduct.category === 'Laptops' && <label>Processor<input maxLength="160" value={newProduct.processor} onChange={(event) => setNewProduct({ ...newProduct, processor: event.target.value })} /></label>}
              </div>
              <button type="submit" disabled={addingProduct}>{addingProduct ? 'Adding…' : 'Add product'}</button>
            </form>
            <div className="inventory-list">
              {visibleProducts.map((product) => {
                const draft = drafts[product.id] || product
                const editableFields = ['brand', 'category', 'description', 'processor', 'imageUrl', 'priceKes', 'stockQuantity', 'isActive']
                const changed = editableFields.some((field) => String(draft[field] ?? '') !== String(product[field] ?? ''))
                return <article className="inventory-card" key={product.id}>
                  <div><span className="admin-eyebrow">{product.brand} · {product.category}</span><h2>{product.name}</h2><span className={product.isActive ? 'inventory-active' : 'inventory-inactive'}>{product.isActive ? 'On sale' : 'Hidden from shop'}</span></div>
                  <label>Price (KSh)<input type="number" min="1" max="100000000" step="1" value={draft.priceKes} onChange={(event) => updateDraft(product, 'priceKes', event.target.value)} /></label>
                  <label>Stock<input type="number" min="0" max="100000" step="1" value={draft.stockQuantity} onChange={(event) => updateDraft(product, 'stockQuantity', event.target.value)} /></label>
                  <details className="inventory-details">
                    <summary>Edit listing details</summary>
                    <div className="inventory-detail-fields">
                      <label>Brand<input required maxLength="100" value={draft.brand} onChange={(event) => updateDraft(product, 'brand', event.target.value)} /></label>
                      <label>Category<select value={draft.category} onChange={(event) => updateDraft(product, 'category', event.target.value)}><option>Laptops</option><option>Phones</option><option>Accessories</option></select></label>
                      <label className="inventory-detail-wide">Description<input maxLength="2000" value={draft.description} onChange={(event) => updateDraft(product, 'description', event.target.value)} /></label>
                      <label>Processor or model detail<input maxLength="160" value={draft.processor} onChange={(event) => updateDraft(product, 'processor', event.target.value)} /></label>
                      <label className="inventory-detail-wide">HTTPS image link<input type="url" placeholder="https://…" value={draft.imageUrl} onChange={(event) => updateDraft(product, 'imageUrl', event.target.value)} /></label>
                      <label className="inventory-visibility"><input type="checkbox" checked={draft.isActive} onChange={(event) => updateDraft(product, 'isActive', event.target.checked)} /> Show this product in the shop</label>
                    </div>
                  </details>
                  <button onClick={() => saveInventory(product)} disabled={!changed || busyProductId === product.id}>{busyProductId === product.id ? 'Saving…' : 'Save'}</button>
                </article>
              })}
              {!visibleProducts.length && <p className="admin-empty">No products match that search.</p>}
            </div>
            </>
          )}
        </section>
      )}
    </main>
  )
}

export default Admin
