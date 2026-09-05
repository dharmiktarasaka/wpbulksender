const EventEmitter = require('events');
const { v4: uuidv4 } = require('uuid');
const waManager = require('./whatsapp');
const storage = require('./storage');

// Helper: Spintax parser ({option1|option2|option3})
function parseSpintax(text) {
  if (!text) return '';
  const spintaxRegex = /\{([^{}]+)\}/g;
  let matches;
  while ((matches = spintaxRegex.exec(text)) !== null) {
    const options = matches[1].split('|');
    const choice = options[Math.floor(Math.random() * options.length)];
    text = text.replace(matches[0], choice);
    spintaxRegex.lastIndex = 0; // reset regex index
  }
  return text;
}

// Helper: Variable replacer ({{name}}, {{phone}}, {{customField}})
function replaceVariables(template, contactData) {
  if (!template) return '';
  let result = template;
  for (const [key, val] of Object.entries(contactData)) {
    const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'gi');
    result = result.replace(regex, val !== undefined && val !== null ? String(val) : '');
  }
  return result;
}

// Helper: Promise sleep
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

class CampaignQueue extends EventEmitter {
  constructor(sessionId = 'default', customWaManager = null) {
    super();
    this.sessionId = sessionId;
    this.waManager = customWaManager || null;
    this.currentCampaign = null;
    this.status = 'idle'; // 'idle', 'running', 'paused', 'stopped'
    this.io = null;
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

  getCurrentState() {
    if (!this.currentCampaign) {
      return { status: 'idle', campaign: null };
    }
    return {
      status: this.status,
      campaign: {
        id: this.currentCampaign.id,
        name: this.currentCampaign.name,
        total: this.currentCampaign.total,
        sent: this.currentCampaign.sent,
        failed: this.currentCampaign.failed,
        remaining: this.currentCampaign.remaining,
        currentProgress: this.currentCampaign.total > 0
          ? Math.round(((this.currentCampaign.sent + this.currentCampaign.failed) / this.currentCampaign.total) * 100)
          : 0,
        logs: this.currentCampaign.logs.slice(-50) // last 50 logs for live feed
      }
    };
  }

  getActiveWa() {
    if (this.waManager) return this.waManager;
    if (waManager.getWhatsAppManager) return waManager.getWhatsAppManager(this.sessionId, this.io);
    return waManager;
  }

  async startCampaign({ name, contacts, template, templates, media, settings }) {
    if (this.status === 'running') {
      throw new Error('A campaign is already currently running.');
    }

    const activeWa = this.getActiveWa();

    if (activeWa.connectionState !== 'open') {
      throw new Error('WhatsApp is not connected. Please connect WhatsApp first.');
    }

    if (!contacts || contacts.length === 0) {
      throw new Error('Contact list is empty.');
    }

    const campaignId = 'camp_' + uuidv4().substring(0, 8);
    const activeSettings = { ...storage.getSettings(this.sessionId), ...(settings || {}) };
    const minDelay = Math.max(1, parseInt(activeSettings.minDelay) || 5);
    const maxDelay = Math.max(minDelay, parseInt(activeSettings.maxDelay) || 12);
    const batchSize = Math.max(5, parseInt(activeSettings.batchSize) || 20);
    const batchPause = Math.max(5, parseInt(activeSettings.batchPause) || 30);
    const defaultCountryCode = activeSettings.defaultCountryCode || '91';

    let templateList = [];
    if (Array.isArray(templates) && templates.length > 0) {
      templateList = templates.map(t => (typeof t === 'string' ? t : t.content || '')).filter(t => t.trim().length > 0);
    }
    if (templateList.length === 0 && template) {
      templateList = [template];
    }
    if (templateList.length === 0) {
      throw new Error('No valid message template provided.');
    }

    this.currentCampaign = {
      id: campaignId,
      name: name || `Campaign ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`,
      startTime: new Date().toISOString(),
      endTime: null,
      total: contacts.length,
      sent: 0,
      failed: 0,
      remaining: contacts.length,
      settings: { minDelay, maxDelay, batchSize, batchPause, defaultCountryCode },
      templates: templateList,
      template: templateList.join('\n--- [OR] ---\n'),
      media: media ? { originalname: media.originalname, mimetype: media.mimetype } : null,
      logs: [],
      records: []
    };

    this.status = 'running';
    this.broadcast('campaign:status', this.getCurrentState());

    this.addLog(`🚀 Campaign "${this.currentCampaign.name}" started with ${contacts.length} recipients & ${templateList.length} rotated template(s).`, 'info');

    // Run queue in background
    this.processQueue(contacts, templateList, media, { minDelay, maxDelay, batchSize, batchPause, defaultCountryCode })
      .catch((err) => {
        this.addLog(`❌ Fatal error in campaign: ${err.message}`, 'error');
        this.finishCampaign('failed');
      });

    return { campaignId, status: 'started' };
  }

  addLog(message, type = 'info', recipient = null) {
    const logItem = {
      id: uuidv4(),
      timestamp: new Date().toLocaleTimeString(),
      message,
      type, // 'info', 'success', 'warning', 'error', 'pause'
      recipient
    };
    if (this.currentCampaign) {
      this.currentCampaign.logs.push(logItem);
      this.broadcast('campaign:log', logItem);
      this.broadcast('campaign:status', this.getCurrentState());
    }
  }

  pauseCampaign() {
    if (this.status === 'running') {
      this.status = 'paused';
      this.addLog('⏸️ Campaign paused by user.', 'pause');
      this.broadcast('campaign:status', this.getCurrentState());
      return true;
    }
    return false;
  }

  resumeCampaign() {
    if (this.status === 'paused') {
      this.status = 'running';
      this.addLog('▶️ Campaign resumed.', 'info');
      this.broadcast('campaign:status', this.getCurrentState());
      return true;
    }
    return false;
  }

  stopCampaign() {
    if (this.status === 'running' || this.status === 'paused') {
      this.status = 'stopped';
      this.addLog('🛑 Campaign stopped by user.', 'warning');
      this.finishCampaign('stopped');
      return true;
    }
    return false;
  }

  async processQueue(contacts, templateList, media, settings) {
    const { minDelay, maxDelay, batchSize, batchPause, defaultCountryCode } = settings;

    let processedCountInBatch = 0;

    for (let i = 0; i < contacts.length; i++) {
      // Check if stopped
      if (this.status === 'stopped') {
        break;
      }

      // Check if paused - wait loop
      while (this.status === 'paused') {
        await sleep(1000);
      }

      if (this.status === 'stopped') {
        break;
      }

      const contact = contacts[i];
      const activeWa = this.getActiveWa();
      const rawPhone = contact.phone || contact.Phone || contact.mobile || contact.Mobile || contact.number;
      const formattedNumber = activeWa.formatPhoneNumber(rawPhone, defaultCountryCode);

      if (!formattedNumber) {
        this.currentCampaign.failed++;
        this.currentCampaign.remaining--;
        const failureRecord = {
          contact,
          phone: rawPhone || 'Unknown',
          status: 'failed',
          reason: 'Invalid phone number format',
          timestamp: new Date().toISOString()
        };
        this.currentCampaign.records.push(failureRecord);
        this.addLog(`⚠️ Skipped (${i + 1}/${contacts.length}): Invalid number "${rawPhone}"`, 'warning', rawPhone);
        continue;
      }

      // 1. Pick a random template from the templateList for anti-ban rotation
      const chosenTemplate = templateList[Math.floor(Math.random() * templateList.length)];
      
      // 2. Prepare personalized message content with variables and spintax
      const filledText = replaceVariables(chosenTemplate, contact);
      const finalizedMessage = parseSpintax(filledText);
      const recipientJid = `${formattedNumber}@s.whatsapp.net`;

      try {
        await activeWa.sendMessage(recipientJid, finalizedMessage, media || null, {});
        this.currentCampaign.sent++;
        this.currentCampaign.remaining--;

        const successRecord = {
          contact,
          phone: formattedNumber,
          status: 'sent',
          message: finalizedMessage,
          timestamp: new Date().toISOString()
        };
        this.currentCampaign.records.push(successRecord);
        this.addLog(`✅ Sent to +${formattedNumber} (${i + 1}/${contacts.length}) [Tpl #${(templateList.indexOf(chosenTemplate) + 1)}]`, 'success', formattedNumber);
      } catch (err) {
        this.currentCampaign.failed++;
        this.currentCampaign.remaining--;

        const failureRecord = {
          contact,
          phone: formattedNumber,
          status: 'failed',
          reason: err.message || 'WhatsApp sending error',
          timestamp: new Date().toISOString()
        };
        this.currentCampaign.records.push(failureRecord);
        this.addLog(`❌ Failed to send to +${formattedNumber}: ${err.message}`, 'error', formattedNumber);
      }

      processedCountInBatch++;

      // Check if this was the last contact
      if (i === contacts.length - 1) {
        break;
      }

      // Batch cooldown check
      if (processedCountInBatch >= batchSize) {
        processedCountInBatch = 0;
        this.addLog(`⏳ Anti-Ban Batch Cooldown: Pausing for ${batchPause}s to protect account health...`, 'pause');
        
        let remainingPause = batchPause;
        while (remainingPause > 0 && this.status !== 'stopped') {
          if (this.status === 'paused') {
            await sleep(1000);
            continue;
          }
          await sleep(1000);
          remainingPause--;
        }
      } else {
        // Randomized delay between individual messages
        const randomSeconds = Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;
        const randomJitter = Math.floor(Math.random() * 800); // 0-800ms jitter
        const totalDelayMs = randomSeconds * 1000 + randomJitter;

        this.addLog(`⏱️ Waiting ${(totalDelayMs / 1000).toFixed(1)}s (anti-ban delay) before next message...`, 'info');

        let remainingDelayMs = totalDelayMs;
        while (remainingDelayMs > 0 && this.status !== 'stopped') {
          if (this.status === 'paused') {
            await sleep(1000);
            continue;
          }
          const step = Math.min(1000, remainingDelayMs);
          await sleep(step);
          remainingDelayMs -= step;
        }
      }
    }

    if (this.status !== 'stopped') {
      this.finishCampaign('completed');
    }
  }

  finishCampaign(outcome = 'completed') {
    if (this.currentCampaign) {
      this.currentCampaign.endTime = new Date().toISOString();
      this.currentCampaign.outcome = outcome;
      this.addLog(
        `🎉 Campaign finished (${outcome})! Total: ${this.currentCampaign.total}, Sent: ${this.currentCampaign.sent}, Failed: ${this.currentCampaign.failed}.`,
        'success'
      );
      // Save completed campaign to history
      storage.saveCampaign(this.currentCampaign, this.sessionId);
    }
    this.status = 'idle';
    this.broadcast('campaign:status', this.getCurrentState());
    this.broadcast('campaign:finished', this.currentCampaign);
  }
}

// Multi-Session Queue Registry
const campaignQueuesMap = new Map();

function getCampaignQueue(sessionId = 'default', customWa = null, io = null) {
  const cleanId = String(sessionId || 'default').replace(/[^a-zA-Z0-9_-]/g, '_');
  if (!campaignQueuesMap.has(cleanId)) {
    const q = new CampaignQueue(cleanId, customWa);
    if (io) q.setSocketIO(io);
    campaignQueuesMap.set(cleanId, q);
  } else {
    const q = campaignQueuesMap.get(cleanId);
    if (io && !q.io) q.setSocketIO(io);
    if (customWa && !q.waManager) q.waManager = customWa;
  }
  return campaignQueuesMap.get(cleanId);
}

const defaultQueue = getCampaignQueue('default');
defaultQueue.CampaignQueue = CampaignQueue;
defaultQueue.getCampaignQueue = getCampaignQueue;

module.exports = defaultQueue;
