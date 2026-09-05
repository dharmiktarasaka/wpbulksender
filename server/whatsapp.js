const path = require('path');
const fs = require('fs');
const QRCode = require('qrcode');
const pino = require('pino');

let makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, Browsers;
try {
  const baileys = require('@whiskeysockets/baileys');
  makeWASocket = baileys.default || baileys.makeWASocket || baileys;
  useMultiFileAuthState = baileys.useMultiFileAuthState;
  DisconnectReason = baileys.DisconnectReason;
  fetchLatestBaileysVersion = baileys.fetchLatestBaileysVersion;
  Browsers = baileys.Browsers;
} catch (e) {
  console.log('Baileys module will be loaded after installation.');
}

class WhatsAppManager {
  constructor(sessionId = 'default') {
    this.sessionId = sessionId;
    this.sock = null;
    const rootDir = fs.existsSync(path.join(__dirname, '..', 'package.json'))
      ? path.join(__dirname, '..')
      : __dirname;
    const baseAuth = process.env.AUTH_DIR || path.join(rootDir, 'auth_info_baileys');
    this.authFolder = (!sessionId || sessionId === 'default')
      ? baseAuth
      : path.join(baseAuth, 'sessions', sessionId);

    this.qrCodeDataUrl = null;
    this.rawQR = null;
    this.connectionState = 'disconnected'; // 'disconnected', 'connecting', 'open', 'qr_ready'
    this.userInfo = this.getUserInfoFromCreds();
    this.io = null;
    this.isInitializing = false;
    this.isConnecting = false;
    this.isLoggingOut = false;
    this.reconnectTimeout = null;
    this.reconnectAttempts = 0;
  }

  setSocketIO(io) {
    this.io = io;
  }

  broadcast(event, data) {
    if (this.io) {
      if (this.sessionId && this.sessionId !== 'default') {
        this.io.to(`session:${this.sessionId}`).emit(event, data);
      } else {
        this.io.emit(event, data);
      }
    }
  }

  hasValidSession() {
    try {
      const credsPath = path.join(this.authFolder, 'creds.json');
      if (!fs.existsSync(credsPath)) return false;
      const raw = fs.readFileSync(credsPath, 'utf8');
      if (!raw || raw.trim().length === 0) return false;
      const data = JSON.parse(raw);
      return Boolean(data && (data.me || data.registered));
    } catch (e) {
      return false;
    }
  }

  getUserInfoFromCreds() {
    try {
      const credsPath = path.join(this.authFolder, 'creds.json');
      if (!fs.existsSync(credsPath)) return null;
      const raw = fs.readFileSync(credsPath, 'utf8');
      if (!raw || raw.trim().length === 0) return null;
      const data = JSON.parse(raw);
      if (data && data.me) {
        const id = data.me.id || '';
        let name = data.me.name;
        if (!name && id) {
          name = id.split('@')[0].split(':')[0];
        }
        return {
          id,
          name: name || 'WhatsApp Connected User'
        };
      }
    } catch (e) {}
    return null;
  }

  getStatus() {
    const validSession = this.hasValidSession();
    return {
      status: this.connectionState,
      qr: validSession ? null : this.qrCodeDataUrl,
      userInfo: this.userInfo || this.getUserInfoFromCreds(),
      hasSession: validSession
    };
  }

  scheduleReconnect(delayMs = 3000) {
    if (this.isLoggingOut) return;
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    this.reconnectTimeout = setTimeout(() => {
      this.reconnectTimeout = null;
      if (!this.isLoggingOut) {
        this.init(false).catch((err) => {
          console.error(`[${this.sessionId}] Reconnection failed:`, err.message);
        });
      }
    }, delayMs);
  }

  async init(force = false) {
    // If already open and not forced, preserve session
    if (this.connectionState === 'open' && this.sock && !force) {
      console.log(`[${this.sessionId}] WhatsApp already active and open. Preserving session.`);
      this.broadcast('wa:status', this.getStatus());
      return;
    }

    // Single-flight lock: prevent parallel socket creation
    if (this.isInitializing || this.isConnecting) {
      console.log(`[${this.sessionId}] WhatsApp connection attempt already in progress, waiting...`);
      return;
    }

    this.isInitializing = true;
    this.isConnecting = true;

    if (!makeWASocket) {
      try {
        const baileys = require('@whiskeysockets/baileys');
        makeWASocket = baileys.default || baileys.makeWASocket || baileys;
        useMultiFileAuthState = baileys.useMultiFileAuthState;
        DisconnectReason = baileys.DisconnectReason;
        fetchLatestBaileysVersion = baileys.fetchLatestBaileysVersion;
        Browsers = baileys.Browsers;
      } catch (err) {
        console.error('Failed to import Baileys:', err.message);
        this.isInitializing = false;
        this.isConnecting = false;
        return;
      }
    }

    try {
      if (!fs.existsSync(this.authFolder)) {
        fs.mkdirSync(this.authFolder, { recursive: true });
      }

      // Safely close existing socket before spawning a new one
      if (this.sock) {
        try {
          this.sock.ev.removeAllListeners();
          this.sock.end(undefined);
        } catch (e) {}
        this.sock = null;
        // Pause to ensure OS socket release & prevent WhatsApp 440 Connection Replaced
        await new Promise((r) => setTimeout(r, 600));
      }

      const { state, saveCreds } = await useMultiFileAuthState(this.authFolder);

      const logger = pino({ level: 'silent' });

      let version;
      try {
        const v = await fetchLatestBaileysVersion();
        version = v.version;
      } catch (e) {
        version = [2, 3000, 1015901307];
      }

      // Update state without wiping userInfo if already paired
      if (this.connectionState !== 'open') {
        this.connectionState = 'connecting';
        if (!this.userInfo) {
          this.userInfo = this.getUserInfoFromCreds();
        }
        this.broadcast('wa:status', this.getStatus());
      }

      // Standard cloud & container browser signature (prevents disconnects on Linux/Render)
      const browserInfo = Browsers?.ubuntu
        ? Browsers.ubuntu('Chrome')
        : ['Ubuntu', 'Chrome', '120.0.6099.109'];

      this.sock = makeWASocket({
        version,
        logger,
        printQRInTerminal: false,
        auth: state,
        browser: browserInfo,
        syncFullHistory: false,
        generateHighQualityLinkPreview: false,
        connectTimeoutMs: 90000,
        defaultQueryTimeoutMs: 90000,
        keepAliveIntervalMs: 20000, // Sends keep-alive ping every 20s to prevent cloud proxy disconnects
        markOnlineOnConnect: false,
        retryRequestDelayMs: 2500,
        emitOwnEvents: false
      });

      this.sock.ev.on('creds.update', saveCreds);

      this.sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        // QR Code generated for pairing
        if (qr) {
          // If valid paired credentials already exist, ignore spurious QR to keep session permanent
          if (!this.hasValidSession()) {
            this.rawQR = qr;
            try {
              this.qrCodeDataUrl = await QRCode.toDataURL(qr, { margin: 2, scale: 8 });
              this.connectionState = 'qr_ready';
              this.broadcast('wa:qr', { qr: this.qrCodeDataUrl });
              this.broadcast('wa:status', this.getStatus());
              console.log(`[${this.sessionId}] New WhatsApp pairing QR Code generated.`);
            } catch (err) {
              console.error('Error rendering QR Code:', err);
            }
          } else {
            console.log(`[${this.sessionId}] QR received while valid session exists. Suppressing to preserve session.`);
          }
        }

        // Connection closed
        if (connection === 'close') {
          const statusCode = lastDisconnect?.error?.output?.statusCode;
          const isRestartRequired = statusCode === DisconnectReason?.restartRequired || statusCode === 515;
          const isReplaced = statusCode === DisconnectReason?.connectionReplaced || statusCode === 440;

          console.log(`[${this.sessionId}] WhatsApp connection closed (statusCode: ${statusCode || 'unknown'}).`);

          // If manual unlink was requested, do not auto-reconnect
          if (this.isLoggingOut) {
            console.log(`[${this.sessionId}] Manual logout/unlink in progress. No reconnect scheduled.`);
            return;
          }

          this.isConnecting = false;
          this.isInitializing = false;

          // If account is already paired, DO NOT CLEAR AUTH!
          // Maintain user session permanently and silently reconnect
          if (this.hasValidSession()) {
            this.connectionState = 'connecting';
            if (!this.userInfo) {
              this.userInfo = this.getUserInfoFromCreds();
            }
            this.broadcast('wa:status', this.getStatus());

            if (isReplaced) {
              console.log(`[${this.sessionId}] Connection replaced (440). Backing off for 12s to prevent conflict...`);
              this.scheduleReconnect(12000);
              return;
            }

            const delay = isRestartRequired ? 2000 : 4000;
            console.log(`[${this.sessionId}] Silently reconnecting in ${delay}ms...`);
            this.scheduleReconnect(delay);
          } else {
            // Not paired yet: allow QR generation
            this.connectionState = 'disconnected';
            this.broadcast('wa:status', this.getStatus());
            this.scheduleReconnect(3000);
          }
        } else if (connection === 'open') {
          console.log(`[${this.sessionId}] ✅ WhatsApp connection opened and permanently linked!`);
          this.connectionState = 'open';
          this.qrCodeDataUrl = null;
          this.isConnecting = false;
          this.isInitializing = false;
          this.reconnectAttempts = 0;

          if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = null;
          }

          // Extract user info
          let userJid = this.sock?.user?.id || '';
          let userName = this.sock?.user?.name || '';
          if (!userName && userJid) {
            userName = userJid.split('@')[0].split(':')[0];
          }

          this.userInfo = {
            id: userJid,
            name: userName || 'WhatsApp Connected User'
          };

          this.broadcast('wa:status', this.getStatus());
        }
      });
    } catch (err) {
      console.error(`[${this.sessionId}] Error during WhatsApp init:`, err.message);
      this.isConnecting = false;
      this.isInitializing = false;
    } finally {
      this.isInitializing = false;
      this.isConnecting = false;
    }
  }

  // ONLY called when user explicitly clicks "Unlink WhatsApp" in the UI
  async logout() {
    console.log(`[${this.sessionId}] User explicitly clicked Unlink WhatsApp.`);
    this.isLoggingOut = true;

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    try {
      if (this.sock) {
        this.sock.ev.removeAllListeners();
        try {
          await this.sock.logout();
        } catch (e) {}
        try {
          this.sock.end(undefined);
        } catch (e) {}
      }
    } catch (e) {
      console.log('Error during logout:', e.message);
    }

    this.sock = null;
    // Strictly ONLY wipe credentials upon explicit manual Unlink
    this.clearAuth();
    this.connectionState = 'disconnected';
    this.qrCodeDataUrl = null;
    this.userInfo = null;
    this.isInitializing = false;
    this.isConnecting = false;
    this.broadcast('wa:status', this.getStatus());

    // Prepare fresh QR code for the user to pair again if desired
    setTimeout(() => {
      this.isLoggingOut = false;
      this.init(true).catch(() => {});
    }, 2000);
  }

  clearAuth() {
    try {
      if (fs.existsSync(this.authFolder)) {
        fs.rmSync(this.authFolder, { recursive: true, force: true });
        console.log(`[${this.sessionId}] Auth credentials cleared on manual unlink.`);
      }
    } catch (e) {
      console.error('Error clearing auth folder:', e.message);
    }
  }

  formatPhoneNumber(phone, defaultCountryCode = '91') {
    if (!phone) return null;
    let cleaned = String(phone).replace(/\D/g, '');
    if (!cleaned) return null;

    if (cleaned.startsWith('0')) {
      cleaned = cleaned.substring(1);
    }

    if (cleaned.length === 10 && defaultCountryCode) {
      cleaned = defaultCountryCode.replace(/\D/g, '') + cleaned;
    }

    return cleaned;
  }

  async isRegisteredUser(cleanedNumber) {
    if (!this.sock || this.connectionState !== 'open') {
      throw new Error('WhatsApp is not connected.');
    }
    try {
      const jid = `${cleanedNumber}@s.whatsapp.net`;
      const [result] = await this.sock.onWhatsApp(jid);
      return result?.exists ? result.jid : false;
    } catch (err) {
      console.error(`Validation error for ${cleanedNumber}:`, err.message);
      return false;
    }
  }

  async sendMessage(toJid, content, media = null, options = {}) {
    if (!this.sock || this.connectionState !== 'open') {
      throw new Error('WhatsApp is not connected.');
    }

    let targetJid = toJid;
    if (!targetJid.includes('@')) {
      targetJid = `${targetJid}@s.whatsapp.net`;
    }

    const sendOptions = (options && typeof options === 'object') ? options : {};
    const activeMedia = media || (typeof content === 'object' && (content.mediaPath || content.path) ? content : null);

    if (activeMedia && (activeMedia.path || activeMedia.mediaPath)) {
      const filePath = activeMedia.path || activeMedia.mediaPath;
      const mediaBuffer = fs.readFileSync(filePath);
      const mime = activeMedia.mimetype || 'image/jpeg';
      const fileName = activeMedia.originalname || path.basename(filePath);
      const caption = typeof content === 'string' ? content : (content?.caption || '');

      if (mime.startsWith('image/')) {
        return await this.sock.sendMessage(
          targetJid,
          { image: mediaBuffer, caption, mimetype: mime },
          sendOptions
        );
      } else if (mime.startsWith('video/')) {
        return await this.sock.sendMessage(
          targetJid,
          { video: mediaBuffer, caption, mimetype: mime },
          sendOptions
        );
      } else if (mime.startsWith('audio/')) {
        return await this.sock.sendMessage(
          targetJid,
          { audio: mediaBuffer, mimetype: mime },
          sendOptions
        );
      } else {
        return await this.sock.sendMessage(
          targetJid,
          { document: mediaBuffer, mimetype: mime, fileName, caption },
          sendOptions
        );
      }
    }

    const textMsg = typeof content === 'string' ? content : (content?.text || '');
    return await this.sock.sendMessage(targetJid, { text: textMsg }, sendOptions);
  }
}

// Multi-Session Registry
const waInstances = new Map();

function getWhatsAppManager(sessionId = 'default', io = null) {
  const cleanId = String(sessionId || 'default').replace(/[^a-zA-Z0-9_-]/g, '_');
  if (!waInstances.has(cleanId)) {
    const mgr = new WhatsAppManager(cleanId);
    if (io) mgr.setSocketIO(io);
    waInstances.set(cleanId, mgr);
  } else if (io && !waInstances.get(cleanId).io) {
    waInstances.get(cleanId).setSocketIO(io);
  }
  return waInstances.get(cleanId);
}

// Auto-restore any existing paired sessions on startup
function autoRestoreSessions(io) {
  const rootDir = fs.existsSync(path.join(__dirname, '..', 'package.json'))
    ? path.join(__dirname, '..')
    : __dirname;
  const baseAuth = process.env.AUTH_DIR || path.join(rootDir, 'auth_info_baileys');

  const defaultCreds = path.join(baseAuth, 'creds.json');
  if (fs.existsSync(defaultCreds)) {
    console.log('⚡ Auto-restoring default WhatsApp session...');
    const mgr = getWhatsAppManager('default', io);
    mgr.init().catch(() => {});
  }

  const sessionsDir = path.join(baseAuth, 'sessions');
  if (fs.existsSync(sessionsDir)) {
    try {
      const dirs = fs.readdirSync(sessionsDir);
      for (const sid of dirs) {
        const credsFile = path.join(sessionsDir, sid, 'creds.json');
        if (fs.existsSync(credsFile)) {
          console.log(`⚡ Auto-restoring private WhatsApp session: ${sid}...`);
          const mgr = getWhatsAppManager(sid, io);
          mgr.init().catch(() => {});
        }
      }
    } catch (e) {}
  }
}

const defaultInstance = getWhatsAppManager('default');
defaultInstance.WhatsAppManager = WhatsAppManager;
defaultInstance.getWhatsAppManager = getWhatsAppManager;
defaultInstance.autoRestoreSessions = autoRestoreSessions;

module.exports = defaultInstance;
