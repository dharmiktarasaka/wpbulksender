import React from 'react';
import {
  QrCode,
  Smartphone,
  ShieldCheck,
  Zap,
  LogOut,
  RefreshCw,
  CheckCircle2,
  Lock
} from 'lucide-react';
import { apiFetch } from '../../services/api';

export default function ConnectionTab({
  waStatus,
  waQr,
  waUser,
  waConnected,
  onShowToast,
  onNext
}) {
  // Automatically request QR code / session init if disconnected and no QR is loaded
  React.useEffect(() => {
    if (!waConnected && !waQr && waStatus === 'disconnected') {
      apiFetch('/api/whatsapp/init', { method: 'POST' }).catch(() => {});
    }
  }, [waConnected, waQr, waStatus]);

  async function handleRefresh() {
    onShowToast('Initializing WhatsApp connection...', 'info');
    try {
      await apiFetch('/api/whatsapp/init', { method: 'POST' });
    } catch (err) {
      onShowToast('Failed to refresh: ' + err.message, 'error');
    }
  }

  async function handleLogout() {
    if (confirm('Are you sure you want to unlink your WhatsApp account? This will disconnect your active session.')) {
      try {
        await apiFetch('/api/whatsapp/logout', { method: 'POST' });
        onShowToast('WhatsApp unlinked successfully', 'info');
      } catch (err) {
        onShowToast('Logout error: ' + err.message, 'error');
      }
    }
  }

  return (
    <section className="tab-panel active">
      <div className="grid-2-col">
        {/* Left: QR Scanner Card */}
        <div className="card glass-card">
          <div className="card-header">
            <h3>
              <QrCode size={20} color="var(--wa-green)" /> Scan QR to Connect
            </h3>
            <span
              className={`badge ${
                waConnected
                  ? 'badge-whatsapp'
                  : waStatus === 'qr_ready'
                  ? 'badge-safe'
                  : 'badge-warning'
              }`}
            >
              {waConnected
                ? 'Active & Ready'
                : waStatus === 'qr_ready'
                ? 'Scan QR Code Now'
                : waStatus === 'connecting'
                ? 'Connecting...'
                : 'Waiting for session'}
            </span>
          </div>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: 320,
              background: 'rgba(0,0,0,0.2)',
              borderRadius: 12,
              padding: 24,
              border: '1px dashed var(--border-color)'
            }}
          >
            {waConnected ? (
              <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
                <div
                  style={{
                    width: 72,
                    height: 72,
                    borderRadius: '50%',
                    background: 'rgba(37, 211, 102, 0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--wa-green)',
                    boxShadow: '0 0 20px rgba(37, 211, 102, 0.4)'
                  }}
                >
                  <CheckCircle2 size={40} />
                </div>
                <div>
                  <h4 style={{ fontSize: '1.25rem', fontWeight: 800 }}>
                    {waUser?.name || 'WhatsApp Account'}
                  </h4>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    {waUser?.id || 'Multi-device session linked successfully'}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                  <button className="btn btn-danger btn-sm" onClick={handleLogout}>
                    <LogOut size={15} /> Unlink WhatsApp
                  </button>
                  <button className="btn btn-primary btn-sm" onClick={onNext}>
                    Proceed to Contacts ➔
                  </button>
                </div>
              </div>
            ) : waQr ? (
              <div style={{ textAlign: 'center' }}>
                <div
                  style={{
                    background: '#fff',
                    padding: 12,
                    borderRadius: 12,
                    boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
                    display: 'inline-block'
                  }}
                >
                  <img src={waQr} alt="WhatsApp QR Code" style={{ width: 240, height: 240, display: 'block' }} />
                </div>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: 14 }}>
                  Scan with WhatsApp on your phone (Linked Devices)
                </p>
                <button className="btn btn-outline btn-xs" onClick={handleRefresh} style={{ marginTop: 8 }}>
                  <RefreshCw size={13} /> Refresh QR Code
                </button>
              </div>
            ) : (
              <div style={{ textAlign: 'center' }}>
                <div style={{ marginBottom: 12, color: 'var(--accent-amber)' }}>
                  <RefreshCw size={32} className="animate-spin" />
                </div>
                <h4 style={{ fontSize: '1rem', fontWeight: 700 }}>Starting WhatsApp Engine...</h4>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: 4 }}>
                  Please wait while the multi-device connection is initialized.
                </p>
                <button className="btn btn-secondary btn-xs" onClick={handleRefresh} style={{ marginTop: 12 }}>
                  <RefreshCw size={14} /> Force Initialize
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right: Pairing Instructions Card */}
        <div className="card glass-card">
          <div className="card-header">
            <h3>
              <Smartphone size={20} color="var(--accent-blue)" /> How to Connect
            </h3>
            <span className="badge badge-safe">
              <ShieldCheck size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} />
              End-to-End Encrypted
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
              <div className="step-num" style={{ background: 'var(--accent-blue)' }}>
                1
              </div>
              <div>
                <strong style={{ fontSize: '0.9rem' }}>Open WhatsApp on your phone</strong>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: 2 }}>
                  Launch the official WhatsApp or WhatsApp Business application.
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
              <div className="step-num" style={{ background: 'var(--accent-blue)' }}>
                2
              </div>
              <div>
                <strong style={{ fontSize: '0.9rem' }}>Navigate to Linked Devices</strong>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: 2 }}>
                  Tap <strong>Settings</strong> ➔ <strong>Linked Devices</strong> ➔ <strong>Link a Device</strong>.
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
              <div className="step-num" style={{ background: 'var(--accent-blue)' }}>
                3
              </div>
              <div>
                <strong style={{ fontSize: '0.9rem' }}>Scan the QR Code on screen</strong>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: 2 }}>
                  Point your phone camera at the QR code on the left. The connection will verify instantly.
                </p>
              </div>
            </div>

            <div
              style={{
                marginTop: 10,
                background: 'rgba(37, 211, 102, 0.05)',
                border: '1px solid rgba(37, 211, 102, 0.2)',
                borderRadius: 8,
                padding: 12,
                fontSize: '0.8rem',
                display: 'flex',
                gap: 10
              }}
            >
              <Lock size={18} color="var(--wa-green)" style={{ flexShrink: 0, marginTop: 2 }} />
              <p style={{ margin: 0, color: 'var(--text-muted)' }}>
                <strong style={{ color: 'var(--text-main)' }}>Privacy Assurance: </strong>
                Your session credentials and keys remain completely private on your local machine and are never shared.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
