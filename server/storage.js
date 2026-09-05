const fs = require('fs');
const path = require('path');

const ROOT_DIR = fs.existsSync(path.join(__dirname, '..', 'package.json'))
  ? path.join(__dirname, '..')
  : __dirname;

const DATA_DIR = process.env.DATA_DIR || path.join(ROOT_DIR, 'data');

// Ensure base data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function getSessionDir(sessionId = 'default') {
  if (!sessionId || sessionId === 'default') {
    return DATA_DIR;
  }
  const cleanId = String(sessionId).replace(/[^a-zA-Z0-9_-]/g, '_');
  const dir = path.join(DATA_DIR, 'sessions', cleanId);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

function getSessionFilePath(filename, sessionId = 'default') {
  return path.join(getSessionDir(sessionId), filename);
}

function readJsonFile(filePath, defaultValue) {
  try {
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, JSON.stringify(defaultValue, null, 2), 'utf-8');
      return defaultValue;
    }
    const data = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(data);
  } catch (err) {
    console.error(`Error reading ${filePath}:`, err.message);
    return defaultValue;
  }
}

function writeJsonFile(filePath, data) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error(`Error writing ${filePath}:`, err.message);
  }
}

const DEFAULT_TEMPLATES = [
  {
    id: 'tpl_default_1',
    name: 'Welcome & Greeting',
    content: 'Hi {{name}}, {Welcome to our service!|Glad to have you with us!|Thank you for connecting with us!}\n\nFeel free to reach out if you have any questions.',
    createdAt: new Date().toISOString()
  },
  {
    id: 'tpl_default_2',
    name: 'Special Offer / Promo',
    content: 'Hello {{name}}! 🔥\n\n{We have an exclusive offer for you!|Here is a special discount just for you!}\nUse code *PROMO20* for 20% OFF today.\n\nBest regards,\nYour Support Team',
    createdAt: new Date().toISOString()
  }
];

const DEFAULT_SETTINGS = {
  minDelay: 8,
  maxDelay: 18,
  batchSize: 15,
  batchPause: 45,
  randomizePacing: true,
  defaultCountryCode: '91'
};

module.exports = {
  // Campaign History (Isolated Per Session)
  getCampaigns(sessionId = 'default') {
    const file = getSessionFilePath('campaigns.json', sessionId);
    return readJsonFile(file, []);
  },
  getCampaignById(id, sessionId = 'default') {
    const campaigns = this.getCampaigns(sessionId);
    return campaigns.find((c) => c.id === id);
  },
  saveCampaign(campaign, sessionId = 'default') {
    const file = getSessionFilePath('campaigns.json', sessionId);
    const campaigns = this.getCampaigns(sessionId);
    const index = campaigns.findIndex((c) => c.id === campaign.id);
    if (index >= 0) {
      campaigns[index] = campaign;
    } else {
      campaigns.unshift(campaign);
    }
    // Keep max 100 historical campaigns per session
    if (campaigns.length > 100) {
      campaigns.length = 100;
    }
    writeJsonFile(file, campaigns);
    return campaign;
  },
  deleteCampaign(id, sessionId = 'default') {
    const file = getSessionFilePath('campaigns.json', sessionId);
    let campaigns = this.getCampaigns(sessionId);
    campaigns = campaigns.filter((c) => c.id !== id);
    writeJsonFile(file, campaigns);
    return true;
  },
  clearCampaigns(sessionId = 'default') {
    const file = getSessionFilePath('campaigns.json', sessionId);
    writeJsonFile(file, []);
    return true;
  },

  // Templates (Isolated Per Session)
  getTemplates(sessionId = 'default') {
    const file = getSessionFilePath('templates.json', sessionId);
    return readJsonFile(file, DEFAULT_TEMPLATES);
  },
  saveTemplate(template, sessionId = 'default') {
    const file = getSessionFilePath('templates.json', sessionId);
    const templates = this.getTemplates(sessionId);
    if (!template.id) {
      template.id = 'tpl_' + Date.now();
      template.createdAt = new Date().toISOString();
      templates.unshift(template);
    } else {
      const index = templates.findIndex((t) => t.id === template.id);
      if (index >= 0) {
        templates[index] = { ...templates[index], ...template, updatedAt: new Date().toISOString() };
      } else {
        templates.unshift(template);
      }
    }
    writeJsonFile(file, templates);
    return template;
  },
  deleteTemplate(id, sessionId = 'default') {
    const file = getSessionFilePath('templates.json', sessionId);
    let templates = this.getTemplates(sessionId);
    templates = templates.filter((t) => t.id !== id);
    writeJsonFile(file, templates);
    return true;
  },

  // Settings (Isolated Per Session)
  getSettings(sessionId = 'default') {
    const file = getSessionFilePath('settings.json', sessionId);
    return readJsonFile(file, DEFAULT_SETTINGS);
  },
  saveSettings(settings, sessionId = 'default') {
    const file = getSessionFilePath('settings.json', sessionId);
    writeJsonFile(file, settings);
    return settings;
  }
};
