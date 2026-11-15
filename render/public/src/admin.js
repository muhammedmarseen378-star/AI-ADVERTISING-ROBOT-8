// ============================================================================
// AI ADVERTISEMENT ROBOT - COMPLETE ADMIN DASHBOARD CONTROLLER
// Handles Categories, Products, Advertisements, Grok AI, Camera Vision & Telemetry
// ============================================================================

import {
  apiCheckSession, apiLogout, apiGetProducts, apiGetCategories, apiCreateCategory,
  apiUpdateCategory, apiDeleteCategory, apiCreateProduct, apiUpdateProduct, apiDeleteProduct,
  apiAiProductResearch, apiGetAdvertisements, apiCreateAdvertisement, apiUpdateAdvertisement,
  apiDeleteAdvertisement, apiPlayNow, apiPauseAd, apiResumeAd, apiGetSchedules,
  apiCreateSchedule, apiUpdateSchedule, apiDeleteSchedule, apiToggleSchedule,
  apiGetGrokConfig, apiSaveGrokConfig, apiTestGrokConnection, apiGetGrokModels,
  apiSelectGrokModel, apiGetRobotStatus, apiSendCommand, apiEmergencyStop,
  apiResetEmergencyStop, apiGetCameraStatus, apiGetSystemStats, apiGetSystemLogs, getAdminToken,
  syncLocalDataToCloud, isDummyItem
} from './api.js';

// Application State
let activeSection = 'overview';
let productsList = [];
let categoriesList = [];
let adsList = [];
let schedulesList = [];
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

  // 2. Actively purge only legacy template dummy items from previous browser storage
  try {
    localStorage.removeItem('cached_active_ad');
    const storedProds = localStorage.getItem('custom_products');
    if (storedProds) {
      const parsed = JSON.parse(storedProds);
      const cleaned = Array.isArray(parsed) ? parsed.filter(p => !isDummyItem(p)) : [];
      localStorage.setItem('custom_products', JSON.stringify(cleaned));
    }
  } catch (e) {}

  // 3. Immediately trigger multi-device bi-directional sync (Laptop <-> Mobile <-> Cloud)
  setTimeout(syncLocalDataToCloud, 100);

  // 4. Setup navigation listeners & actions
  setupNavigation();
  setupActionListeners();
  setupCameraControls();

  // 5. Load initial dashboard data
  await loadCategories();
  await loadOverview();

  // 6. Start polling for real robot telemetry (every 3 seconds)
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
 * Navigation Router with Mobile Drawer Support
 */
function setupNavigation() {
  const menuToggle = document.getElementById('mobile-menu-toggle');
  const menuClose = document.getElementById('mobile-menu-close');
  const sidebarOverlay = document.getElementById('sidebar-overlay');
  const sidebar = document.querySelector('.sidebar');

  function openMobileMenu() {
    if (sidebar) sidebar.classList.add('mobile-open');
    if (sidebarOverlay) sidebarOverlay.classList.add('active');
    document.body.classList.add('menu-open');
  }

  function closeMobileMenu() {
    if (sidebar) sidebar.classList.remove('mobile-open');
    if (sidebarOverlay) sidebarOverlay.classList.remove('active');
    document.body.classList.remove('menu-open');
  }

  if (menuToggle) menuToggle.addEventListener('click', openMobileMenu);
  if (menuClose) menuClose.addEventListener('click', closeMobileMenu);
  if (sidebarOverlay) sidebarOverlay.addEventListener('click', closeMobileMenu);

  document.querySelectorAll('.nav-link[data-section]').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const target = link.getAttribute('data-section');
      switchSection(target);
      if (window.innerWidth <= 900) {
        closeMobileMenu();
      }
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
  else if (sectionId === 'schedule') loadSchedulesView();
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

  // Schedule Duration Mode change listener (Full Time vs Custom Rotation)
  const schedDurMode = document.getElementById('sched-duration-mode');
  const schedDurInput = document.getElementById('sched-duration');
  const schedDurHelp = document.getElementById('sched-duration-help');
  if (schedDurMode) {
    schedDurMode.addEventListener('change', () => {
      if (schedDurMode.value === 'custom') {
        if (schedDurInput) {
          schedDurInput.style.display = 'block';
          if (!parseInt(schedDurInput.value)) schedDurInput.value = '30';
        }
        if (schedDurHelp) schedDurHelp.textContent = 'Enter custom rotation interval in seconds';
      } else if (schedDurMode.value === 'full_time') {
        if (schedDurInput) {
          schedDurInput.style.display = 'none';
          schedDurInput.value = '0';
        }
        if (schedDurHelp) schedDurHelp.textContent = 'Poster stays on screen full time until completion';
      } else {
        if (schedDurInput) {
          schedDurInput.style.display = 'none';
          schedDurInput.value = schedDurMode.value;
        }
        if (schedDurHelp) schedDurHelp.textContent = `Rotates to next ad every ${schedDurMode.value} seconds`;
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

  // Quick Add Category from Product Modal
  const btnQuickCat = document.getElementById('btn-quick-cat-modal');
  if (btnQuickCat) {
    btnQuickCat.addEventListener('click', () => {
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
        name,
        slug,
        icon,
        display_order: categoriesList.length + 1
      };

      try {
        await apiCreateCategory(newCat);
        showToast(`Category "${name}" created successfully!`, 'success');
        closeModal('modal-category');
        formCat.reset();
        await loadCategories();
        renderCategoriesGrid();
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  }

  // New Schedule Button Trigger
  const btnNewSched = document.getElementById('btn-new-schedule');
  if (btnNewSched) {
    btnNewSched.addEventListener('click', () => {
      openCreateScheduleModal();
    });
  }

  // Schedule Form Submit
  const formSched = document.getElementById('form-schedule');
  if (formSched) {
    formSched.addEventListener('submit', async (e) => {
      e.preventDefault();
      await handleScheduleSubmit();
    });
  }
  // Initialize Category Symbol Picker Palette
  initCategorySymbolPicker();
}

const CATEGORY_SYMBOL_GROUPS = {
  'All': [
    '🏷️', '🛍️', '🛒', '📦', '🎁', '💎', '🏬', '🏢', '💳', '💰', '💵', '🪙', '🧾', '🏪', '🪪', '⚖️', '✨', '🌟',
    '💻', '📱', '⚡', '🎧', '📷', '📺', '🎮', '🤖', '🔋', '⌨️', '🖱️', '🖨️', '⌚', '🎙️', '📻', '📹', '🕹️', '🔌', '📡', '💾', '💿', '🖥️', '🖲️', '📟', '💡',
    '🍔', '🍕', '☕', '🍹', '🍰', '🍦', '🥗', '🍱', '🍜', '🍎', '🍞', '🍿', '🍩', '🍫', '🍇', '🍉', '🍓', '🥑', '🥩', '🍗', '🥪', '🌮', '🍣', '🥟', '🍵', '🍺', '🍷', '🧃',
    '👗', '👟', '👕', '👠', '💄', '💇', '💍', '👜', '👓', '🧢', '👔', '🧥', '👖', '🩳', '👢', '👡', '🧦', '🧤', '🧣', '🪞', '🧴', '🪮', '💅', '🌂',
    '💊', '🩺', '💪', '🏋️', '🧘', '🚴', '⚽', '🏆', '🌿', '🩹', '💉', '🧬', '🩸', '🏥', '🚑', '🦷', '🧼', '🪥', '🥊', '🏊', '🎾', '🏀', '🏸',
    '🚗', '🛵', '🚲', '✈️', '🚀', '🚢', '⛽', '🏖️', '🚆', '🏎️', '🏍️', '🚙', '🚚', '🚜', '🚁', '⛵', '🚊', '🚖', '🚨', '🚦', '🗺️',
    '🏠', '🛋️', '🔑', '🧰', '🪴', '🍳', '🧹', '🚪', '🛏️', '🚿', '🪟', '🏡', '🏗️', '🏰', '🧱', '🔨', '🪚', '🪜',
    '🎓', '📚', '🔧', '💼', '🎨', '🎵', '📝', '📊', '📈', '📌', '🔒', '🛡️', '📋', '✉️', '📯', '🔍', '🧭', '🛎️', '🧑‍🏫', '🧑‍💻', '🧑‍🍳', '🧑‍🔧',
    '🎲', '🎯', '🎳', '🎬', '🎤', '🎪', '🎟️', '🎫', '🎭', '🎻', '🎸', '🎹', '🥁', '🔮', '🪄', '🧸',
    '🐶', '🐱', '🐠', '🦜', '🌾', '🌻', '🌲', '🌴', '🍀', '🐾', '🐮', '🐴', '🐑', '🐝', '🥕', '🍅', '🥔'
  ],
  'Retail': ['🏷️', '🛍️', '🛒', '📦', '🎁', '💎', '🏬', '🏢', '💳', '💰', '💵', '🪙', '🧾', '🏪', '🪪', '⚖️', '✨', '🌟'],
  'Tech': ['💻', '📱', '⚡', '🎧', '📷', '📺', '🎮', '🤖', '🔋', '⌨️', '🖱️', '🖨️', '⌚', '🎙️', '📻', '📹', '🕹️', '🔌', '📡', '💾', '💿', '🖥️', '🖲️', '📟', '💡'],
  'Food': ['🍔', '🍕', '☕', '🍹', '🍰', '🍦', '🥗', '🍱', '🍜', '🍎', '🍞', '🍿', '🍩', '🍫', '🍇', '🍉', '🍓', '🥑', '🥩', '🍗', '🥪', '🌮', '🍣', '🥟', '🍵', '🍺', '🍷', '🧃'],
  'Fashion': ['👗', '👟', '👕', '👠', '💄', '💇', '💍', '👜', '👓', '🧢', '👔', '🧥', '👖', '🩳', '👢', '👡', '🧦', '🧤', '🧣', '🪞', '🧴', '🪮', '💅', '🌂'],
  'Health': ['💊', '🩺', '💪', '🏋️', '🧘', '🚴', '⚽', '🏆', '🌿', '🩹', '💉', '🧬', '🩸', '🏥', '🚑', '🦷', '🧼', '🪥', '🥊', '🏊', '🎾', '🏀', '🏸'],
  'Auto': ['🚗', '🛵', '🚲', '✈️', '🚀', '🚢', '⛽', '🏖️', '🚆', '🏎️', '🏍️', '🚙', '🚚', '🚜', '🚁', '⛵', '🚊', '🚖', '🚨', '🚦', '🗺️'],
  'Home': ['🏠', '🛋️', '💡', '🔑', '🧰', '🪴', '🍳', '🧹', '🚪', '🛏️', '🚿', '🪟', '🏡', '🏗️', '🏰', '🧱', '🔨', '🪚', '🪜'],
  'Services': ['🎓', '📚', '🔧', '💼', '🎨', '🎵', '📝', '📊', '📈', '📌', '🔒', '🛡️', '📋', '✉️', '📯', '🔍', '🧭', '🛎️', '🧑‍🏫', '🧑‍💻', '🧑‍🍳', '🧑‍🔧'],
  'Media': ['🎮', '🎲', '🎯', '🎳', '🎬', '🎤', '🎪', '🎟️', '🎫', '🎭', '🎻', '🎸', '🎹', '🥁', '🔮', '🪄', '🧸'],
  'Nature': ['🐶', '🐱', '🐠', '🦜', '🌾', '🌻', '🌲', '🌴', '🍀', '🐾', '🐮', '🐴', '🐑', '🐝', '🥕', '🍅', '🥔']
};

function initCategorySymbolPicker() {
  const container = document.getElementById('category-symbol-picker');
  const tabsBar = document.getElementById('symbol-tabs-bar');
  const searchInput = document.getElementById('search-symbol-input');
  const iconInput = document.getElementById('cat-icon');
  const iconPreview = document.getElementById('cat-icon-preview');
  if (!container || !iconInput) return;

  let activeTab = 'All';

  function renderTabs() {
    if (!tabsBar) return;
    tabsBar.innerHTML = Object.keys(CATEGORY_SYMBOL_GROUPS).map(group => `
      <button type="button" class="btn-tab-chip ${group === activeTab ? 'active' : ''}" style="white-space: nowrap; font-size: 11px; padding: 3px 8px; border-radius: 4px; border: 1px solid ${group === activeTab ? 'var(--cyan-primary)' : 'rgba(255,255,255,0.12)'}; background: ${group === activeTab ? 'rgba(0, 240, 255, 0.2)' : 'rgba(255,255,255,0.05)'}; color: ${group === activeTab ? 'var(--cyan-primary)' : '#cbd5e1'}; cursor: pointer;" data-group="${group}">
        ${group} (${CATEGORY_SYMBOL_GROUPS[group].length})
      </button>
    `).join('');

    tabsBar.querySelectorAll('.btn-tab-chip').forEach(btn => {
      btn.addEventListener('click', () => {
        activeTab = btn.getAttribute('data-group');
        renderTabs();
        renderSymbols();
      });
    });
  }

  function renderSymbols(filter = '') {
    const list = CATEGORY_SYMBOL_GROUPS[activeTab] || CATEGORY_SYMBOL_GROUPS['All'];
    const query = (filter || '').toLowerCase().trim();
    const filtered = query ? list.filter(sym => sym.includes(query)) : list;

    container.innerHTML = filtered.map(sym => `
      <button type="button" class="btn-symbol-chip" style="background: rgba(255,255,255,0.06); border: 1px solid ${iconInput.value === sym ? 'var(--cyan-primary)' : 'rgba(255,255,255,0.12)'}; border-radius: 6px; font-size: 19px; padding: 4px; cursor: pointer; transition: all 0.15s;" data-symbol="${sym}">${sym}</button>
    `).join('');

    container.querySelectorAll('.btn-symbol-chip').forEach(btn => {
      btn.addEventListener('click', () => {
        const sym = btn.getAttribute('data-symbol');
        iconInput.value = sym;
        if (iconPreview) iconPreview.textContent = sym;
        container.querySelectorAll('.btn-symbol-chip').forEach(b => {
          b.style.borderColor = 'rgba(255,255,255,0.12)';
          b.style.background = 'rgba(255,255,255,0.06)';
        });
        btn.style.borderColor = 'var(--cyan-primary)';
        btn.style.background = 'rgba(0, 240, 255, 0.25)';
      });
    });
  }

  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      renderSymbols(e.target.value);
    });
  }

  iconInput.addEventListener('input', (e) => {
    if (iconPreview) iconPreview.textContent = e.target.value.trim() || '🏷️';
  });

  renderTabs();
  renderSymbols();
}

window.deleteCategory = async (id) => {
  const cat = categoriesList.find(c => c.id === id);
  const name = cat ? cat.name : 'this category';
  if (confirm(`Are you sure you want to delete category "${name}"?`)) {
    try {
      await apiDeleteCategory(id);
      showToast(`Category "${name}" deleted.`, 'success');
      await loadCategories();
      renderCategoriesGrid();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }
};

async function sendMove(direction) {
  const speedSlider = document.getElementById('robot-speed-slider');
  const speed = speedSlider ? parseInt(speedSlider.value) : 150;
  try {
    await apiSendCommand('MOVE', { direction, speed }, 4);
  } catch (err) {
    console.warn('Move command error:', err.message);
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
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

    if (productsList.length === 0) {
      try {
        const prodRes = await apiGetProducts();
        productsList = prodRes.products || [];
        const p = document.getElementById('stat-total-products');
        if (p && productsList.length > 0) p.textContent = productsList.length;
      } catch (e) {}
    }

    if (adsList.length === 0) {
      try {
        const adsRes = await apiGetAdvertisements();
        adsList = adsRes.advertisements || [];
      } catch (e) {}
    }

    if (schedulesList.length === 0) {
      try {
        const sRes = await apiGetSchedules();
        schedulesList = sRes.schedules || [];
      } catch (e) {}
    }

    const activeAd = adsList.find(a => a.status === 'active') || adsList[0];
    const activeTitleEl = document.getElementById('overview-active-title');
    const activeCatEl = document.getElementById('overview-active-cat');
    const activePageEl = document.getElementById('overview-active-page');
    const schedCountEl = document.getElementById('overview-schedule-count');

    if (activeTitleEl) activeTitleEl.textContent = activeAd ? activeAd.title : '-- No active broadcast --';
    if (activeCatEl) activeCatEl.textContent = activeAd ? `Category: ${activeAd.category_name || 'General'}` : 'Category: --';
    if (activePageEl) activePageEl.textContent = activeAd ? `Page ${activeAd.display_page_id || 1}` : 'Page 1';
    if (schedCountEl) schedCountEl.textContent = `${schedulesList.length} Rules Active`;

    await pollTelemetry();
  } catch (err) {
    console.error('Error loading overview:', err);
  }
}

async function pollTelemetry() {
  try {
    const [robotData, cameraData] = await Promise.all([
      apiGetRobotStatus().catch(() => null),
      apiGetCameraStatus().catch(() => null)
    ]);

    const isMainOnline = Boolean(robotData && (robotData.online !== undefined ? robotData.online : (robotData.device?.status === 'online')));
    const isCamOnline = Boolean(cameraData && (cameraData.online !== undefined ? cameraData.online : (cameraData.device?.status === 'online')));
    const isEstop = Boolean(robotData && robotData.emergencyStopActive);

    const onlineCount = (isMainOnline ? 1 : 0) + (isCamOnline ? 1 : 0);

    // Top status badges
    const dot = document.getElementById('top-robot-dot');
    const text = document.getElementById('top-robot-text');
    const pill = document.getElementById('top-robot-pill') || (dot ? dot.closest('.status-pill') : null);

    if (dot && text) {
      if (onlineCount === 2) {
        dot.className = 'status-dot online';
        if (pill) pill.className = 'status-pill online';
        text.innerHTML = '<span class="status-full">🟢 Online (2/2 ESPs)</span><span class="status-compact">2/2 Online</span>';
        if (pill) pill.title = 'Both SevenSemi Main ESP32 and AI Camera ESP32-S3 connected to cloud';
      } else if (onlineCount === 1) {
        dot.className = 'status-dot warning';
        if (pill) pill.className = 'status-pill warning';
        const which = isMainOnline ? 'Main Online' : 'Cam Online';
        text.innerHTML = `<span class="status-full">🟡 1/2 Online (${which})</span><span class="status-compact">1/2 Online</span>`;
        if (pill) pill.title = `1 of 2 ESPs online (${isMainOnline ? 'Main Controller connected, Camera offline' : 'AI Camera connected, Main Controller offline'})`;
      } else {
        dot.className = 'status-dot offline';
        if (pill) pill.className = 'status-pill offline';
        text.innerHTML = '<span class="status-full">🔴 Offline (0/2 ESPs)</span><span class="status-compact">0/2 Offline</span>';
        if (pill) pill.title = 'Both ESP32 controllers are offline';
      }
    }

    // Overview Card Sync
    const syncText = document.getElementById('overview-robot-sync');
    if (syncText) {
      if (onlineCount === 2) {
        syncText.textContent = '2/2 Online (Dual Linked)';
        syncText.style.color = 'var(--success, #10b981)';
      } else if (onlineCount === 1) {
        syncText.textContent = isMainOnline ? '1/2 Online (Main Only)' : '1/2 Online (Cam Only)';
        syncText.style.color = '#f59e0b';
      } else {
        syncText.textContent = '0/2 Offline';
        syncText.style.color = 'var(--danger, #ef4444)';
      }
    }

    // Emergency Stop Banner
    const estopBanner = document.getElementById('global-estop-banner');
    if (estopBanner) {
      estopBanner.style.display = isEstop ? 'flex' : 'none';
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
    const adCat = document.getElementById('ad-category');

    if (select) {
      select.innerHTML = `<option value="">All Categories (${categoriesList.length})</option>` + 
        categoriesList.map(c => `<option value="${c.id}">${c.icon || '🏷️'} ${escapeHtml(c.name)}</option>`).join('');
    }
    if (modalSelect) {
      if (categoriesList.length === 0) {
        modalSelect.innerHTML = '<option value="" disabled selected>⚠️ No categories yet — Click "+ New Category" above</option>';
      } else {
        modalSelect.innerHTML = '<option value="">-- Select Category --</option>' + 
          categoriesList.map(c => `<option value="${c.id}">${c.icon || '🏷️'} ${escapeHtml(c.name)}</option>`).join('');
      }
    }
    if (adCat) {
      adCat.innerHTML = '<option value="">-- Auto-filled from Product --</option>' + 
        categoriesList.map(c => `<option value="${c.id}">${c.icon || '🏷️'} ${escapeHtml(c.name)}</option>`).join('');
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

  if (filtered.length === 0) {
    grid.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 48px 24px; background: rgba(255,255,255,0.02); border: 1px dashed var(--border-color); border-radius: var(--radius-md);">
        <span style="font-size: 40px; display: block; margin-bottom: 12px;">🏷️</span>
        <h4 style="color: #fff; margin-bottom: 8px;">No Categories Created Yet</h4>
        <p style="color: var(--text-muted); font-size: 13px; max-width: 440px; margin: 0 auto 18px auto;">
          Only user-created categories are used in product and advertisement rotations. Click below to add your first category.
        </p>
        <button class="btn btn-primary btn-sm" onclick="openModal('modal-category')">+ Add Category</button>
      </div>
    `;
    return;
  }

  grid.innerHTML = filtered.map(cat => {
    const icon = cat.icon || getCategoryIcon(cat.slug);
    const count = productsList.filter(p => p.category_id === cat.id).length;
    return `
      <div class="category-card">
        <div>
          <div class="category-card-header">
            <div class="category-icon-bubble">${icon}</div>
            <div style="flex:1;">
              <div class="category-name">${escapeHtml(cat.name)}</div>
              <div class="category-slug">${escapeHtml(cat.slug || cat.id)}</div>
            </div>
            <button class="btn btn-danger btn-sm" style="padding: 2px 8px; font-size: 11px;" onclick="window.deleteCategory('${cat.id}')" title="Delete Category">🗑️</button>
          </div>
          <p style="font-size: 12px; color: var(--text-muted); margin-bottom: 12px;">
            Targeted channel for autonomous robot advertising &amp; display rotation.
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
      <tr class="empty-row">
        <td colspan="6" style="text-align: center; padding: 48px 20px; color: var(--text-muted);">
          <div style="font-size: 32px; margin-bottom: 12px;">📦</div>
          <div style="font-size: 15px; font-weight: 700; color: #e2e8f0; margin-bottom: 6px;">No Products Added Yet</div>
          <p style="font-size: 13px; color: #94a3b8; max-width: 440px; margin: 0 auto 16px;">
            Your product catalog is empty. Click <strong>"+ Add Product"</strong> above to manually create your first product.
          </p>
          <button type="button" class="btn btn-primary" onclick="document.getElementById('btn-new-product').click()">+ Add Product Manually</button>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = productsList.map(p => `
    <tr>
      <td>
        <div style="display: flex; align-items: center; gap: 12px;">
          ${p.image_url 
            ? `<img src="${p.image_url}" alt="${escapeHtml(p.name)}" style="width: 44px; height: 44px; border-radius: 6px; object-fit: cover; border: 1px solid var(--border-color);" onerror="this.outerHTML='<div style=\\'width:44px;height:44px;border-radius:6px;background:rgba(0,240,255,0.1);border:1px solid var(--border-color);display:flex;align-items:center;justify-content:center;font-size:20px;\\'>📦</div>'">` 
            : `<div style="width: 44px; height: 44px; border-radius: 6px; background: rgba(0, 240, 255, 0.1); border: 1px solid var(--border-color); display: flex; align-items: center; justify-content: center; font-size: 20px;">📦</div>`
          }
          <div>
            <strong style="color: #fff; font-size: 14px;">${escapeHtml(p.name)}</strong>
            <br>
            <small style="color: var(--cyan-primary);">${escapeHtml(p.brand || 'Enterprise')}</small>
          </div>
        </div>
      </td>
      <td data-label="Category"><span class="status-pill">${escapeHtml(p.category_name || 'General')}</span></td>
      <td data-label="Price" style="color:#ffd200; font-weight:700;">${p.price ? '₹' + Number(p.price).toLocaleString('en-IN') : 'N/A'}</td>
      <td data-label="Description"><span style="font-size:12px; color:var(--text-muted);">${escapeHtml((p.description || '').slice(0, 60))}${(p.description || '').length > 60 ? '...' : ''}</span></td>
      <td data-label="Stock Status"><span class="status-pill" style="border-color: rgba(0, 230, 118, 0.4); color: #00e676;">${escapeHtml(p.availability || 'In Stock')}</span></td>
      <td data-label="Actions">
        <div class="mobile-action-buttons">
          <button class="btn btn-primary btn-sm" onclick="createAdFromProduct('${p.id}')" title="Create Advertisement from this Product">📢 Make Ad</button>
          <button class="btn btn-secondary btn-sm" onclick="editProduct('${p.id}')">✏️ Edit</button>
          <button class="btn btn-danger btn-sm" onclick="deleteProduct('${p.id}', '${escapeHtml(p.name || 'product').replace(/'/g, "\\'")}')">🗑️ Delete</button>
        </div>
      </td>
    </tr>
  `).join('');
}

window.createAdFromProduct = (id) => {
  const prod = productsList.find(p => p.id === id);
  if (!prod) return;

  const form = document.getElementById('form-advertisement');
  if (form) form.reset();
  document.getElementById('ad-id').value = '';

  // Populate categories dropdown
  const catSelect = document.getElementById('ad-category');
  if (catSelect) {
    catSelect.innerHTML = categoriesList.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    if (prod.category_id) catSelect.value = prod.category_id;
  }

  // Populate products dropdown
  const prodSelect = document.getElementById('ad-product');
  if (prodSelect) {
    prodSelect.innerHTML = '<option value="">-- Standalone / Select Product --</option>' +
      productsList.map(p => `<option value="${p.id}">${p.name} (₹${p.price || 0})</option>`).join('');
    prodSelect.value = prod.id;
  }

  // Auto-fill Advertisement = Product
  document.getElementById('ad-title').value = prod.name || '';
  document.getElementById('ad-poster-url').value = prod.image_url || '';
  document.getElementById('ad-short-desc').value = prod.description || prod.name || '';
  document.getElementById('ad-short-desc-ml').value = prod.description_ml || '';
  document.getElementById('ad-price').value = prod.price || '';

  // Update poster preview
  const previewImg = document.getElementById('ad-poster-img');
  const placeholder = document.getElementById('ad-poster-placeholder');
  if (prod.image_url && previewImg) {
    previewImg.src = prod.image_url;
    previewImg.style.display = 'block';
    if (placeholder) placeholder.style.display = 'none';
  } else if (previewImg) {
    previewImg.style.display = 'none';
    if (placeholder) placeholder.style.display = 'block';
  }

  document.getElementById('modal-ad-title').textContent = `Create Advertisement for "${prod.name}"`;
  openModal('modal-advertisement');
};

window.editProduct = (id) => {
  const prod = productsList.find(p => p.id === id);
  if (!prod) return;
  document.getElementById('prod-id').value = prod.id;
  document.getElementById('prod-name').value = prod.name || '';
  document.getElementById('prod-brand').value = prod.brand || '';
  document.getElementById('prod-model').value = prod.model || '';
  document.getElementById('prod-category').value = prod.category_id || '';
  document.getElementById('prod-price').value = prod.price || '';
  document.getElementById('prod-image-url').value = prod.image_url || '';
  document.getElementById('prod-desc').value = prod.description || '';
  document.getElementById('prod-desc-ml').value = prod.description_ml || '';
  document.getElementById('prod-promo').value = prod.promo_info || '';
  document.getElementById('prod-features').value = prod.features_json || '';

  // Update poster preview
  const previewImg = document.getElementById('prod-poster-img');
  const placeholder = document.getElementById('prod-poster-placeholder');
  if (prod.image_url && previewImg) {
    previewImg.src = prod.image_url;
    previewImg.style.display = 'block';
    if (placeholder) placeholder.style.display = 'none';
  } else if (previewImg) {
    previewImg.style.display = 'none';
    if (placeholder) placeholder.style.display = 'block';
  }

  document.getElementById('modal-product-title').textContent = 'Edit Product';
  openModal('modal-product');
};

window.deleteProduct = async (id, name) => {
  if (confirm(`Are you sure you want to delete product "${name || 'this item'}"?`)) {
    try {
      await apiDeleteProduct(id);
      showToast(`Deleted "${name || 'product'}"`, 'success');
      productsList = productsList.filter(p => p.id !== id);
      renderProductsTable();

      // Also remove any linked advertisement
      const linkedAd = adsList.find(a => a.product_id === id);
      if (linkedAd) {
        try {
          await apiDeleteAdvertisement(linkedAd.id);
          adsList = adsList.filter(a => a.id !== linkedAd.id);
          renderAdsTable();
        } catch (adErr) {}
      }

      const statEl = document.getElementById('stat-total-products');
      if (statEl) statEl.textContent = productsList.length;
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
    const previewImg = document.getElementById('prod-poster-img');
    const placeholder = document.getElementById('prod-poster-placeholder');
    if (previewImg) previewImg.style.display = 'none';
    if (placeholder) placeholder.style.display = 'block';
    const fileName = document.getElementById('prod-file-name');
    if (fileName) fileName.textContent = 'JPG, PNG, WebP supported';
    document.getElementById('modal-product-title').textContent = 'Add New Product';
    openModal('modal-product');
  });
}

// Product Poster image file upload
const prodFileInput = document.getElementById('prod-image-file');
if (prodFileInput) {
  prodFileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target.result;
      document.getElementById('prod-image-url').value = dataUrl;
      const previewImg = document.getElementById('prod-poster-img');
      const placeholder = document.getElementById('prod-poster-placeholder');
      const fileName = document.getElementById('prod-file-name');
      if (previewImg) {
        previewImg.src = dataUrl;
        previewImg.style.display = 'block';
      }
      if (placeholder) placeholder.style.display = 'none';
      if (fileName) fileName.textContent = file.name;
    };
    reader.readAsDataURL(file);
  });
}

// Product Poster URL live preview
const prodUrlInput = document.getElementById('prod-image-url');
if (prodUrlInput) {
  prodUrlInput.addEventListener('input', (e) => {
    const url = e.target.value.trim();
    const previewImg = document.getElementById('prod-poster-img');
    const placeholder = document.getElementById('prod-poster-placeholder');
    if (url && previewImg) {
      previewImg.src = url;
      previewImg.style.display = 'block';
      if (placeholder) placeholder.style.display = 'none';
    } else if (previewImg) {
      previewImg.style.display = 'none';
      if (placeholder) placeholder.style.display = 'block';
    }
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
      name: document.getElementById('prod-name').value.trim(),
      brand: document.getElementById('prod-brand').value.trim(),
      model: document.getElementById('prod-model').value.trim(),
      category_id: catSelect.value,
      category_name: catName,
      price: document.getElementById('prod-price').value ? parseFloat(document.getElementById('prod-price').value) : null,
      image_url: document.getElementById('prod-image-url').value.trim(),
      description: document.getElementById('prod-desc').value.trim(),
      description_ml: document.getElementById('prod-desc-ml').value.trim(),
      promo_info: document.getElementById('prod-promo').value.trim(),
      features_json: document.getElementById('prod-features').value.trim() || '[]',
      availability: 'In Stock'
    };

    const createAdCheckbox = document.getElementById('prod-create-ad');
    const adPriority = document.getElementById('prod-ad-priority')?.value || '3';

    try {
      if (id) {
        await apiUpdateProduct(id, payload);
        showToast('Product updated successfully!', 'success');
        const idx = productsList.findIndex(p => p.id === id);
        if (idx !== -1) {
          productsList[idx] = { ...productsList[idx], ...payload };
        }

        // Also update any linked advertisement (Advertisement = Product)
        const linkedAd = adsList.find(a => a.product_id === id);
        if (linkedAd) {
          try {
            await apiUpdateAdvertisement(linkedAd.id, {
              ...linkedAd,
              title: payload.name,
              category_id: payload.category_id,
              category_name: payload.category_name,
              poster_url: payload.image_url || linkedAd.poster_url,
              short_desc: payload.description || payload.name,
              short_desc_ml: payload.description_ml || '',
              price: payload.price
            });
            linkedAd.title = payload.name;
            linkedAd.poster_url = payload.image_url || linkedAd.poster_url;
            linkedAd.price = payload.price;
            renderAdsTable();
          } catch(adErr) {}
        }
      } else {
        const res = await apiCreateProduct(payload);
        showToast('Product created successfully!', 'success');
        const createdProd = res.product || { ...payload, id: 'prod_' + Date.now() };
        productsList.unshift(createdProd);

        // Also create Live Advertisement Poster if requested
        if (createAdCheckbox && createAdCheckbox.checked) {
          try {
            await apiCreateAdvertisement({
              title: createdProd.name,
              product_id: createdProd.id,
              category_id: createdProd.category_id,
              category_name: createdProd.category_name,
              poster_url: createdProd.image_url || '/assets/ads/custom_poster.png',
              short_desc: createdProd.description || createdProd.name,
              short_desc_ml: createdProd.description_ml || '',
              detailed_desc: createdProd.description || '',
              price: createdProd.price,
              priority: parseInt(adPriority),
              status: 'active',
              display_page_id: 1
            });
            showToast('Live Advertisement Poster created & activated!', 'success');
          } catch(e) {}
        }
      }

      closeModal('modal-product');
      renderProductsTable();
      const statEl = document.getElementById('stat-total-products');
      if (statEl) statEl.textContent = productsList.length;
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

  if (adsList.length === 0) {
    tbody.innerHTML = `
      <tr class="empty-row">
        <td colspan="6" style="text-align: center; padding: 48px 20px; color: var(--text-muted);">
          <div style="font-size: 32px; margin-bottom: 12px;">📢</div>
          <div style="font-size: 15px; font-weight: 700; color: #e2e8f0; margin-bottom: 6px;">No Advertisements Created Yet</div>
          <p style="font-size: 13px; color: #94a3b8; max-width: 440px; margin: 0 auto 16px;">
            Create your first advertisement poster to broadcast on the robot screen.
          </p>
          <button type="button" class="btn btn-primary" onclick="document.getElementById('btn-new-advertisement').click()">+ Create Advertisement Poster</button>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = adsList.map(ad => `
    <tr>
      <td>
        <div style="display: flex; align-items: center; gap: 12px;">
          ${ad.poster_url 
            ? `<img src="${ad.poster_url}" style="width:44px; height:44px; border-radius:6px; object-fit:cover; border:1px solid var(--border-color);" onerror="this.outerHTML='<div style=\\'width:44px;height:44px;border-radius:6px;background:rgba(0,240,255,0.1);border:1px solid var(--border-color);display:flex;align-items:center;justify-content:center;font-size:20px;\\'>📢</div>'">` 
            : `<div style="width:44px; height:44px; border-radius:6px; background:rgba(0,240,255,0.1); border:1px solid var(--border-color); display:flex; align-items:center; justify-content:center; font-size:20px;">📢</div>`
          }
          <div>
            <strong style="color: #fff; font-size: 14px;">${escapeHtml(ad.title)}</strong>
            ${ad.short_desc ? `<br><small style="color: var(--text-dim);">${escapeHtml(ad.short_desc.slice(0, 50))}</small>` : (ad.price ? `<br><small style="color: var(--cyan-primary);">₹${ad.price}</small>` : '')}
          </div>
        </div>
      </td>
      <td data-label="Category"><span class="status-pill">${escapeHtml(ad.category_name || 'General')}</span></td>
      <td data-label="DWIN Screen"><span class="status-pill" style="border-color: rgba(0,240,255,0.3); color:#00f0ff;">${parseInt(ad.display_page_id) === 1 || !ad.display_page_id ? 'Page 1 (Primary)' : 'Page ' + ad.display_page_id}</span></td>
      <td data-label="Priority"><span class="status-pill">${ad.priority === 3 ? '🔴 Urgent' : (ad.priority === 2 ? '🟡 High' : '⚪ Normal')}</span></td>
      <td data-label="Status"><span class="status-pill ${ad.status === 'active' ? 'online' : (ad.status === 'paused' ? 'warning' : 'offline')}">${(ad.status || 'SCHEDULED').toUpperCase()}</span></td>
      <td data-label="Actions">
        <div class="mobile-action-buttons">
          <button class="btn btn-primary btn-sm" onclick="playNow('${ad.id}')">▶ Play</button>
          ${ad.status === 'active' 
            ? `<button class="btn btn-secondary btn-sm" onclick="pauseAd('${ad.id}')">⏸ Pause</button>` 
            : `<button class="btn btn-secondary btn-sm" onclick="resumeAd('${ad.id}')">▶ Resume</button>`
          }
          <button class="btn btn-secondary btn-sm" onclick="editAd('${ad.id}')">✏️ Edit</button>
          <button class="btn btn-danger btn-sm" onclick="deleteAd('${ad.id}', '${escapeHtml(ad.title || 'ad').replace(/'/g, "\\'")}')">🗑️ Delete</button>
        </div>
      </td>
    </tr>
  `).join('');
}

window.playNow = async (id) => {
  try {
    await apiPlayNow(id);
    showToast('Broadcast command dispatched to robot display!', 'success');
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

window.deleteAd = async (id, title) => {
  if (confirm(`Are you sure you want to delete advertisement "${title || 'this item'}"?`)) {
    try {
      await apiDeleteAdvertisement(id);
      showToast(`Deleted "${title || 'ad'}"`, 'success');
      adsList = adsList.filter(a => a.id !== id);
      renderAdsTable();
      const totalAdsEl = document.getElementById('stat-total-ads');
      if (totalAdsEl) totalAdsEl.textContent = adsList.length;
    } catch (err) {
      showToast(err.message, 'error');
    }
  }
};

window.editAd = (id) => {
  const ad = adsList.find(a => a.id === id);
  if (!ad) return;

  // Populate products dropdown (Only user-created products!)
  const prodSelect = document.getElementById('ad-product');
  if (prodSelect) {
    if (productsList.length === 0) {
      prodSelect.innerHTML = '<option value="" disabled selected>⚠️ No products created yet — Create a product first in Products section</option>';
    } else {
      prodSelect.innerHTML = '<option value="">-- Select Product (Auto-Fills All Fields) --</option>' +
        productsList.map(p => `<option value="${p.id}">📦 ${escapeHtml(p.name)} (${p.brand || 'No brand'}) - ₹${p.price || 0}</option>`).join('');
    }
    prodSelect.value = ad.product_id || '';
  }

  // Populate categories dropdown
  const catSelect = document.getElementById('ad-category');
  if (catSelect) {
    catSelect.innerHTML = '<option value="">-- Category --</option>' + 
      categoriesList.map(c => `<option value="${c.id}">${c.icon || '🏷️'} ${escapeHtml(c.name)}</option>`).join('');
    catSelect.value = ad.category_id || '';
  }

  document.getElementById('ad-id').value = ad.id;
  document.getElementById('ad-title').value = ad.title || '';
  document.getElementById('ad-poster-url').value = ad.poster_url || '';
  document.getElementById('ad-short-desc').value = ad.short_desc || '';
  document.getElementById('ad-short-desc-ml').value = ad.short_desc_ml || '';
  document.getElementById('ad-price').value = ad.price || '';
  document.getElementById('ad-page-id').value = ad.display_page_id || '1';
  document.getElementById('ad-priority').value = ad.priority || '2';

  // Preview
  const previewImg = document.getElementById('ad-poster-img');
  const placeholder = document.getElementById('ad-poster-placeholder');
  if (ad.poster_url && previewImg) {
    previewImg.src = ad.poster_url;
    previewImg.style.display = 'block';
    if (placeholder) placeholder.style.display = 'none';
  } else if (previewImg) {
    previewImg.style.display = 'none';
    if (placeholder) placeholder.style.display = 'block';
  }

  document.getElementById('modal-ad-title').textContent = 'Edit Advertisement Poster';
  openModal('modal-advertisement');
};

// New Advertisement Button Listener
const btnNewAd = document.getElementById('btn-new-advertisement');
if (btnNewAd) {
  btnNewAd.addEventListener('click', () => {
    // Populate products dropdown (Only user-created products!)
    const prodSelect = document.getElementById('ad-product');
    if (prodSelect) {
      if (productsList.length === 0) {
        prodSelect.innerHTML = '<option value="" disabled selected>⚠️ No products created yet — Create a product first in Products section</option>';
      } else {
        prodSelect.innerHTML = '<option value="">-- Select Product (Auto-Fills All Fields) --</option>' +
          productsList.map(p => `<option value="${p.id}">📦 ${escapeHtml(p.name)} (${p.brand || 'No brand'}) - ₹${p.price || 0}</option>`).join('');
      }
    }
    // Populate categories dropdown
    const catSelect = document.getElementById('ad-category');
    if (catSelect) {
      catSelect.innerHTML = '<option value="">-- Category --</option>' + 
        categoriesList.map(c => `<option value="${c.id}">${c.icon || '🏷️'} ${escapeHtml(c.name)}</option>`).join('');
    }

    const form = document.getElementById('form-advertisement');
    if (form) form.reset();
    document.getElementById('ad-id').value = '';
    const previewImg = document.getElementById('ad-poster-img');
    const placeholder = document.getElementById('ad-poster-placeholder');
    if (previewImg) previewImg.style.display = 'none';
    if (placeholder) placeholder.style.display = 'block';
    document.getElementById('modal-ad-title').textContent = 'Create Advertisement Poster';
    openModal('modal-advertisement');
  });
}

// Auto-Fill Advertisement = Product on Selection Change
const adProductSelect = document.getElementById('ad-product');
if (adProductSelect) {
  adProductSelect.addEventListener('change', (e) => {
    const prodId = e.target.value;
    if (!prodId) return;
    const prod = productsList.find(p => p.id === prodId);
    if (!prod) return;

    // Fill Advertisement fields from Product
    const titleInput = document.getElementById('ad-title');
    if (titleInput) titleInput.value = prod.name || '';

    const catSelect = document.getElementById('ad-category');
    if (catSelect && prod.category_id) catSelect.value = prod.category_id;

    const posterInput = document.getElementById('ad-poster-url');
    if (posterInput) posterInput.value = prod.image_url || '';

    const previewImg = document.getElementById('ad-poster-img');
    const placeholder = document.getElementById('ad-poster-placeholder');
    if (prod.image_url && previewImg) {
      previewImg.src = prod.image_url;
      previewImg.style.display = 'block';
      if (placeholder) placeholder.style.display = 'none';
    } else if (previewImg) {
      previewImg.style.display = 'none';
      if (placeholder) placeholder.style.display = 'block';
    }

    const priceInput = document.getElementById('ad-price');
    if (priceInput) priceInput.value = prod.price || '';

    const shortDesc = document.getElementById('ad-short-desc');
    if (shortDesc) shortDesc.value = prod.description || '';

    const shortDescMl = document.getElementById('ad-short-desc-ml');
    if (shortDescMl) shortDescMl.value = prod.description_ml || '';

    showToast(`Auto-filled advertisement from "${prod.name}"`, 'success');
  });
}

// Advertisement image file upload
const adFileInput = document.getElementById('ad-poster-file');
if (adFileInput) {
  adFileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target.result;
      document.getElementById('ad-poster-url').value = dataUrl;
      const previewImg = document.getElementById('ad-poster-img');
      const placeholder = document.getElementById('ad-poster-placeholder');
      if (previewImg) {
        previewImg.src = dataUrl;
        previewImg.style.display = 'block';
      }
      if (placeholder) placeholder.style.display = 'none';
    };
    reader.readAsDataURL(file);
  });
}

// Advertisement URL input live preview
const adUrlInput = document.getElementById('ad-poster-url');
if (adUrlInput) {
  adUrlInput.addEventListener('input', (e) => {
    const url = e.target.value.trim();
    const previewImg = document.getElementById('ad-poster-img');
    const placeholder = document.getElementById('ad-poster-placeholder');
    if (url && previewImg) {
      previewImg.src = url;
      previewImg.style.display = 'block';
      if (placeholder) placeholder.style.display = 'none';
    } else if (previewImg) {
      previewImg.style.display = 'none';
      if (placeholder) placeholder.style.display = 'block';
    }
  });
}

// Advertisement Form Submit
const formAd = document.getElementById('form-advertisement');
if (formAd) {
  formAd.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('ad-id').value;
    const catSelect = document.getElementById('ad-category');
    const catName = catSelect ? catSelect.options[catSelect.selectedIndex]?.text || 'General' : 'General';
    const prodSelect = document.getElementById('ad-product');
    const prodId = prodSelect ? prodSelect.value : '';

    const payload = {
      title: document.getElementById('ad-title').value.trim(),
      product_id: prodId || null,
      category_id: catSelect ? catSelect.value : '',
      category_name: catName,
      poster_url: document.getElementById('ad-poster-url').value.trim(),
      short_desc: document.getElementById('ad-short-desc').value.trim(),
      short_desc_ml: document.getElementById('ad-short-desc-ml').value.trim(),
      price: document.getElementById('ad-price').value ? parseFloat(document.getElementById('ad-price').value) : null,
      display_page_id: parseInt(document.getElementById('ad-page-id').value || '1'),
      priority: parseInt(document.getElementById('ad-priority').value || '2'),
      status: 'active'
    };

    try {
      if (id) {
        await apiUpdateAdvertisement(id, payload);
        showToast('Advertisement updated successfully!', 'success');
        const idx = adsList.findIndex(a => a.id === id);
        if (idx !== -1) adsList[idx] = { ...adsList[idx], ...payload };
      } else {
        const res = await apiCreateAdvertisement(payload);
        showToast('Advertisement created & activated!', 'success');
        const createdAd = res.advertisement || { ...payload, id: 'ad_' + Date.now() };
        adsList.unshift(createdAd);
      }

      closeModal('modal-advertisement');
      renderAdsTable();
      const totalAdsEl = document.getElementById('stat-total-ads');
      if (totalAdsEl) totalAdsEl.textContent = adsList.length;
      loadOverview();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
}

// ----------------------------------------------------------------------------
// 4. SCHEDULE MANAGEMENT SECTION
// ----------------------------------------------------------------------------
async function loadSchedulesView() {
  try {
    const res = await apiGetSchedules();
    schedulesList = res.schedules || [];
    if (adsList.length === 0) {
      try {
        const aRes = await apiGetAdvertisements();
        adsList = aRes.advertisements || [];
      } catch (e) {}
    }
    renderSchedulesTable();
  } catch (err) {
    showToast('Failed to load schedules: ' + err.message, 'error');
  }
}

function renderSchedulesTable() {
  const tbody = document.getElementById('schedules-table-body');
  if (!tbody) return;

  if (schedulesList.length === 0) {
    tbody.innerHTML = `
      <tr class="empty-row">
        <td colspan="7" style="text-align: center; padding: 48px 20px; color: var(--text-muted);">
          <div style="font-size: 32px; margin-bottom: 12px;">⏱️</div>
          <div style="font-size: 15px; font-weight: 700; color: #e2e8f0; margin-bottom: 6px;">No Advertisement Schedules Configured</div>
          <p style="font-size: 13px; color: #94a3b8; max-width: 440px; margin: 0 auto 16px;">
            Set up automated rotation schedules with specific playback windows, rotation durations, and DWIN display screens.
          </p>
          <button class="btn btn-primary btn-sm" onclick="window.openCreateScheduleModal()">+ Create Schedule Rule</button>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = schedulesList.map(s => {
    const linkedAd = adsList.find(a => a.id === s.advertisement_id);
    const title = s.ad_title || (linkedAd ? linkedAd.title : 'Advertisement');
    const poster = linkedAd?.poster_url || '';
    const isActive = s.is_active === 1 || s.is_active === true;

    return `
      <tr>
        <td>
          <div style="display: flex; align-items: center; gap: 10px;">
            ${poster 
              ? `<img src="${poster}" style="width:38px; height:38px; border-radius:6px; object-fit:cover; border:1px solid var(--border-color);" onerror="this.style.display='none'">` 
              : `<div style="width:38px; height:38px; border-radius:6px; background:rgba(0,240,255,0.1); border:1px solid var(--border-color); display:flex; align-items:center; justify-content:center; font-size:16px;">📢</div>`
            }
            <div>
              <strong style="color: #fff; font-size: 14px;">${escapeHtml(title)}</strong>
              ${linkedAd?.price ? `<br><small style="color: var(--cyan-primary);">₹${linkedAd.price}</small>` : ''}
            </div>
          </div>
        </td>
        <td data-label="DWIN Screen"><span class="status-pill">${parseInt(s.display_page_id) === 1 || !s.display_page_id ? 'Page 1 (Primary)' : 'Page ' + s.display_page_id}</span></td>
        <td data-label="Playback Window"><strong style="color:#fff;">${s.start_time || '09:00'} - ${s.end_time || '21:00'}</strong></td>
        <td data-label="Duration">${(!s.duration_sec || parseInt(s.duration_sec) === 0 || parseInt(s.duration_sec) >= 86400) ? '<span class="badge" style="background:rgba(0, 240, 255, 0.12); border:1px solid #00f0ff; color:#00f0ff; font-weight:700;">⭐ Full Time (Until End)</span>' : `${s.duration_sec}s loop`}</td>
        <td data-label="Days"><span style="font-size:12px; color:var(--text-dim);">${escapeHtml(s.days || 'Every Day')}</span></td>
        <td data-label="Status">
          <button class="btn btn-sm ${isActive ? 'btn-secondary' : 'btn-secondary'}" style="${isActive ? 'border-color: rgba(0,240,255,0.4); color: var(--cyan-primary);' : 'opacity: 0.6;'}" onclick="window.toggleSchedule('${s.id}')">
            ${isActive ? '🟢 Active' : '⚪ Paused'}
          </button>
        </td>
        <td data-label="Actions">
          <div class="mobile-action-buttons">
            <button class="btn btn-secondary btn-sm" onclick="window.editSchedule('${s.id}')" title="Edit Schedule">✏️ Edit</button>
            <button class="btn btn-danger btn-sm" onclick="window.deleteSchedule('${s.id}')" title="Delete Schedule">🗑️ Delete</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

window.openCreateScheduleModal = () => {
  const adSelect = document.getElementById('sched-ad-id');
  if (adSelect) {
    if (adsList.length === 0) {
      adSelect.innerHTML = '<option value="" disabled selected>⚠️ No advertisements found — Create an ad or product first</option>';
    } else {
      adSelect.innerHTML = '<option value="">-- Choose Advertisement --</option>' +
        adsList.map(a => `<option value="${a.id}">📢 ${escapeHtml(a.title)} (Page ${a.display_page_id || 1})</option>`).join('');
    }
  }

  const form = document.getElementById('form-schedule');
  if (form) form.reset();
  document.getElementById('sched-id').value = '';
  document.getElementById('sched-page-id').value = '1';
  
  const durMode = document.getElementById('sched-duration-mode');
  const durInput = document.getElementById('sched-duration');
  const durHelp = document.getElementById('sched-duration-help');
  if (durMode) durMode.value = 'full_time';
  if (durInput) { durInput.value = '0'; durInput.style.display = 'none'; }
  if (durHelp) durHelp.textContent = 'Poster stays on screen full time until completion';

  document.getElementById('modal-schedule-title').textContent = 'Create Schedule Rule';
  openModal('modal-schedule');
};

window.editSchedule = (id) => {
  const s = schedulesList.find(item => item.id === id);
  if (!s) return;

  const adSelect = document.getElementById('sched-ad-id');
  if (adSelect) {
    adSelect.innerHTML = '<option value="">-- Choose Advertisement --</option>' +
      adsList.map(a => `<option value="${a.id}">📢 ${escapeHtml(a.title)} (Page ${a.display_page_id || 1})</option>`).join('');
    adSelect.value = s.advertisement_id;
  }

  document.getElementById('sched-id').value = s.id;
  document.getElementById('sched-start-time').value = s.start_time || '09:00';
  document.getElementById('sched-end-time').value = s.end_time || '21:00';
  document.getElementById('sched-page-id').value = s.display_page_id || '1';

  const durMode = document.getElementById('sched-duration-mode');
  const durInput = document.getElementById('sched-duration');
  const durHelp = document.getElementById('sched-duration-help');
  const sDur = parseInt(s.duration_sec || 0);

  if (sDur === 0 || sDur >= 86400) {
    if (durMode) durMode.value = 'full_time';
    if (durInput) { durInput.value = '0'; durInput.style.display = 'none'; }
    if (durHelp) durHelp.textContent = 'Poster stays on screen full time until completion';
  } else if ([30, 60, 120].includes(sDur)) {
    if (durMode) durMode.value = String(sDur);
    if (durInput) { durInput.value = String(sDur); durInput.style.display = 'none'; }
    if (durHelp) durHelp.textContent = `Rotates to next ad every ${sDur} seconds`;
  } else {
    if (durMode) durMode.value = 'custom';
    if (durInput) { durInput.value = String(sDur); durInput.style.display = 'block'; }
    if (durHelp) durHelp.textContent = 'Enter custom rotation interval in seconds';
  }

  document.getElementById('sched-days').value = s.days || 'Every Day';
  document.getElementById('sched-priority').value = s.priority || '2';
  document.getElementById('sched-active').checked = s.is_active === 1 || s.is_active === true;

  document.getElementById('modal-schedule-title').textContent = 'Edit Schedule Rule';
  openModal('modal-schedule');
};

window.deleteSchedule = async (id) => {
  if (confirm('Are you sure you want to delete this schedule rule?')) {
    try {
      await apiDeleteSchedule(id);
      showToast('Schedule rule deleted successfully!', 'success');
      schedulesList = schedulesList.filter(s => s.id !== id);
      renderSchedulesTable();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }
};

window.toggleSchedule = async (id) => {
  try {
    const res = await apiToggleSchedule(id);
    const updated = res.schedule;
    const found = schedulesList.find(s => s.id === id);
    if (found && updated) {
      found.is_active = updated.is_active;
    }
    renderSchedulesTable();
    showToast('Schedule status updated!', 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
};

async function handleScheduleSubmit() {
  const id = document.getElementById('sched-id').value;
  const adSelect = document.getElementById('sched-ad-id');
  const adId = adSelect.value;
  const selectedAd = adsList.find(a => a.id === adId);
  const adTitle = selectedAd ? selectedAd.title : 'Scheduled Ad';

  const durModeEl = document.getElementById('sched-duration-mode');
  let durationSec = 0;
  if (durModeEl) {
    if (durModeEl.value === 'full_time') {
      durationSec = 0;
    } else if (durModeEl.value === 'custom') {
      durationSec = parseInt(document.getElementById('sched-duration').value || '30');
    } else {
      durationSec = parseInt(durModeEl.value || '30');
    }
  } else {
    durationSec = parseInt(document.getElementById('sched-duration').value || '0');
  }

  const payload = {
    advertisement_id: adId,
    ad_title: adTitle,
    display_page_id: parseInt(document.getElementById('sched-page-id').value || 1),
    start_time: document.getElementById('sched-start-time').value,
    end_time: document.getElementById('sched-end-time').value,
    duration_sec: durationSec,
    days: document.getElementById('sched-days').value,
    priority: parseInt(document.getElementById('sched-priority').value || 2),
    is_active: document.getElementById('sched-active').checked ? 1 : 0
  };

  try {
    if (id) {
      await apiUpdateSchedule(id, payload);
      showToast('Schedule rule updated successfully!', 'success');
      const idx = schedulesList.findIndex(s => s.id === id);
      if (idx !== -1) {
        schedulesList[idx] = { ...schedulesList[idx], ...payload };
      }
    } else {
      const res = await apiCreateSchedule(payload);
      showToast('Schedule rule created successfully!', 'success');
      const created = res.schedule || { ...payload, id: 'sched_' + Date.now() };
      schedulesList.unshift(created);
    }

    closeModal('modal-schedule');
    renderSchedulesTable();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

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
    if (!tbody) return;

    if (!res.logs || res.logs.length === 0) {
      tbody.innerHTML = `
        <tr class="empty-row">
          <td colspan="4" style="text-align: center; padding: 40px 16px; color: var(--text-muted);">
            <div style="font-size: 28px; margin-bottom: 8px;">📋</div>
            <div style="font-size: 14px; font-weight: 700; color: #e2e8f0; margin-bottom: 4px;">No System Logs Yet</div>
            <p style="font-size: 12px; color: #94a3b8; margin: 0;">Robot operations, AI research, and broadcast events will appear here in real time.</p>
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = res.logs.map(l => `
      <tr>
        <td data-label="Timestamp" style="font-size:12px; color:var(--text-dim);">${new Date(l.created_at).toLocaleString()}</td>
        <td data-label="Actor"><strong>${escapeHtml(l.actor || 'System')}</strong></td>
        <td data-label="Action"><span class="status-pill">${escapeHtml(l.action || 'INFO')}</span></td>
        <td data-label="Details" style="word-break: break-word;"><small style="color: #cbd5e1;">${escapeHtml(l.details || '')}</small></td>
      </tr>
    `).join('');
  } catch (err) {
    console.error('Error loading logs:', err);
  }
}

// ----------------------------------------------------------------------------
// Multi-Device Real-Time Sync Loop (Laptop <-> Mobile)
// Automatically keeps products, ads, schedules, and logs updated across all open devices
// ----------------------------------------------------------------------------
setInterval(() => {
  if (document.hidden) return;
  if (activeSection === 'products') loadProducts();
  else if (activeSection === 'advertisements') loadAdvertisements();
  else if (activeSection === 'schedule') loadSchedulesView();
  else if (activeSection === 'logs') loadLogs();
}, 10000);

document.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    pollTelemetry();
    if (activeSection === 'products') loadProducts();
    else if (activeSection === 'advertisements') loadAdvertisements();
    else if (activeSection === 'schedule') loadSchedulesView();
    else if (activeSection === 'logs') loadLogs();
  }
});

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
