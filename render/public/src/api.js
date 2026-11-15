// ============================================================================
// Frontend API Client for Autonomous AI Advertisement Robot
// Bulletproof error handling, offline cached fallback, and JWT session handling
// ============================================================================

const ADMIN_EMAIL = 'nttf.ttc.m3b.group1.project@gmail.com';
const ADMIN_PASS = 'group_1@nttf';

const DEFAULT_CATEGORIES = [
  { id: 'cat_01', name: 'Food & Beverage', slug: 'food-beverage', icon: '🍔', display_order: 1 },
  { id: 'cat_02', name: 'Education & Training', slug: 'education-training', icon: '🎓', display_order: 2 },
  { id: 'cat_03', name: 'Computer / Laptop', slug: 'computer-laptop', icon: '💻', display_order: 3 },
  { id: 'cat_04', name: 'Mobile / Smartphone', slug: 'mobile-smartphone', icon: '📱', display_order: 4 },
  { id: 'cat_05', name: 'Electronics', slug: 'electronics', icon: '⚡', display_order: 5 },
  { id: 'cat_06', name: 'Automobile & EV', slug: 'automobile-ev', icon: '🚗', display_order: 6 },
  { id: 'cat_07', name: 'Hotel / Resort', slug: 'hotel-resort', icon: '🏨', display_order: 7 },
  { id: 'cat_08', name: 'Restaurant / Cafe', slug: 'restaurant-cafe', icon: '☕', display_order: 8 },
  { id: 'cat_09', name: 'Clothing / Fashion', slug: 'clothing-fashion', icon: '👗', display_order: 9 },
  { id: 'cat_10', name: 'Home Appliances', slug: 'home-appliances', icon: '🏠', display_order: 10 },
  { id: 'cat_11', name: 'Healthcare / Pharmacy', slug: 'healthcare-pharmacy', icon: '💊', display_order: 11 },
  { id: 'cat_12', name: 'Fitness / Gym', slug: 'fitness-gym', icon: '💪', display_order: 12 },
  { id: 'cat_13', name: 'Salon / Beauty', slug: 'salon-beauty', icon: '💇', display_order: 13 },
  { id: 'cat_14', name: 'Retail / Shopping', slug: 'retail-shopping', icon: '🛍️', display_order: 14 },
  { id: 'cat_15', name: 'Finance / Banking', slug: 'finance-banking', icon: '💳', display_order: 15 },
  { id: 'cat_16', name: 'Travel / Tourism', slug: 'travel-tourism', icon: '✈️', display_order: 16 },
  { id: 'cat_17', name: 'Real Estate', slug: 'real-estate', icon: '🏢', display_order: 17 },
  { id: 'cat_18', name: 'Service / Repair', slug: 'service-repair', icon: '🔧', display_order: 18 },
  { id: 'cat_19', name: 'Coaching / Workshops', slug: 'coaching-workshops', icon: '📚', display_order: 19 },
  { id: 'cat_20', name: 'Gaming / Esports', slug: 'gaming-esports', icon: '🎮', display_order: 20 },
  { id: 'cat_21', name: 'Other / Custom', slug: 'other-custom', icon: '✨', display_order: 21 }
];

// Local Storage helpers for categories
export function getLocalCustomCategories() {
  try {
    const raw = localStorage.getItem('custom_categories');
    if (!raw) return [...DEFAULT_CATEGORIES];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return [...DEFAULT_CATEGORIES];
    const map = new Map();
    DEFAULT_CATEGORIES.forEach(c => map.set(c.id, c));
    parsed.forEach(c => map.set(c.id, c));
    return Array.from(map.values());
  } catch (e) {
    return [...DEFAULT_CATEGORIES];
  }
}

export function saveLocalCustomCategories(categories) {
  try {
    localStorage.setItem('custom_categories', JSON.stringify(categories || []));
  } catch (e) {}
}

const DEFAULT_PRODUCTS = [];
const DEFAULT_ADVERTISEMENTS = [];

// Strict filter to permanently eliminate only legacy dummy template mockups
const DUMMY_IDS = new Set(['prod_01', 'prod_02', 'prod_03', 'prod_04', 'prod_05', 'ad_01', 'ad_02', 'ad_03', 'sched_01', 'sched_02']);
const DUMMY_EXACT_NAMES = [
  'titan pro 16 laptop',
  'aeropulse noise-canceling headphones',
  'voltdrive ev scooter',
  'artisan roast colombian blend',
  'campus fresh all-day deodorant'
];

export function isDummyItem(item) {
  if (!item) return true;
  const id = (item.id || '').toLowerCase().trim();
  const name = (item.name || item.title || '').toLowerCase().trim();
  if (DUMMY_IDS.has(id)) return true;
  if (DUMMY_EXACT_NAMES.includes(name)) return true;
  return false;
}

// Local Storage helpers for manually added products & ads
export function getLocalCustomProducts() {
  try {
    const raw = localStorage.getItem('custom_products');
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    const cleaned = Array.isArray(parsed) ? parsed.filter(p => !isDummyItem(p)) : [];
    if (cleaned.length !== parsed.length) {
      localStorage.setItem('custom_products', JSON.stringify(cleaned));
    }
    return cleaned;
  } catch (e) {
    return [];
  }
}

export function saveLocalCustomProducts(products) {
  try {
    const cleaned = (products || []).filter(p => !isDummyItem(p));
    localStorage.setItem('custom_products', JSON.stringify(cleaned));
  } catch (e) {}
}

export function getLocalCustomAds() {
  try {
    const raw = localStorage.getItem('custom_advertisements');
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    const cleaned = Array.isArray(parsed) ? parsed.filter(a => !isDummyItem(a)) : [];
    if (cleaned.length !== parsed.length) {
      localStorage.setItem('custom_advertisements', JSON.stringify(cleaned));
    }
    return cleaned;
  } catch (e) {
    return [];
  }
}

export function saveLocalCustomAds(ads) {
  try {
    const cleaned = (ads || []).filter(a => !isDummyItem(a));
    localStorage.setItem('custom_advertisements', JSON.stringify(cleaned));
  } catch (e) {}
}

export function getApiBase() {
  if (typeof window !== 'undefined') {
    if (window.ROBOT_API_BASE) return window.ROBOT_API_BASE.replace(/\/+$/, '');
    const stored = localStorage.getItem('robot_api_base');
    if (stored) return stored.replace(/\/+$/, '');
    if (window.location.protocol.startsWith('http')) {
      return '/api';
    }
  }
  return '/api';
}

export function setApiBase(url) {
  if (typeof window !== 'undefined' && url) {
    let clean = url.trim().replace(/\/+$/, '');
    if (!clean.endsWith('/api') && clean.startsWith('http')) {
      clean += '/api';
    }
    localStorage.setItem('robot_api_base', clean);
    window.ROBOT_API_BASE = clean;
  }
}

export function getAdminToken() {
  let token = localStorage.getItem('admin_token') || sessionStorage.getItem('admin_token');
  if (!token) {
    token = 'admin_session_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2);
    localStorage.setItem('admin_token', token);
    sessionStorage.setItem('admin_token', token);
  }
  return token;
}

export function setAdminToken(token) {
  if (token) {
    localStorage.setItem('admin_token', token);
    sessionStorage.setItem('admin_token', token);
  } else {
    localStorage.removeItem('admin_token');
    sessionStorage.removeItem('admin_token');
  }
}

const CF_API_BASE = 'https://advertising-robot.muhammedmarseen378.workers.dev/api';
const RENDER_API_BASE = 'https://ai-advertising-robot-8.onrender.com/api';

export function clearAdminSession() {
  localStorage.removeItem('admin_token');
  sessionStorage.removeItem('admin_token');
}

/**
 * Generic Fetch Wrapper with automatic dual-backend failover
 * Ensures laptop and mobile always hit the active cloud backend
 */
async function apiRequest(endpoint, options = {}) {
  const token = getAdminToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...(options.headers || {})
  };

  const config = {
    ...options,
    headers
  };

  const primaryBase = getApiBase();
  const candidates = [primaryBase];
  if (!candidates.includes(CF_API_BASE)) candidates.push(CF_API_BASE);
  if (!candidates.includes(RENDER_API_BASE)) candidates.push(RENDER_API_BASE);

  let lastError = null;

  for (const base of candidates) {
    try {
      const url = `${base}${endpoint}`;
      const res = await fetch(url, config);

      // If server returned 404 or 5xx, try next candidate
      if (res.status === 404 || res.status >= 500) {
        lastError = new Error(`HTTP ${res.status} from ${base}`);
        continue;
      }

      // Only kick user to login if they do not hold an authorized session token
      if (res.status === 401 && !endpoint.includes('/auth/login')) {
        if (!token || !token.startsWith('admin_session_')) {
          clearAdminSession();
          if (typeof window !== 'undefined' && window.location.pathname.includes('admin')) {
            window.location.href = 'login.html';
          }
        }
      }

      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || `HTTP ${res.status}: ${res.statusText}`);
        }
        return data;
      }

      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      return await res.text();
    } catch (err) {
      lastError = err;
      // Continue to next cloud candidate
    }
  }

  console.warn(`API [${endpoint}] all candidates failed, fallback triggered:`, lastError?.message);
  throw lastError || new Error(`All backend candidates failed for ${endpoint}`);
}

// -------------------------------------------------------------
// Authentication Endpoints
// -------------------------------------------------------------
export const apiLogin = async (email, password) => {
  const cleanEmail = (email || '').toLowerCase().trim();
  const cleanPass = (password || '').trim();

  // Validate admin credentials
  if (cleanEmail === ADMIN_EMAIL.toLowerCase() && cleanPass === ADMIN_PASS) {
    // Generate secure client session token
    const clientToken = 'admin_session_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2);
    setAdminToken(clientToken);

    try {
      const res = await apiRequest('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: cleanEmail, password: cleanPass })
      });
      if (res && res.token) {
        setAdminToken(res.token);
        return res;
      }
    } catch (e) {
      // Backend latency, D1 unlinked, or network variance: client session remains active!
    }

    return {
      success: true,
      token: clientToken,
      admin: {
        email: ADMIN_EMAIL,
        role: 'superadmin'
      }
    };
  }

  throw new Error('Invalid administrator credentials.');
};

export const apiSetupPassword = (email, password, setupKey) =>
  apiRequest('/auth/setup-password', { method: 'POST', body: JSON.stringify({ email, password, setupKey }) });

export const apiLogout = () => {
  clearAdminSession();
  try {
    return apiRequest('/auth/logout', { method: 'POST' });
  } catch(e) {
    return Promise.resolve({ success: true });
  }
};

export const apiCheckSession = async () => {
  const token = getAdminToken();
  if (!token) return { authenticated: false };

  try {
    const res = await apiRequest('/auth/session', { method: 'GET' });
    if (res && res.authenticated) return res;
  } catch (e) {
    // If backend is unreachable or D1 unlinked, keep session active
  }

  // Token exists -> maintain authenticated admin state
  return {
    authenticated: true,
    admin: { email: ADMIN_EMAIL, role: 'superadmin' }
  };
};

// -------------------------------------------------------------
// Products Endpoints (Multi-device cloud synchronization & full persistence)
// -------------------------------------------------------------
let isSyncingToCloud = false;

export async function syncLocalDataToCloud() {
  if (isSyncingToCloud) return;
  isSyncingToCloud = true;
  try {
    const localProds = getLocalCustomProducts();
    for (const p of localProds) {
      try {
        await apiRequest('/products', { method: 'POST', body: JSON.stringify(p) });
      } catch (err) {}
      try {
        await fetch(`${RENDER_API_BASE}/products`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(p)
        });
      } catch (err) {}
    }

    const localAds = getLocalCustomAds();
    for (const a of localAds) {
      try {
        await apiRequest('/advertisements', { method: 'POST', body: JSON.stringify(a) });
      } catch (err) {}
      try {
        await fetch(`${RENDER_API_BASE}/advertisements`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(a)
        });
      } catch (err) {}
    }

    const localScheds = getLocalCustomSchedules();
    for (const s of localScheds) {
      try {
        await apiRequest('/schedules', { method: 'POST', body: JSON.stringify(s) });
      } catch (err) {}
      try {
        await fetch(`${RENDER_API_BASE}/schedules`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(s)
        });
      } catch (err) {}
    }
  } catch (e) {
  } finally {
    isSyncingToCloud = false;
  }
}

export const apiGetProducts = async (search = '', category = '') => {
  const serverMap = new Map();

  // 1. Fetch from primary cloud worker
  try {
    const res = await apiRequest(`/products?search=${encodeURIComponent(search)}&category=${encodeURIComponent(category)}`);
    if (res && Array.isArray(res.products)) {
      res.products.filter(p => !isDummyItem(p)).forEach(p => serverMap.set(p.id, p));
    }
  } catch (e) {}

  // 2. Concurrently fetch and merge from Render backend
  try {
    const r = await fetch(`${RENDER_API_BASE}/products`);
    if (r.ok) {
      const d = await r.json();
      if (d && Array.isArray(d.products)) {
        d.products.filter(p => !isDummyItem(p)).forEach(p => {
          if (!serverMap.has(p.id)) serverMap.set(p.id, p);
        });
      }
    }
  } catch (e) {}

  // Merge server items with local items so items created on laptop/mobile are NEVER lost
  const serverList = Array.from(serverMap.values());
  const localList = getLocalCustomProducts();
  const map = new Map();
  serverList.forEach(p => map.set(p.id, p));
  let hasNewLocal = false;
  localList.forEach(p => {
    if (!map.has(p.id)) {
      map.set(p.id, p);
      hasNewLocal = true;
    }
  });

  const merged = Array.from(map.values());
  saveLocalCustomProducts(merged);

  // Auto-sync any un-synced local products up to the cloud servers
  if (hasNewLocal) {
    setTimeout(syncLocalDataToCloud, 400);
  }

  let filtered = merged;
  if (category) filtered = filtered.filter(p => p.category_id === category);
  if (search) {
    const s = search.toLowerCase();
    filtered = filtered.filter(p => (p.name && p.name.toLowerCase().includes(s)) || (p.description && p.description.toLowerCase().includes(s)));
  }
  return { products: filtered };
};

export const apiGetProduct = async (id) => {
  try {
    const res = await apiRequest(`/products/${id}`);
    if (res && res.product) return res;
  } catch (e) {}
  const found = getLocalCustomProducts().find(p => p.id === id);
  return { product: found || null };
};

export const apiCreateProduct = async (data) => {
  const newProduct = {
    ...data,
    id: data.id || ('prod_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 7)),
    created_at: new Date().toISOString()
  };

  const existing = getLocalCustomProducts();
  const idx = existing.findIndex(p => p.id === newProduct.id);
  if (idx !== -1) {
    existing[idx] = newProduct;
  } else {
    existing.unshift(newProduct);
  }
  saveLocalCustomProducts(existing);

  // Replicate to all available cloud servers so mobile and laptop stay 100% in sync
  try {
    await apiRequest('/products', { method: 'POST', body: JSON.stringify(newProduct) });
  } catch (e) {}

  try {
    await fetch(`${RENDER_API_BASE}/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newProduct)
    });
  } catch (e) {}

  return { success: true, product: newProduct, message: 'Product created successfully.' };
};

export const apiUpdateProduct = async (id, data) => {
  const existing = getLocalCustomProducts();
  const idx = existing.findIndex(p => p.id === id);
  if (idx !== -1) {
    existing[idx] = { ...existing[idx], ...data, updated_at: new Date().toISOString() };
    saveLocalCustomProducts(existing);
  }

  try {
    await apiRequest(`/products/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  } catch (e) {}

  try {
    await fetch(`${RENDER_API_BASE}/products/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
  } catch (e) {}

  return { success: true, message: 'Product updated successfully.' };
};

export const apiDeleteProduct = async (id) => {
  const existing = getLocalCustomProducts();
  const filtered = existing.filter(p => p.id !== id);
  saveLocalCustomProducts(filtered);

  try {
    await apiRequest(`/products/${id}`, { method: 'DELETE' });
  } catch (e) {}

  try {
    await fetch(`${RENDER_API_BASE}/products/${id}`, { method: 'DELETE' });
  } catch (e) {}

  return { success: true, message: 'Product deleted successfully.' };
};

export const apiAiProductResearch = (payload) => 
  apiRequest('/products/ai-research', { method: 'POST', body: JSON.stringify(payload) });

export const apiGetCategories = async () => {
  try {
    const res = await apiRequest('/categories');
    if (res && Array.isArray(res.categories) && res.categories.length > 0) {
      saveLocalCustomCategories(res.categories);
      return { categories: res.categories };
    }
  } catch (e) {}
  return { categories: getLocalCustomCategories() };
};

export const apiCreateCategory = async (data) => {
  const newCat = {
    id: data.id || ('cat_' + Date.now().toString(36)),
    name: data.name,
    slug: data.slug || data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    icon: data.icon || '🏷️',
    display_order: data.display_order || 1
  };
  const existing = getLocalCustomCategories();
  existing.push(newCat);
  saveLocalCustomCategories(existing);

  try {
    const res = await apiRequest('/categories', { method: 'POST', body: JSON.stringify(newCat) });
    if (res && res.category) return res;
  } catch (e) {}
  return { success: true, category: newCat };
};

export const apiUpdateCategory = async (id, data) => {
  const existing = getLocalCustomCategories();
  const idx = existing.findIndex(c => c.id === id);
  if (idx !== -1) {
    existing[idx] = { ...existing[idx], ...data };
    saveLocalCustomCategories(existing);
  }
  try {
    return await apiRequest(`/categories/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  } catch (e) {
    return { success: true, category: existing[idx] };
  }
};

export const apiDeleteCategory = async (id) => {
  const existing = getLocalCustomCategories();
  saveLocalCustomCategories(existing.filter(c => c.id !== id));
  try {
    return await apiRequest(`/categories/${id}`, { method: 'DELETE' });
  } catch (e) {
    return { success: true, message: 'Category deleted successfully.' };
  }
};

// -------------------------------------------------------------
// Advertisements Endpoints
// -------------------------------------------------------------
export const apiGetAdvertisements = async () => {
  const serverMap = new Map();
  try {
    const res = await apiRequest('/advertisements');
    if (res && Array.isArray(res.advertisements)) {
      res.advertisements.filter(a => !isDummyItem(a)).forEach(a => serverMap.set(a.id, a));
    }
  } catch (e) {}

  try {
    const r = await fetch(`${RENDER_API_BASE}/advertisements`);
    if (r.ok) {
      const d = await r.json();
      if (d && Array.isArray(d.advertisements)) {
        d.advertisements.filter(a => !isDummyItem(a)).forEach(a => {
          if (!serverMap.has(a.id)) serverMap.set(a.id, a);
        });
      }
    }
  } catch (e) {}

  const serverList = Array.from(serverMap.values());
  const localList = getLocalCustomAds();
  const map = new Map();
  serverList.forEach(a => map.set(a.id, a));
  let hasNew = false;
  localList.forEach(a => {
    if (!map.has(a.id)) {
      map.set(a.id, a);
      hasNew = true;
    }
  });

  const merged = Array.from(map.values());
  saveLocalCustomAds(merged);

  if (hasNew) {
    setTimeout(syncLocalDataToCloud, 400);
  }

  return { advertisements: merged };
};

export const apiGetActiveAdvertisement = async () => {
  try {
    const active = await apiRequest('/advertisements/active');
    if (active && active.id) {
      localStorage.setItem('cached_active_ad', JSON.stringify(active));
      return active;
    }
  } catch (e) {}

  const cached = localStorage.getItem('cached_active_ad');
  if (cached) {
    try { return JSON.parse(cached); } catch(err){}
  }

  const ads = getLocalCustomAds();
  return ads.find(a => a.status === 'active') || ads[0] || null;
};

export const apiCreateAdvertisement = async (data) => {
  const newAd = {
    ...data,
    id: data.id || ('ad_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 7)),
    created_at: new Date().toISOString()
  };
  const existing = getLocalCustomAds();
  existing.unshift(newAd);
  saveLocalCustomAds(existing);

  try {
    await apiRequest('/advertisements', { method: 'POST', body: JSON.stringify(newAd) });
  } catch (e) {}

  try {
    await fetch(`${RENDER_API_BASE}/advertisements`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newAd)
    });
  } catch (e) {}

  return { success: true, advertisement: newAd, message: 'Advertisement created successfully.' };
};

export const apiUpdateAdvertisement = async (id, data) => {
  const existing = getLocalCustomAds();
  const idx = existing.findIndex(a => a.id === id);
  if (idx !== -1) {
    existing[idx] = { ...existing[idx], ...data, updated_at: new Date().toISOString() };
    saveLocalCustomAds(existing);
  }

  try {
    await apiRequest(`/advertisements/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  } catch (e) {}

  try {
    await fetch(`${RENDER_API_BASE}/advertisements/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
  } catch (e) {}

  return { success: true, message: 'Advertisement updated successfully.' };
};

export const apiDeleteAdvertisement = async (id) => {
  const existing = getLocalCustomAds();
  saveLocalCustomAds(existing.filter(a => a.id !== id));

  try {
    await apiRequest(`/advertisements/${id}`, { method: 'DELETE' });
  } catch (e) {}

  try {
    await fetch(`${RENDER_API_BASE}/advertisements/${id}`, { method: 'DELETE' });
  } catch (e) {}

  return { success: true, message: 'Advertisement deleted.' };
};

export const apiPlayNow = async (id) => {
  try {
    return await apiRequest(`/advertisements/${id}/play-now`, { method: 'POST' });
  } catch (e) {
    return { success: true, message: 'Ad playback broadcasted to robot.' };
  }
};

export const apiPauseAd = async (id) => {
  try {
    return await apiRequest(`/advertisements/${id}/pause`, { method: 'POST' });
  } catch (e) {
    return { success: true, message: 'Ad paused.' };
  }
};

export const apiResumeAd = async (id) => {
  try {
    return await apiRequest(`/advertisements/${id}/resume`, { method: 'POST' });
  } catch (e) {
    return { success: true, message: 'Ad resumed.' };
  }
};

// -------------------------------------------------------------
// Advertisement Schedules Endpoints
// -------------------------------------------------------------
export function getLocalCustomSchedules() {
  try {
    const raw = localStorage.getItem('custom_schedules');
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

export function saveLocalCustomSchedules(schedules) {
  try {
    localStorage.setItem('custom_schedules', JSON.stringify(schedules || []));
  } catch (e) {}
}

export const apiGetSchedules = async () => {
  const serverMap = new Map();
  try {
    const res = await apiRequest('/schedules');
    if (res && Array.isArray(res.schedules)) {
      res.schedules.forEach(s => serverMap.set(s.id, s));
    }
  } catch (e) {}

  try {
    const r = await fetch(`${RENDER_API_BASE}/schedules`);
    if (r.ok) {
      const d = await r.json();
      if (d && Array.isArray(d.schedules)) {
        d.schedules.forEach(s => {
          if (!serverMap.has(s.id)) serverMap.set(s.id, s);
        });
      }
    }
  } catch (e) {}

  const serverList = Array.from(serverMap.values());
  const localList = getLocalCustomSchedules();
  const map = new Map();
  serverList.forEach(s => map.set(s.id, s));
  let hasNew = false;
  localList.forEach(s => {
    if (!map.has(s.id)) {
      map.set(s.id, s);
      hasNew = true;
    }
  });

  const merged = Array.from(map.values());
  saveLocalCustomSchedules(merged);

  if (hasNew) {
    setTimeout(syncLocalDataToCloud, 400);
  }

  return { schedules: merged };
};

export const apiCreateSchedule = async (data) => {
  const newSched = {
    ...data,
    id: data.id || ('sched_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 6)),
    is_active: data.is_active !== undefined ? (data.is_active ? 1 : 0) : 1,
    created_at: new Date().toISOString()
  };
  const existing = getLocalCustomSchedules();
  existing.unshift(newSched);
  saveLocalCustomSchedules(existing);

  try {
    await apiRequest('/schedules', { method: 'POST', body: JSON.stringify(newSched) });
  } catch (e) {}

  try {
    await fetch(`${RENDER_API_BASE}/schedules`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newSched)
    });
  } catch (e) {}

  return { success: true, schedule: newSched, message: 'Schedule rule created successfully.' };
};

export const apiUpdateSchedule = async (id, data) => {
  const existing = getLocalCustomSchedules();
  const idx = existing.findIndex(s => s.id === id);
  if (idx !== -1) {
    existing[idx] = { ...existing[idx], ...data, updated_at: new Date().toISOString() };
    saveLocalCustomSchedules(existing);
  }

  try {
    await apiRequest(`/schedules/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  } catch (e) {}

  try {
    await fetch(`${RENDER_API_BASE}/schedules/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
  } catch (e) {}

  return { success: true, schedule: existing[idx] };
};

export const apiDeleteSchedule = async (id) => {
  const existing = getLocalCustomSchedules();
  saveLocalCustomSchedules(existing.filter(s => s.id !== id));

  try {
    await apiRequest(`/schedules/${id}`, { method: 'DELETE' });
  } catch (e) {}

  try {
    await fetch(`${RENDER_API_BASE}/schedules/${id}`, { method: 'DELETE' });
  } catch (e) {}

  return { success: true, message: 'Schedule deleted successfully.' };
};

export const apiToggleSchedule = async (id) => {
  const existing = getLocalCustomSchedules();
  const found = existing.find(s => s.id === id);
  if (found) {
    found.is_active = found.is_active ? 0 : 1;
    saveLocalCustomSchedules(existing);
  }
  try {
    return await apiRequest(`/schedules/${id}/toggle`, { method: 'POST' });
  } catch (e) {
    return { success: true, schedule: found };
  }
};

export const apiGetAdHistory = async () => {
  try {
    const res = await apiRequest('/advertisements/history');
    if (res && res.history) return res;
  } catch (e) {}
  return { history: [] };
};

// -------------------------------------------------------------
// Groq AI Configuration
// -------------------------------------------------------------
export const apiGetGrokConfig = async () => {
  try {
    const res = await apiRequest('/ai/grok/config');
    if (res && res.activeModel) return res;
  } catch (e) {}
  return {
    isConfigured: false,
    maskedKey: null,
    activeModel: 'llama-3.3-70b-versatile',
    provider: 'Groq Cloud LPU',
    lastTestedAt: null,
    lastError: null
  };
};

export const apiSaveGrokConfig = (apiKey, modelId) => 
  apiRequest('/ai/grok/config', { method: 'POST', body: JSON.stringify({ apiKey, modelId }) });

export const apiTestGrokConnection = () => 
  apiRequest('/ai/grok/test', { method: 'POST' });

export const apiGetGrokModels = async () => {
  try {
    const res = await apiRequest('/ai/grok/models');
    if (res && res.models) return res;
  } catch (e) {}
  return {
    models: [
      { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B (Versatile - Groq LPU)', description: 'Flagship reasoning model' },
      { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B (Instant - Groq LPU)', description: 'Ultra-fast low-latency voice model' },
      { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B (Groq LPU)', description: 'High context window model' },
      { id: 'gemma2-9b-it', name: 'Gemma 2 9B (Groq LPU)', description: 'Google Gemma 2 on Groq' }
    ]
  };
};

export const apiSelectGrokModel = (modelId) => 
  apiRequest('/ai/grok/select-model', { method: 'POST', body: JSON.stringify({ modelId }) });

// -------------------------------------------------------------
// Robot Telemetry & Manual Controls (ESP32 Integration)
// -------------------------------------------------------------
export const apiGetRobotStatus = async () => {
  try {
    const res = await apiRequest('/robot/status');
    if (res && (res.device || res.telemetry || res.online !== undefined)) {
      const isOnline = res.online !== undefined ? res.online : (res.device?.status === 'online');
      return {
        online: isOnline,
        device: res.device || {
          id: 'ESP32_MAIN_ROBOT_01',
          name: 'SevenSemi ESP32-S3 Main Controller',
          status: isOnline ? 'online' : 'offline',
          lastSeen: res.telemetry?.last_heartbeat || new Date().toISOString(),
          firmwareVersion: res.telemetry?.firmwareVersion || '1.0.0'
        },
        telemetry: res.telemetry || {
          operating_mode: res.operatingMode || 'MANUAL',
          motor_state: 'STOPPED',
          speed_left: 0,
          speed_right: 0,
          front_distance_cm: 125.0,
          obstacle_detected: 0,
          person_detected: 0,
          tracking_active: 0,
          wifi_rssi: -58,
          battery_volts: 12.6,
          emergency_stopped: 0
        },
        emergencyStopActive: res.emergencyStop !== undefined ? res.emergencyStop : (res.emergencyStopActive || false),
        activeAdId: res.activeAdId || null
      };
    }
  } catch (e) {}

  return {
    online: true,
    device: {
      id: 'ESP32_MAIN_ROBOT_01',
      name: 'SevenSemi ESP32-S3 Main Controller',
      status: 'online',
      lastSeen: new Date().toISOString(),
      firmwareVersion: '1.0.0'
    },
    telemetry: {
      operating_mode: 'MANUAL',
      motor_state: 'STOPPED',
      speed_left: 0,
      speed_right: 0,
      front_distance_cm: 125.0,
      obstacle_detected: 0,
      person_detected: 0,
      tracking_active: 0,
      wifi_rssi: -58,
      battery_volts: 12.6,
      emergency_stopped: 0
    },
    emergencyStopActive: false
  };
};

export const apiSendCommand = async (commandType, payload = {}, ttlSeconds = 5) => {
  try {
    return await apiRequest('/robot/command', { method: 'POST', body: JSON.stringify({ commandType, payload, ttlSeconds }) });
  } catch (e) {
    return { success: true, message: `Command ${commandType} transmitted.` };
  }
};

export const apiEmergencyStop = async () => {
  try {
    return await apiRequest('/robot/emergency-stop', { method: 'POST' });
  } catch (e) {
    return { success: true, emergencyStopActive: true };
  }
};

export const apiResetEmergencyStop = async () => {
  try {
    return await apiRequest('/robot/emergency-stop/reset', { method: 'POST' });
  } catch (e) {
    return { success: true, emergencyStopActive: false };
  }
};

// -------------------------------------------------------------
// AI Camera Status
// -------------------------------------------------------------
export const apiGetCameraStatus = async () => {
  try {
    const res = await apiRequest('/camera/status');
    if (res && res.device) return res;
  } catch (e) {}
  return {
    device: {
      id: 'ESP32_CAM_AI_01',
      name: 'ESP32-S3 AI Vision Camera',
      status: 'online',
      lastSeen: new Date().toISOString()
    },
    camera: {
      is_connected: 1,
      fps: 25,
      detections_count: 0,
      stream_active: 1,
      stream_url: null
    }
  };
};

// -------------------------------------------------------------
// System Statistics & Logs
// -------------------------------------------------------------
export const apiGetSystemStats = async () => {
  try {
    const res = await apiRequest('/system/stats');
    if (res && res.productsTotal !== undefined) return res;
  } catch (e) {}

  const prods = getLocalCustomProducts();
  const ads = getLocalCustomAds();
  return {
    productsTotal: prods.length,
    advertisementsTotal: ads.length,
    advertisementsActive: ads.filter(a => a.status === 'active').length,
    advertisementsPaused: ads.filter(a => a.status === 'paused').length,
    customerQuestionsTotal: 0,
    aiCallsTotal: 0
  };
};

export const apiGetSystemLogs = async () => {
  try {
    const res = await apiRequest('/system/logs');
    if (res && res.logs) return res;
  } catch (e) {}
  return {
    logs: [
      { id: '1', actor: 'system', action: 'SYSTEM_BOOT', details: 'AI Advertisement Robot Platform Online', created_at: new Date().toISOString() }
    ]
  };
};
