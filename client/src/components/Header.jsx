import React from 'react';
import { Server, Settings, RefreshCw, Sun, Moon } from 'lucide-react';

export default function Header({
  activeTab,
  setActiveTab,
  tabMeta,
  serverStatus,
  backendUrl,
  waConnected,
  waUser,
  theme = 'light',
  onToggleTheme,
  onOpenServerModal,
  onRefreshSession
}) {
  const steps = [
    { id: 'tab-connection', num: 1, label: 'Connect' },
    { id: 'tab-contacts', num: 2, label: 'Contacts' },
    { id: 'tab-composer', num: 3, label: 'Message' },
    { id: 'tab-settings', num: 4, label: 'Safety' },
    { id: 'tab-console', num: 5, label: 'Live Send' }
  ];

  const displayUrl = backendUrl ? backendUrl.replace(/^https?:\/\//, '') : 'Backend';
  const shortUrl = displayUrl.length > 20 ? displayUrl.substring(0, 18) + '...' : displayUrl;

  return (
    <header className="top-bar">
      <div className="top-title">
        <div className="wizard-stepper">
          {steps.map((step, idx) => (
            <React.Fragment key={step.id}>
              <div
                className={`step-pill ${activeTab === step.id ? 'active' : ''}`}
                onClick={() => setActiveTab(step.id)}
              >
                <span className="step-circle">{step.num}</span>
                <span>{step.label}</span>
              </div>
              {idx < steps.length - 1 && <div className="step-divider" />}
            </React.Fragment>
          ))}
        </div>
        <h1>{tabMeta[activeTab]?.title || 'WhatsApp Bulk Sender'}</h1>
        <p>{tabMeta[activeTab]?.subtitle || 'Smart campaign suite'}</p>
      </div>

      <div className="top-actions">
        {/* Backend Connection Pill */}
        <div
          className={`server-pill ${serverStatus}`}
          onClick={onOpenServerModal}
          title={`Backend Server: ${backendUrl} (Click to configure)`}
        >
          <span className="server-dot" />
          <span>
            {serverStatus === 'connected'
              ? `Backend: ${shortUrl}`
              : serverStatus === 'connecting'
              ? 'Connecting...'
              : 'Backend: Offline'}
          </span>
          <Server size={14} style={{ marginLeft: 4 }} />
        </div>

        {/* WhatsApp Session Pill */}
        <div className={`connection-pill ${waConnected ? 'connected' : ''}`}>
          <span className="pill-dot" />
          <span>{waConnected ? `Connected: ${waUser?.name || 'WA User'}` : 'Disconnected'}</span>
        </div>

        {/* Theme Toggle Button (Light / Dark) */}
        <button
          className="btn btn-outline"
          onClick={onToggleTheme}
          title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
        >
          {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
        </button>

        {/* Server Config Settings Button */}
        <button className="btn btn-outline" onClick={onOpenServerModal} title="Server Settings (Render / Localhost)">
          <Settings size={16} />
        </button>

        {/* Refresh Session Button */}
        <button className="btn btn-outline" onClick={onRefreshSession} title="Refresh WhatsApp Session / QR">
          <RefreshCw size={16} />
        </button>
      </div>
    </header>
  );
}
