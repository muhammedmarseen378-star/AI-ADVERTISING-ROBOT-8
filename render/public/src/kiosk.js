// ============================================================================
// Public Advertisement Kiosk Interactive Controller
// Continuous auto-sync, smooth ad transitions, and Malayalam bilingual toggle
// ============================================================================

import { apiGetActiveAdvertisement, apiGetRobotStatus, apiGetAdvertisements } from './api.js';
import { getLanguage, toggleLanguage, t, updatePageTranslations } from './i18n.js';

let currentAdId = null;
let pollTimer = null;
let allAds = [];

export async function initKiosk() {
  updatePageTranslations();
  
  // Bind Language Switcher
  const langBtn = document.getElementById('btn-lang-toggle');
  if (langBtn) {
    langBtn.addEventListener('click', () => {
      toggleLanguage();
      updatePageTranslations();
      refreshAdDisplay();
    });
  }

  // Bind Category Chips
  document.querySelectorAll('.category-chip').forEach(chip => {
    chip.addEventListener('click', async () => {
      document.querySelectorAll('.category-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      const catId = chip.getAttribute('data-cat');
      await filterKioskByCategory(catId);
    });
  });

  // Pre-load all ads
  try {
    const res = await apiGetAdvertisements();
    allAds = res.advertisements || [];
  } catch(e) {}

  // Initial load
  await refreshActiveAd();
  await checkRobotStatus();

  // Auto-poll active advertisement every 8 seconds
  pollTimer = setInterval(async () => {
    await refreshActiveAd();
    await checkRobotStatus();
  }, 8000);
}

async function filterKioskByCategory(categoryId) {
  if (!categoryId) {
    await refreshActiveAd();
    return;
  }
  const matched = allAds.find(a => a.category_id === categoryId);
  if (matched) {
    cachedActiveData = matched;
    refreshAdDisplay();
  }
}

let cachedActiveData = null;

async function refreshActiveAd() {
  try {
    const data = await apiGetActiveAdvertisement();
    if (!data) return;

    cachedActiveData = data;
    refreshAdDisplay();
  } catch (err) {
    console.warn('Kiosk sync error:', err.message);
  }
}

function refreshAdDisplay() {
  if (!cachedActiveData) return;
  const data = cachedActiveData;
  const lang = getLanguage();

  const titleEl = document.getElementById('kiosk-title');
  const catEl = document.getElementById('kiosk-category');
  const descEl = document.getElementById('kiosk-desc');
  const priceEl = document.getElementById('kiosk-price');
  const promoEl = document.getElementById('kiosk-promo');
  const featuresList = document.getElementById('kiosk-features');
  const posterImg = document.getElementById('kiosk-poster');

  // Smooth fade transition if ad changes
  if (currentAdId !== data.id) {
    if (posterImg) {
      posterImg.style.opacity = '0';
      setTimeout(() => {
        posterImg.src = data.poster_url || '/assets/ads/gaming_laptop.svg';
        posterImg.style.opacity = '1';
      }, 300);
    }
    currentAdId = data.id;
  }

  // Bilingual text selection
  if (titleEl) titleEl.textContent = data.title || 'Welcome';
  if (catEl) catEl.textContent = data.category_name || 'Featured Product';
  
  if (descEl) {
    if (lang === 'ml' && data.detailed_desc_ml) {
      descEl.textContent = data.detailed_desc_ml;
    } else {
      descEl.textContent = data.detailed_desc || data.short_desc || '';
    }
  }

  if (priceEl) {
    if (data.price) {
      priceEl.textContent = `₹${Number(data.price).toLocaleString('en-IN')}`;
      priceEl.style.display = 'block';
    } else {
      priceEl.style.display = 'none';
    }
  }

  if (promoEl) {
    if (data.promo_info) {
      promoEl.textContent = `🎁 ${data.promo_info}`;
      promoEl.style.display = 'block';
    } else {
      promoEl.style.display = 'none';
    }
  }

  if (featuresList && data.features) {
    featuresList.innerHTML = '';
    const feats = data.features.split(/[•,\n]/).map(f => f.trim()).filter(Boolean);
    feats.slice(0, 4).forEach(f => {
      const li = document.createElement('li');
      li.textContent = f;
      featuresList.appendChild(li);
    });
  }
}

async function checkRobotStatus() {
  try {
    const statusData = await apiGetRobotStatus();
    const badge = document.getElementById('robot-status-badge');
    const dot = document.getElementById('robot-status-dot');
    const text = document.getElementById('robot-status-text');

    if (statusData && statusData.device) {
      const isOnline = statusData.device.status === 'online';
      if (dot) {
        dot.className = `status-dot ${isOnline ? 'online' : 'offline'}`;
      }
      if (text) {
        text.textContent = isOnline ? t('online') : t('offline');
      }
    }
  } catch (e) {
    // Graceful silent fallback
    const dot = document.getElementById('robot-status-dot');
    const text = document.getElementById('robot-status-text');
    if (dot) dot.className = 'status-dot offline';
    if (text) text.textContent = t('offline');
  }
}

// Auto-boot on load
if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', initKiosk);
}
