// ============================================================================
// AI ADVERTISEMENT ROBOT - COMPLETE ADMIN DASHBOARD CONTROLLER
// Handles Products, Advertisements, Grok AI Settings, Telemetry, and Motor Control
// ============================================================================

import {
  apiCheckSession, apiLogout, apiGetProducts, apiGetCategories, apiCreateProduct,
  apiUpdateProduct, apiDeleteProduct, apiAiProductResearch, apiGetAdvertisements,
  apiCreateAdvertisement, apiUpdateAdvertisement, apiDeleteAdvertisement, apiPlayNow,
  apiPauseAd, apiResumeAd, apiGetAdHistory, apiGetGrokConfig, apiSaveGrokConfig,
  apiTestGrokConnection, apiGetGrokModels, apiSelectGrokModel, apiGetRobotStatus,
  apiSendCommand, apiEmergencyStop, apiResetEmergencyStop, apiGetCameraStatus,
  apiGetSystemStats, apiGetSystemLogs
} from './api.js';

// Application State
let activeSection = 'overview';
let productsList = [];
let categoriesList = [];
let adsList = [];
let telemetryInterval = null;

// Initialize on DOM load
window.addEventListener('DOMContentLoaded', async () => {
  // 1. Verify authenticated session
  try {
    const session = await apiCheckSession();
    if (!session || !session.authenticated) {
      window.location.href = 'login.html';
      return;
    }
  } catch (e) {
    window.location.href = 'login.html';
    return;
  }

  // 2. Setup navigation listeners
  setupNavigation();
  setupActionListeners();

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

  const logoutBtn = document.getElementById('btn-logout');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      await apiLogout();
      window.location.href = 'login.html';
    });
  }
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
  else if (sectionId === 'products') loadProducts();
  else if (sectionId === 'advertisements') loadAdvertisements();
  else if (sectionId === 'grok-config') loadGrokSettings();
  else if (sectionId === 'robot-monitoring') loadRobotMonitoring();
  else if (sectionId === 'camera-monitoring') loadCameraMonitoring();
  else if (sectionId === 'manual-control') pollTelemetry();
  else if (sectionId === 'logs') loadLogs();
}

/**
 * Setup Global Action Listeners (Emergency Stop, Manual D-Pad)
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
      document.getElementById('stat-total-products').textContent = stats.productsTotal || 0;
      document.getElementById('stat-active-ads').textContent = stats.advertisementsActive || 0;
      document.getElementById('stat-total-ads').textContent = stats.advertisementsTotal || 0;
      document.getElementById('stat-questions').textContent = stats.customerQuestionsTotal || 0;
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

    const isOnline = data.device.status === 'online';
    const isEstop = data.emergencyStopActive;

    // Top status badges
    const dot = document.getElementById('top-robot-dot');
    const text = document.getElementById('top-robot-text');
    if (dot) dot.className = `status-dot ${isOnline ? 'online' : 'offline'}`;
    if (text) text.textContent = isOnline ? 'Robot Online' : 'Robot Offline';

    // Emergency Stop Banner
    const estopBanner = document.getElementById('global-estop-banner');
    if (estopBanner) {
      estopBanner.style.display = isEstop ? 'flex' : 'none';
    }

    // Live Telemetry Readouts
    const telem = data.telemetry;
    const distEl = document.getElementById('telem-distance');
    if (distEl) distEl.textContent = telem.front_distance_cm > 0 ? `${telem.front_distance_cm.toFixed(1)} cm` : 'Clear (>200cm)';

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
// 2. PRODUCT MANAGEMENT SECTION & GROK AI RESEARCH
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
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:30px; color:var(--text-muted);">No products found. Add your first product above.</td></tr>';
    return;
  }

  tbody.innerHTML = productsList.map(p => `
    <tr>
      <td><strong>${p.name}</strong><br><small style="color:var(--text-dim);">${p.brand || 'No brand'}</small></td>
      <td><span class="status-pill">${p.category_name || 'General'}</span></td>
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

// Expose edit & delete to window for inline onclick handlers
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
  if (confirm(`Are you sure you want to delete "${name}"?`)) {
    try {
      await apiDeleteProduct(id);
      showToast('Product deleted successfully', 'success');
      loadProducts();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }
};

// Bind Product Form & Grok AI Research
const btnNewProduct = document.getElementById('btn-new-product');
if (btnNewProduct) {
  btnNewProduct.addEventListener('click', () => {
    document.getElementById('form-product').reset();
    document.getElementById('prod-id').value = '';
    document.getElementById('modal-product-title').textContent = 'Add New Product';
    openModal('modal-product');
  });
}

const formProduct = document.getElementById('form-product');
if (formProduct) {
  formProduct.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('prod-id').value;
    const payload = {
      name: document.getElementById('prod-name').value,
      brand: document.getElementById('prod-brand').value,
      model: document.getElementById('prod-model').value,
      category_id: document.getElementById('prod-category').value,
      price: document.getElementById('prod-price').value,
      description: document.getElementById('prod-desc').value,
      description_ml: document.getElementById('prod-desc-ml').value,
      promo_info: document.getElementById('prod-promo').value,
      features_json: document.getElementById('prod-features').value || '[]'
    };

    try {
      if (id) {
        await apiUpdateProduct(id, payload);
        showToast('Product updated successfully', 'success');
      } else {
        await apiCreateProduct(payload);
        showToast('Product created successfully', 'success');
      }
      closeModal('modal-product');
      loadProducts();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
}

// Grok AI Product Research trigger inside product modal
const btnGrokResearch = document.getElementById('btn-grok-research');
if (btnGrokResearch) {
  btnGrokResearch.addEventListener('click', async () => {
    const name = document.getElementById('prod-name').value;
    const brand = document.getElementById('prod-brand').value;
    const catSelect = document.getElementById('prod-category');
    const catName = catSelect.options[catSelect.selectedIndex]?.text || '';

    if (!name) {
      showToast('Please enter a Product Name before requesting AI research.', 'error');
      return;
    }

    btnGrokResearch.disabled = true;
    btnGrokResearch.textContent = '⏳ Researching with Grok AI...';

    try {
      const res = await apiAiProductResearch({ productName: name, brand, categoryName: catName });
      if (res && res.data) {
        const d = res.data;
        if (d.description) document.getElementById('prod-desc').value = d.description;
        if (d.description_ml) document.getElementById('prod-desc-ml').value = d.description_ml;
        if (d.suggested_promo) document.getElementById('prod-promo').value = d.suggested_promo;
        if (d.features) document.getElementById('prod-features').value = JSON.stringify(d.features);
        showToast(`AI Research completed using ${res.modelUsed}! Please review and approve.`, 'success');
      }
    } catch (err) {
      showToast('Grok Research failed: ' + err.message, 'error');
    } finally {
      btnGrokResearch.disabled = false;
      btnGrokResearch.textContent = '✨ Research with Grok AI';
    }
  });
}

// ----------------------------------------------------------------------------
// 3. ADVERTISEMENT MANAGEMENT SECTION
// ----------------------------------------------------------------------------
async function loadAdvertisements() {
  try {
    const res = await apiGetAdvertisements();
    adsList = res.advertisements || [];
    renderAdvertisementsTable();
  } catch (err) {
    showToast('Failed to load advertisements: ' + err.message, 'error');
  }
}

function renderAdvertisementsTable() {
  const tbody = document.getElementById('ads-table-body');
  if (!tbody) return;

  if (adsList.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:30px; color:var(--text-muted);">No advertisements created yet.</td></tr>';
    return;
  }

  tbody.innerHTML = adsList.map(a => `
    <tr>
      <td><strong>${a.title}</strong></td>
      <td>${a.product_name || 'Generic Ad'}</td>
      <td><span class="status-pill">Page ${a.display_page_id || 1}</span></td>
      <td><span class="status-pill">${a.priority === 3 ? '🔴 Urgent' : a.priority === 2 ? '🟡 High' : '🔵 Normal'}</span></td>
      <td>
        <span class="status-pill ${a.status === 'active' ? 'online' : ''}" style="color:${a.status === 'active' ? 'var(--cyan-primary)' : 'inherit'};">
          ${a.status.toUpperCase()}
        </span>
      </td>
      <td>
        <button class="btn btn-primary btn-sm" onclick="playAdNow('${a.id}')">▶ Play Now</button>
        ${a.status === 'paused' ? 
          `<button class="btn btn-secondary btn-sm" onclick="resumeAd('${a.id}')">Resume</button>` : 
          `<button class="btn btn-secondary btn-sm" onclick="pauseAd('${a.id}')">Pause</button>`}
        <button class="btn btn-danger btn-sm" onclick="deleteAd('${a.id}', '${a.title}')">Delete</button>
      </td>
    </tr>
  `).join('');
}

window.playAdNow = async (id) => {
  try {
    await apiPlayNow(id);
    showToast('Manual Play Now activated! Broadcast live on DWIN & Kiosk.', 'success');
    loadAdvertisements();
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
    showToast('Advertisement resumed in schedule.', 'success');
    loadAdvertisements();
  } catch (err) {
    showToast(err.message, 'error');
  }
};

window.deleteAd = async (id, title) => {
  if (confirm(`Delete advertisement "${title}"?`)) {
    try {
      await apiDeleteAdvertisement(id);
      showToast('Advertisement deleted.', 'success');
      loadAdvertisements();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }
};

// ----------------------------------------------------------------------------
// 4. GROK AI CONFIGURATION SECTION
// ----------------------------------------------------------------------------
async function loadGrokSettings() {
  try {
    const config = await apiGetGrokConfig();
    const maskedEl = document.getElementById('grok-masked-key');
    const statusEl = document.getElementById('grok-status-badge');
    const lastTestEl = document.getElementById('grok-last-tested');

    if (config.isConfigured) {
      if (maskedEl) maskedEl.textContent = config.maskedKey || 'Configured';
      if (statusEl) {
        statusEl.className = 'status-pill online';
        statusEl.textContent = 'API Configured';
      }
    } else {
      if (maskedEl) maskedEl.textContent = 'Not configured';
      if (statusEl) {
        statusEl.className = 'status-pill offline';
        statusEl.textContent = 'No Key';
      }
    }

    if (lastTestEl) lastTestEl.textContent = config.lastTestedAt ? new Date(config.lastTestedAt).toLocaleString() : 'Never tested';

    // Load supported models
    await loadGrokModels(config.activeModel);
  } catch (err) {
    showToast('Failed to load Grok settings: ' + err.message, 'error');
  }
}

async function loadGrokModels(currentModelId) {
  try {
    const res = await apiGetGrokModels();
    const modelSelect = document.getElementById('grok-model-select');
    if (!modelSelect || !res.models) return;

    modelSelect.innerHTML = res.models.map(m => `
      <option value="${m.id}" ${m.id === (res.activeModel || currentModelId) ? 'selected' : ''}>
        ${m.name || m.id} (${m.id})
      </option>
    `).join('');
  } catch (err) {
    console.error('Error loading models:', err);
  }
}

// Bind Save Key Button
const btnSaveGrokKey = document.getElementById('btn-save-grok-key');
if (btnSaveGrokKey) {
  btnSaveGrokKey.addEventListener('click', async () => {
    const keyInput = document.getElementById('grok-api-key-input');
    const modelSelect = document.getElementById('grok-model-select');
    const key = keyInput?.value.trim();
    const modelId = modelSelect?.value || 'grok-2-1212';

    if (!key) {
      showToast('Please enter a Grok API key.', 'error');
      return;
    }

    btnSaveGrokKey.disabled = true;
    btnSaveGrokKey.textContent = '⏳ Validating with xAI...';

    try {
      const res = await apiSaveGrokConfig(key, modelId);
      showToast(res.message || 'Grok API Key validated and saved!', 'success');
      keyInput.value = '';
      loadGrokSettings();
    } catch (err) {
      showToast('Validation failed: ' + err.message, 'error');
    } finally {
      btnSaveGrokKey.disabled = false;
      btnSaveGrokKey.textContent = 'Save and Test API Key';
    }
  });
}

// Bind Test Connection Button
const btnTestGrokConn = document.getElementById('btn-test-grok-conn');
if (btnTestGrokConn) {
  btnTestGrokConn.addEventListener('click', async () => {
    btnTestGrokConn.disabled = true;
    btnTestGrokConn.textContent = 'Testing...';
    try {
      const res = await apiTestGrokConnection();
      showToast(res.message, 'success');
      loadGrokSettings();
    } catch (err) {
      showToast('Test failed: ' + err.message, 'error');
    } finally {
      btnTestGrokConn.disabled = false;
      btnTestGrokConn.textContent = 'Test API Connection';
    }
  });
}

// Bind Select Model Button
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
// 5. ACTIVITY LOGS
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

// Modal Helpers
function openModal(id) {
  const m = document.getElementById(id);
  if (m) m.classList.add('show');
}

function closeModal(id) {
  const m = document.getElementById(id);
  if (m) m.classList.remove('show');
}

window.closeModal = closeModal;
