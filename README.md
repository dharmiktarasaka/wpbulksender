# 📱 WhatsApp Bulk Message Sender Pro (Decoupled Frontend & Backend)

A full-stack, secure, privacy-focused WhatsApp bulk campaign platform designed with real-time QR pairing, dynamic multi-variant templates, Spintax rotation, randomized anti-ban pacing, Excel/CSV ingestion, and live delivery tracking.

**Architecture**:
- 🌐 **Frontend (`client/`)**: Standalone static SPA with Vercel configuration, live WhatsApp simulator, and dynamic backend URL switcher.
- ⚙️ **Backend (`server/`)**: Standalone Node.js + Express + Socket.IO + Baileys multi-device engine with Render configuration and full CORS support.

---

## 🌟 Key Features

1. **WhatsApp Web Multi-Device Authentication**
   - Instant QR code generation streamed via WebSockets.
   - Real-time connection status monitoring and safe logout controls.
   - Multi-device socket support (powered by `@whiskeysockets/baileys`).

2. **Smart Contact Ingestion (Excel, CSV, Manual & Variable Editor)**
   - Drag & Drop `.xlsx`, `.xls`, and `.csv` spreadsheet parser with download sample button.
   - Automatic column detector (Phone Number, Name, Custom Attributes).
   - In-app Contact Details & Custom Variables Editor (`#contactEditModal`).
   - Deduplication tool & invalid number cleaning.

3. **Multi-Variant Message Rotation & Anti-Ban Protection**
   - **Template A/B/C/D Rotation**: Create multiple template variations that rotate randomly per contact to bypass spam patterns.
   - **Spintax Syntax Engine**: Rotates message phrasing dynamically (`{Hi|Hello|Hey}`).
   - **Dynamic Personalization**: `{{name}}`, `{{phone}}`, `{{company}}`, etc.
   - **Randomized Message Pacing**: Configurable min-max delays (e.g. 8–18 seconds) with random jitter.
   - **Batch Cooldown Pauses**: Automatic pauses (e.g. 45s every 15 messages).

4. **Live Monitoring & Audit History**
   - Live progress bar, Sent / Failed / Remaining statistics.
   - Real-time terminal log feed with colored event pills.
   - Pause, Resume, and Stop campaign controls in real-time.
   - One-click CSV delivery report export.

---

## 💻 Local Development (Run Frontend & Backend Separately)

### 1. Run Backend Server (Port 5000):
```bash
# In terminal 1:
npm run dev:backend
# OR
cd server && npm start
```
> Backend starts at: `http://localhost:5000`

### 2. Run Frontend Server (Port 3000):
```bash
# In terminal 2:
npm run dev:frontend
# OR
cd client && npm run dev
```
> Frontend opens at: `http://localhost:3000`

---

## ☁️ Deploy to Vercel (Frontend) & Render (Backend)

See the full step-by-step guide in [DEPLOYMENT.md](file:///c:/code/whatsapp%20bulk%20sender/DEPLOYMENT.md):

1. **Backend ➔ Render**:
   - Create a Web Service with Root Directory: `server`, Start Command: `npm start`.
   - Set environment variable `PORT = 10000` and `CORS_ORIGIN = *`.
   - Copy your Render backend URL (e.g. `https://your-backend.onrender.com`).

2. **Frontend ➔ Vercel**:
   - Create a project with Root Directory: `client`.
   - Deploy as a static site.

3. **Connect**:
   - Open your Vercel website, click the **Backend Server Config (⚙️)** button in the top header, enter your Render URL, and click **Save & Connect**!
