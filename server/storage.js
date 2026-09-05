const fs = require('fs');
const path = require('path');

const ROOT_DIR = fs.existsSync(path.join(__dirname, '..', 'package.json'))
  ? path.join(__dirname, '..')
  : __dirname;

const DATA_DIR = process.env.DATA_DIR || path.join(ROOT_DIR, 'data');
const HISTORY_FILE = path.join(DATA_DIR, 'campaigns.json');
const TEMPLATES_FILE = path.join(DATA_DIR, 'templates.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
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

module.exports = {
  // Campaign History
  getCampaigns() {
    return readJsonFile(HISTORY_FILE, []);
  },
  getCampaignById(id) {
    const campaigns = this.getCampaigns();
    return campaigns.find(c => c.id === id);
  },
  saveCampaign(campaign) {
    const campaigns = this.getCampaigns();
    const index = campaigns.findIndex(c => c.id === campaign.id);
    if (index >= 0) {
      campaigns[index] = campaign;
    } else {
      campaigns.unshift(campaign);
    }
    // Keep max 100 historical campaigns
    if (campaigns.length > 100) {
      campaigns.length = 100;
    }
    writeJsonFile(HISTORY_FILE, campaigns);
    return campaign;
  },
  deleteCampaign(id) {
    let campaigns = this.getCampaigns();
    campaigns = campaigns.filter(c => c.id !== id);
    writeJsonFile(HISTORY_FILE, campaigns);
    return true;
  },
  clearCampaigns() {
    writeJsonFile(HISTORY_FILE, []);
    return true;
  },

  // Templates
  getTemplates() {
    return readJsonFile(TEMPLATES_FILE, [
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
    ]);
  },
  saveTemplate(template) {
    const templates = this.getTemplates();
    if (!template.id) {
      template.id = 'tpl_' + Date.now();
      template.createdAt = new Date().toISOString();
      templates.unshift(template);
    } else {
      const index = templates.findIndex(t => t.id === template.id);
      if (index >= 0) {
        templates[index] = { ...templates[index], ...template, updatedAt: new Date().toISOString() };
      } else {
        templates.unshift(template);
      }
    }
    writeJsonFile(TEMPLATES_FILE, templates);
    return template;
  },
  deleteTemplate(id) {
    let templates = this.getTemplates();
    templates = templates.filter(t => t.id !== id);
    writeJsonFile(TEMPLATES_FILE, templates);
    return true;
  },

  // Settings
  getSettings() {
    return readJsonFile(SETTINGS_FILE, {
      minDelay: 5,
      maxDelay: 12,
      batchSize: 20,
      batchPause: 30,
      randomizePacing: true,
      defaultCountryCode: '91'
    });
  },
  saveSettings(settings) {
    writeJsonFile(SETTINGS_FILE, settings);
    return settings;
  }
};
