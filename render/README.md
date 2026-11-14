# AI Advertisement Robot - Render.com Deployment Package

A complete, self-contained deployment package for [Render.com](https://render.com).

---

## 📁 Folder Structure

```
render/
├── server.js               # Production Node.js server (zero external dependencies)
├── package.json            # npm start script and metadata
├── render.yaml             # Render Blueprint specification for 1-click setup
├── database.json           # File-backed persistence for products, ads, and telemetry
└── public/                 # Static web application
    ├── index.html          # Direct Administrator Login (no NTTF / project mentions)
    ├── login.html          # Administrator Login
    ├── admin.html          # 13-section Administrator Dashboard
    ├── kiosk.html          # Full-screen Advertisement Kiosk
    ├── src/
    │   ├── styles.css      # Cyberpunk UI styling
    │   ├── api.js          # API client
    │   ├── admin.js        # Admin dashboard controller
    │   ├── kiosk.js        # Kiosk controller
    │   └── i18n.js         # Malayalam / English translation engine
    └── assets/
        └── ads/            # Vector advertisement posters (.svg)
```

---

## 🚀 How to Deploy on Render.com (Web Service)

### Method 1: Connecting your GitHub Repository
1. In your GitHub repository (`muhammedmarseen378-star/AI-ADVERTISING-ROBOT`), commit/upload the **`render`** folder.
2. Log in to [Render.com](https://dashboard.render.com/).
3. Click **New +** (top right) → **Web Service**.
4. Select your GitHub repository.
5. Configure the following settings:
   * **Name:** `ai-advertising-robot`
   * **Root Directory:** `render`
   * **Environment / Runtime:** `Node`
   * **Build Command:** `npm install` *(or leave blank)*
   * **Start Command:** `node server.js`
   * **Plan:** Free
6. Click **Deploy Web Service**.

---

### Method 2: Deploying as a Static Site on Render
If you only want to host the frontend on Render:
1. In Render, select **New +** → **Static Site**.
2. **Root Directory:** `render/public`
3. **Build Command:** *(Leave blank)*
4. **Publish Directory:** `.`
5. Click **Create Static Site**.

---

## 🔑 Administrator Credentials
* **Email:** `nttf.ttc.m3b.group1.project@gmail.com`
* **Password:** `group_1@nttf`
* **Direct Access:** Visiting your Render URL (`https://<service-name>.onrender.com/`) opens the Administrator Login page directly.
