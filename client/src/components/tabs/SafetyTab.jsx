import React, { useState } from 'react';
import {
  ShieldCheck,
  Zap,
  Sliders,
  CheckCircle2,
  AlertCircle,
  Clock,
  Rocket
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
  const [selectedPreset, setSelectedPreset] = useState('safe');

  const presets = [
    {
      id: 'safe',
      name: 'Safe (Recommended)',
      desc: '10–25s Delay • 10/batch • 60s pause',
      badge: 'Maximum Safety',
      badgeClass: 'badge-safe',
      values: { minDelay: 10, maxDelay: 25, batchSize: 10, batchPause: 60 }
    },
    {
      id: 'balanced',
      name: 'Balanced Marketing',
      desc: '6–15s Delay • 20/batch • 45s pause',
      badge: 'Optimal Speed',
      badgeClass: 'badge-whatsapp',
      values: { minDelay: 6, maxDelay: 15, batchSize: 20, batchPause: 45 }
    },
    {
      id: 'turbo',
      name: 'Turbo Fast',
      desc: '3–8s Delay • 35/batch • 30s pause',
      badge: 'High Speed',
      badgeClass: 'badge-warning',
      values: { minDelay: 3, maxDelay: 8, batchSize: 35, batchPause: 30 }
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
              <ShieldCheck size={20} color="var(--wa-green)" /> Anti-Ban Pacing & Delays
            </h3>
            <span className="badge badge-safe">AI Rate-Limiting</span>
          </div>

          {/* Presets */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
            <label className="form-label" style={{ fontSize: '0.8rem', textTransform: 'uppercase' }}>
              Safety Speed Presets:
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
                max="60"
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
                max="120"
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
                min="5"
                max="100"
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
                Template Variations: <strong>{templateVariations.length} active</strong>
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Clock size={18} color="var(--accent-blue)" />
              <span style={{ fontSize: '0.88rem' }}>
                Estimated Total Time: <strong>{calculateDuration()}</strong>
              </span>
            </div>
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
