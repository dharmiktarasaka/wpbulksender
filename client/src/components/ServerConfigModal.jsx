import React, { useState, useEffect } from 'react';
import { Server, Link as LinkIcon, Zap, Check, X, Laptop, Globe } from 'lucide-react';
import { testServerPing } from '../services/api';

export default function ServerConfigModal({
  isOpen,
  onClose,
  currentUrl,
  onSave
}) {
  const [urlInput, setUrlInput] = useState('');
  const [pingStatus, setPingStatus] = useState('idle'); // idle, testing, success, error
  const [latency, setLatency] = useState(null);
  const [healthData, setHealthData] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (isOpen) {
      setUrlInput(currentUrl);
      handleTest(currentUrl);
    }
  }, [isOpen, currentUrl]);

  if (!isOpen) return null;

  async function handleTest(customUrl = null) {
    const target = (customUrl !== null ? customUrl : urlInput).trim();
    setPingStatus('testing');
    setErrorMessage('');

    const res = await testServerPing(target);
    if (res.success) {
      setPingStatus('success');
      setLatency(res.latency);
      setHealthData(res.data);
    } else {
      setPingStatus('error');
      setErrorMessage(res.error || 'Server is offline or unreachable');
    }
  }

  function handleSave() {
    onSave(urlInput.trim());
    onClose();
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content glass-card" style={{ maxWidth: 540 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                background: 'rgba(59, 130, 246, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--accent-blue)'
              }}
            >
              <Server size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.15rem' }}>Backend Server Connection</h3>
              <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Connect your Vercel frontend to your Render backend
              </p>
            </div>
          </div>
          <button className="btn-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="modal-body" style={{ padding: '20px 24px' }}>
          <div className="form-group" style={{ marginBottom: 16 }}>
            <label
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 6,
                fontWeight: 600
              }}
            >
              <span>Backend Server URL:</span>
              <span
                className={`badge ${
                  pingStatus === 'success'
                    ? 'badge-safe'
                    : pingStatus === 'error'
                    ? 'badge-danger'
                    : 'badge-outline'
                }`}
              >
                {pingStatus === 'testing'
                  ? 'Testing...'
                  : pingStatus === 'success'
                  ? `Online (${latency}ms)`
                  : pingStatus === 'error'
                  ? 'Offline'
                  : 'Ready'}
              </span>
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                className="form-control"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="e.g. https://your-backend.onrender.com or http://localhost:5000"
                style={{ paddingLeft: 38, fontFamily: 'monospace', fontSize: '0.9rem' }}
              />
              <LinkIcon
                size={16}
                style={{ position: 'absolute', left: 14, top: 14, color: 'var(--text-muted)' }}
              />
            </div>
            <small style={{ marginTop: 6, display: 'block', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
              Enter the public URL of your Render backend web service, or local backend URL.
            </small>
          </div>

          <div style={{ marginBottom: 20 }}>
            <label
              style={{
                fontSize: '0.8rem',
                color: 'var(--text-muted)',
                marginBottom: 8,
                display: 'block',
                textTransform: 'uppercase',
                fontWeight: 600,
                letterSpacing: 0.5
              }}
            >
              Quick Presets:
            </label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn-outline btn-xs"
                onClick={() => {
                  setUrlInput('http://localhost:5000');
                  handleTest('http://localhost:5000');
                }}
              >
                <Laptop size={14} /> Localhost (5000)
              </button>
              <button
                type="button"
                className="btn btn-outline btn-xs"
                onClick={() => {
                  setUrlInput('http://localhost:3000');
                  handleTest('http://localhost:3000');
                }}
              >
                <Laptop size={14} /> Localhost (3000)
              </button>
              <button
                type="button"
                className="btn btn-outline btn-xs"
                onClick={() => {
                  setUrlInput(window.location.origin);
                  handleTest(window.location.origin);
                }}
              >
                <Globe size={14} /> Same Origin
              </button>
            </div>
          </div>

          <div
            style={{
              background: 'var(--bg-card-subtle)',
              border: '1px solid var(--border-color)',
              borderRadius: 8,
              padding: 12,
              fontSize: '0.82rem',
              marginBottom: 16
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ color: 'var(--text-muted)' }}>Status:</span>
              <strong>
                {pingStatus === 'success' ? (
                  <span style={{ color: 'var(--wa-green)' }}>● Connected</span>
                ) : pingStatus === 'error' ? (
                  <span style={{ color: 'var(--accent-rose)' }}>● Offline ({errorMessage})</span>
                ) : (
                  'Checking...'
                )}
              </strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ color: 'var(--text-muted)' }}>Latency:</span>
              <span>{latency !== null ? `${latency} ms` : '--'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>WhatsApp Engine:</span>
              <span>
                {healthData
                  ? healthData.whatsappConnected
                    ? 'Linked'
                    : 'Ready for QR scan'
                  : '--'}
              </span>
            </div>
          </div>

          {/* Privacy & Session Isolation Card */}
          <div
            style={{
              background: 'rgba(16, 185, 129, 0.05)',
              border: '1px solid rgba(16, 185, 129, 0.2)',
              borderRadius: 8,
              padding: 12,
              fontSize: '0.82rem'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <strong style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--wa-green)' }}>
                🔒 Private Workspace Isolation
              </strong>
              <button
                type="button"
                className="btn btn-outline btn-xs"
                onClick={() => {
                  if (confirm('Create a new fresh workspace? Your current session and QR code will be reset to a brand new private ID.')) {
                    localStorage.removeItem('WASENDER_SESSION_ID');
                    window.location.reload();
                  }
                }}
                title="Generate a new isolated session"
              >
                Reset / New Session
              </button>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', margin: 0 }}>
              Your WhatsApp connection, imported contacts, messages, and campaigns are completely private to this browser session. Other users cannot view or access your account.
            </p>
          </div>
        </div>

        <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => handleTest()}>
            <Zap size={15} /> Test Connection
          </button>
          <button type="button" className="btn btn-primary btn-sm" onClick={handleSave}>
            <Check size={15} /> Save & Connect
          </button>
        </div>
      </div>
    </div>
  );
}
