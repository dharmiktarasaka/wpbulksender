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
    this.userInfo = null;
    this.io = null;
    this.isInitializing = false;
    this.reconnectTimeout = null;
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

  getStatus() {
    return {
      status: this.connectionState,
      qr: this.qrCodeDataUrl,
      userInfo: this.userInfo
    };
  }

  async init(force = false) {
    // If already open and not forced, keep connection alive without re-creating socket
    if (this.connectionState === 'open' && this.sock && !force) {
      console.log('WhatsApp connection already open and active. Preserving session.');
      this.broadcast('wa:status', this.getStatus());
      return;
    }

    // Prevent concurrent initialization attempts
    if (this.isInitializing) {
      console.log('WhatsApp initialization already in progress, waiting...');
      return;
    }

    this.isInitializing = true;

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
        return;
      }
    }

    try {
      if (!fs.existsSync(this.authFolder)) {
        fs.mkdirSync(this.authFolder, { recursive: true });
      }

      // Clean up previous socket listeners to avoid duplicate events and memory leaks
      if (this.sock) {
        try {
          this.sock.ev.removeAllListeners();
          this.sock.end(undefined);
        } catch (e) {}
        this.sock = null;
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

      // Set connecting state if not already open
      if (this.connectionState !== 'open') {
        this.connectionState = 'connecting';
        this.broadcast('wa:status', this.getStatus());
      }

      const browserInfo = Browsers?.windows ? Browsers.windows('Desktop') : ['Windows', 'Desktop', '10.0.22631'];

      this.sock = makeWASocket({
        version,
        logger,
        printQRInTerminal: false,
        auth: state,
        browser: browserInfo,
        syncFullHistory: false,
        generateHighQualityLinkPreview: false,
        connectTimeoutMs: 60000,
        defaultQueryTimeoutMs: 60000,
        keepAliveIntervalMs: 15000,
        markOnlineOnConnect: true,
        emitOwnEvents: false
      });

      this.sock.ev.on('creds.update', saveCreds);

      this.sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        // QR Code generated
        if (qr) {
          this.rawQR = qr;
          try {
            this.qrCodeDataUrl = await QRCode.toDataURL(qr, { margin: 2, scale: 8 });
            this.connectionState = 'qr_ready';
            this.broadcast('wa:qr', { qr: this.qrCodeDataUrl });
            this.broadcast('wa:status', this.getStatus());
            console.log('New WhatsApp pairing QR Code generated.');
          } catch (err) {
            console.error('Error rendering QR Code:', err);
          }
        }

        // Connection closed
        if (connection === 'close') {
          const statusCode = lastDisconnect?.error?.output?.statusCode;
          const isLoggedOut = statusCode === DisconnectReason?.loggedOut;
          const isRestartRequired = statusCode === DisconnectReason?.restartRequired || statusCode === 515;

          console.log(`WhatsApp connection closed (statusCode: ${statusCode}). Reconnecting...`);

          if (isLoggedOut) {
            // User explicitly logged out from device or app
            console.log('WhatsApp account was logged out. Clearing session.');
            this.connectionState = 'disconnected';
            this.qrCodeDataUrl = null;
            this.userInfo = null;
            this.clearAuth();
            this.broadcast('wa:status', this.getStatus());
            this.isInitializing = false;
            // Generate a fresh QR code
            setTimeout(() => this.init(true), 1500);
            return;
          }

          // For all other disconnects (restart required 515, network blips, server restarts):
          // Maintain user state and silently auto-reconnect immediately so the user stays permanently connected!
          this.isInitializing = false;
          if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);

          const delay = isRestartRequired ? 500 : 2500;
          this.reconnectTimeout = setTimeout(() => {
            console.log('Re-establishing WhatsApp multi-device connection...');
            this.init(true);
          }, delay);
        } else if (connection === 'open') {
          console.log('✅ WhatsApp connection opened and permanently linked!');
          this.connectionState = 'open';
          this.qrCodeDataUrl = null;
          this.isInitializing = false;
          if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);

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
      console.error('Error during WhatsApp init:', err);
      this.isInitializing = false;
    } finally {
      this.isInitializing = false;
    }
  }

  async logout() {
    console.log('Manual logout triggered by user.');
    if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);

    try {
      if (this.sock) {
        this.sock.ev.removeAllListeners();
        await this.sock.logout();
        this.sock.end(undefined);
      }
    } catch (e) {
      console.log('Error during logout:', e.message);
    }

    this.sock = null;
    this.clearAuth();
    this.connectionState = 'disconnected';
    this.qrCodeDataUrl = null;
    this.userInfo = null;
    this.isInitializing = false;
    this.broadcast('wa:status', this.getStatus());

    // Generate fresh QR code after manual logout
    setTimeout(() => this.init(true), 1500);
  }

  clearAuth() {
    try {
      if (fs.existsSync(this.authFolder)) {
        fs.rmSync(this.authFolder, { recursive: true, force: true });
        console.log('Auth credentials cleared.');
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

    // Ensure options is ALWAYS a valid non-null object for Baileys
    const sendOptions = (options && typeof options === 'object') ? options : {};

    // Determine if media is attached (passed as 3rd param or within content object)
    const activeMedia = media || (typeof content === 'object' && (content.mediaPath || content.path) ? content : null);

    // 1. Send Media message with text caption
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

    // 2. Text only message
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

const defaultInstance = getWhatsAppManager('default');
defaultInstance.WhatsAppManager = WhatsAppManager;
defaultInstance.getWhatsAppManager = getWhatsAppManager;

module.exports = defaultInstance;
