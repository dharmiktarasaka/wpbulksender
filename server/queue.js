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
    this.sentTimestamps = []; // sliding window timestamps of sent messages
    this.recentDelays = [];   // history of delay intervals to ensure non-repetition
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
    const oneHourAgo = Date.now() - 3600 * 1000;
    const sentInLastHour = this.sentTimestamps ? this.sentTimestamps.filter(t => t > oneHourAgo).length : 0;

    if (!this.currentCampaign) {
      return {
        status: 'idle',
        campaign: null,
        hourlyUsage: {
          sentInLastHour,
          maxPerHour: 5,
          hourlyLimitEnabled: true
        }
      };
    }
    return {
      status: this.status,
      hourlyUsage: {
        sentInLastHour,
        maxPerHour: this.currentCampaign.settings?.maxPerHour || 5,
        hourlyLimitEnabled: this.currentCampaign.settings?.hourlyLimitEnabled ?? true
      },
      campaign: {
        id: this.currentCampaign.id,
        name: this.currentCampaign.name,
        total: this.currentCampaign.total,
        sent: this.currentCampaign.sent,
        failed: this.currentCampaign.failed,
        remaining: this.currentCampaign.remaining,
        settings: this.currentCampaign.settings,
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
    const minDelay = Math.max(1, parseInt(activeSettings.minDelay) || 8);
    const maxDelay = Math.max(minDelay, parseInt(activeSettings.maxDelay) || 18);
    const batchSize = Math.max(1, parseInt(activeSettings.batchSize) || 5);
    const batchPause = Math.max(5, parseInt(activeSettings.batchPause) || 30);
    const defaultCountryCode = activeSettings.defaultCountryCode || '91';
    const hourlyLimitEnabled = activeSettings.hourlyLimitEnabled !== false;
    const maxPerHour = Math.max(1, parseInt(activeSettings.maxPerHour) || 5);
    const neverRepeatDelay = activeSettings.neverRepeatDelay !== false;
    const simulateTyping = activeSettings.simulateTyping !== false;

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

    const campaignSettings = {
      minDelay,
      maxDelay,
      batchSize,
      batchPause,
      defaultCountryCode,
      hourlyLimitEnabled,
      maxPerHour,
      neverRepeatDelay,
      simulateTyping
    };

    this.currentCampaign = {
      id: campaignId,
      name: name || `Campaign ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`,
      startTime: new Date().toISOString(),
      endTime: null,
      total: contacts.length,
      sent: 0,
      failed: 0,
      remaining: contacts.length,
      settings: campaignSettings,
      templates: templateList,
      template: templateList.join('\n--- [OR] ---\n'),
      media: media ? { originalname: media.originalname, mimetype: media.mimetype } : null,
      logs: [],
      records: []
    };

    this.status = 'running';
    this.broadcast('campaign:status', this.getCurrentState());

    this.addLog(
      `🚀 Campaign "${this.currentCampaign.name}" started with ${contacts.length} recipients & ${templateList.length} template variation(s). Anti-Ban Active: Max ${maxPerHour} msgs/hr, ${neverRepeatDelay ? 'Non-repeating variable delays' : 'Random delays'}, ${simulateTyping ? 'Typing indicator enabled' : 'Instant send'}.`,
      'info'
    );

    // Run queue in background
    this.processQueue(contacts, templateList, media, campaignSettings)
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
    const {
      minDelay,
      maxDelay,
      batchSize,
      batchPause,
      defaultCountryCode,
      hourlyLimitEnabled,
      maxPerHour,
      neverRepeatDelay,
      simulateTyping
    } = settings;

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

      // 1. Sliding Window Hourly Rate Limiter Check (Strictly max X msgs/hr, e.g. 5)
      if (hourlyLimitEnabled) {
        let oneHourAgo = Date.now() - 3600 * 1000;
        this.sentTimestamps = this.sentTimestamps.filter((t) => t > oneHourAgo);

        if (this.sentTimestamps.length >= maxPerHour) {
          const oldest = this.sentTimestamps[0];
          const waitMs = Math.max(1000, oldest + 3600 * 1000 - Date.now() + 2000);
          const waitMins = Math.ceil(waitMs / 60000);
          this.addLog(
            `⏳ Anti-Ban Protection: Hourly limit reached (${this.sentTimestamps.length}/${maxPerHour} msgs in last 60m). Pausing for ${waitMins} minute(s) until next available window...`,
            'pause'
          );
          this.broadcast('campaign:status', this.getCurrentState());

          let remainingWaitMs = waitMs;
          while (remainingWaitMs > 0 && this.status !== 'stopped') {
            if (this.status === 'paused') {
              await sleep(1000);
              continue;
            }
            const step = Math.min(1000, remainingWaitMs);
            await sleep(step);
            remainingWaitMs -= step;
          }

          if (this.status === 'stopped') break;

          // Re-evaluate timestamps after waiting
          oneHourAgo = Date.now() - 3600 * 1000;
          this.sentTimestamps = this.sentTimestamps.filter((t) => t > oneHourAgo);
          this.addLog(`▶️ Hourly window unlocked. Resuming sending (${this.sentTimestamps.length}/${maxPerHour} used in rolling hour).`, 'info');
        }
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

      // 2. Pick a random template from the templateList for anti-ban rotation
      const chosenTemplate = templateList[Math.floor(Math.random() * templateList.length)];
      
      // 3. Prepare personalized message content with variables and spintax
      const filledText = replaceVariables(chosenTemplate, contact);
      const finalizedMessage = parseSpintax(filledText);
      const recipientJid = `${formattedNumber}@s.whatsapp.net`;

      // 4. Simulated Typing Presence (Breaks robotic instant-delivery detection)
      if (simulateTyping) {
        const typingDurationMs = Math.floor(Math.random() * 2500) + 1800; // 1.8s to 4.3s
        this.addLog(`✍️ Simulating human typing indicator for ${(typingDurationMs / 1000).toFixed(1)}s (+${formattedNumber})...`, 'info', formattedNumber);
        try {
          await activeWa.simulateTyping(recipientJid, typingDurationMs);
        } catch (e) {}
      }

      try {
        await activeWa.sendMessage(recipientJid, finalizedMessage, media || null, {});
        this.currentCampaign.sent++;
        this.currentCampaign.remaining--;
        this.sentTimestamps.push(Date.now());

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
        // 5. Dynamic High-Variance Non-Repeating Delay Engine
        let chosenSeconds;
        let attempts = 0;
        do {
          const base = Math.random() * (maxDelay - minDelay) + minDelay;
          // Organic non-linear jitter (-15% to +30%)
          const jitter = 1 + (Math.random() * 0.45 - 0.15);
          chosenSeconds = Math.round(base * jitter * 10) / 10;
          chosenSeconds = Math.max(minDelay * 0.75, Math.min(maxDelay * 1.35, chosenSeconds));
          chosenSeconds = Math.round(chosenSeconds * 10) / 10;

          // Never repeat any of the last 5 delays (must differ by at least 1.8s)
          const isDuplicate = this.recentDelays.slice(-5).some((d) => Math.abs(d - chosenSeconds) < 1.8);
          if (!neverRepeatDelay || !isDuplicate || attempts > 15) {
            break;
          }
          attempts++;
        } while (attempts < 20);

        this.recentDelays.push(chosenSeconds);
        if (this.recentDelays.length > 10) this.recentDelays.shift();

        // Microsecond jitter (100ms - 990ms) ensures timestamps are never mechanical
        const microJitterMs = Math.floor(Math.random() * 890) + 100;
        const totalDelayMs = Math.round(chosenSeconds * 1000) + microJitterMs;

        const displaySec = (totalDelayMs / 1000).toFixed(1);
        const displayMin = totalDelayMs >= 60000 ? ` (~${(totalDelayMs / 60000).toFixed(1)} min)` : '';
        this.addLog(`⏱️ Non-repeating delay: waiting ${displaySec}s${displayMin} before next message (anti-pattern variance)...`, 'info');

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
