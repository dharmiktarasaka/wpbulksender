const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const { Server } = require('socket.io');
const multer = require('multer');
const xlsx = require('xlsx');

const waManager = require('./whatsapp');
const campaignQueue = require('./queue');
const storage = require('./storage');

const app = express();
const server = http.createServer(app);

// Backend Port (Defaults to 5000 locally, or process.env.PORT on Render / Cloud)
const PORT = process.env.PORT || 5000;

// Setup directories (safe for both root execution and server/ directory execution)
const ROOT_DIR = fs.existsSync(path.join(__dirname, '..', 'package.json')) 
  ? path.join(__dirname, '..') 
  : __dirname;

const UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(ROOT_DIR, 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Socket.IO Server with permissive CORS for Vercel / Remote Frontends
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: false
  },
  transports: ['websocket', 'polling']
});

// Multer storage
const storageEngine = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + '-' + file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_'));
  }
});
const upload = multer({ storage: storageEngine, limits: { fileSize: 50 * 1024 * 1024 } }); // 50MB max

// Middlewares - Full CORS support with x-session-id for isolated multi-tenancy
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'x-session-id']
}));
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// Multi-Tenant Private Workspace / Session Middleware
function sessionMiddleware(req, res, next) {
  let sid = req.headers['x-session-id'] || req.query.sessionId;
  if (!sid && req.headers.cookie) {
    const match = req.headers.cookie.match(/wa_session_id=([^;]+)/);
    if (match) sid = match[1];
  }
  if (!sid || typeof sid !== 'string' || sid.trim().length === 0) {
    sid = 'default';
  }
  req.sessionId = sid.trim().replace(/[^a-zA-Z0-9_-]/g, '_');
  res.setHeader('x-session-id', req.sessionId);
  next();
}
app.use(sessionMiddleware);

// Static file hosting for uploads (Media files sent in WhatsApp messages)
app.use('/uploads', express.static(UPLOADS_DIR));

// Static frontend serving fallback (if client exists alongside backend)
const CLIENT_DIR = path.join(ROOT_DIR, 'client');
if (fs.existsSync(CLIENT_DIR)) {
  app.use(express.static(CLIENT_DIR));
}

// Pass Socket.IO to default instances
waManager.setSocketIO(io);
campaignQueue.setSocketIO(io);

// Socket.io connection with Private Room Isolation
io.on('connection', (socket) => {
  const rawSid = socket.handshake.auth?.sessionId || socket.handshake.query?.sessionId || 'default';
  const sessionId = String(rawSid).replace(/[^a-zA-Z0-9_-]/g, '_');
  socket.sessionId = sessionId;
  socket.join(`session:${sessionId}`);

  console.log(`Client connected to Socket.IO: ${socket.id} (Private Session: ${sessionId})`);

  // Get isolated instances for this specific session
  const userWa = waManager.getWhatsAppManager(sessionId, io);
  const userQueue = campaignQueue.getCampaignQueue(sessionId, userWa, io);

  // Emit current states ONLY to this specific connecting client
  socket.emit('wa:status', userWa.getStatus());
  socket.emit('campaign:status', userQueue.getCurrentState());

  socket.on('disconnect', () => {
    console.log(`Client disconnected from Socket.IO: ${socket.id} (Private Session: ${sessionId})`);
  });
});

// ==================== REST APIs (Isolated Per Session) ==================== //

// 1. WhatsApp Endpoints
app.get('/api/whatsapp/status', (req, res) => {
  const userWa = waManager.getWhatsAppManager(req.sessionId, io);
  res.json(userWa.getStatus());
});

app.post('/api/whatsapp/init', async (req, res) => {
  try {
    const userWa = waManager.getWhatsAppManager(req.sessionId, io);
    await userWa.init();
    res.json({ success: true, message: 'WhatsApp initialization triggered.', sessionId: req.sessionId });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/whatsapp/logout', async (req, res) => {
  try {
    const userWa = waManager.getWhatsAppManager(req.sessionId, io);
    await userWa.logout();
    res.json({ success: true, message: 'Logged out successfully.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/whatsapp/send-test', async (req, res) => {
  try {
    const { phone, message } = req.body;
    if (!phone) {
      return res.status(400).json({ success: false, error: 'Phone number is required.' });
    }
    const userWa = waManager.getWhatsAppManager(req.sessionId, io);
    const formatted = userWa.formatPhoneNumber(phone);
    const jid = `${formatted}@s.whatsapp.net`;
    const result = await userWa.sendMessage(jid, message || 'Hello! Test message from WhatsApp Bulk Sender Pro.');
    res.json({ success: true, jid, messageId: result?.key?.id, status: 'sent' });
  } catch (err) {
    console.error('Send test error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 2. Contact Ingestion & File Upload (Excel / CSV)
app.post('/api/contacts/parse', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded.' });
    }

    const filePath = req.file.path;
    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rawData = xlsx.utils.sheet_to_json(sheet, { defval: '' });

    // Clean up uploaded file
    try {
      fs.unlinkSync(filePath);
    } catch (e) {}

    if (!rawData || rawData.length === 0) {
      return res.status(400).json({ success: false, error: 'File contains no data rows.' });
    }

    const columns = Object.keys(rawData[0]);
    res.json({
      success: true,
      totalRows: rawData.length,
      columns,
      preview: rawData.slice(0, 5),
      data: rawData
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to process file: ' + err.message });
  }
});

// 3. Media Upload
app.post('/api/media/upload', upload.single('media'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded.' });
    }
    res.json({
      success: true,
      file: {
        filename: req.file.filename,
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
        path: req.file.path,
        url: `/uploads/${req.file.filename}`
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4. Templates (Isolated Per Session)
app.get('/api/templates', (req, res) => {
  res.json(storage.getTemplates(req.sessionId));
});

app.post('/api/templates', (req, res) => {
  const template = storage.saveTemplate(req.body, req.sessionId);
  res.json({ success: true, template });
});

app.delete('/api/templates/:id', (req, res) => {
  storage.deleteTemplate(req.params.id, req.sessionId);
  res.json({ success: true });
});

// 5. Settings (Isolated Per Session)
app.get('/api/settings', (req, res) => {
  res.json(storage.getSettings(req.sessionId));
});

app.post('/api/settings', (req, res) => {
  const settings = storage.saveSettings(req.body, req.sessionId);
  res.json({ success: true, settings });
});

// 6. Campaign Actions (Isolated Per Session)
app.post('/api/campaign/start', upload.single('mediaFile'), async (req, res) => {
  try {
    let { name, contacts, template, templates, settings } = req.body;

    if (typeof contacts === 'string') {
      contacts = JSON.parse(contacts);
    }
    if (typeof settings === 'string') {
      settings = JSON.parse(settings);
    }
    if (typeof templates === 'string') {
      try {
        templates = JSON.parse(templates);
      } catch (e) {
        templates = [templates];
      }
    }

    let media = null;
    if (req.file) {
      media = {
        path: req.file.path,
        originalname: req.file.originalname,
        mimetype: req.file.mimetype
      };
    }

    const userWa = waManager.getWhatsAppManager(req.sessionId, io);
    const userQueue = campaignQueue.getCampaignQueue(req.sessionId, userWa, io);

    const result = await userQueue.startCampaign({
      name,
      contacts,
      template,
      templates,
      media,
      settings: settings || storage.getSettings(req.sessionId)
    });

    res.json({ success: true, ...result });
  } catch (err) {
    console.error('Error starting campaign:', err);
    res.status(400).json({ success: false, error: err.message });
  }
});

app.post('/api/campaign/pause', (req, res) => {
  const userQueue = campaignQueue.getCampaignQueue(req.sessionId, null, io);
  const success = userQueue.pauseCampaign();
  res.json({ success, message: success ? 'Campaign paused' : 'No campaign running' });
});

app.post('/api/campaign/resume', (req, res) => {
  const userQueue = campaignQueue.getCampaignQueue(req.sessionId, null, io);
  const success = userQueue.resumeCampaign();
  res.json({ success, message: success ? 'Campaign resumed' : 'No paused campaign to resume' });
});

app.post('/api/campaign/stop', (req, res) => {
  const userQueue = campaignQueue.getCampaignQueue(req.sessionId, null, io);
  const success = userQueue.stopCampaign();
  res.json({ success, message: success ? 'Campaign stopped' : 'No active campaign to stop' });
});

app.get('/api/campaign/status', (req, res) => {
  const userQueue = campaignQueue.getCampaignQueue(req.sessionId, null, io);
  res.json(userQueue.getCurrentState());
});

// 7. Campaign History & Export (Isolated Per Session)
app.get('/api/campaigns', (req, res) => {
  res.json(storage.getCampaigns(req.sessionId));
});

app.get('/api/campaigns/:id', (req, res) => {
  const campaign = storage.getCampaignById(req.params.id, req.sessionId);
  if (!campaign) return res.status(404).json({ success: false, error: 'Campaign not found' });
  res.json(campaign);
});

app.delete('/api/campaigns/:id', (req, res) => {
  storage.deleteCampaign(req.params.id, req.sessionId);
  res.json({ success: true });
});

app.delete('/api/campaigns', (req, res) => {
  storage.clearCampaigns(req.sessionId);
  res.json({ success: true, message: 'All campaigns deleted.' });
});

app.get('/api/campaigns/:id/export', (req, res) => {
  const campaign = storage.getCampaignById(req.params.id, req.sessionId);
  if (!campaign || !campaign.records) {
    return res.status(404).send('Campaign records not found');
  }

  const exportData = campaign.records.map((r, i) => ({
    Index: i + 1,
    Phone: r.phone,
    Status: r.status,
    Message: r.message || '',
    Reason: r.reason || '',
    Timestamp: r.timestamp || ''
  }));

  const worksheet = xlsx.utils.json_to_sheet(exportData);
  const csvOutput = xlsx.utils.sheet_to_csv(worksheet);

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${campaign.name.replace(/[^a-zA-Z0-9_-]/g, '_')}_report.csv"`);
  res.send(csvOutput);
});

// 8. Health Check for Render & Uptime Monitors
app.get('/api/health', (req, res) => {
  const userWa = waManager.getWhatsAppManager(req.sessionId, io);
  res.json({
    status: 'healthy',
    name: 'WhatsApp Bulk Sender Backend',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    sessionId: req.sessionId,
    whatsappConnected: userWa.getStatus().status === 'open'
  });
});

app.get('/api/ping', (req, res) => {
  res.json({ pong: true, timestamp: Date.now() });
});

// Start Server
server.listen(PORT, async () => {
  console.log(`====================================================`);
  console.log(`🚀 WhatsApp Bulk Sender Backend running on PORT: ${PORT}`);
  console.log(`🌐 Local URL: http://localhost:${PORT}`);
  console.log(`📡 Socket.IO gateway ready for Vercel / Remote Clients`);
  console.log(`🔒 Multi-Session Workspace Isolation: ACTIVE`);
  console.log(`====================================================`);
});
