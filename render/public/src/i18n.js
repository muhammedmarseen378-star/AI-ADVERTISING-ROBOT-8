// ============================================================================
// Bilingual Internationalization (English & Malayalam)
// Supports Indian English (en-IN) and Malayalam (ml-IN)
// ============================================================================

export const translations = {
  en: {
    appTitle: "AI Advertisement Robot",
    collegeName: "Autonomous AI Robot",
    deptName: "Smart Commercial Advertising",
    publicKiosk: "Public Kiosk",
    adminDashboard: "Admin Dashboard",
    robotStatus: "Robot Status",
    online: "Online",
    offline: "Offline",
    emergencyStop: "Emergency Stop",
    emergencyStopActive: "EMERGENCY STOP ACTIVATED",
    resetEstop: "Reset Emergency Stop",
    aiAssistant: "AI Voice Assistant",
    aiListening: "Say 'Hey Robot' to ask any question",
    aiAvailable: "AI Ready",
    currentAd: "Current Broadcast",
    nextAd: "Next Scheduled",
    price: "Price",
    features: "Key Highlights",
    specifications: "Technical Specs",
    promoOffer: "Promotional Offer",
    category: "Category",
    manualControl: "Robot Manual Control",
    autonomousMode: "Autonomous Human Following",
    forward: "Forward",
    reverse: "Reverse",
    left: "Left Turn",
    right: "Right Turn",
    stop: "Halt Motors",
    speed: "Speed",
    ultrasonicDistance: "Front Obstacle Distance",
    personTracking: "Person Tracking",
    detected: "Detected",
    notDetected: "Clear",
    welcomeTitle: "Welcome to AI Advertisement Robot",
    welcomeSub: "Autonomous Smart Advertising Platform",
    switchLanguage: "മലയാളം"
  },
  ml: {
    appTitle: "എഐ പരസ്യ റോബോട്ട്",
    collegeName: "ഓട്ടോണമസ് എഐ റോബോട്ട്",
    deptName: "സ്മാർട്ട് പരസ്യ സംവിധാനം",
    publicKiosk: "പരസ്യ കിയോസ്‌ക്",
    adminDashboard: "അഡ്മിൻ ഡാഷ്‌ബോർഡ്",
    robotStatus: "റോബോട്ട് നില",
    online: "ഓൺലൈൻ",
    offline: "ഓഫ്‌ലൈൻ",
    emergencyStop: "അടിയന്തര സ്റ്റോപ്പ് (E-Stop)",
    emergencyStopActive: "അടിയന്തര സ്റ്റോപ്പ് പ്രവർത്തനക്ഷമമാക്കി",
    resetEstop: "സ്റ്റോപ്പ് ഒഴിവാക്കുക",
    aiAssistant: "എഐ വോയ്‌സ് അസിസ്റ്റന്റ്",
    aiListening: "സംശയങ്ങൾ ചോദിക്കാൻ 'ഹേ റോബോട്ട്' എന്ന് പറയുക",
    aiAvailable: "എഐ സജ്ജമാണ്",
    currentAd: "നിലവിലെ പരസ്യം",
    nextAd: "അടുത്ത പരസ്യം",
    price: "വില",
    features: "പ്രധാന സവിശേഷതകൾ",
    specifications: "സാങ്കേതിക വിവരങ്ങൾ",
    promoOffer: "പ്രത്യേക ഓഫർ",
    category: "വിഭാഗം",
    manualControl: "റോബോട്ട് മാനുവൽ കൺട്രോൾ",
    autonomousMode: "സ്വയം നിയന്ത്രിത മോഡ്",
    forward: "മുന്നോട്ട്",
    reverse: "പിന്നോട്ട്",
    left: "ഇടത്തോട്ട്",
    right: "വലത്തോട്ട്",
    stop: "നിർത്തുക",
    speed: "വേഗത",
    ultrasonicDistance: "തടസ്സത്തിലേക്കുള്ള ദൂരം",
    personTracking: "വ്യക്തിയെ തിരിച്ചറിയൽ",
    detected: "കണ്ടെത്തി",
    notDetected: "തടസ്സമില്ല",
    welcomeTitle: "എഐ പരസ്യ റോബോട്ടിലേക്ക് സ്വാഗതം",
    welcomeSub: "ഓട്ടോണമസ് സ്മാർട്ട് പരസ്യ സംവിധാനം",
    switchLanguage: "English"
  }
};

let currentLang = localStorage.getItem('robot_kiosk_lang') || 'en';

export function getLanguage() {
  return currentLang;
}

export function setLanguage(lang) {
  if (lang === 'en' || lang === 'ml') {
    currentLang = lang;
    localStorage.setItem('robot_kiosk_lang', lang);
    document.documentElement.lang = lang;
    updatePageTranslations();
  }
}

export function toggleLanguage() {
  const newLang = currentLang === 'en' ? 'ml' : 'en';
  setLanguage(newLang);
  return newLang;
}

export function t(key) {
  return translations[currentLang]?.[key] || translations['en']?.[key] || key;
}

export function updatePageTranslations() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (key && translations[currentLang]?.[key]) {
      el.textContent = translations[currentLang][key];
    }
  });
}
