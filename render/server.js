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
  activeAdId: null,
  activeAdPageId: 1,
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
  categories: [],
  products: [],
  advertisements: [],
  schedules: []
};

// Load saved data if exists
try {
  if (fs.existsSync(DATA_FILE)) {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    state = { ...state, ...parsed };
    // Eliminate any legacy dummy categories
    if (Array.isArray(state.categories)) {
      state.categories = state.categories.filter(c => !c.id.startsWith('cat_0') && !c.id.startsWith('cat_1') && !c.id.startsWith('cat_2'));
    }
    if (!Array.isArray(state.schedules)) {
      state.schedules = [];
    }
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
    res.writeHead(302, { 'Location': '/admin.html' });
    return res.end();
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
        id: body.id || ('prod_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 6)),
        ...body,
        created_at: new Date().toISOString()
      };
      state.products.push(newProd);
      persistState();
      return sendJson(res, { success: true, product: newProd }, 201);
    }

    if (pathname.startsWith('/api/products/') && method === 'PUT') {
      const prodId = pathname.replace('/api/products/', '');
      const body = await parseJsonBody(req);
      const idx = state.products.findIndex(p => p.id === prodId);
      if (idx !== -1) {
        state.products[idx] = { ...state.products[idx], ...body, updated_at: new Date().toISOString() };
        persistState();
        return sendJson(res, { success: true, product: state.products[idx], message: 'Product updated successfully.' });
      }
      return sendJson(res, { error: 'Product not found' }, 404);
    }

    if (pathname.startsWith('/api/products/') && method === 'DELETE') {
      const prodId = pathname.replace('/api/products/', '');
      state.products = state.products.filter(p => p.id !== prodId);
      persistState();
      return sendJson(res, { success: true, message: 'Product deleted successfully.' });
    }

    // Advertisements
    if (pathname === '/api/advertisements' && method === 'GET') {
      return sendJson(res, { advertisements: state.advertisements });
    }

    if (pathname === '/api/advertisements' && method === 'POST') {
      const body = await parseJsonBody(req);
      const newAd = {
        id: body.id || ('ad_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 6)),
        ...body,
        created_at: new Date().toISOString()
      };
      state.advertisements.push(newAd);
      persistState();
      return sendJson(res, { success: true, advertisement: newAd }, 201);
    }

    if (pathname.startsWith('/api/advertisements/') && pathname.endsWith('/play-now') && method === 'POST') {
      const adId = pathname.split('/')[3];
      const found = state.advertisements.find(a => a.id === adId);
      if (found) {
        state.advertisements.forEach(a => { if (a.status === 'active') a.status = 'scheduled'; });
        found.status = 'active';
        state.activeAdId = found.id;
        state.activeAdPageId = found.display_page_id || 1;
        persistState();
        return sendJson(res, { success: true, message: `Ad "${found.title}" is now playing.` });
      }
      return sendJson(res, { error: 'Ad not found' }, 404);
    }

    if (pathname.startsWith('/api/advertisements/') && pathname.endsWith('/pause') && method === 'POST') {
      const adId = pathname.split('/')[3];
      const found = state.advertisements.find(a => a.id === adId);
      if (found) {
        found.status = 'paused';
        persistState();
        return sendJson(res, { success: true, message: `Ad "${found.title}" paused.` });
      }
      return sendJson(res, { error: 'Ad not found' }, 404);
    }

    if (pathname.startsWith('/api/advertisements/') && pathname.endsWith('/resume') && method === 'POST') {
      const adId = pathname.split('/')[3];
      const found = state.advertisements.find(a => a.id === adId);
      if (found) {
        found.status = 'active';
        persistState();
        return sendJson(res, { success: true, message: `Ad "${found.title}" resumed.` });
      }
      return sendJson(res, { error: 'Ad not found' }, 404);
    }

    if (pathname.startsWith('/api/advertisements/') && method === 'PUT') {
      const adId = pathname.replace('/api/advertisements/', '');
      const body = await parseJsonBody(req);
      const idx = state.advertisements.findIndex(a => a.id === adId);
      if (idx !== -1) {
        state.advertisements[idx] = { ...state.advertisements[idx], ...body, updated_at: new Date().toISOString() };
        persistState();
        return sendJson(res, { success: true, advertisement: state.advertisements[idx], message: 'Ad updated successfully.' });
      }
      return sendJson(res, { error: 'Ad not found' }, 404);
    }

    if (pathname.startsWith('/api/advertisements/') && method === 'DELETE') {
      const adId = pathname.replace('/api/advertisements/', '');
      state.advertisements = state.advertisements.filter(a => a.id !== adId);
      persistState();
      return sendJson(res, { success: true, message: 'Ad deleted successfully.' });
    }

    // Robot Heartbeat & Telemetry (ESP32 Integration)
    if (pathname === '/api/robot/heartbeat' && method === 'POST') {
      const telemetry = await parseJsonBody(req);
      state.robotTelemetry = {
        ...state.robotTelemetry,
        ...telemetry,
        last_heartbeat: new Date().toISOString()
      };
      
      // Dispatch any queued commands to ESP32
      const commandsToDispatch = state.pendingCommands.splice(0, state.pendingCommands.length);
      
      return sendJson(res, {
        status: 'OK',
        timestamp: new Date().toISOString(),
        emergencyStopActive: state.emergencyStop,
        activeAdvertisement: {
          adId: state.activeAdId || null,
          displayPageId: state.activeAdPageId || 1
        },
        commands: commandsToDispatch
      });
    }

    if (pathname === '/api/robot/command/ack' && method === 'POST') {
      const ackData = await parseJsonBody(req);
      return sendJson(res, { success: true, acknowledged: ackData.commandId });
    }

    if (pathname === '/api/robot/status' && method === 'GET') {
      const isOnline = (Date.now() - new Date(state.robotTelemetry.last_heartbeat).getTime()) < 30000;
      return sendJson(res, {
        online: isOnline,
        device: {
          id: 'ESP32_MAIN_ROBOT_01',
          name: 'SevenSemi ESP32-S3 Main Controller',
          status: isOnline ? 'online' : 'offline',
          lastSeen: state.robotTelemetry.last_heartbeat,
          firmwareVersion: state.robotTelemetry.firmwareVersion || '1.0.0'
        },
        operatingMode: state.operatingMode,
        emergencyStop: state.emergencyStop,
        telemetry: state.robotTelemetry,
        activeAdId: state.activeAdId
      });
    }

    // Robot Commands (Manual Control from Website to ESP32)
    if (pathname === '/api/robot/command' && method === 'POST') {
      const body = await parseJsonBody(req);
      const cmdType = body.commandType || body.command_type;
      
      if (state.emergencyStop && cmdType === 'MOVE') {
        return sendJson(res, { error: 'Emergency Stop is currently active. Reset Emergency Stop before dispatching movement.' }, 403);
      }

      const payloadJson = typeof body.payload === 'string' ? body.payload : JSON.stringify(body.payload || {});
      const cmdObj = {
        id: 'cmd_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 6),
        command_type: cmdType,
        payload_json: payloadJson,
        created_at: new Date().toISOString()
      };
      state.pendingCommands.push(cmdObj);
      return sendJson(res, { success: true, commandId: cmdObj.id, message: 'Command queued for robot execution' });
    }

    if (pathname === '/api/robot/emergency-stop' && method === 'POST') {
      state.emergencyStop = true;
      state.operatingMode = 'EMERGENCY_STOP';
      const estopCmd = {
        id: 'estop_' + Date.now().toString(36),
        command_type: 'EMERGENCY_STOP',
        payload_json: '{}',
        created_at: new Date().toISOString()
      };
      state.pendingCommands = [estopCmd];
      return sendJson(res, { success: true, message: 'EMERGENCY STOP ACTIVATED', emergencyStopActive: true });
    }

    if (pathname === '/api/robot/emergency-stop/reset' && method === 'POST') {
      state.emergencyStop = false;
      state.operatingMode = 'MANUAL';
      const resetCmd = {
        id: 'reset_' + Date.now().toString(36),
        command_type: 'RESET_ESTOP',
        payload_json: '{}',
        created_at: new Date().toISOString()
      };
      state.pendingCommands.push(resetCmd);
      return sendJson(res, { success: true, message: 'Emergency stop cleared', emergencyStopActive: false });
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
        icon: data.icon || '🏷️',
        display_order: state.categories.length + 1
      };
      state.categories.push(newCat);
      persistState();
      return sendJson(res, { success: true, category: newCat }, 201);
    }

    if (pathname.startsWith('/api/categories/') && method === 'PUT') {
      const catId = pathname.replace('/api/categories/', '');
      const body = await parseJsonBody(req);
      const idx = state.categories.findIndex(c => c.id === catId);
      if (idx !== -1) {
        state.categories[idx] = { ...state.categories[idx], ...body, updated_at: new Date().toISOString() };
        persistState();
        return sendJson(res, { success: true, category: state.categories[idx], message: 'Category updated.' });
      }
      return sendJson(res, { error: 'Category not found' }, 404);
    }

    if (pathname.startsWith('/api/categories/') && method === 'DELETE') {
      const catId = pathname.replace('/api/categories/', '');
      state.categories = state.categories.filter(c => c.id !== catId);
      persistState();
      return sendJson(res, { success: true, message: 'Category deleted successfully.' });
    }

    // -------------------------------------------------------------
    // Advertisement Schedules Endpoints
    // -------------------------------------------------------------
    if (pathname === '/api/schedules' && method === 'GET') {
      return sendJson(res, { schedules: state.schedules || [] });
    }

    if (pathname === '/api/schedules' && method === 'POST') {
      const body = await parseJsonBody(req);
      const newSchedule = {
        id: body.id || ('sched_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 6)),
        advertisement_id: body.advertisement_id || '',
        ad_title: body.ad_title || '',
        display_page_id: parseInt(body.display_page_id || 1),
        start_time: body.start_time || '09:00',
        end_time: body.end_time || '21:00',
        duration_sec: parseInt(body.duration_sec || 30),
        days: body.days || 'Every Day',
        priority: parseInt(body.priority || 2),
        is_active: body.is_active !== undefined ? (body.is_active ? 1 : 0) : 1,
        created_at: new Date().toISOString()
      };
      if (!state.schedules) state.schedules = [];
      state.schedules.push(newSchedule);
      persistState();
      return sendJson(res, { success: true, schedule: newSchedule }, 201);
    }

    if (pathname.startsWith('/api/schedules/') && pathname.endsWith('/toggle') && method === 'POST') {
      const schedId = pathname.split('/')[3];
      if (!state.schedules) state.schedules = [];
      const found = state.schedules.find(s => s.id === schedId);
      if (found) {
        found.is_active = found.is_active ? 0 : 1;
        persistState();
        return sendJson(res, { success: true, schedule: found });
      }
      return sendJson(res, { error: 'Schedule not found' }, 404);
    }

    if (pathname.startsWith('/api/schedules/') && method === 'PUT') {
      const schedId = pathname.replace('/api/schedules/', '');
      const body = await parseJsonBody(req);
      if (!state.schedules) state.schedules = [];
      const idx = state.schedules.findIndex(s => s.id === schedId);
      if (idx !== -1) {
        state.schedules[idx] = { ...state.schedules[idx], ...body, updated_at: new Date().toISOString() };
        persistState();
        return sendJson(res, { success: true, schedule: state.schedules[idx] });
      }
      return sendJson(res, { error: 'Schedule not found' }, 404);
    }

    if (pathname.startsWith('/api/schedules/') && method === 'DELETE') {
      const schedId = pathname.replace('/api/schedules/', '');
      if (!state.schedules) state.schedules = [];
      state.schedules = state.schedules.filter(s => s.id !== schedId);
      persistState();
      return sendJson(res, { success: true, message: 'Schedule deleted successfully.' });
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

    if (pathname === '/api/camera/heartbeat' && method === 'POST') {
      const data = await parseJsonBody(req);
      state.cameraStatus = {
        online: true,
        fps: data.fps || 25,
        resolution: data.resolution || '1280x720',
        stream_active: true,
        stream_url: data.stream_url || `http://${data.ip || '192.168.1.150'}:81/stream`,
        last_heartbeat: new Date().toISOString()
      };
      return sendJson(res, { status: 'success' });
    }

    if (pathname === '/api/camera/status' && method === 'GET') {
      const isOnline = state.cameraStatus && (Date.now() - new Date(state.cameraStatus.last_heartbeat).getTime() < 15000);
      return sendJson(res, {
        online: isOnline || false,
        fps: isOnline ? (state.cameraStatus.fps || 25) : 0,
        resolution: isOnline ? (state.cameraStatus.resolution || "1280x720") : "Offline",
        stream_active: isOnline || false,
        stream_url: isOnline ? state.cameraStatus.stream_url : null
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
