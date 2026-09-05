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

// Middlewares - Full CORS support for standalone Vercel Frontend
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// Static file hosting for uploads (Media files sent in WhatsApp messages)
app.use('/uploads', express.static(UPLOADS_DIR));

// Static frontend serving fallback (if client exists alongside backend)
const CLIENT_DIR = path.join(ROOT_DIR, 'client');
if (fs.existsSync(CLIENT_DIR)) {
  app.use(express.static(CLIENT_DIR));
}

// Pass Socket.IO to managers
waManager.setSocketIO(io);
campaignQueue.setSocketIO(io);

// Socket.io connection
io.on('connection', (socket) => {
  console.log('Client connected to Socket.IO:', socket.id);
  // Emit current states immediately upon connection
  socket.emit('wa:status', waManager.getStatus());
  socket.emit('campaign:status', campaignQueue.getCurrentState());

  socket.on('disconnect', () => {
    console.log('Client disconnected from Socket.IO:', socket.id);
  });
});

// ==================== REST APIs ==================== //

// 1. WhatsApp Endpoints
app.get('/api/whatsapp/status', (req, res) => {
  res.json(waManager.getStatus());
});

app.post('/api/whatsapp/init', async (req, res) => {
  try {
    await waManager.init();
    res.json({ success: true, message: 'WhatsApp initialization triggered.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/whatsapp/logout', async (req, res) => {
  try {
    await waManager.logout();
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
    const formatted = waManager.formatPhoneNumber(phone);
    const jid = `${formatted}@s.whatsapp.net`;
    const result = await waManager.sendMessage(jid, message || 'Hello! Test message from WhatsApp Bulk Sender Pro.');
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
    const rawRows = xlsx.utils.sheet_to_json(sheet, { defval: '' });

    // Clean up uploaded temp file
    try {
      fs.unlinkSync(filePath);
    } catch (e) {}

    if (!rawRows || rawRows.length === 0) {
      return res.status(400).json({ success: false, error: 'The uploaded sheet is empty.' });
    }

    // Identify columns
    const columns = Object.keys(rawRows[0]);

    // Detect phone column candidates
    const phoneCandidates = columns.filter(c =>
      /phone|mobile|contact|cell|number|whatsapp|tele/i.test(c)
    );
    const suggestedPhoneCol = phoneCandidates[0] || columns[0];

    // Detect name column candidates
    const nameCandidates = columns.filter(c =>
      /name|client|customer|user|full\s*name|first\s*name/i.test(c)
    );
    const suggestedNameCol = nameCandidates[0] || (columns.length > 1 ? columns[1] : columns[0]);

    res.json({
      success: true,
      filename: req.file.originalname,
      totalRows: rawRows.length,
      columns,
      suggestedPhoneCol,
      suggestedNameCol,
      previewRows: rawRows.slice(0, 10),
      allRows: rawRows
    });
  } catch (err) {
    console.error('Error parsing contact file:', err);
    res.status(500).json({ success: false, error: 'Failed to parse file: ' + err.message });
  }
});

// 3. Media Upload
app.post('/api/media/upload', upload.single('media'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No media file provided.' });
    }
    res.json({
      success: true,
      media: {
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

// 4. Templates
app.get('/api/templates', (req, res) => {
  res.json(storage.getTemplates());
});

app.post('/api/templates', (req, res) => {
  const template = storage.saveTemplate(req.body);
  res.json({ success: true, template });
});

app.delete('/api/templates/:id', (req, res) => {
  storage.deleteTemplate(req.params.id);
  res.json({ success: true });
});

// 5. Settings
app.get('/api/settings', (req, res) => {
  res.json(storage.getSettings());
});

app.post('/api/settings', (req, res) => {
  const settings = storage.saveSettings(req.body);
  res.json({ success: true, settings });
});

// 6. Campaign Actions
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

    const result = await campaignQueue.startCampaign({
      name,
      contacts,
      template,
      templates,
      media,
      settings: settings || storage.getSettings()
    });

    res.json({ success: true, ...result });
  } catch (err) {
    console.error('Error starting campaign:', err);
    res.status(400).json({ success: false, error: err.message });
  }
});

app.post('/api/campaign/pause', (req, res) => {
  const success = campaignQueue.pauseCampaign();
  res.json({ success, message: success ? 'Campaign paused' : 'No campaign running' });
});

app.post('/api/campaign/resume', (req, res) => {
  const success = campaignQueue.resumeCampaign();
  res.json({ success, message: success ? 'Campaign resumed' : 'No paused campaign to resume' });
});

app.post('/api/campaign/stop', (req, res) => {
  const success = campaignQueue.stopCampaign();
  res.json({ success, message: success ? 'Campaign stopped' : 'No active campaign to stop' });
});

app.get('/api/campaign/status', (req, res) => {
  res.json(campaignQueue.getCurrentState());
});

// 7. Campaign History & Export
app.get('/api/campaigns', (req, res) => {
  res.json(storage.getCampaigns());
});

app.get('/api/campaigns/:id', (req, res) => {
  const campaign = storage.getCampaignById(req.params.id);
  if (!campaign) return res.status(404).json({ success: false, error: 'Campaign not found' });
  res.json(campaign);
});

app.delete('/api/campaigns/:id', (req, res) => {
  storage.deleteCampaign(req.params.id);
  res.json({ success: true });
});

app.delete('/api/campaigns', (req, res) => {
  storage.clearCampaigns();
  res.json({ success: true, message: 'All campaigns deleted.' });
});

app.get('/api/campaigns/:id/export', (req, res) => {
  const campaign = storage.getCampaignById(req.params.id);
  if (!campaign || !campaign.records) {
    return res.status(404).send('Campaign records not found');
  }

  const exportData = campaign.records.map((r, i) => ({
    Index: i + 1,
    Phone: r.phone,
    Status: r.status,
    ReasonOrError: r.reason || '',
    MessageSent: r.message || '',
    Timestamp: r.timestamp || ''
  }));

  const worksheet = xlsx.utils.json_to_sheet(exportData);
  const csvOutput = xlsx.utils.sheet_to_csv(worksheet);

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename=campaign_${campaign.id}_report.csv`);
  res.send(csvOutput);
});

// 8. Health & Ping Check (For Render / Vercel connection testing)
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    name: 'WhatsApp Bulk Sender Backend',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    whatsappConnected: waManager.getStatus().status === 'open'
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
  console.log(`====================================================`);
  
  // Auto init WhatsApp Baileys socket on startup
  try {
    await waManager.init();
  } catch (err) {
    console.log('WhatsApp will initialize upon connection.');
  }
});

