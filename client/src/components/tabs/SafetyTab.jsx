import React, { useState } from 'react';
import {
  ShieldCheck,
  Zap,
  Sliders,
  CheckCircle2,
  AlertCircle,
  Clock,
  Rocket,
  ShieldAlert
} from 'lucide-react';

export default function SafetyTab({
  settings,
  setSettings,
  campaignName,
  setCampaignName,
  contacts,
  templateVariations,
  waConnected,
  isCampaignRunning,
  onStartCampaign,
  onShowToast
}) {
  const [selectedPreset, setSelectedPreset] = useState('ultra_safe');

  const presets = [
    {
      id: 'ultra_safe',
      name: 'Ultra-Safe (5 msgs/hr)',
      desc: 'Max 5 msgs/hr • Non-repeating variance • Typing simulation',
      badge: 'Zero-Ban Shield',
      badgeClass: 'badge-safe',
      values: {
        minDelay: 15,
        maxDelay: 45,
        batchSize: 5,
        batchPause: 120,
        hourlyLimitEnabled: true,
        maxPerHour: 5,
        neverRepeatDelay: true,
        simulateTyping: true
      }
    },
    {
      id: 'safe',
      name: 'Safe Human (15 msgs/hr)',
      desc: 'Max 15 msgs/hr • 10–25s delay • Typing simulation',
      badge: 'Recommended',
      badgeClass: 'badge-whatsapp',
      values: {
        minDelay: 10,
        maxDelay: 25,
        batchSize: 8,
        batchPause: 60,
        hourlyLimitEnabled: true,
        maxPerHour: 15,
        neverRepeatDelay: true,
        simulateTyping: true
      }
    },
    {
      id: 'balanced',
      name: 'Balanced (30 msgs/hr)',
      desc: 'Max 30 msgs/hr • 6–15s delay • Regular pauses',
      badge: 'Optimal Speed',
      badgeClass: 'badge-warning',
      values: {
        minDelay: 6,
        maxDelay: 15,
        batchSize: 15,
        batchPause: 45,
        hourlyLimitEnabled: true,
        maxPerHour: 30,
        neverRepeatDelay: true,
        simulateTyping: true
      }
    }
  ];

  function applyPreset(p) {
    setSelectedPreset(p.id);
    setSettings({
      ...settings,
      ...p.values
    });
    onShowToast(`Applied ${p.name} preset`, 'info');
  }

  // Calculate estimated duration
  function calculateDuration() {
    const count = contacts.length;
    if (!count) return '0 minutes';

    if (settings.hourlyLimitEnabled && settings.maxPerHour > 0) {
      const hoursRequired = count / Number(settings.maxPerHour);
      const totalMinutes = Math.round(hoursRequired * 60);
      const hrs = Math.floor(totalMinutes / 60);
      const mins = totalMinutes % 60;
      if (hrs === 0) return `~${mins} minutes (at ${settings.maxPerHour} msgs/hr)`;
      return `~${hrs} hr ${mins > 0 ? `${mins} min` : ''} (at ${settings.maxPerHour} msgs/hr)`;
    }

    const avgDelay = (Number(settings.minDelay) + Number(settings.maxDelay)) / 2;
    const batchCount = Math.floor(count / Number(settings.batchSize));
    const totalSeconds = Math.round(count * avgDelay + batchCount * Number(settings.batchPause));

    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    if (mins === 0) return `~${secs} seconds`;
    return `~${mins} min ${secs} sec`;
  }

  const isReadyToLaunch =
    waConnected &&
    contacts.length > 0 &&
    templateVariations.some((v) => v.trim().length > 0) &&
    !isCampaignRunning;

  return (
    <section className="tab-panel active">
      <div className="grid-2-col">
        {/* Left: Anti-Ban Speed Settings & Presets */}
        <div className="card glass-card">
          <div className="card-header">
            <h3>
              <ShieldCheck size={20} color="var(--wa-green)" /> Anti-Ban Pacing & Rate Limits
            </h3>
            <span className="badge badge-safe">Algorithmic Shield</span>
          </div>

          {/* Presets */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
            <label className="form-label" style={{ fontSize: '0.8rem', textTransform: 'uppercase' }}>
              Anti-Detection Speed Presets:
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
              {presets.map((p) => (
                <div
                  key={p.id}
                  onClick={() => applyPreset(p)}
                  className="glass-card"
                  style={{
                    padding: 12,
                    cursor: 'pointer',
                    borderRadius: 10,
                    borderColor: selectedPreset === p.id ? 'var(--wa-green)' : 'var(--border-color)',
                    background: selectedPreset === p.id ? 'rgba(37, 211, 102, 0.08)' : 'rgba(255,255,255,0.02)'
                  }}
                >
                  <span className={`badge ${p.badgeClass}`} style={{ fontSize: '0.65rem', marginBottom: 6, display: 'inline-block' }}>
                    {p.badge}
                  </span>
                  <h4 style={{ fontSize: '0.85rem', fontWeight: 700 }}>{p.name}</h4>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.72rem', marginTop: 2 }}>{p.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Core Anti-Ban Switches */}
          <div className="glass-card" style={{ padding: 14, borderRadius: 10, marginBottom: 20, background: 'rgba(255,255,255,0.02)' }}>
            <h4 style={{ fontSize: '0.88rem', fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
              <ShieldAlert size={16} color="var(--accent-amber)" /> Anti-Detection Features
            </h4>

            {/* Hourly Rate Limiter */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label className="form-label" style={{ margin: 0, cursor: 'pointer', fontWeight: 600 }}>
                  Strict Hourly Limit (Max Messages / Hour):
                </label>
                <input
                  type="checkbox"
                  checked={settings.hourlyLimitEnabled !== false}
                  onChange={(e) => {
                    setSelectedPreset('custom');
                    setSettings({ ...settings, hourlyLimitEnabled: e.target.checked });
                  }}
                  style={{ transform: 'scale(1.2)', cursor: 'pointer' }}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <input
                  type="range"
                  min="1"
                  max="30"
                  disabled={settings.hourlyLimitEnabled === false}
                  value={settings.maxPerHour || 5}
                  onChange={(e) => {
                    setSelectedPreset('custom');
                    setSettings({ ...settings, maxPerHour: Number(e.target.value) });
                  }}
                  style={{ flex: 1 }}
                />
                <span style={{ fontSize: '0.9rem', fontWeight: 700, minWidth: 70, textAlign: 'right', color: 'var(--wa-green)' }}>
                  {settings.maxPerHour || 5} msg/hr
                </span>
              </div>
              <p style={{ fontSize: '0.74rem', color: 'var(--text-muted)', margin: 0 }}>
                Limits total outbound messages to {settings.maxPerHour || 5} per 60-minute rolling window to evade WhatsApp velocity triggers.
              </p>
            </div>

            {/* Non-repeating Dynamic Variance */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.06)', marginBottom: 10 }}>
              <div>
                <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>High-Variance Non-Repeating Delays</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  Intervals are randomly generated with unique jitter so timing never repeats.
                </div>
              </div>
              <input
                type="checkbox"
                checked={settings.neverRepeatDelay !== false}
                onChange={(e) => {
                  setSelectedPreset('custom');
                  setSettings({ ...settings, neverRepeatDelay: e.target.checked });
                }}
                style={{ transform: 'scale(1.2)', cursor: 'pointer' }}
              />
            </div>

            {/* Human Typing Simulation */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <div>
                <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>Human Typing Presence Simulation</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  Sends WhatsApp "typing..." presence for 2–4s before sending each message.
                </div>
              </div>
              <input
                type="checkbox"
                checked={settings.simulateTyping !== false}
                onChange={(e) => {
                  setSelectedPreset('custom');
                  setSettings({ ...settings, simulateTyping: e.target.checked });
                }}
                style={{ transform: 'scale(1.2)', cursor: 'pointer' }}
              />
            </div>
          </div>

          {/* Sliders */}
          <div className="grid-2-col" style={{ gap: 16, marginBottom: 14 }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Min Delay:</span>
                <strong>{settings.minDelay}s</strong>
              </label>
              <input
                type="range"
                min="2"
                max="120"
                value={settings.minDelay}
                onChange={(e) => {
                  setSelectedPreset('custom');
                  setSettings({ ...settings, minDelay: Number(e.target.value) });
                }}
              />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Max Delay:</span>
                <strong>{settings.maxDelay}s</strong>
              </label>
              <input
                type="range"
                min="4"
                max="180"
                value={settings.maxDelay}
                onChange={(e) => {
                  setSelectedPreset('custom');
                  setSettings({ ...settings, maxDelay: Number(e.target.value) });
                }}
              />
            </div>
          </div>

          <div className="grid-2-col" style={{ gap: 16 }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Batch Size:</span>
                <strong>{settings.batchSize} msgs</strong>
              </label>
              <input
                type="range"
                min="1"
                max="50"
                value={settings.batchSize}
                onChange={(e) => {
                  setSelectedPreset('custom');
                  setSettings({ ...settings, batchSize: Number(e.target.value) });
                }}
              />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Batch Cooldown Pause:</span>
                <strong>{settings.batchPause}s</strong>
              </label>
              <input
                type="range"
                min="10"
                max="300"
                value={settings.batchPause}
                onChange={(e) => {
                  setSelectedPreset('custom');
                  setSettings({ ...settings, batchPause: Number(e.target.value) });
                }}
              />
            </div>
          </div>
        </div>

        {/* Right: Pre-Flight Checklist & Launch */}
        <div className="card glass-card">
          <div className="card-header">
            <h3>
              <Rocket size={20} color="var(--accent-purple)" /> Pre-Flight Checklist
            </h3>
            <span className="badge badge-outline">Step 4 of 5</span>
          </div>

          {/* Campaign Name */}
          <div className="form-group" style={{ marginBottom: 16 }}>
            <label className="form-label">Campaign Name / Identifier</label>
            <input
              type="text"
              className="form-control"
              placeholder="e.g. VIP Customer Promo March"
              value={campaignName}
              onChange={(e) => setCampaignName(e.target.value)}
            />
          </div>

          {/* Checklist items */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {waConnected ? (
                <CheckCircle2 size={18} color="var(--wa-green)" />
              ) : (
                <AlertCircle size={18} color="var(--accent-rose)" />
              )}
              <span style={{ fontSize: '0.88rem' }}>
                WhatsApp Account: <strong>{waConnected ? 'Connected' : 'Not Connected'}</strong>
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {contacts.length > 0 ? (
                <CheckCircle2 size={18} color="var(--wa-green)" />
              ) : (
                <AlertCircle size={18} color="var(--accent-rose)" />
              )}
              <span style={{ fontSize: '0.88rem' }}>
                Recipients Loaded: <strong>{contacts.length} contacts</strong>
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {templateVariations.some((v) => v.trim()) ? (
                <CheckCircle2 size={18} color="var(--wa-green)" />
              ) : (
                <AlertCircle size={18} color="var(--accent-rose)" />
              )}
              <span style={{ fontSize: '0.88rem' }}>
                Template Variations: <strong>{templateVariations.length} active (Spintax enabled)</strong>
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Clock size={18} color="var(--accent-blue)" />
              <span style={{ fontSize: '0.88rem' }}>
                Estimated Total Time: <strong>{calculateDuration()}</strong>
              </span>
            </div>
          </div>

          {/* Anti-Ban Safety Summary Notice */}
          <div
            style={{
              padding: 12,
              borderRadius: 8,
              background: 'rgba(37, 211, 102, 0.06)',
              border: '1px solid rgba(37, 211, 102, 0.2)',
              marginBottom: 20,
              fontSize: '0.78rem',
              lineHeight: 1.5
            }}
          >
            <div style={{ fontWeight: 700, color: 'var(--wa-green)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
              <ShieldCheck size={16} /> Anti-Algorithm Protection Configured:
            </div>
            <div>• Pacing: Max <strong>{settings.maxPerHour || 5} messages per hour</strong>.</div>
            <div>• Non-Repeating Delays: <strong>{settings.neverRepeatDelay !== false ? 'Active (Never repeats same time)' : 'Disabled'}</strong>.</div>
            <div>• Human Presence: <strong>{settings.simulateTyping !== false ? 'Active (Shows typing status)' : 'Disabled'}</strong>.</div>
          </div>

          <button
            className="btn btn-primary btn-lg"
            disabled={!isReadyToLaunch}
            onClick={onStartCampaign}
            style={{ width: '100%' }}
          >
            <Rocket size={18} /> {isCampaignRunning ? 'Campaign in Progress...' : 'Launch Bulk Campaign Now'}
          </button>
        </div>
      </div>
    </section>
  );
}
