import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import './App.css'

const shopContact = {
  phone: '+254716719022',
  whatsappUrl: 'https://wa.me/254716719022',
  email: 'kipkoechryan022@gmail.com',
  address: 'Bihi Towers, Moi Avenue, Nairobi',
  mapUrl: 'https://www.google.com/maps/search/?api=1&query=Bihi+Towers%2C+Moi+Avenue%2C+Nairobi%2C+Kenya',
}

const categoryIcons = { Laptops: '\u{1F4BB}', Phones: '\u{1F4F1}', Accessories: '\u{1F3A7}' }
const currentYear = new Date().getFullYear()


// Temporary county zones until Google Routes is configured. County-wide rates are estimates.
const deliveryFees = {
  'Nairobi': 100,
  'Embu': 300, 'Murang’a': 300, 'Nyeri': 300, 'Meru': 300, 'Tharaka-Nithi': 300,
  'Kajiado': 300, 'Kiambu': 300, 'Machakos': 300, 'Kirinyaga': 300, 'Makueni': 300, 'Isiolo': 300,
  'Laikipia': 300, 'Nyandarua': 300, 'Samburu': 300,
}
const counties = [
  'Baringo', 'Bomet', 'Bungoma', 'Busia', 'Elgeyo-Marakwet', 'Embu', 'Garissa', 'Homa Bay',
  'Isiolo', 'Kajiado', 'Kakamega', 'Kericho', 'Kiambu', 'Kilifi', 'Kirinyaga', 'Kisii',
  'Kisumu', 'Kitui', 'Kwale', 'Laikipia', 'Lamu', 'Machakos', 'Makueni', 'Mandera',
  'Marsabit', 'Meru', 'Migori', 'Mombasa', 'Murang’a', 'Nairobi', 'Nakuru', 'Nandi',
  'Narok', 'Nyamira', 'Nyandarua', 'Nyeri', 'Samburu', 'Siaya', 'Taita-Taveta',
  'Tana River', 'Tharaka-Nithi', 'Trans Nzoia', 'Turkana', 'Uasin Gishu', 'Vihiga',
  'Wajir', 'West Pokot',
]
const deliveryFeeFor = (county) => deliveryFees[county] ?? 600

const formatPrice = (price) => `KSh ${price.toLocaleString('en-KE')}`
const imageUrl = (source, width = 700) => source?.startsWith('http') ? source : `https://images.unsplash.com/${source || 'photo-1496181133206-80ce9b88a853'}?auto=format&fit=crop&w=${width}&q=85`

const infoPages = {
  '/about': {
    eyebrow: 'A LITTLE ABOUT US',
    title: 'Good tech for the things you want to do.',
    intro: 'TECHWISE is a Nairobi-based tech shop built to make choosing your next device feel simple and personal.',
    sections: [
      ['Shop with a clear head', 'Browse the products currently in stock, compare the details, and reach out if you want help choosing. We are growing the range to include laptops, phones, and useful accessories.'],
      ['Here when you need us', 'Questions about a product or an order? Talk to the shop directly by WhatsApp or email.'],
    ],
  },
  '/delivery': {
    eyebrow: 'DELIVERY & PAYMENTS',
    title: 'From Nairobi to your doorstep.',
    intro: 'We deliver across Kenya. The delivery estimate depends on your county and is shown in your cart and again at checkout.',
    sections: [
      ['County-based delivery estimates', 'Current estimates are KSh 100 for Nairobi, KSh 300 for nearby counties in the configured central and eastern zone, and KSh 600 for other counties. These are estimates; confirm the amount shown for your address before paying.'],
      ['Ways to pay', 'Checkout supports M-Pesa and card through Paystack. Your order is not ready for dispatch until its payment is confirmed.'],
      ['Laptop warranty', 'Laptops include a one-year warranty. Ask us about the warranty terms for a specific item before ordering.'],
    ],
  },
  '/contact': {
    eyebrow: 'WE ARE EASY TO REACH',
    title: 'Need a hand? Talk to us.',
    intro: 'Ask about a product, delivery estimate, or an order. We are based in Nairobi and deliver across Kenya.',
    sections: [],
  },
  '/faq': {
    eyebrow: 'THE QUICK ANSWERS',
    title: 'A few things you might be wondering.',
    intro: 'If you need an answer about a particular product or order, send us a message and we will help.',
    sections: [
      ['Can you deliver outside Nairobi?', 'Yes. Delivery is available across all 47 counties. The estimated fee depends on the county and appears in your cart and checkout.'],
      ['Which payment methods can I use?', 'You can choose M-Pesa or card at checkout through Paystack.'],
      ['Do I need an account to shop?', 'No. You can check out without an account. Creating an account lets you see your order history.'],
      ['What is the laptop warranty?', 'Laptops include a one-year warranty. Contact us to confirm the terms for the item you are considering.'],
    ],
  },
}

function StoreInfoPage({ page }) {
  const content = infoPages[page]
  if (!content) return <main className="info-page"><span className="eyebrow">PAGE NOT FOUND</span><h1>That page wandered off.</h1><p>Head back to the shop to find what you need.</p><Link className="primary-button" to="/">Back to the shop</Link></main>

  return (
    <main className="info-page">
      <span className="eyebrow">{content.eyebrow}</span>
      <h1>{content.title}</h1>
      <p className="info-intro">{content.intro}</p>
      {content.sections.length > 0 && <div className="info-sections">{content.sections.map(([title, body]) => <section key={title}><h2>{title}</h2><p>{body}</p></section>)}</div>}
      {page === '/contact' && <div className="contact-options"><a href={shopContact.whatsappUrl} target="_blank" rel="noreferrer"><span>WHATSAPP</span><strong>Chat with the shop ↗</strong><small>{shopContact.phone}</small></a><a href={`mailto:${shopContact.email}`}><span>EMAIL</span><strong>Send us an email ↗</strong><small>{shopContact.email}</small></a><a href={`tel:${shopContact.phone}`}><span>CALL</span><strong>Give us a call ↗</strong><small>{shopContact.phone}</small></a><a href={shopContact.mapUrl} target="_blank" rel="noreferrer"><span>VISIT</span><strong>Get directions ↗</strong><small>{shopContact.address}</small></a></div>}
      <Link className="info-shop-link" to="/#shop">Browse the shop <span>↗</span></Link>
    </main>
  )
}

function App() {
  const location = useLocation()
  const navigate = useNavigate()
  const currentPath = location.pathname
  const [products, setProducts] = useState([])
  const [catalogLoading, setCatalogLoading] = useState(true)
  const [catalogError, setCatalogError] = useState(false)
  const categories = useMemo(() => {
    const counts = new Map()
    products.forEach((product) => counts.set(product.category, (counts.get(product.category) || 0) + 1))
    return [...counts].map(([name, count]) => ({ name, count, icon: categoryIcons[name] || '💻' }))
  }, [products])
  const [cart, setCart] = useState({})
  const [savedProductIds, setSavedProductIds] = useState(() => {
    try {
      const saved = JSON.parse((localStorage.getItem('techwise-saved-products') || localStorage.getItem('techparts-saved-products')) || '[]')
      return Array.isArray(saved) ? saved.map(String) : []
    } catch {
      return []
    }
  })
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState('All products')
  const [maxPrice, setMaxPrice] = useState(350000)
  const [sort, setSort] = useState('Featured')
  const [cartOpen, setCartOpen] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)
  const [customer, setCustomer] = useState(null)
  const [accountMode, setAccountMode] = useState('login')
  const [accountFields, setAccountFields] = useState({ fullName: '', email: '', password: '' })
  const [accountOrders, setAccountOrders] = useState([])
  const [accountBusy, setAccountBusy] = useState(false)
  const [accountError, setAccountError] = useState('')
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [orderReceipt, setOrderReceipt] = useState(null)
  const [orderSubmitting, setOrderSubmitting] = useState(false)
  const [checkoutDetails, setCheckoutDetails] = useState({ customerName: '', customerEmail: '', phone: '', town: '', deliveryAddress: '', paymentMethod: 'mpesa' })
  const [deliveryCounty, setDeliveryCounty] = useState('Nairobi')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    if (!mobileMenuOpen) return undefined
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setMobileMenuOpen(false)
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [mobileMenuOpen])

  useEffect(() => {
    try {
      localStorage.setItem('techwise-saved-products', JSON.stringify(savedProductIds))
    } catch {
      // Wishlist still works for the current visit when browser storage is unavailable.
    }
  }, [savedProductIds])

  useEffect(() => {
    let active = true
    fetch('/api/products?limit=48')
      .then((response) => {
        if (!response.ok) throw new Error('Catalog API is unavailable')
        return response.json()
      })
      .then((data) => {
        if (!active) return
        setProducts(data.products.map((product) => ({
          ...product,
          detail: [
            product.processor,
            product.ramGb && `${product.ramGb}GB RAM`,
            product.storageGb && `${product.storageGb}GB SSD`,
          ].filter(Boolean).join(' · ') || product.description,
          reviews: product.reviewCount,
          image: product.imageUrl,
        })))
      })
      .catch(() => {
        if (!active) return
        setCatalogError(true)
      })
      .finally(() => {
        if (active) setCatalogLoading(false)
      })
    return () => { active = false }
  }, [])

  useEffect(() => {
    fetch('/api/account/me', { credentials: 'include' })
      .then((response) => response.ok ? response.json() : null)
      .then((data) => {
        if (data?.customer) {
          setCustomer(data.customer)
          setCheckoutDetails((current) => ({ ...current, customerName: data.customer.fullName, customerEmail: data.customer.email }))
        }
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!accountOpen || !customer) return
    fetch('/api/account/orders', { credentials: 'include' })
      .then(async (response) => {
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || 'Order history is unavailable.')
        setAccountOrders(data.orders)
      })
      .catch((error) => setAccountError(error.message))
  }, [accountOpen, customer])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const reference = params.get('reference')
    if (params.get('payment') !== 'return' || !reference) return
    fetch(`/api/payments/verify?reference=${encodeURIComponent(reference)}`)
      .then((response) => response.json().then((data) => ({ ok: response.ok, data })))
      .then(({ ok, data }) => setNotice(ok && data.status === 'paid' ? 'Payment confirmed. Thank you for your order!' : 'Payment is not confirmed yet. Check your order status before delivery.'))
      .catch(() => setNotice('We could not check payment yet. Please contact the shop with your payment reference.'))
      .finally(() => window.history.replaceState({}, '', window.location.pathname))
  }, [])

  const visibleProducts = useMemo(() => {
    const query = search.trim().toLowerCase()
    let result = products.filter((product) =>
      (activeCategory === 'All products' || product.category === activeCategory) &&
      product.price <= maxPrice &&
      (!query || `${product.name} ${product.category} ${product.detail}`.toLowerCase().includes(query)),
    )
    if (sort === 'Price: low to high') result = [...result].sort((a, b) => a.price - b.price)
    if (sort === 'Price: high to low') result = [...result].sort((a, b) => b.price - a.price)
    if (sort === 'Top rated') result = [...result].sort((a, b) => b.rating - a.rating)
    return result
  }, [activeCategory, maxPrice, products, search, sort])

  const cartItems = products.filter((product) => cart[product.id])
  const cartCount = Object.values(cart).reduce((sum, quantity) => sum + quantity, 0)
  const subtotal = cartItems.reduce((sum, product) => sum + product.price * cart[product.id], 0)
  const deliveryFee = deliveryFeeFor(deliveryCounty)

  function addToCart(product) {
    if (product.stockQuantity !== undefined && (cart[product.id] || 0) >= product.stockQuantity) {
      setNotice(`Only ${product.stockQuantity} of ${product.name} are in stock`)
      window.setTimeout(() => setNotice(''), 2400)
      return
    }
    setCart((current) => ({ ...current, [product.id]: (current[product.id] || 0) + 1 }))
    setNotice(`Nice pick! ${product.name} is in your bag`)
    window.setTimeout(() => setNotice(''), 2400)
  }

  function changeQuantity(id, amount) {
    const product = products.find((item) => item.id === id)
    if (amount > 0 && product?.stockQuantity !== undefined && (cart[id] || 0) >= product.stockQuantity) {
      setNotice(`Only ${product.stockQuantity} of ${product.name} are in stock`)
      window.setTimeout(() => setNotice(''), 2400)
      return
    }
    setCart((current) => {
      const nextQuantity = (current[id] || 0) + amount
      if (nextQuantity <= 0) {
        const next = { ...current }
        delete next[id]
        return next
      }
      return { ...current, [id]: nextQuantity }
    })
  }

  function toggleSavedProduct(productId) {
    const normalizedId = String(productId)
    setSavedProductIds((current) => current.includes(normalizedId)
      ? current.filter((id) => id !== normalizedId)
      : [...current, normalizedId])
  }

  async function placeOrder(event) {
    event.preventDefault()
    setOrderSubmitting(true)
    try {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...checkoutDetails, county: deliveryCounty, items: cartItems.map((product) => ({ id: product.id, quantity: cart[product.id] })) }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Could not place your order.')
      if (data.order.checkoutUrl) {
        window.location.assign(data.order.checkoutUrl)
        return
      }
      setOrderReceipt(data.order)
      setCart({})
    } catch (error) {
      setNotice(error.message)
      window.setTimeout(() => setNotice(''), 4000)
    } finally {
      setOrderSubmitting(false)
    }
  }

  async function checkOrderPayment() {
    if (!orderReceipt?.reference) return
    try {
      const response = await fetch(`/api/payments/verify?reference=${encodeURIComponent(orderReceipt.reference)}`)
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Could not check payment.')
      setOrderReceipt({ ...orderReceipt, paymentStatus: data.status })
      setNotice(data.status === 'paid' ? 'Payment confirmed. Thank you!' : `Payment status: ${data.status}`)
    } catch (error) {
      setNotice(error.message)
    }
    window.setTimeout(() => setNotice(''), 4000)
  }

  async function submitAccount(event) {
    event.preventDefault()
    setAccountBusy(true)
    setAccountError('')
    try {
      const response = await fetch(`/api/account/${accountMode === 'register' ? 'register' : 'login'}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(accountFields),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Account request could not be completed.')
      setCustomer(data.customer)
      setCheckoutDetails((current) => ({ ...current, customerName: data.customer.fullName, customerEmail: data.customer.email }))
      setAccountFields({ fullName: '', email: '', password: '' })
    } catch (error) {
      setAccountError(error.message)
    } finally {
      setAccountBusy(false)
    }
  }

  async function signOutCustomer() {
    await fetch('/api/account/logout', { method: 'POST', credentials: 'include' }).catch(() => {})
    setCustomer(null)
    setAccountOrders([])
    setAccountMode('login')
  }

  return (
    <div className="storefront" id="top">
      <div className="announcement">Delivery across all 47 counties <span>·</span> Fees based on destination <span>·</span> 1-year warranty on laptops</div>
      {mobileMenuOpen && <div className="menu-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setMobileMenuOpen(false) }}><aside className="store-menu" id="store-menu" role="dialog" aria-modal="true" aria-labelledby="store-menu-title"><div className="store-menu-head"><div><span className="menu-kicker">TECHWISE · NAIROBI</span><h2 id="store-menu-title">Find your way</h2></div><button className="close-button" onClick={() => setMobileMenuOpen(false)} aria-label="Close menu">×</button></div><nav aria-label="Store menu"><Link to="/#shop" onClick={() => setMobileMenuOpen(false)}><span>Shop all</span><small>Explore available products</small></Link><Link to="/#categories" onClick={() => setMobileMenuOpen(false)}><span>Categories</span><small>Find the kind of tech you need</small></Link><Link to="/about" onClick={() => setMobileMenuOpen(false)}><span>About TECHWISE</span><small>A little about our shop</small></Link><Link to="/delivery" onClick={() => setMobileMenuOpen(false)}><span>Delivery & payments</span><small>Fees, delivery areas, and payment</small></Link><Link to="/faq" onClick={() => setMobileMenuOpen(false)}><span>Frequently asked questions</span><small>Quick answers before you order</small></Link><Link to="/contact" onClick={() => setMobileMenuOpen(false)}><span>Contact</span><small>Talk to the shop</small></Link></nav><div className="store-menu-actions"><button onClick={() => { setMobileMenuOpen(false); setAccountOpen(true); setAccountError('') }}>Your account</button><button onClick={() => { setMobileMenuOpen(false); setCartOpen(true) }}>Open cart <span>{cartCount}</span></button></div></aside></div>}
      <header className="site-header">
        <button className="menu-button" aria-label={mobileMenuOpen ? 'Close store menu' : 'Open store menu'} aria-haspopup="dialog" aria-controls="store-menu" aria-expanded={mobileMenuOpen} onClick={() => setMobileMenuOpen((open) => !open)}><span></span><span></span><span></span><small>{mobileMenuOpen ? 'Close' : 'Menu'}</small></button>
        <Link className="brand" to="/" aria-label="TECHWISE home"><span className="brand-mark">T</span><span>TECHWISE</span></Link>
        <nav className="main-nav" aria-label="Main navigation">
          <a className={currentPath === '/' ? 'nav-active' : ''} href="/#shop">Shop</a><a href="/#categories">Categories</a><Link to="/about">About</Link><Link to="/delivery">Delivery</Link><Link to="/contact">Contact</Link>
        </nav>
        <label className="search-box"><span aria-hidden="true">⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search phones, laptops, accessories..." aria-label="Search products" /><kbd>↵</kbd></label>
        <div className="header-actions">
          <button className="account-button" onClick={() => { setAccountOpen(true); setAccountError('') }}>{customer ? 'My account' : 'Account'}</button>
          <button className="cart-button" onClick={() => setCartOpen(true)} aria-label={`Open cart, ${cartCount} items`}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 4h2l2.2 10.2a2 2 0 0 0 2 1.6h8.3a2 2 0 0 0 1.9-1.4L21 8H6"/><circle cx="10" cy="20" r="1"/><circle cx="18" cy="20" r="1"/></svg><span>Cart</span><b>{cartCount}</b></button>

        </div>
      </header>

      {currentPath === '/' ? <main>
        <section className="hero" aria-label="Featured laptop">
          <img className="hero-image" src={imageUrl('photo-1496181133206-80ce9b88a853', 1800)} alt="Premium laptop on a clean desk" />
          <div className="hero-shade" />
          <div className="hero-copy"><span className="eyebrow"><i /> GOOD GEAR. BIG PLANS.</span><h1>Your next big thing<br />starts here.</h1><p>For class, the side hustle, late-night ideas, and everything you are building next.</p><a className="primary-button" href="#shop">Meet your next laptop <span>↗</span></a><div className="hero-paging"><b /> <i /> <i /> <small>NAIROBI TO ALL 47 COUNTIES</small></div></div>
          <div className="hero-note"><span>GO ON, GET CURIOUS</span><strong>Your next sidekick is waiting.</strong></div>
        </section>

        <section className="benefits" aria-label="Store benefits">
          <div><span className="benefit-icon">↗</span><p><strong>We come to you</strong><small>Delivery across all 47 counties</small></p></div>
          <div><span className="benefit-icon">↺</span><p><strong>One less thing to worry about</strong><small>1-year warranty on every laptop</small></p></div>
          <div><span className="benefit-icon">♧</span><p><strong>Here when you need us</strong><small>Need advice? Just ask.</small></p></div>
          <div><span className="benefit-icon">◇</span><p><strong>Checkout, minus the stress</strong><small>Secure payment with Paystack</small></p></div>
        </section>

        <section className="category-section" id="categories">
          <div className="section-heading"><div><span className="eyebrow green-eyebrow">PICK YOUR PLAYGROUND</span><h2>What are we shopping for?</h2></div><a className="text-link" href="#shop">See the whole crew <span>↗</span></a></div>
          <div className="category-grid">{categories.map((category, index) => <button className={`category-card category-${index + 1} ${activeCategory === category.name ? 'selected' : ''}`} key={category.name} onClick={() => { setActiveCategory(activeCategory === category.name ? 'All products' : category.name); document.getElementById('shop')?.scrollIntoView({ behavior: 'smooth' }) }}><span className="category-icon">{category.icon}</span><span className="category-label"><strong>{category.name}</strong><small>{category.count} to choose from <i>↗</i></small></span></button>)}</div>
        </section>

        <section className="shop-section" id="shop">
          <div className="section-heading shop-heading"><div><span className="eyebrow green-eyebrow">THE LINE-UP</span><h2>{activeCategory === 'All products' ? 'Meet your next sidekick.' : activeCategory}</h2><p>Good tech for big plans, small budgets, and everything in between.</p></div><a className="text-link" href="#deals">Need a hand? <span>↗</span></a></div>
          <div className="shop-layout">
            <aside className="filters" aria-label="Product filters"><div className="filter-title"><strong>Find your fit</strong><button onClick={() => { setActiveCategory('All products'); setMaxPrice(350000) }}>Start over</button></div><div className="filter-group"><h3>Categories <span>−</span></h3><button className={activeCategory === 'All products' ? 'filter-choice active' : 'filter-choice'} onClick={() => setActiveCategory('All products')}>All products <small>{products.length}</small></button>{categories.map((category) => <button className={activeCategory === category.name ? 'filter-choice active' : 'filter-choice'} key={category.name} onClick={() => setActiveCategory(category.name)}>{category.name}<small>{category.count}</small></button>)}</div><div className="filter-group"><h3>Price range <span>−</span></h3><div className="price-range"><span>KSh 0</span><span>{formatPrice(maxPrice)}</span></div><input type="range" min="10000" max="350000" step="5000" value={maxPrice} onChange={(event) => setMaxPrice(Number(event.target.value))} aria-label="Maximum price" /></div><div className="help-card"><span>NEED A HAND?</span><strong>Let’s find your<br />new favorite.</strong><a href={shopContact.whatsappUrl} target="_blank" rel="noreferrer">Chat on WhatsApp ↗</a><a href={`mailto:${shopContact.email}`}>Email the shop ↗</a></div></aside>
            <div className="product-area"><div className="product-toolbar"><span><strong>{visibleProducts.length} products</strong> <span className="muted">ready for a new setup</span>{catalogLoading && <span className="sample-note"> · finding the good stuff</span>}{catalogError && <span className="sample-note"> · catalog taking a breather</span>}</span><label>Sort by <select value={sort} onChange={(event) => setSort(event.target.value)}><option>Featured</option><option>Price: low to high</option><option>Price: high to low</option><option>Top rated</option></select></label></div>
              {visibleProducts.length ? (
                <div className="product-grid">
                  {visibleProducts.map((product) => (
                    <article className="product-card" key={product.id}>
                      <div className="product-image-wrap">
                        <img src={imageUrl(product.image)} alt={product.name} loading="lazy" />
                        {product.badge && <span className="product-badge">{product.badge}</span>}
                        <button className={savedProductIds.includes(String(product.id)) ? 'wish-button saved' : 'wish-button'} aria-label={`${savedProductIds.includes(String(product.id)) ? 'Remove' : 'Save'} ${product.name} ${savedProductIds.includes(String(product.id)) ? 'from' : 'to'} wishlist`} aria-pressed={savedProductIds.includes(String(product.id))} onClick={() => toggleSavedProduct(product.id)}>{savedProductIds.includes(String(product.id)) ? '♥' : '♡'}</button>
                        <button className="quick-add" onClick={() => addToCart(product)} disabled={product.stockQuantity === 0}>{product.stockQuantity === 0 ? 'Out of stock' : 'Add to bag'} <span>＋</span></button>
                      </div>
                      <div className="product-info">
                        {Number(product.rating) > 0 && product.reviews > 0
                          ? <div className="rating"><span>★★★★★</span> <small>{product.rating} ({product.reviews})</small></div>
                          : <div className="product-brand">{product.brand || product.category}</div>}
                        <h3>{product.name}</h3>
                        <p>{product.description || product.detail}</p>
                        {product.description && product.detail && <div className="spec-line">{product.detail}</div>}
                        <div className="product-price"><strong>{formatPrice(product.price)}</strong>{product.oldPrice && <del>{formatPrice(product.oldPrice)}</del>}</div>
                        <div className={product.stockQuantity <= 2 ? 'stock-line low-stock' : 'stock-line'}><i /> {product.stockQuantity} in stock · delivery across Kenya</div>
                      </div>
                    </article>
                  ))}
                </div>
              ) : catalogLoading ? <div className="empty-results" role="status"><strong>Loading the product catalog…</strong></div> : catalogError ? <div className="empty-results" role="alert"><strong>We could not load the catalog</strong><p>Check your connection and give it another go.</p><button onClick={() => window.location.reload()}>Try again</button></div> : <div className="empty-results"><strong>No products hiding here</strong><p>Try a different search, or give those filters a reset.</p><button onClick={() => { setSearch(''); setActiveCategory('All products'); setMaxPrice(350000) }}>Clear filters</button></div>}
            </div>
          </div>
        </section>

        <section className="newsletter" id="deals"><div><span className="eyebrow">NEED HELP?</span><h2>Questions? Ask away.</h2><p>Message us about a laptop, your budget, or anything else.</p></div><div className="newsletter-contact"><a className="newsletter-button" href={shopContact.whatsappUrl} target="_blank" rel="noreferrer">Chat on WhatsApp ↗</a><a href={`mailto:${shopContact.email}`}>Email the shop ↗</a></div></section>
      </main> : <StoreInfoPage page={currentPath} />}

      <footer className="site-footer"><div className="footer-brand"><Link className="brand" to="/"><span className="brand-mark">T</span><span>TECHWISE</span></Link><p>For the big ideas and the everyday bits.</p><small>© {currentYear} TECHWISE Kenya</small></div><nav className="footer-pages" aria-label="Information pages"><strong>Explore</strong><Link to="/about">About us</Link><Link to="/delivery">Delivery & payments</Link><Link to="/faq">FAQs</Link><Link to="/contact">Contact</Link></nav><div className="footer-contacts"><strong>Talk to us</strong><a href={`tel:${shopContact.phone}`}>{shopContact.phone}</a><a href={shopContact.whatsappUrl} target="_blank" rel="noreferrer">WhatsApp</a><a href={`mailto:${shopContact.email}`}>{shopContact.email}</a><a href={shopContact.mapUrl} target="_blank" rel="noreferrer">{shopContact.address} ↗</a></div></footer>


      {notice && <div className="toast" role="status">✓ <span>{notice}</span></div>}
      {accountOpen && <div className="account-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setAccountOpen(false) }}><section className="account-panel" role="dialog" aria-modal="true" aria-labelledby="account-title"><div className="account-panel-heading"><div><span className="eyebrow green-eyebrow">YOUR TECHWISE ACCOUNT</span><h2 id="account-title">{customer ? `Hi, ${customer.fullName.split(' ')[0]}` : accountMode === 'register' ? 'Create your account' : 'Welcome back'}</h2></div><button className="close-button" onClick={() => setAccountOpen(false)} aria-label="Close account">×</button></div>
        {customer ? <><p className="account-email">{customer.email}</p><div className="account-orders-heading"><h3>Your orders</h3><button onClick={signOutCustomer}>Sign out</button></div>{accountError && <p className="account-error" role="alert">{accountError}</p>}{accountOrders.length ? <div className="account-order-list">{accountOrders.map((order) => <article key={order.id}><div><strong>Order #{order.id}</strong><small>{new Intl.DateTimeFormat('en-KE', { dateStyle: 'medium', timeZone: 'Africa/Nairobi' }).format(new Date(order.createdAt))} · {order.town}, {order.county}</small></div><span className={`admin-status payment-${order.paymentStatus}`}>{order.paymentStatus}</span><strong>{formatPrice(order.total)}</strong><small>{order.items.map((item) => `${item.quantity} × ${item.name}`).join(', ')}</small></article>)}</div> : <p className="account-empty">No orders are linked to this account yet. Orders you place while signed in will appear here.</p>}</> : <><p className="account-intro">Create an account to keep your order history together. You can still shop without one.</p><form className="account-form" onSubmit={submitAccount}>{accountMode === 'register' && <label>Full name<input required minLength="2" maxLength="120" autoComplete="name" value={accountFields.fullName} onChange={(event) => setAccountFields({ ...accountFields, fullName: event.target.value })} /></label>}<label>Email address<input required type="email" maxLength="254" autoComplete="email" value={accountFields.email} onChange={(event) => setAccountFields({ ...accountFields, email: event.target.value })} /></label><label>Password<input required type="password" minLength={accountMode === 'register' ? 12 : 1} maxLength="128" autoComplete={accountMode === 'register' ? 'new-password' : 'current-password'} value={accountFields.password} onChange={(event) => setAccountFields({ ...accountFields, password: event.target.value })} />{accountMode === 'register' && <small>Use at least 12 characters.</small>}</label>{accountError && <p className="account-error" role="alert">{accountError}</p>}<button className="checkout-button" disabled={accountBusy}>{accountBusy ? 'Please wait…' : accountMode === 'register' ? 'Create account' : 'Sign in'}</button></form><p className="account-switch">{accountMode === 'register' ? 'Already have an account?' : 'New to TECHWISE?'} <button onClick={() => { setAccountMode(accountMode === 'register' ? 'login' : 'register'); setAccountError('') }}>{accountMode === 'register' ? 'Sign in' : 'Create an account'}</button></p></>}
      </section></div>}
      {cartOpen && <div className="drawer-backdrop" onClick={() => setCartOpen(false)}><aside className="cart-drawer" onClick={(event) => event.stopPropagation()} aria-label="Shopping cart"><div className="drawer-heading"><div><span className="eyebrow green-eyebrow">{checkoutOpen ? 'DELIVERY DETAILS' : 'THE GOOD STUFF'}</span><h2>{orderReceipt ? 'Order received' : checkoutOpen ? 'Checkout' : <>Your cart <small>({cartCount})</small></>}</h2></div><button className="close-button" onClick={() => setCartOpen(false)} aria-label="Close cart">×</button></div>{orderReceipt ? <div className="checkout-confirmation"><strong>Order #{orderReceipt.id} is recorded.</strong><p>{orderReceipt.displayText || (orderReceipt.setupRequired ? 'Payment setup is not finished yet. Your order is saved as pending; do not dispatch until payment is confirmed.' : `Payment status: ${orderReceipt.paymentStatus || 'pending'}.`)}</p><p>Order total: <b>{formatPrice(orderReceipt.total)}</b></p>{orderReceipt.reference && orderReceipt.paymentStatus !== 'paid' && <button className="checkout-button" onClick={checkOrderPayment}>Check payment status</button>}<button className="continue-shopping" onClick={() => { setCartOpen(false); setCheckoutOpen(false); setOrderReceipt(null) }}>Continue shopping</button></div> : checkoutOpen ? <form className="checkout-form" onSubmit={placeOrder}><label>Full name<input required minLength="2" maxLength="120" value={checkoutDetails.customerName} onChange={(event) => setCheckoutDetails({ ...checkoutDetails, customerName: event.target.value })} /></label><label>Email address<input required type="email" maxLength="254" autoComplete="email" value={checkoutDetails.customerEmail} onChange={(event) => setCheckoutDetails({ ...checkoutDetails, customerEmail: event.target.value })} /></label><label>Phone number<input required type="tel" minLength="9" maxLength="20" placeholder="07xx xxx xxx" value={checkoutDetails.phone} onChange={(event) => setCheckoutDetails({ ...checkoutDetails, phone: event.target.value })} /></label><label>County<select value={deliveryCounty} onChange={(event) => setDeliveryCounty(event.target.value)}>{counties.map((county) => <option key={county}>{county}</option>)}</select></label><label>Town or area<input required minLength="2" maxLength="100" value={checkoutDetails.town} onChange={(event) => setCheckoutDetails({ ...checkoutDetails, town: event.target.value })} /></label><label>Delivery address or landmark<textarea required minLength="5" maxLength="300" value={checkoutDetails.deliveryAddress} onChange={(event) => setCheckoutDetails({ ...checkoutDetails, deliveryAddress: event.target.value })} /></label><fieldset><legend>Payment method</legend><label><input type="radio" name="payment" value="mpesa" checked={checkoutDetails.paymentMethod === 'mpesa'} onChange={(event) => setCheckoutDetails({ ...checkoutDetails, paymentMethod: event.target.value })} /> M-Pesa</label><label><input type="radio" name="payment" value="card" checked={checkoutDetails.paymentMethod === 'card'} onChange={(event) => setCheckoutDetails({ ...checkoutDetails, paymentMethod: event.target.value })} /> Card</label></fieldset><p className="delivery-estimate">County delivery estimate: {formatPrice(deliveryFee)}. Route based fees will be enabled when Google Maps is configured.</p><div className="order-total"><span>Total</span><strong>{formatPrice(subtotal + deliveryFee)}</strong></div><button className="checkout-button" disabled={orderSubmitting}>{orderSubmitting ? 'Starting payment…' : 'Confirm & pay securely'} <span>→</span></button><button type="button" className="continue-shopping" onClick={() => setCheckoutOpen(false)}>Back to cart</button></form> : cartItems.length ? <><div className="drawer-items">{cartItems.map((product) => <div className="drawer-item" key={product.id}><img src={imageUrl(product.image, 240)} alt=""/><div className="drawer-item-info"><strong>{product.name}</strong><small>{formatPrice(product.price)}</small><div className="quantity-control"><button onClick={() => changeQuantity(product.id, -1)} aria-label="Decrease quantity">−</button><span>{cart[product.id]}</span><button onClick={() => changeQuantity(product.id, 1)} aria-label="Increase quantity">+</button></div></div><button className="remove-item" onClick={() => changeQuantity(product.id, -cart[product.id])} aria-label={`Remove ${product.name}`}>×</button></div>)}</div><div className="drawer-total"><label className="delivery-select">Delivery county<select value={deliveryCounty} onChange={(event) => setDeliveryCounty(event.target.value)}>{counties.map((county) => <option key={county}>{county}</option>)}</select></label><p className="delivery-estimate">Your county delivery estimate. Route based fees will be enabled when Google Maps is configured.</p><div><span>Subtotal</span><strong>{formatPrice(subtotal)}</strong></div><div><span>Estimated delivery</span><strong>{formatPrice(deliveryFee)}</strong></div><div className="order-total"><span>Estimated total</span><strong>{formatPrice(subtotal + deliveryFee)}</strong></div><button className="checkout-button" onClick={() => { setCheckoutOpen(true); setOrderReceipt(null) }}>Continue to checkout <span>→</span></button><button className="continue-shopping" onClick={() => setCartOpen(false)}>Continue shopping</button></div></> : <div className="empty-cart"><span>⌑</span><strong>Your cart is enjoying the empty space.</strong><p>Spot a laptop you like? Bring it over.</p><button className="primary-button" onClick={() => setCartOpen(false)}>Explore products ↗</button></div>}</aside></div>}
    </div>
  )
}

export default App
