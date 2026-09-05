# 🚀 Complete Deployment Guide: Vercel (Frontend) + Render (Backend)

**WhatsApp Bulk Sender Pro** is architected as two decoupled, production-ready micro-services:
- 🌐 **Frontend (`client/`)**: High-performance React 18 + Vite SPA deployed on **Vercel** (Global Edge CDN).
- ⚙️ **Backend (`server/`)**: Express + Baileys Multi-Device + Socket.IO real-time engine deployed on **Render**.

---

## ☁️ Step 1: Deploy Backend to Render

1. Go to [Render.com](https://render.com) and sign in (or create a free account).
2. Push your project to your **GitHub** account.
3. In Render Dashboard, click **New +** ➔ **Web Service**.
4. Select your GitHub repository.
5. Fill in the service configuration:
   - **Name**: `wasender-backend` (or any name you prefer)
   - **Root Directory**: `server`
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type / Plan**: `Free`
6. Add Environment Variables (under **Environment** tab):
   | Key | Value | Note |
   |---|---|---|
   | `NODE_ENV` | `production` | Production mode |
   | `PORT` | `10000` | Port used by Render |
   | `CORS_ORIGIN` | `*` | Allows your Vercel frontend |
7. Click **Create Web Service**.
8. After building and deploying, Render provides your public HTTPS URL, for example:
   `https://wasender-backend.onrender.com`

---

## 🌐 Step 2: Deploy Frontend to Vercel

1. Go to [Vercel.com](https://vercel.com) and log in.
2. Click **Add New...** ➔ **Project**.
3. Import your GitHub repository.
4. Configure the project settings:
   - **Framework Preset**: `Vite` (Vercel automatically detects this)
   - **Root Directory**: Click *Edit* and select **`client`**
   - **Build Command**: `npm run build` (default)
   - **Output Directory**: `dist` (default)
5. **Add Environment Variable** (Recommended):
   - Key: `VITE_BACKEND_URL`
   - Value: `https://wasender-backend.onrender.com` *(your Render backend URL from Step 1)*
6. Click **Deploy**.
7. In ~30 seconds, your site will be live on your custom Vercel domain:
   `https://your-project.vercel.app`

---

## 🔗 Step 3: Connect & Pair WhatsApp

1. Open your Vercel URL in your browser: `https://your-project.vercel.app`.
2. If you added `VITE_BACKEND_URL` in Vercel, the app connects automatically!
   *(If not, click the **Backend Status** pill in the top header, paste your Render URL, and click **Save & Connect**).*
3. Scan the QR code shown on the screen using **WhatsApp > Linked Devices > Link a Device**.
4. You are permanently connected and ready to send bulk campaigns!

---

## 💡 Pro Tips for Production

- **Free Tier Inactivity**: Render free instances spin down after 15 minutes of inactivity. For continuous 24/7 campaigns without waiting for wake-up spin, you can upgrade to Render's $7/mo Starter plan or set up a free uptime monitor (like [UptimeRobot](https://uptimerobot.com)) to ping `https://your-backend.onrender.com/api/ping` every 10 minutes.
- **Persistent Disk (Optional)**: If you attach a Render Persistent Disk mounted to `/data` and `/auth_info_baileys`, your WhatsApp session token will persist across server updates and redeployments without needing to re-scan the QR code.
