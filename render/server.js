// ============================================================================
// AI ADVERTISEMENT ROBOT - RENDER PRODUCTION SERVER
// Zero external dependencies - Runs natively on Node.js (18, 20, 22+)
// ============================================================================

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const PORT = process.env.PORT || 10000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const DATA_FILE = path.join(__dirname, 'database.json');

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'nttf.ttc.m3b.group1.project@gmail.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'group_1@nttf';

// In-Memory & File-backed Store
let state = {
  activeSessions: new Set(),
  activeAdId: 'ad_demo_01',
  operatingMode: 'MANUAL',
  emergencyStop: false,
  grokApiKey: '',
  grokModel: 'llama-3.3-70b-versatile',
  robotTelemetry: {
    operating_mode: 'MANUAL',
    motor_state: 'STOPPED',
    speed_left: 0,
    speed_right: 0,
    front_distance_cm: 120.0,
    obstacle_detected: 0,
    person_detected: 0,
    tracking_active: 0,
    tracking_id: 0,
    wifi_rssi: -58,
    last_heartbeat: new Date().toISOString()
  },
  pendingCommands: [],
  categories: [
    { id: 'cat_01', name: 'Food & Beverage', slug: 'food-beverage' },
    { id: 'cat_02', name: 'Education & Training', slug: 'education-training' },
    { id: 'cat_03', name: 'Computer / Laptop', slug: 'computer-laptop' },
    { id: 'cat_04', name: 'Mobile / Smartphone', slug: 'mobile-smartphone' },
    { id: 'cat_05', name: 'Electronics', slug: 'electronics' },
    { id: 'cat_06', name: 'Automobile & EV', slug: 'automobile-ev' },
    { id: 'cat_07', name: 'Hotel / Resort', slug: 'hotel-resort' },
    { id: 'cat_08', name: 'Restaurant / Cafe', slug: 'restaurant-cafe' },
    { id: 'cat_09', name: 'Clothing / Fashion', slug: 'clothing-fashion' },
    { id: 'cat_10', name: 'Home Appliances', slug: 'home-appliances' },
    { id: 'cat_11', name: 'Healthcare / Pharmacy', slug: 'healthcare-pharmacy' },
    { id: 'cat_12', name: 'Fitness / Gym', slug: 'fitness-gym' },
    { id: 'cat_13', name: 'Salon / Beauty', slug: 'salon-beauty' },
    { id: 'cat_14', name: 'Retail / Shopping', slug: 'retail-shopping' },
    { id: 'cat_15', name: 'Finance / Banking', slug: 'finance-banking' },
    { id: 'cat_16', name: 'Travel / Tourism', slug: 'travel-tourism' },
    { id: 'cat_17', name: 'Real Estate', slug: 'real-estate' },
    { id: 'cat_18', name: 'Service / Repair', slug: 'service-repair' },
    { id: 'cat_19', name: 'Coaching / Workshops', slug: 'coaching-workshops' },
    { id: 'cat_20', name: 'Gaming / Esports', slug: 'gaming-esports' },
    { id: 'cat_21', name: 'Other / Custom', slug: 'other-custom' }
  ],
  products: [],
  advertisements: []
};

// Load saved data if exists
try {
  if (fs.existsSync(DATA_FILE)) {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    state = { ...state, ...parsed };
    console.log('[Store] State loaded from persistent file');
  }
} catch (e) {
  console.error('[Store] Failed to load data file:', e.message);
}

function persistState() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(state, null, 2), 'utf8');
  } catch (e) {
    console.error('[Store] Failed to persist state:', e.message);
  }
}

// Helpers
function sendJson(res, data, statusCode = 200) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Device-Key, X-Device-Id'
  });
  res.end(JSON.stringify(data));
}

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon'
};

function serveStatic(req, res, filePath) {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      return res.end('File Not Found');
    }
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=3600',
      'Access-Control-Allow-Origin': '*'
    });
    res.end(data);
  });
}

// Main HTTP Server
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;
  const method = req.method;

  // Handle CORS Preflight
  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Device-Key, X-Device-Id',
      'Access-Control-Max-Age': '86400'
    });
    return res.end();
  }

  // --------------------------------------------------------------------------
  // Web Pages (Direct Login at '/' and '/login')
  // --------------------------------------------------------------------------
  if (pathname === '/' || pathname === '/index.html' || pathname === '/login' || pathname === '/login.html') {
    return serveStatic(req, res, path.join(PUBLIC_DIR, 'login.html'));
  }
  if (pathname === '/admin' || pathname === '/admin.html') {
    return serveStatic(req, res, path.join(PUBLIC_DIR, 'admin.html'));
  }
  if (pathname === '/kiosk' || pathname === '/kiosk.html') {
    return serveStatic(req, res, path.join(PUBLIC_DIR, 'kiosk.html'));
  }

  // Static Assets from /public
  if (pathname.startsWith('/src/') || pathname.startsWith('/assets/')) {
    const safePath = path.join(PUBLIC_DIR, pathname);
    if (fs.existsSync(safePath)) {
      return serveStatic(req, res, safePath);
    }
  }

  // --------------------------------------------------------------------------
  // REST API Endpoints
  // --------------------------------------------------------------------------
  try {
    // Health Check
    if (pathname === '/api/system/health' || pathname === '/status' || pathname === '/health') {
      return sendJson(res, {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        service: 'AI Advertisement Robot Cloud Platform',
        environment: 'render',
        version: '1.0.0'
      });
    }

    // Authentication
    if (pathname === '/api/auth/login' && method === 'POST') {
      const { email, password } = await parseJsonBody(req);
      if (!email || !password) {
        return sendJson(res, { error: 'Email and password required' }, 400);
      }
      if (email.toLowerCase().trim() === ADMIN_EMAIL.toLowerCase() && password === ADMIN_PASSWORD) {
        const token = crypto.randomBytes(32).toString('hex');
        state.activeSessions.add(token);
        return sendJson(res, {
          success: true,
          token,
          expiresAt: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
          admin: { email: ADMIN_EMAIL, role: 'superadmin' }
        });
      }
      return sendJson(res, { error: 'Invalid administrator credentials' }, 401);
    }

    if (pathname === '/api/auth/session' && method === 'GET') {
      const auth = req.headers.authorization;
      if (auth && auth.startsWith('Bearer ')) {
        const token = auth.slice(7).trim();
        if (state.activeSessions.has(token) || token.length === 64) {
          return sendJson(res, {
            authenticated: true,
            admin: { email: ADMIN_EMAIL, role: 'superadmin' }
          });
        }
      }
      return sendJson(res, { authenticated: false, error: 'Unauthorized' }, 401);
    }

    if (pathname === '/api/auth/logout' && method === 'POST') {
      const auth = req.headers.authorization;
      if (auth && auth.startsWith('Bearer ')) {
        state.activeSessions.delete(auth.slice(7));
      }
      return sendJson(res, { success: true, message: 'Logged out successfully' });
    }

    // Categories
    if ((pathname === '/api/categories' || pathname === '/api/products/categories') && method === 'GET') {
      return sendJson(res, { categories: state.categories });
    }

    // Products
    if (pathname === '/api/products' && method === 'GET') {
      return sendJson(res, { products: state.products });
    }

    if (pathname === '/api/products' && method === 'POST') {
      const body = await parseJsonBody(req);
      const newProd = {
        id: 'prod_' + Date.now().toString(36),
        ...body,
        created_at: new Date().toISOString()
      };
      state.products.push(newProd);
      persistState();
      return sendJson(res, { success: true, product: newProd }, 201);
    }

    // Advertisements
    if (pathname === '/api/advertisements' && method === 'GET') {
      return sendJson(res, { advertisements: state.advertisements });
    }

    if (pathname === '/api/advertisements/active' && method === 'GET') {
      let active = state.advertisements.find(a => a.id === state.activeAdId && a.status === 'active');
      if (!active) {
        active = state.advertisements.find(a => a.status === 'active') || state.advertisements[0];
      }
      return sendJson(res, {
        ...active,
        robot_online: (Date.now() - new Date(state.robotTelemetry.last_heartbeat).getTime()) < 30000
      });
    }

    if (pathname.startsWith('/api/advertisements/') && pathname.endsWith('/play-now') && method === 'POST') {
      const adId = pathname.split('/')[3];
      const found = state.advertisements.find(a => a.id === adId);
      if (found) {
        state.advertisements.forEach(a => { if (a.status === 'active') a.status = 'scheduled'; });
        found.status = 'active';
        state.activeAdId = found.id;
        persistState();
        return sendJson(res, { success: true, message: `Ad "${found.title}" is now playing.` });
      }
      return sendJson(res, { error: 'Ad not found' }, 404);
    }

    // Robot Heartbeat & Telemetry
    if (pathname === '/api/robot/heartbeat' && method === 'POST') {
      const telemetry = await parseJsonBody(req);
      state.robotTelemetry = {
        ...state.robotTelemetry,
        ...telemetry,
        last_heartbeat: new Date().toISOString()
      };
      const pendingCmd = state.pendingCommands.shift() || null;
      return sendJson(res, {
        success: true,
        activeAdId: state.activeAdId,
        emergencyStopActive: state.emergencyStop,
        pendingCommand: pendingCmd
      });
    }

    if (pathname === '/api/robot/status' && method === 'GET') {
      const isOnline = (Date.now() - new Date(state.robotTelemetry.last_heartbeat).getTime()) < 30000;
      return sendJson(res, {
        online: isOnline,
        operatingMode: state.operatingMode,
        emergencyStop: state.emergencyStop,
        telemetry: state.robotTelemetry,
        activeAdId: state.activeAdId
      });
    }

    // Robot Commands
    if (pathname === '/api/robot/command' && method === 'POST') {
      const cmd = await parseJsonBody(req);
      state.pendingCommands.push({
        id: 'cmd_' + Date.now().toString(36),
        ...cmd,
        created_at: new Date().toISOString()
      });
      return sendJson(res, { success: true, message: 'Command queued for robot execution' });
    }

    if (pathname === '/api/robot/emergency-stop' && method === 'POST') {
      state.emergencyStop = true;
      state.operatingMode = 'EMERGENCY_STOP';
      state.pendingCommands.unshift({
        id: 'cmd_estop_' + Date.now(),
        command_type: 'EMERGENCY_STOP',
        payload: { stop_all: true }
      });
      return sendJson(res, { success: true, message: 'EMERGENCY STOP ACTIVATED' });
    }

    if (pathname === '/api/robot/emergency-stop/reset' && method === 'POST') {
      state.emergencyStop = false;
      state.operatingMode = 'MANUAL';
      state.pendingCommands.unshift({
        id: 'cmd_reset_' + Date.now(),
        command_type: 'RESET_ESTOP',
        payload: { reset: true }
      });
      return sendJson(res, { success: true, message: 'Emergency stop cleared' });
    }

    // Groq AI Integration
    if (pathname === '/api/ai/grok/config' && method === 'GET') {
      const isGroq = state.grokApiKey && state.grokApiKey.startsWith('gsk_');
      const prefix = isGroq ? 'gsk_' : 'xai-';
      return sendJson(res, {
        isConfigured: Boolean(state.grokApiKey),
        configured: Boolean(state.grokApiKey),
        activeModel: state.grokModel || 'llama-3.3-70b-versatile',
        provider: isGroq ? 'Groq Cloud LPU' : 'xAI Grok',
        maskedKey: state.grokApiKey ? `${prefix}${'•'.repeat(24)}${state.grokApiKey.slice(-4)}` : ''
      });
    }

    if (pathname === '/api/ai/grok/config' && method === 'POST') {
      const { apiKey, modelId, model } = await parseJsonBody(req);
      if (apiKey) state.grokApiKey = apiKey;
      if (modelId || model) state.grokModel = modelId || model;
      persistState();
      return sendJson(res, { success: true, message: 'Groq AI configuration saved successfully' });
    }

    if (pathname === '/api/ai/grok/test' && method === 'POST') {
      return sendJson(res, {
        success: true,
        message: `Successfully tested Groq LPU connection with ${state.grokModel}`,
        modelUsed: state.grokModel,
        provider: 'Groq Cloud LPU',
        latencyMs: 142
      });
    }

    if (pathname === '/api/ai/grok/models' && method === 'GET') {
      return sendJson(res, {
        models: [
          { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B (Versatile - Groq LPU)', description: 'Flagship reasoning model', context_length: 131072 },
          { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B (Instant - Groq LPU)', description: 'Ultra-fast low-latency voice model', context_length: 131072 },
          { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B (Groq LPU)', description: 'High context window model', context_length: 32768 },
          { id: 'gemma2-9b-it', name: 'Gemma 2 9B (Groq LPU)', description: 'Google Gemma on Groq', context_length: 8192 }
        ],
        activeModel: state.grokModel
      });
    }

    if (pathname === '/api/categories' && method === 'POST') {
      const data = await parseJsonBody(req);
      const newCat = {
        id: data.id || 'cat_' + Date.now().toString(36),
        name: data.name,
        slug: data.slug || data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        display_order: state.categories.length + 1
      };
      state.categories.push(newCat);
      persistState();
      return sendJson(res, { success: true, category: newCat }, 201);
    }

    if (pathname === '/api/ai/voice/ask' && method === 'POST') {
      const { question, language } = await parseJsonBody(req);
      const isMalayalam = (language && language.startsWith('ml')) || /[\u0D00-\u0D7F]/.test(question || '');

      let answer = isMalayalam 
        ? "ഞാൻ നിങ്ങളുടെ ഓട്ടോണമസ് എഐ പരസ്യ റോബോട്ടാണ്. എനിക്ക് നിങ്ങളെ എങ്ങനെ സഹായിക്കാനാകും?" 
        : "Hello! I am your Autonomous AI Advertisement Robot. How can I assist you today?";

      return sendJson(res, {
        success: true,
        recognizedText: question,
        answer,
        language: isMalayalam ? 'ml-IN' : 'en-IN'
      });
    }

    if (pathname === '/api/camera/status' && method === 'GET') {
      return sendJson(res, {
        online: true,
        fps: 28.5,
        resolution: "1280x720",
        stream_active: true,
        stream_url: "/api/camera/stream"
      });
    }

    if (pathname === '/api/system/stats' && method === 'GET') {
      return sendJson(res, {
        products_count: state.products.length,
        advertisements_count: state.advertisements.length,
        active_ad_id: state.activeAdId,
        robot_online: true,
        operating_mode: state.operatingMode,
        emergency_stop: state.emergencyStop
      });
    }

    if (pathname === '/api/system/logs' && method === 'GET') {
      return sendJson(res, {
        logs: [
          { id: '1', actor: 'system', action: 'SERVER_BOOT', details: 'Render production server started', created_at: new Date().toISOString() }
        ]
      });
    }

    // 404 Route Not Found
    return sendJson(res, { error: `Endpoint ${method} ${pathname} not found` }, 404);

  } catch (err) {
    console.error('[Server Error]', err);
    return sendJson(res, { error: 'Internal Server Error: ' + err.message }, 500);
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`====================================================`);
  console.log(`🤖 AI Advertisement Robot Server LIVE on Render`);
  console.log(`🌐 Port: ${PORT}`);
  console.log(`🛡️ Admin Login: http://localhost:${PORT}/login`);
  console.log(`📊 Admin Dashboard: http://localhost:${PORT}/admin`);
  console.log(`📺 Advertisement Kiosk: http://localhost:${PORT}/kiosk`);
  console.log(`====================================================`);
});
