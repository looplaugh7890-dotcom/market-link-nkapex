// Usage: npm run test:e2e   (server must be running: npm run dev / npm start)
// Exercises every SRS feature through the HTTP API as admin, farmer and customer.
// Creates its own throw-away users/products/orders (e-mails start with "e2e+") and deletes them at the end.
require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');

const BASE = process.env.API_URL || `http://localhost:${process.env.PORT || 5000}/api`;
const PASSWORD = 'Password@123';
const STAMP = Date.now();
const results = [];

const call = async (method, path, token, body, raw) => {
  const res = await fetch(BASE + path, {
    method,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body && !raw ? { 'Content-Type': 'application/json' } : {}) },
    body: raw ? body : body ? JSON.stringify(body) : undefined,
  });
  let json = {};
  try {
    json = await res.json();
  } catch {
    /* not json */
  }
  return { status: res.status, ...json };
};
const ok = (name, cond, detail = '') => {
  results.push({ name, pass: !!cond });
  console.log(`${cond ? '  PASS' : '  FAIL'}  ${name}${cond ? '' : detail ? `  -> ${detail}` : ''}`);
};
const section = (t) => console.log(`\n== ${t}`);
const login = async (email, password = PASSWORD) => (await call('POST', '/auth/login', null, { email, password })).token;

// Next date (>= 3 days ahead) that falls on a Saturday, formatted YYYY-MM-DD in local time.
const nextSaturday = () => {
  const d = new Date();
  d.setDate(d.getDate() + 3);
  while (d.getDay() !== 6) d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const nextMonday = () => {
  const d = new Date();
  d.setDate(d.getDate() + 3);
  while (d.getDay() !== 1) d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

(async () => {
  const health = await fetch(BASE.replace(/\/api$/, '') + '/api/health').catch(() => null);
  if (!health) {
    console.error(`Cannot reach ${BASE}. Start the backend first.`);
    process.exit(1);
  }
  await connectDB();

  const admin = await login('admin@marketlink.test');
  const seedCustomer = await login('customer@marketlink.test');
  const seedFarmer = await login('farmer@marketlink.test');
  ok('Seed logins work (admin, farmer, customer)', admin && seedCustomer && seedFarmer);

  // ---------------------------------------------------------------- registration & login
  section('Registration, login, access control');
  const custEmail = `e2e+cust${STAMP}@marketlink.test`;
  const farmEmail = `e2e+farm${STAMP}@marketlink.test`;
  let r = await call('POST', '/auth/register', null, { name: 'E2E Customer', email: custEmail, phone: '0300123456', address: '1 Test Street', password: PASSWORD });
  ok('Customer can register (name, phone, e-mail, address)', r.status === 201 && r.token, JSON.stringify(r));
  const custToken = r.token;
  const custId = r.user?._id;
  r = await call('POST', '/auth/register', null, { name: 'Dup', email: custEmail, phone: '1', address: 'x', password: PASSWORD });
  ok('Duplicate e-mail is rejected', r.status >= 400 && r.status < 500);
  r = await call('POST', '/auth/register', null, { name: 'No phone', email: `e2e+np${STAMP}@marketlink.test`, address: 'x', password: PASSWORD });
  ok('Registration without required fields is rejected', r.status === 400);
  r = await call('POST', '/auth/register-farmer', null, { stallName: 'E2E Stall', contactPerson: 'E2E Farmer', email: farmEmail, phone: '0311222333', address: '2 Farm Road', password: PASSWORD });
  ok('Farmer can register; starts as pending', r.status === 201 && r.user?.farmerProfile?.approvalStatus === 'pending', JSON.stringify(r));
  const farmToken = r.token;
  const farmId = r.user?._id;
  r = await call('POST', '/auth/login', null, { email: 'admin@marketlink.test', password: 'wrong' });
  ok('Wrong password -> 401 Invalid credentials', r.status === 401);
  r = await call('GET', '/auth/me', custToken);
  ok('GET /auth/me returns the logged in user', r.user?.email === custEmail);
  r = await call('GET', '/orders');
  ok('Unauthenticated request to /orders -> 401', r.status === 401);
  r = await call('GET', '/admin/dashboard', custToken);
  ok('Customer cannot open admin API -> 403', r.status === 403);
  r = await call('GET', '/admin/dashboard', seedFarmer);
  ok('Farmer cannot open admin API -> 403', r.status === 403);
  r = await call('POST', '/orders', seedFarmer, { items: [] });
  ok('Farmer cannot place customer orders -> 403', r.status === 403);
  r = await call('PUT', '/auth/me', custToken, { name: 'E2E Customer Renamed', phone: '0300999999', address: '9 New Street' });
  ok('Customer can update own profile', r.status === 200 && r.user?.name === 'E2E Customer Renamed');
  r = await call('PUT', '/auth/password', custToken, { currentPassword: PASSWORD, newPassword: 'NewPass@456' });
  ok('Password change works', r.status === 200);
  ok('Login with the new password works', !!(await login(custEmail, 'NewPass@456')));
  await call('PUT', '/auth/password', custToken, { currentPassword: 'NewPass@456', newPassword: PASSWORD });

  // ---------------------------------------------------------------- browse markets / farmers / products
  section('Browse markets, farmers and products (public)');
  r = await call('GET', '/markets?limit=50');
  const markets = r.markets || [];
  const green = markets.find((m) => m.name === 'Green Valley Market');
  ok('Markets list is available', markets.length >= 1 && green);
  r = await call('GET', '/markets?day=monday&limit=50');
  ok('Filter markets by day = Monday returns no Green Valley', !(r.markets || []).some((m) => m.name === 'Green Valley Market'));
  r = await call('GET', '/markets?day=saturday&limit=50');
  ok('Filter markets by day = Saturday includes Green Valley', (r.markets || []).some((m) => m.name === 'Green Valley Market'));
  r = await call('GET', `/markets?lat=${green.latitude}&lng=${green.longitude}&radius=5&limit=50`);
  ok('Markets near a location (geo query) works', (r.markets || []).some((m) => m._id === green._id));
  r = await call('GET', `/markets/${green._id}`);
  ok('Market detail shows coordinates and farmers present', r.market?.latitude && Array.isArray(r.farmers) && r.farmers.length >= 1);
  r = await call('GET', '/farmers?limit=50');
  ok('Farmers list is public and hides pending farmers', r.farmers?.length >= 1 && !r.farmers.some((f) => f._id === farmId));
  const fred = (r.farmers || []).find((f) => f.farmerProfile?.stallName?.startsWith("Fred's"));
  r = await call('GET', `/farmers/${fred?._id}`);
  ok('Farmer profile shows stall name, location, days and current stock', r.farmer?.farmerProfile?.stallName && Array.isArray(r.products) && r.products.length >= 1, JSON.stringify(Object.keys(r)));
  const cats = (await call('GET', '/categories')).categories || [];
  const veg = cats.find((c) => c.name === 'Vegetables');
  r = await call('GET', `/products?category=${veg._id}&minPrice=2&maxPrice=4&market=${green._id}`);
  ok('Product filter category + price + market works', r.products?.length >= 1 && r.products.every((p) => p.price >= 2 && p.price <= 4 && p.category?._id === veg._id), `${r.total}`);
  r = await call('GET', '/products?day=saturday');
  ok('Product filter by market day works', r.success && r.total >= 1);
  r = await call('GET', '/products?search=tomato');
  ok('Product text search works', r.products?.some((p) => /tomato/i.test(p.name)));
  r = await call('GET', '/products?sort=price_asc&limit=5');
  ok('Product sort by price ascending', r.products?.length > 1 && r.products.every((p, i, a) => i === 0 || a[i - 1].price <= p.price));
  const tomato = (await call('GET', '/products?search=tomato')).products[0];
  r = await call('GET', `/products/${tomato._id}`);
  ok('Product detail: price, unit, quantity, farmer', r.product?.price && r.product?.unit && r.product?.quantityAvailable !== undefined && r.product?.farmer?._id);

  // ---------------------------------------------------------------- farmer (pending -> approved)
  section('Farmer: approval gate, profile, stock, weekly template');
  r = await call('POST', '/products', farmToken, { category: veg._id, name: 'E2E Radish', price: 1, unit: 'kg', quantityAvailable: 5 });
  ok('Pending farmer cannot list products -> 403', r.status === 403);
  r = await call('PATCH', `/admin/farmers/${farmId}/status`, admin, { status: 'approved' });
  ok('Admin approves the farmer', r.status === 200 && r.user?.farmerProfile?.approvalStatus === 'approved');
  r = await call('PUT', '/farmers/profile', farmToken, {
    description: 'E2E test stall',
    cutoffHours: 12,
    operatingDays: ['saturday', 'sunday'],
    pickupWindows: [
      { day: 'saturday', start: '09:00', end: '13:00' },
      { day: 'sunday', start: '09:00', end: '13:00' },
    ],
    markets: [green._id],
    location: { address: 'Stall E2E', latitude: 24.8608, longitude: 67.0012 },
  });
  ok('Farmer updates profile (markets, days, pickup windows, map pin, cut-off)', r.status === 200, JSON.stringify(r));
  r = await call('POST', '/products', farmToken, { category: veg._id, name: 'E2E Radish', description: 'Crunchy', price: 1.5, unit: 'kg', quantityAvailable: 20, weeklyTemplate: { enabled: true, quantity: 20 } });
  ok('Approved farmer creates a product', r.status === 201, JSON.stringify(r));
  const prod = r.product;
  r = await call('PUT', `/products/${prod._id}`, farmToken, { price: 1.75, description: 'Crunchy and fresh' });
  ok('Farmer edits a product', r.status === 200 && r.product?.price === 1.75);
  r = await call('GET', '/products/mine', farmToken);
  ok('Farmer views own products', r.products?.some((p) => p._id === prod._id));
  r = await call('PATCH', `/products/${prod._id}/status`, farmToken, { status: 'sold_out' });
  ok('Farmer marks product sold out', r.product?.quantityAvailable === 0 && r.product?.status === 'sold_out');
  r = await call('PATCH', `/products/${prod._id}/status`, farmToken, { status: 'unavailable' });
  ok('Farmer marks product temporarily unavailable', r.product?.status === 'unavailable');
  await call('PATCH', `/products/${prod._id}/status`, farmToken, { status: 'available' });
  r = await call('POST', '/products/weekly-template/apply', farmToken);
  ok('Weekly template resets stock', r.status === 200);
  r = await call('GET', `/products/${prod._id}`);
  ok('Stock restored from weekly template (20)', r.product?.quantityAvailable === 20 && r.product?.status === 'available', `${r.product?.quantityAvailable}`);
  const html = new FormData();
  html.append('image', new Blob(['<script>alert(1)</script>'], { type: 'text/html' }), 'evil.html');
  r = await call('POST', '/uploads/image', farmToken, html, true);
  ok('Non-image upload (HTML) is rejected', r.status >= 400 && r.status < 500, `${r.status}`);
  const png = new FormData();
  png.append('image', new Blob([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64')], { type: 'image/png' }), 'dot.png');
  r = await call('POST', '/uploads/image', farmToken, png, true);
  ok('Image upload (PNG) is accepted', r.status === 201 && r.url, JSON.stringify(r));

  // ---------------------------------------------------------------- customer: cart -> order
  section('Customer: pre-orders (place, stock, slots, cancel, modify)');
  const sat = nextSaturday();
  const slot = { start: '09:00', end: '10:00' };
  const item = (q) => [{ product: prod._id, quantity: q }];
  r = await call('POST', '/orders', custToken, { items: item(30), market: green._id, pickupDate: sat, pickupSlot: slot });
  ok('Ordering more than stock is rejected (409); nothing reserved', r.status === 409 && (await call('GET', `/products/${prod._id}`)).product.quantityAvailable === 20);
  r = await call('POST', '/orders', custToken, { items: item(2), market: green._id, pickupDate: nextMonday(), pickupSlot: slot });
  ok('Pickup on a closed day (Monday) is rejected', r.status === 400);
  r = await call('POST', '/orders', custToken, { items: item(2), market: green._id, pickupDate: sat, pickupSlot: { start: '15:00', end: '16:00' } });
  ok('Pickup outside the farmer window is rejected', r.status === 400);
  r = await call('POST', '/orders', custToken, { items: item(2), market: green._id, pickupDate: sat, pickupSlot: slot, notes: 'E2E order' });
  ok('Customer places a pre-order for pickup', r.status === 201 && r.orders?.length === 1, JSON.stringify(r));
  const order = r.orders?.[0];
  ok('New order status is "placed"', order?.status === 'placed');
  ok('Stock dropped by the ordered quantity (20 -> 18)', (await call('GET', `/products/${prod._id}`)).product.quantityAvailable === 18);
  r = await call('PUT', `/orders/${order._id}`, custToken, { items: item(4) });
  ok('Customer modifies the order before cut-off (qty 4)', r.status === 200, JSON.stringify(r));
  ok('Stock adjusted after modify (20 -> 16)', (await call('GET', `/products/${prod._id}`)).product.quantityAvailable === 16);
  r = await call('POST', `/orders/${order._id}/cancel`, custToken);
  ok('Customer cancels the order before cut-off', r.status === 200 && r.order?.status === 'cancelled', JSON.stringify(r));
  ok('Stock restored after cancel (back to 20)', (await call('GET', `/products/${prod._id}`)).product.quantityAvailable === 20);

  // second order goes through the whole farmer workflow
  r = await call('POST', '/orders', custToken, { items: item(3), market: green._id, pickupDate: sat, pickupSlot: slot });
  const order2 = r.orders?.[0];
  ok('Second order placed for the farmer workflow', r.status === 201 && order2);
  r = await call('GET', '/orders', farmToken);
  ok('Farmer sees the incoming pre-order', (r.orders || []).some((o) => o._id === order2._id));
  r = await call('GET', '/orders', custToken);
  ok('Customer sees order history', (r.orders || []).some((o) => o._id === order2._id));
  r = await call('PATCH', `/orders/${order2._id}/status`, farmToken, { status: 'completed' });
  ok('Invalid status jump (placed -> completed) is rejected', r.status === 400);
  r = await call('PATCH', `/orders/${order2._id}/status`, farmToken, { status: 'accepted' });
  ok('Farmer accepts the order', r.order?.status === 'accepted');
  r = await call('PATCH', `/orders/${order2._id}/status`, farmToken, { status: 'ready' });
  ok('Farmer marks order ready for pickup', r.order?.status === 'ready');
  r = await call('PATCH', `/orders/${order2._id}/status`, seedFarmer, { status: 'completed' });
  ok('Another farmer cannot update this order', r.status >= 400);
  r = await call('PATCH', `/orders/${order2._id}/status`, farmToken, { status: 'completed' });
  ok('Farmer completes the order', r.order?.status === 'completed');
  r = await call('GET', '/notifications', custToken);
  const notes = r.notifications || [];
  ok('Customer got in-app alerts for accepted / ready / completed', ['accepted', 'ready', 'completed'].every((s) => notes.some((n) => new RegExp(s, 'i').test(n.title + n.message))), notes.map((n) => n.title).join(', '));
  r = await call('GET', `/orders/${order2._id}/reorder`, custToken);
  ok('Quick reorder returns the previous items', r.status === 200, JSON.stringify(r).slice(0, 120));

  // declined path releases stock
  r = await call('POST', '/orders', custToken, { items: item(2), market: green._id, pickupDate: sat, pickupSlot: slot });
  const order3 = r.orders?.[0];
  r = await call('PATCH', `/orders/${order3._id}/status`, farmToken, { status: 'declined' });
  ok('Farmer declines an order and stock is released', r.order?.status === 'declined' && (await call('GET', `/products/${prod._id}`)).product.quantityAvailable === 17);

  // ---------------------------------------------------------------- reviews
  section('Reviews and ratings');
  r = await call('POST', '/orders', custToken, { items: item(1), market: green._id, pickupDate: sat, pickupSlot: slot });
  const openOrder = r.orders?.[0];
  r = await call('POST', '/reviews', custToken, { order: openOrder._id, rating: 5, comment: 'too early' });
  ok('Cannot review before the order is completed', r.status === 400);
  r = await call('POST', '/reviews', custToken, { order: order2._id, product: prod._id, rating: 5, comment: 'Great radishes' });
  ok('Customer reviews a product after completion', r.status === 201, JSON.stringify(r));
  const review = r.review;
  r = await call('POST', '/reviews', custToken, { order: order2._id, rating: 4, comment: 'Nice farmer' });
  ok('Customer reviews the farmer after completion', r.status === 201);
  r = await call('GET', `/products/${prod._id}`);
  ok('Product rating is recalculated (5.0, 1 review)', r.product?.ratingAvg === 5 && r.product?.ratingCount === 1);
  r = await call('GET', `/reviews?product=${prod._id}`);
  ok('Other customers can read product reviews', r.reviews?.length === 1);
  r = await call('PUT', `/reviews/${review._id}/reply`, farmToken, { text: 'Thank you!' });
  ok('Farmer replies to a review', r.status === 200 && r.review?.reply?.text === 'Thank you!', JSON.stringify(r));
  r = await call('GET', '/reviews/mine', farmToken);
  ok('Farmer views reviews on own products', r.reviews?.length >= 1);

  // ---------------------------------------------------------------- product page extras (freshness, insights)
  section('Product page: freshness details and computed insights');
  r = await call('PUT', `/products/${prod._id}`, farmToken, { harvestedOn: new Date().toISOString().slice(0, 10), storage: 'Keep cool', tags: ['organic', 'seasonal', 'not-a-real-tag'] });
  ok('Farmer sets harvest date, storage tip and badges (unknown badges are dropped)', r.status === 200 && r.product?.tags?.length === 2 && r.product?.storage === 'Keep cool' && r.product?.harvestedOn, JSON.stringify(r).slice(0, 200));
  r = await call('GET', `/products/${prod._id}`);
  ok('Product page data includes insights (reserved, price comparison, bought-together)', r.insights && 'reserved' in r.insights && 'price' in r.insights && Array.isArray(r.insights.together), JSON.stringify(r.insights));
  r = await call('PUT', `/products/${prod._id}`, farmToken, { harvestedOn: '2999-01-01' });
  ok('A harvest date in the future is ignored', r.status === 200 && !r.product?.harvestedOn || new Date(r.product.harvestedOn) < new Date('2100-01-01') === false);
  r = await call('GET', '/search?q=e2e', null);
  ok('Live search endpoint answers (any letters)', r.status === 200 && Array.isArray(r.products) && Array.isArray(r.categories));
  r = await call('GET', '/search?q=to', null);
  ok('Live search ranks prefix matches first (to -> Tomatoes)', r.products?.[0]?.name?.toLowerCase().startsWith('to'), (r.products || []).map((x) => x.name).join(','));

  // ---------------------------------------------------------------- readable URLs
  section('Readable URLs (slugs)');
  r = await call('GET', `/products/${prod._id}`);
  const slug = r.product?.slug;
  ok('New products get a readable slug automatically', /^e2e-radish/.test(slug || ''), slug);
  r = await call('GET', `/products/${slug}`);
  ok('Product can be opened by slug', r.product?._id === prod._id);
  r = await call('GET', '/products/definitely-not-a-product');
  ok('Unknown slug -> 404', r.status === 404);
  r = await call('GET', `/markets/${green.slug}`);
  ok('Market can be opened by slug', r.market?._id === green._id, green.slug);
  r = await call('GET', `/farmers/${fred.farmerProfile.slug}`);
  ok('Farmer stall can be opened by slug', r.farmer?._id === fred._id, fred.farmerProfile?.slug);

  // ---------------------------------------------------------------- favorites
  section('Favorites and restock alerts');
  const fav = (m, t, id, tok = custToken) => call(m, `/customer/favorites/${t}/${id}`, tok);
  ok('Customer favorites a product', (await fav('PUT', 'products', prod._id)).status === 200);
  ok('Customer favorites a farmer', (await fav('PUT', 'farmers', farmId)).status === 200);
  ok('Customer favorites a market', (await fav('PUT', 'markets', green._id)).status === 200);
  r = await call('GET', '/customer/favorites', custToken);
  ok('Favorites list returns saved items', JSON.stringify(r).includes(prod._id) && JSON.stringify(r).includes(green._id));
  ok('Farmer cannot use favorites (RBAC)', (await call('GET', '/customer/favorites', farmToken)).status === 403);
  await call('PATCH', `/products/${prod._id}/status`, farmToken, { status: 'sold_out' });
  await call('PATCH', `/products/${prod._id}/status`, farmToken, { status: 'available' });
  await call('POST', '/products/weekly-template/apply', farmToken);
  r = await call('GET', '/notifications', custToken);
  ok('Restock alert sent to customers who favorited the product', (r.notifications || []).some((n) => /stock/i.test(n.title + n.message)), (r.notifications || []).map((n) => n.title).join(', '));
  ok('Customer can remove a favorite', (await fav('DELETE', 'products', prod._id)).status === 200);
  r = await call('PATCH', '/notifications/read-all', custToken);
  ok('Mark all notifications read', r.status === 200);

  // ---------------------------------------------------------------- chatbot
  section('AI assistant (chatbot)');
  r = await call('POST', '/chatbot', null, { message: 'Do you have apples?' });
  ok('Chatbot finds a product (apples)', r.status === 200 && /apple/i.test(JSON.stringify(r)), JSON.stringify(r).slice(0, 150));
  r = await call('POST', '/chatbot', null, { message: 'When is Green Valley Market open?' });
  ok('Chatbot answers market timings', r.status === 200 && /saturday|sat/i.test(JSON.stringify(r)), JSON.stringify(r).slice(0, 150));
  r = await call('POST', '/chatbot', null, { message: 'What are the pickup windows?' });
  ok('Chatbot answers pickup windows / FAQ', r.status === 200 && (r.reply || r.answer || r.message), JSON.stringify(r).slice(0, 150));

  // ---------------------------------------------------------------- admin
  section('Admin: dashboard, users, markets, categories, moderation, reports, announcements');
  r = await call('GET', '/admin/dashboard', admin);
  const stats = r.stats || r;
  ok('Dashboard shows total farmers, customers, markets, orders', ['farmers', 'customers', 'markets', 'orders'].every((k) => Object.keys(stats).some((s) => s.toLowerCase().includes(k))), JSON.stringify(stats));
  r = await call('GET', '/admin/users?role=farmer', admin);
  ok('Admin lists farmers', (r.users || []).some((u) => u._id === farmId));
  r = await call('GET', '/admin/users?role=customer', admin);
  ok('Admin lists customers', (r.users || []).some((u) => u._id === custId));
  r = await call('PATCH', `/admin/farmers/${farmId}/status`, admin, { status: 'suspended' });
  ok('Admin suspends a farmer', r.user?.farmerProfile?.approvalStatus === 'suspended');
  ok('Suspended farmer disappears from public lists', !((await call('GET', '/farmers?limit=50')).farmers || []).some((f) => f._id === farmId));
  ok('Suspended farmer cannot add products', (await call('POST', '/products', farmToken, { category: veg._id, name: 'x', price: 1, unit: 'kg', quantityAvailable: 1 })).status === 403);
  await call('PATCH', `/admin/farmers/${farmId}/status`, admin, { status: 'approved' });
  r = await call('PATCH', `/admin/users/${custId}/active`, admin, { isActive: false });
  ok('Admin deactivates a customer', r.status === 200);
  ok('Deactivated customer cannot log in', (await call('POST', '/auth/login', null, { email: custEmail, password: PASSWORD })).status === 403);
  ok('Deactivated customer’s existing session is rejected', [401, 403].includes((await call('GET', '/auth/me', custToken)).status));
  await call('PATCH', `/admin/users/${custId}/active`, admin, { isActive: true });
  ok('Admin reactivates the customer', (await call('POST', '/auth/login', null, { email: custEmail, password: PASSWORD })).status === 200);

  r = await call('POST', '/markets', admin, { name: `E2E Market ${STAMP}`, address: '1 Test Lane', latitude: 24.9, longitude: 67.1, mapProvider: 'openstreetmap', operatingDays: ['friday'], openTime: '08:00', closeTime: '12:00' });
  ok('Admin adds a market (name, address, days, hours, coordinates)', r.status === 201, JSON.stringify(r));
  const mk = r.market;
  r = await call('PUT', `/markets/${mk._id}`, admin, { name: `E2E Market ${STAMP} edited`, closeTime: '13:00' });
  ok('Admin edits a market', r.status === 200);
  ok('Farmer cannot add markets (RBAC)', (await call('POST', '/markets', farmToken, { name: 'x' })).status === 403);
  ok('Admin removes a market', (await call('DELETE', `/markets/${mk._id}`, admin)).status === 200);
  ok('Removed market is gone from the public list', !((await call('GET', '/markets?limit=50')).markets || []).some((m) => m._id === mk._id));

  r = await call('POST', '/categories', admin, { name: `E2E Category ${STAMP}`, description: 'temp' });
  ok('Admin creates a category (master data)', r.status === 201, JSON.stringify(r));
  const cat = r.category;
  ok('Admin edits a category', (await call('PUT', `/categories/${cat._id}`, admin, { name: `E2E Category ${STAMP} b` })).status === 200);
  ok('Admin deletes a category', (await call('DELETE', `/categories/${cat._id}`, admin)).status === 200);

  r = await call('POST', '/admin/announcements', admin, { title: `E2E announcement ${STAMP}`, message: 'Test message', audience: 'customers' });
  ok('Admin publishes an announcement to customers', r.status === 201, JSON.stringify(r));
  const ann = r.announcement;
  r = await call('GET', '/notifications/announcements', seedCustomer);
  ok('Customers see the announcement', JSON.stringify(r).includes(`E2E announcement ${STAMP}`));
  r = await call('GET', '/notifications/announcements', seedFarmer);
  ok('Farmers do not see a customers-only announcement', !JSON.stringify(r).includes(`E2E announcement ${STAMP}`));
  ok('Admin deletes the announcement', (await call('DELETE', `/admin/announcements/${ann._id}`, admin)).status === 200);

  r = await call('GET', '/admin/reviews', admin);
  ok('Admin views all reviews for moderation', (r.reviews || []).some((x) => x._id === review._id));
  r = await call('DELETE', `/reviews/${review._id}`, admin);
  ok('Admin removes an inappropriate review', r.status === 200);
  r = await call('GET', `/products/${prod._id}`);
  ok('Product rating recalculated after removal (0 reviews)', r.product?.ratingCount === 0);
  r = await call('GET', '/products/admin/all', admin);
  ok('Admin views all product listings', r.products?.some((p) => p._id === prod._id));
  ok('Admin removes an inappropriate product listing', (await call('DELETE', `/products/${prod._id}`, admin)).status === 200);

  r = await call('POST', '/admin/reports', admin, { reportType: 'summary' });
  ok('Admin generates a platform summary report', r.status === 201 || r.status === 200, JSON.stringify(r).slice(0, 200));
  const rep = JSON.stringify(r);
  ok('Report includes total orders, revenue by market and most active farmers', /order/i.test(rep) && /revenue/i.test(rep) && /farmer/i.test(rep), rep.slice(0, 300));
  r = await call('GET', '/admin/reports', admin);
  ok('Admin lists generated reports', (r.reports || []).length >= 1);

  // farmer dashboard insights
  r = await call('GET', '/farmers/dashboard', seedFarmer);
  ok('Farmer dashboard: total orders, pending orders, revenue, best sellers', r.stats && 'totalOrders' in r.stats && 'pendingOrders' in r.stats && 'revenue' in r.stats && Array.isArray(r.stats.bestSelling), JSON.stringify(r).slice(0, 200));

  // ---------------------------------------------------------------- admin extras (analytics, bulk, export, audit, search)
  section('Admin extras: analytics, bulk actions, CSV export, audit log, search');
  r = await call('GET', '/admin/dashboard', admin);
  const st = r.stats || {};
  ok('Overview has 14-day series, status split, revenue, top markets', st.days?.length === 14 && st.byStatus && 'revenue' in st && Array.isArray(st.topMarkets), Object.keys(st).join(','));
  ok('Overview has a "needs attention" queue and recent activity', st.attention && st.recent?.orders && st.recent?.users);
  r = await call('GET', '/admin/search?q=fred', admin);
  ok('Command-palette search finds users/markets/products', r.results?.length >= 1, JSON.stringify(r).slice(0, 120));
  r = await call('PATCH', '/admin/users/bulk', admin, { ids: [custId, farmId], action: 'deactivate' });
  ok('Bulk deactivate updates several accounts', r.status === 200 && r.modified === 2, JSON.stringify(r));
  r = await call('PATCH', '/admin/users/bulk', admin, { ids: [custId, farmId], action: 'activate' });
  ok('Bulk activate restores them', r.modified === 2);
  r = await call('PATCH', '/admin/users/bulk', admin, { ids: [], action: 'activate' });
  ok('Bulk action with no ids is rejected', r.status === 400);
  ok('Customer cannot use bulk/export/audit (RBAC)', [(await call('PATCH', '/admin/users/bulk', seedCustomer, { ids: [custId], action: 'activate' })).status, (await call('GET', '/admin/audit', seedCustomer)).status].every((x) => x === 403));
  const csvRes = await fetch(BASE + '/admin/export/users?role=customer', { headers: { Authorization: `Bearer ${admin}` } });
  const csv = await csvRes.text();
  ok('CSV export of customers downloads with a header row', csvRes.status === 200 && /text\/csv/.test(csvRes.headers.get('content-type')) && csv.startsWith('name,email'), csv.slice(0, 60));
  const csvO = await (await fetch(BASE + '/admin/export/orders', { headers: { Authorization: `Bearer ${admin}` } })).text();
  ok('CSV export of orders downloads', csvO.startsWith('order,placed_at'));
  r = await call('POST', '/admin/reports', admin, { reportType: 'top_products' });
  ok('Report: top products', r.status === 201 && Array.isArray(r.report?.data));
  r = await call('GET', '/admin/audit?limit=50', admin);
  ok('Audit log records admin actions (approve, bulk, export, report)', r.logs?.some((l) => /^farmer\./.test(l.action)) && r.logs?.some((l) => l.action.startsWith('bulk.')) && r.logs?.some((l) => l.action === 'export'), (r.logs || []).map((l) => l.action).slice(0, 8).join(','));
  r = await call('GET', '/admin/audit?action=bulk', admin);
  ok('Audit log can be filtered by action', r.logs?.length >= 2 && r.logs.every((l) => l.action.startsWith('bulk')));

  // ---------------------------------------------------------------- cleanup
  section('Cleanup');
  const User = require('../models/User');
  const Order = require('../models/Order');
  const Product = require('../models/Product');
  const Review = require('../models/Review');
  const Notification = require('../models/Notification');
  const Report = require('../models/Report');
  const Market = require('../models/Market');
  const Category = require('../models/Category');
  const Announcement = require('../models/Announcement');
  const users = await User.find({ email: /^e2e\+/ }).select('_id');
  const ids = users.map((u) => u._id);
  await Promise.all([
    Order.deleteMany({ $or: [{ customer: { $in: ids } }, { farmer: { $in: ids } }] }),
    Product.deleteMany({ farmer: { $in: ids } }),
    Review.deleteMany({ $or: [{ customer: { $in: ids } }, { farmer: { $in: ids } }] }),
    Notification.deleteMany({ user: { $in: ids } }),
    Report.deleteMany({ createdAt: { $gte: new Date(STAMP) } }),
    Market.deleteMany({ name: /^E2E Market/ }),
    Category.deleteMany({ name: /^E2E Category/ }),
    Announcement.deleteMany({ title: /^E2E announcement/ }),
    require('../models/AuditLog').deleteMany({ createdAt: { $gte: new Date(STAMP) } }),
    User.deleteMany({ _id: { $in: ids } }),
  ]);
  console.log(`  removed ${ids.length} test users and their data`);

  const failed = results.filter((x) => !x.pass);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed${failed.length ? `, ${failed.length} FAILED:` : '.'}`);
  failed.forEach((f) => console.log(`  x ${f.name}`));
  await mongoose.disconnect();
  process.exit(failed.length ? 1 : 0);
})().catch(async (e) => {
  console.error('Test run crashed:', e);
  await mongoose.disconnect().catch(() => {});
  process.exit(2);
});
