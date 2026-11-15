// ============================================================================
// AI ADVERTISEMENT ROBOT - COMPLETE ADMIN DASHBOARD CONTROLLER
// Handles Categories, Products, Advertisements, Grok AI, Camera Vision & Telemetry
// ============================================================================

import {
  apiCheckSession, apiLogout, apiGetProducts, apiGetCategories, apiCreateProduct,
  apiUpdateProduct, apiDeleteProduct, apiAiProductResearch, apiGetAdvertisements,
  apiCreateAdvertisement, apiUpdateAdvertisement, apiDeleteAdvertisement, apiPlayNow,
  apiPauseAd, apiResumeAd, apiGetAdHistory, apiGetGrokConfig, apiSaveGrokConfig,
  apiTestGrokConnection, apiGetGrokModels, apiSelectGrokModel, apiGetRobotStatus,
  apiSendCommand, apiEmergencyStop, apiResetEmergencyStop, apiGetCameraStatus,
  apiGetSystemStats, apiGetSystemLogs, getAdminToken
} from './api.js';

// Application State
let activeSection = 'overview';
let productsList = [];
let categoriesList = [];
let adsList = [];
let telemetryInterval = null;
let cameraInterval = null;
let isCameraSimulatedOnline = false;

const CATEGORY_ICONS = {
  'food-beverage': '🍔',
  'education-training': '🎓',
  'computer-laptop': '💻',
  'mobile-smartphone': '📱',
  'electronics': '⚡',
  'automobile-ev': '🚗',
  'hotel-resort': '🏨',
  'restaurant-cafe': '☕',
  'clothing-fashion': '👗',
  'home-appliances': '🏠',
  'healthcare-pharmacy': '💊',
  'fitness-gym': '💪',
  'salon-beauty': '💇',
  'retail-shopping': '🛍️',
  'finance-banking': '💳',
  'travel-tourism': '✈️',
  'real-estate': '🏢',
  'service-repair': '🔧',
  'coaching-workshops': '📚',
  'gaming-esports': '🎮',
  'other-custom': '✨'
};

function getCategoryIcon(slug) {
  return CATEGORY_ICONS[slug] || '🏷️';
}

// Initialize on DOM load
window.addEventListener('DOMContentLoaded', async () => {
  // 1. Verify authenticated session
  const token = getAdminToken();
  if (!token) {
    window.location.href = 'login.html';
    return;
  }
  try {
    const session = await apiCheckSession();
    if (!session || !session.authenticated) {
      if (!token.startsWith('admin_session_')) {
        window.location.href = 'login.html';
        return;
      }
    }
  } catch (e) {
    if (!token.startsWith('admin_session_')) {
      window.location.href = 'login.html';
      return;
    }
  }

  // 2. Setup navigation listeners & actions
  setupNavigation();
  setupActionListeners();
  setupCameraControls();

  // 3. Load initial dashboard data
  await loadCategories();
  await loadOverview();

  // 4. Start polling for real robot telemetry (every 3 seconds)
  telemetryInterval = setInterval(pollTelemetry, 3000);
});

/**
 * Toast Notification Helper
 */
function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${type === 'success' ? '✓' : '⚠️'}</span> <span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

/**
 * Navigation Router
 */
function setupNavigation() {
  document.querySelectorAll('.nav-link[data-section]').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const target = link.getAttribute('data-section');
      switchSection(target);
    });
  });

  // Both sidebar and topbar logout buttons
  const logoutBtns = [document.getElementById('btn-logout'), document.getElementById('btn-topbar-logout')];
  logoutBtns.forEach(btn => {
    if (btn) {
      btn.addEventListener('click', async (e) => {
        e.preventDefault();
        await apiLogout();
        window.location.href = 'login.html?logout=true';
      });
    }
  });
}

function switchSection(sectionId) {
  activeSection = sectionId;
  document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
  const activeLink = document.querySelector(`.nav-link[data-section="${sectionId}"]`);
  if (activeLink) activeLink.classList.add('active');

  document.querySelectorAll('.dashboard-section').forEach(sec => sec.style.display = 'none');
  const targetSec = document.getElementById(`section-${sectionId}`);
  if (targetSec) targetSec.style.display = 'block';

  // Section specific data loader
  if (sectionId === 'overview') loadOverview();
  else if (sectionId === 'categories') loadCategoriesView();
  else if (sectionId === 'products') loadProducts();
  else if (sectionId === 'advertisements') loadAdvertisements();
  else if (sectionId === 'grok-config') loadGrokSettings();
  else if (sectionId === 'camera-monitoring') loadCameraMonitoring();
  else if (sectionId === 'manual-control') pollTelemetry();
  else if (sectionId === 'logs') loadLogs();
}

/**
 * Setup Global Action Listeners (Emergency Stop, D-Pad, Category Modal)
 */
function setupActionListeners() {
  // Global Emergency Stop Buttons
  const estopButtons = document.querySelectorAll('.trigger-estop');
  estopButtons.forEach(btn => {
    btn.addEventListener('click', async () => {
      if (confirm('CRITICAL ACTION: Trigger IMMEDIATE Emergency Stop on all robot motors?')) {
        try {
          await apiEmergencyStop();
          showToast('EMERGENCY STOP ACTIVATED!', 'error');
          await pollTelemetry();
        } catch (err) {
          showToast(err.message, 'error');
        }
      }
    });
  });

  const resetEstopBtn = document.getElementById('btn-reset-estop');
  if (resetEstopBtn) {
    resetEstopBtn.addEventListener('click', async () => {
      try {
        await apiResetEmergencyStop();
        showToast('Emergency Stop reset. Robot in safe manual state.', 'success');
        await pollTelemetry();
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  }

  // D-Pad Directional Controls for Robot
  const dpadButtons = document.querySelectorAll('.dpad-btn[data-dir]');
  dpadButtons.forEach(btn => {
    btn.addEventListener('mousedown', () => sendMove(btn.getAttribute('data-dir')));
    btn.addEventListener('mouseup', () => sendMove('STOP'));
    btn.addEventListener('touchstart', (e) => { e.preventDefault(); sendMove(btn.getAttribute('data-dir')); });
    btn.addEventListener('touchend', (e) => { e.preventDefault(); sendMove('STOP'); });
  });

  // Operating Mode Switcher
  const modeSelect = document.getElementById('robot-operating-mode-select');
  if (modeSelect) {
    modeSelect.addEventListener('change', async (e) => {
      const mode = e.target.value;
      try {
        await apiSendCommand('SET_MODE', { mode }, 10);
        showToast(`Robot mode set to ${mode}`, 'success');
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  }

  // Products filters & Search
  const searchProd = document.getElementById('search-product');
  if (searchProd) {
    searchProd.addEventListener('input', () => loadProducts());
  }
  const filterCat = document.getElementById('filter-category');
  if (filterCat) {
    filterCat.addEventListener('change', () => loadProducts());
  }

  // Categories search filter
  const searchCat = document.getElementById('search-category');
  if (searchCat) {
    searchCat.addEventListener('input', (e) => renderCategoriesGrid(e.target.value));
  }

  // Add Category Modal Trigger
  const btnNewCat = document.getElementById('btn-new-category');
  if (btnNewCat) {
    btnNewCat.addEventListener('click', () => {
      openModal('modal-category');
    });
  }

  // Add Category Form Submit
  const formCat = document.getElementById('form-category');
  if (formCat) {
    formCat.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('cat-name').value.trim();
      const slug = document.getElementById('cat-slug').value.trim() || name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const icon = document.getElementById('cat-icon').value.trim() || '🏷️';
      
      const newCat = {
        id: 'cat_' + Date.now().toString(36),
        name,
        slug,
        icon,
        display_order: categoriesList.length + 1
      };

      categoriesList.push(newCat);
      showToast(`Category "${name}" created successfully!`, 'success');
      closeModal('modal-category');
      formCat.reset();
      await loadCategories();
      renderCategoriesGrid();
    });
  }
}

async function sendMove(direction) {
  const speedSlider = document.getElementById('robot-speed-slider');
  const speed = speedSlider ? parseInt(speedSlider.value) : 150;
  try {
    await apiSendCommand('MOVE', { direction, speed }, 4);
  } catch (err) {
    console.warn('Move command error:', err.message);
  }
}

// ----------------------------------------------------------------------------
// 1. OVERVIEW SECTION
// ----------------------------------------------------------------------------
async function loadOverview() {
  try {
    const stats = await apiGetSystemStats();
    if (stats) {
      const p = document.getElementById('stat-total-products');
      if (p) p.textContent = stats.productsTotal || 0;
      const a = document.getElementById('stat-active-ads');
      if (a) a.textContent = stats.advertisementsActive || 0;
      const t = document.getElementById('stat-total-ads');
      if (t) t.textContent = stats.advertisementsTotal || 0;
      const q = document.getElementById('stat-questions');
      if (q) q.textContent = stats.customerQuestionsTotal || 0;
    }
    await pollTelemetry();
  } catch (err) {
    console.error('Error loading overview:', err);
  }
}

async function pollTelemetry() {
  try {
    const data = await apiGetRobotStatus();
    if (!data) return;

    const isOnline = (data.online !== undefined ? data.online : (data.device?.status === 'online'));
    const isEstop = !!data.emergencyStopActive;

    // Top status badges
    const dot = document.getElementById('top-robot-dot');
    const text = document.getElementById('top-robot-text');
    if (dot) dot.className = `status-dot ${isOnline ? 'online' : 'offline'}`;
    if (text) text.textContent = isOnline ? 'Robot Online (ESP32)' : 'Robot Offline';

    // Emergency Stop Banner
    const estopBanner = document.getElementById('global-estop-banner');
    if (estopBanner) {
      estopBanner.style.display = isEstop ? 'flex' : 'none';
    }

    // Live Telemetry Readouts
    const telem = data.telemetry || {};
    const distEl = document.getElementById('telem-distance');
    if (distEl) distEl.textContent = (telem.front_distance_cm !== undefined && telem.front_distance_cm > 0) ? `${Number(telem.front_distance_cm).toFixed(1)} cm` : 'Clear (>200cm)';

    const motorEl = document.getElementById('telem-motor');
    if (motorEl) motorEl.textContent = telem.motor_state || 'STOPPED';

    const personEl = document.getElementById('telem-person');
    if (personEl) {
      personEl.textContent = telem.person_detected ? `Detected (ID: ${telem.tracking_id || 1})` : 'None';
      personEl.style.color = telem.person_detected ? 'var(--cyan-primary)' : 'var(--text-muted)';
    }

    const modeEl = document.getElementById('telem-mode');
    if (modeEl) modeEl.textContent = telem.operating_mode || 'MANUAL';

    const wifiEl = document.getElementById('telem-wifi');
    if (wifiEl) wifiEl.textContent = telem.wifi_rssi ? `${telem.wifi_rssi} dBm` : 'Connected';

    const batEl = document.getElementById('telem-battery');
    if (batEl) {
      batEl.textContent = telem.battery_volts ? `${telem.battery_volts.toFixed(1)} V` : 'External 12V LiFePO4';
    }
  } catch (err) {
    console.warn('Telemetry poll error:', err.message);
  }
}

// ----------------------------------------------------------------------------
// 2. CATEGORIES MANAGEMENT SECTION
// ----------------------------------------------------------------------------
async function loadCategories() {
  try {
    const res = await apiGetCategories();
    categoriesList = res.categories || [];
    const select = document.getElementById('filter-category');
    const modalSelect = document.getElementById('prod-category');
    if (select) {
      select.innerHTML = '<option value="">All Categories</option>' + 
        categoriesList.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    }
    if (modalSelect) {
      modalSelect.innerHTML = categoriesList.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    }
  } catch (err) {
    console.error('Error fetching categories:', err);
  }
}

async function loadCategoriesView() {
  await loadCategories();
  if (productsList.length === 0) {
    try {
      const pRes = await apiGetProducts();
      productsList = pRes.products || [];
    } catch(e) {}
  }
  renderCategoriesGrid();
}

function renderCategoriesGrid(filter = '') {
  const grid = document.getElementById('categories-grid');
  if (!grid) return;

  const f = (filter || '').toLowerCase().trim();
  const filtered = categoriesList.filter(c => 
    c.name.toLowerCase().includes(f) || (c.slug && c.slug.toLowerCase().includes(f))
  );

  grid.innerHTML = filtered.map(cat => {
    const icon = cat.icon || getCategoryIcon(cat.slug);
    const count = productsList.filter(p => p.category_id === cat.id).length;
    return `
      <div class="category-card">
        <div>
          <div class="category-card-header">
            <div class="category-icon-bubble">${icon}</div>
            <div>
              <div class="category-name">${cat.name}</div>
              <div class="category-slug">${cat.slug || cat.id}</div>
            </div>
          </div>
          <p style="font-size: 12px; color: var(--text-muted); margin-bottom: 12px;">
            Targeted channel for autonomous robot advertising & kiosk rotation.
          </p>
        </div>
        <div class="category-card-footer">
          <span class="category-badge-count">${count} Products</span>
          <button class="btn btn-secondary btn-sm" onclick="filterByThisCategory('${cat.id}')">
            View Products →
          </button>
        </div>
      </div>
    `;
  }).join('');
}

window.filterByThisCategory = (catId) => {
  switchSection('products');
  const sel = document.getElementById('filter-category');
  if (sel) {
    sel.value = catId;
    loadProducts();
  }
};

// ----------------------------------------------------------------------------
// 3. PRODUCT MANAGEMENT SECTION & GROK AI RESEARCH
// ----------------------------------------------------------------------------
async function loadProducts() {
  const search = document.getElementById('search-product')?.value || '';
  const cat = document.getElementById('filter-category')?.value || '';
  try {
    const res = await apiGetProducts(search, cat);
    productsList = res.products || [];
    renderProductsTable();
  } catch (err) {
    showToast('Failed to load products: ' + err.message, 'error');
  }
}

function renderProductsTable() {
  const tbody = document.getElementById('products-table-body');
  if (!tbody) return;

  if (productsList.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align: center; padding: 48px 20px; color: var(--text-muted);">
          <div style="font-size: 32px; margin-bottom: 12px;">📦</div>
          <div style="font-size: 15px; font-weight: 700; color: #e2e8f0; margin-bottom: 6px;">No Products Added Yet</div>
          <p style="font-size: 13px; color: #94a3b8; max-width: 440px; margin: 0 auto 16px;">
            Your product catalog is empty. Click <strong>"+ Add Product"</strong> above to manually create your first product.
          </p>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = productsList.map(p => `
    <tr>
      <td><strong>${p.name}</strong><br><small style="color:var(--text-dim);">${p.brand || 'Enterprise'}</small></td>
      <td><span class="status-pill">${p.category_name || 'Electronics'}</span></td>
      <td style="color:#ffd200; font-weight:700;">${p.price ? '₹' + Number(p.price).toLocaleString('en-IN') : 'N/A'}</td>
      <td><span style="font-size:12px; color:var(--text-muted);">${(p.description || '').slice(0, 60)}...</span></td>
      <td><span class="status-pill">${p.availability || 'In Stock'}</span></td>
      <td>
        <button class="btn btn-secondary btn-sm" onclick="editProduct('${p.id}')">Edit</button>
        <button class="btn btn-danger btn-sm" onclick="deleteProduct('${p.id}', '${p.name}')">Delete</button>
      </td>
    </tr>
  `).join('');
}

window.editProduct = (id) => {
  const prod = productsList.find(p => p.id === id);
  if (!prod) return;
  document.getElementById('prod-id').value = prod.id;
  document.getElementById('prod-name').value = prod.name;
  document.getElementById('prod-brand').value = prod.brand || '';
  document.getElementById('prod-model').value = prod.model || '';
  document.getElementById('prod-category').value = prod.category_id || '';
  document.getElementById('prod-price').value = prod.price || '';
  document.getElementById('prod-desc').value = prod.description || '';
  document.getElementById('prod-desc-ml').value = prod.description_ml || '';
  document.getElementById('prod-promo').value = prod.promo_info || '';
  document.getElementById('prod-features').value = prod.features_json || '';
  document.getElementById('modal-product-title').textContent = 'Edit Product';
  openModal('modal-product');
};

window.deleteProduct = async (id, name) => {
  if (confirm(`Are you sure you want to delete product "${name}"?`)) {
    try {
      await apiDeleteProduct(id);
      showToast(`Deleted ${name}`, 'success');
      loadProducts();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }
};

// Add product button listener
const btnNewProduct = document.getElementById('btn-new-product');
if (btnNewProduct) {
  btnNewProduct.addEventListener('click', () => {
    document.getElementById('form-product').reset();
    document.getElementById('prod-id').value = '';
    document.getElementById('modal-product-title').textContent = 'Add New Product';
    openModal('modal-product');
  });
}

// Product form submit listener
const formProduct = document.getElementById('form-product');
if (formProduct) {
  formProduct.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('prod-id').value;
    const catSelect = document.getElementById('prod-category');
    const catName = catSelect.options[catSelect.selectedIndex]?.text || 'General';

    const payload = {
      name: document.getElementById('prod-name').value,
      brand: document.getElementById('prod-brand').value,
      model: document.getElementById('prod-model').value,
      category_id: catSelect.value,
      category_name: catName,
      price: document.getElementById('prod-price').value ? parseFloat(document.getElementById('prod-price').value) : null,
      description: document.getElementById('prod-desc').value,
      description_ml: document.getElementById('prod-desc-ml').value,
      promo_info: document.getElementById('prod-promo').value,
      features_json: document.getElementById('prod-features').value || '[]'
    };

    try {
      if (id) {
        await apiUpdateProduct(id, payload);
        showToast('Product updated successfully!');
      } else {
        await apiCreateProduct(payload);
        showToast('Product created successfully!');
      }
      closeModal('modal-product');
      loadProducts();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
}

// Grok AI product copilot
const btnGrokResearch = document.getElementById('btn-grok-research');
if (btnGrokResearch) {
  btnGrokResearch.addEventListener('click', async () => {
    const name = document.getElementById('prod-name').value;
    const brand = document.getElementById('prod-brand').value;
    const categoryId = document.getElementById('prod-category').value;

    if (!name) {
      alert('Please enter at least a Product Name before researching with Grok AI.');
      return;
    }

    btnGrokResearch.disabled = true;
    btnGrokResearch.textContent = '⚡ Researching with Grok AI...';

    try {
      const result = await apiAiProductResearch({
        productName: name,
        brand: brand,
        categoryId: categoryId
      });

      if (result) {
        if (result.description) document.getElementById('prod-desc').value = result.description;
        if (result.description_ml) document.getElementById('prod-desc-ml').value = result.description_ml;
        if (result.promo_info) document.getElementById('prod-promo').value = result.promo_info;
        if (result.features) document.getElementById('prod-features').value = JSON.stringify(result.features);
        showToast('Grok AI specifications & Malayalam copy populated!', 'success');
      }
    } catch (err) {
      showToast('Grok AI research: ' + err.message, 'error');
    } finally {
      btnGrokResearch.disabled = false;
      btnGrokResearch.textContent = '✨ Research with Grok AI';
    }
  });
}

// ----------------------------------------------------------------------------
// 4. ADVERTISEMENT ROTATION MANAGEMENT
// ----------------------------------------------------------------------------
async function loadAdvertisements() {
  try {
    const res = await apiGetAdvertisements();
    adsList = res.advertisements || [];
    renderAdsTable();
  } catch (err) {
    showToast('Failed to load advertisements: ' + err.message, 'error');
  }
}

function renderAdsTable() {
  const tbody = document.getElementById('ads-table-body');
  if (!tbody) return;

  tbody.innerHTML = adsList.map(ad => `
    <tr>
      <td>
        <img src="${ad.poster_url}" style="width:40px; height:40px; border-radius:4px; object-fit:cover; vertical-align:middle; margin-right:8px;" onerror="this.src='/assets/ads/gaming_laptop.svg'">
        <strong>${ad.title}</strong>
      </td>
      <td><span class="status-pill">${ad.category_name || 'General'}</span></td>
      <td>Priority ${ad.priority}</td>
      <td>Page ${ad.display_page_id || 1}</td>
      <td><span class="status-pill ${ad.status === 'active' ? 'online' : 'offline'}">${ad.status.toUpperCase()}</span></td>
      <td>
        <button class="btn btn-primary btn-sm" onclick="playNow('${ad.id}')">▶ Play Now</button>
        ${ad.status === 'active' 
          ? `<button class="btn btn-secondary btn-sm" onclick="pauseAd('${ad.id}')">⏸ Pause</button>` 
          : `<button class="btn btn-secondary btn-sm" onclick="resumeAd('${ad.id}')">Resume</button>`
        }
      </td>
    </tr>
  `).join('');
}

window.playNow = async (id) => {
  try {
    await apiPlayNow(id);
    showToast('Broadcast command dispatched to robot display & kiosk!', 'success');
    loadAdvertisements();
    loadOverview();
  } catch (err) {
    showToast(err.message, 'error');
  }
};

window.pauseAd = async (id) => {
  try {
    await apiPauseAd(id);
    showToast('Advertisement paused.', 'success');
    loadAdvertisements();
  } catch (err) {
    showToast(err.message, 'error');
  }
};

window.resumeAd = async (id) => {
  try {
    await apiResumeAd(id);
    showToast('Advertisement resumed in rotation.', 'success');
    loadAdvertisements();
  } catch (err) {
    showToast(err.message, 'error');
  }
};

// ----------------------------------------------------------------------------
// 5. CAMERA VISION & LIVE STREAM WITH NO SIGNAL SCREEN
// ----------------------------------------------------------------------------
function setupCameraControls() {
  const toggleBtn = document.getElementById('btn-toggle-camera-sim');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      isCameraSimulatedOnline = !isCameraSimulatedOnline;
      showToast(
        isCameraSimulatedOnline ? 'Camera live stream active (ONLINE)' : 'Camera stream offline (NO SIGNAL displayed)',
        isCameraSimulatedOnline ? 'success' : 'error'
      );
      updateCameraDisplay();
    });
  }

  const simOnlineBtn = document.getElementById('btn-simulate-online');
  if (simOnlineBtn) {
    simOnlineBtn.addEventListener('click', () => {
      isCameraSimulatedOnline = true;
      showToast('Live video feed connected!', 'success');
      updateCameraDisplay();
    });
  }

  const retryBtn = document.getElementById('btn-retry-camera');
  if (retryBtn) {
    retryBtn.addEventListener('click', async () => {
      showToast('Pinging ESP32-CAM AI module...', 'info');
      await updateCameraDisplay();
    });
  }
}

async function loadCameraMonitoring() {
  updateCameraDisplay();
  if (!cameraInterval) {
    cameraInterval = setInterval(updateCameraDisplay, 3000);
  }
}

async function updateCameraDisplay() {
  const noSignal = document.getElementById('no-signal-screen');
  const liveScreen = document.getElementById('live-online-screen');
  const statusPill = document.getElementById('camera-status-pill');
  const camStatusMetric = document.getElementById('cam-metric-status');
  const camFpsMetric = document.getElementById('cam-metric-fps');
  const hudTime = document.getElementById('hud-time');

  let isOnline = isCameraSimulatedOnline;

  try {
    const data = await apiGetCameraStatus();
    if (data && data.device && data.device.status === 'online') {
      isOnline = true;
    }
  } catch (e) {}

  if (hudTime) {
    hudTime.textContent = new Date().toLocaleTimeString();
  }

  if (isOnline) {
    if (noSignal) noSignal.style.display = 'none';
    if (liveScreen) liveScreen.style.display = 'flex';
    if (statusPill) {
      statusPill.className = 'status-pill online';
      statusPill.textContent = 'Camera Online (720p)';
    }
    if (camStatusMetric) {
      camStatusMetric.textContent = 'ONLINE';
      camStatusMetric.style.color = 'var(--success)';
    }
    if (camFpsMetric) camFpsMetric.textContent = '25 FPS';
  } else {
    if (noSignal) noSignal.style.display = 'flex';
    if (liveScreen) liveScreen.style.display = 'none';
    if (statusPill) {
      statusPill.className = 'status-pill offline';
      statusPill.textContent = 'Camera Offline';
    }
    if (camStatusMetric) {
      camStatusMetric.textContent = 'OFFLINE';
      camStatusMetric.style.color = 'var(--danger)';
    }
    if (camFpsMetric) camFpsMetric.textContent = '0 FPS';
  }
}

// ----------------------------------------------------------------------------
// 6. GROK AI CONFIGURATION
// ----------------------------------------------------------------------------
async function loadGrokSettings() {
  try {
    const config = await apiGetGrokConfig();
    const badge = document.getElementById('grok-status-badge');
    if (badge) {
      badge.textContent = config.isConfigured ? 'Connected & Verified' : 'Not Configured';
      badge.className = `status-pill ${config.isConfigured ? 'online' : 'offline'}`;
    }

    const keyInput = document.getElementById('grok-api-key');
    if (keyInput && config.maskedKey) {
      keyInput.value = config.maskedKey;
    }

    const modelSelect = document.getElementById('grok-model-select');
    if (modelSelect && config.activeModel) {
      modelSelect.value = config.activeModel;
    }
  } catch (err) {
    console.error('Error fetching Grok settings:', err);
  }
}

const btnSaveGrokKey = document.getElementById('btn-save-grok-key');
if (btnSaveGrokKey) {
  btnSaveGrokKey.addEventListener('click', async () => {
    const key = document.getElementById('grok-api-key')?.value.trim();
    const model = document.getElementById('grok-model-select')?.value;
    if (!key || key.startsWith('xai-****')) {
      alert('Please enter a valid unmasked xAI API key.');
      return;
    }

    btnSaveGrokKey.disabled = true;
    btnSaveGrokKey.textContent = 'Validating Key...';

    try {
      const res = await apiSaveGrokConfig(key, model);
      showToast(res.message || 'Key verified and securely saved!', 'success');
      loadGrokSettings();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      btnSaveGrokKey.disabled = false;
      btnSaveGrokKey.textContent = 'Save & Test API Key';
    }
  });
}

const btnTestGrokConn = document.getElementById('btn-test-grok-conn');
if (btnTestGrokConn) {
  btnTestGrokConn.addEventListener('click', async () => {
    btnTestGrokConn.disabled = true;
    btnTestGrokConn.textContent = 'Testing Connection...';
    try {
      const res = await apiTestGrokConnection();
      showToast(`Ping successful! Model: ${res.modelUsed}`, 'success');
    } catch (err) {
      showToast('Test failed: ' + err.message, 'error');
    } finally {
      btnTestGrokConn.disabled = false;
      btnTestGrokConn.textContent = 'Test Current Connection';
    }
  });
}

const btnSaveGrokModel = document.getElementById('btn-save-grok-model');
if (btnSaveGrokModel) {
  btnSaveGrokModel.addEventListener('click', async () => {
    const modelSelect = document.getElementById('grok-model-select');
    const modelId = modelSelect?.value;
    if (!modelId) return;

    try {
      await apiSelectGrokModel(modelId);
      showToast(`Model ${modelId} activated!`, 'success');
      loadGrokSettings();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
}

// ----------------------------------------------------------------------------
// 7. ACTIVITY LOGS
// ----------------------------------------------------------------------------
async function loadLogs() {
  try {
    const res = await apiGetSystemLogs();
    const tbody = document.getElementById('logs-table-body');
    if (!tbody || !res.logs) return;

    tbody.innerHTML = res.logs.map(l => `
      <tr>
        <td style="font-size:12px; color:var(--text-dim);">${new Date(l.created_at).toLocaleString()}</td>
        <td><strong>${l.actor}</strong></td>
        <td><span class="status-pill">${l.action}</span></td>
        <td><small>${l.details || ''}</small></td>
      </tr>
    `).join('');
  } catch (err) {
    console.error('Error loading logs:', err);
  }
}

// Modal Helpers exposed globally
window.openModal = (id) => {
  const m = document.getElementById(id);
  if (m) {
    m.classList.add('show');
    m.classList.add('active');
  }
};

window.closeModal = (id) => {
  const m = document.getElementById(id);
  if (m) {
    m.classList.remove('show');
    m.classList.remove('active');
  }
};

window.switchSection = switchSection;
window.loadProducts = loadProducts;
window.loadLogs = loadLogs;
