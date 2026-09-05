import React from 'react';
import {
  MessageSquare,
  Users,
  PenTool,
  ShieldCheck,
  Activity,
  Lock,
  CheckCircle
} from 'lucide-react';

export default function Sidebar({
  activeTab,
  setActiveTab,
  waConnected,
  waStatus,
  waUser,
  contactCount,
  isCampaignRunning
}) {
  const navItems = [
    {
      id: 'tab-connection',
      num: 1,
      title: 'Connect WhatsApp',
      desc: 'QR Code Scanner',
      icon: MessageSquare,
      checked: waConnected
    },
    {
      id: 'tab-contacts',
      num: 2,
      title: 'Import Contacts',
      desc: 'Excel / CSV / Paste',
      icon: Users,
      badge: contactCount
    },
    {
      id: 'tab-composer',
      num: 3,
      title: 'Compose Message',
      desc: 'Templates & Variations',
      icon: PenTool
    },
    {
      id: 'tab-settings',
      num: 4,
      title: 'Anti-Ban Safety',
      desc: 'Pacing & Speed Presets',
      icon: ShieldCheck
    },
    {
      id: 'tab-console',
      num: 5,
      title: 'Live Monitor & History',
      desc: 'Progress & Reports',
      icon: Activity,
      running: isCampaignRunning
    }
  ];

  let statusLabel = 'Disconnected';
  let statusDotClass = 'status-dot';
  let userDetail = 'Waiting for scan...';

  if (waConnected) {
    statusLabel = 'Connected';
    statusDotClass = 'status-dot connected';
    userDetail = waUser?.name || waUser?.id || 'Active Session';
  } else if (waStatus === 'qr_ready') {
    statusLabel = 'Scan QR Code';
    statusDotClass = 'status-dot connecting';
    userDetail = 'Waiting for scan...';
  } else if (waStatus === 'connecting') {
    statusLabel = 'Connecting...';
    statusDotClass = 'status-dot connecting';
    userDetail = 'Linking session...';
  }

  return (
    <aside className="sidebar">
      {/* Brand Header */}
      <div className="brand">
        <div className="brand-icon">
          <i className="fa-brands fa-whatsapp"></i>
        </div>
        <div className="brand-text">
          <h2>
            WASender<span className="badge-pro">PRO</span>
          </h2>
          <span className="sub-text">Smart Campaign Suite</span>
        </div>
      </div>

      {/* WhatsApp Status Card */}
      <div className="sidebar-status-card">
        <div className="status-indicator-wrapper">
          <span className={statusDotClass} />
          <span className="status-label">{statusLabel}</span>
        </div>
        <div className="user-detail">{userDetail}</div>
      </div>

      {/* Navigation Tabs */}
      <nav className="nav-menu">
        {navItems.map((item) => {
          return (
            <button
              key={item.id}
              className={`nav-btn ${activeTab === item.id ? 'active' : ''}`}
              onClick={() => setActiveTab(item.id)}
            >
              <span className="step-num">{item.num}</span>
              <div className="nav-btn-content">
                <span className="nav-title">{item.title}</span>
                <span className="nav-desc">{item.desc}</span>
              </div>

              {item.checked && (
                <CheckCircle size={16} color="var(--wa-green)" />
              )}
              {item.badge !== undefined && (
                <span className="nav-count">{item.badge}</span>
              )}
              {item.running && (
                <span className="pulse-active-badge">LIVE</span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Sidebar Footer */}
      <div className="sidebar-footer">
        <div className="privacy-notice">
          <Lock size={18} color="var(--wa-green)" style={{ flexShrink: 0, marginTop: 2 }} />
          <div>
            <strong>100% Privacy Protected</strong>
            <p>Your contacts and session remain completely private on your local machine.</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
