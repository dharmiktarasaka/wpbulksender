import React, { useEffect, useRef } from 'react';
import {
  Activity,
  Pause,
  Play,
  Square,
  Trash2,
  RefreshCw,
  Eye,
  FileSpreadsheet,
  CheckCircle,
  XCircle,
  Clock
} from 'lucide-react';
import { apiFetch, getFullApiUrl } from '../../services/api';

export default function ConsoleTab({
  activeCampaign,
  terminalLogs,
  setTerminalLogs,
  campaignHistory,
  loadHistory,
  onViewCampaignDetails,
  onShowToast
}) {
  const terminalEndRef = useRef(null);

  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [terminalLogs]);

  async function handlePause() {
    try {
      await apiFetch('/api/campaign/pause', { method: 'POST' });
      onShowToast('Campaign paused', 'warning');
    } catch (e) {
      onShowToast('Error: ' + e.message, 'error');
    }
  }

  async function handleResume() {
    try {
      await apiFetch('/api/campaign/resume', { method: 'POST' });
      onShowToast('Campaign resumed', 'info');
    } catch (e) {
      onShowToast('Error: ' + e.message, 'error');
    }
  }

  async function handleStop() {
    if (confirm('Are you sure you want to stop the ongoing campaign?')) {
      try {
        await apiFetch('/api/campaign/stop', { method: 'POST' });
        onShowToast('Campaign stopped', 'error');
      } catch (e) {
        onShowToast('Error: ' + e.message, 'error');
      }
    }
  }

  async function handleDeleteCampaign(id, name) {
    if (confirm(`Are you sure you want to delete campaign "${name}"?`)) {
      try {
        const res = await apiFetch(`/api/campaigns/${id}`, { method: 'DELETE' });
        if (res.ok) {
          onShowToast(`Campaign "${name}" deleted`, 'success');
          loadHistory();
        } else {
          const text = await res.text();
          throw new Error(text || 'Failed to delete campaign');
        }
      } catch (e) {
        onShowToast('Error deleting campaign: ' + e.message, 'error');
      }
    }
  }

  async function handleClearAll() {
    if (confirm('Are you sure you want to clear ALL past campaign history? This cannot be undone.')) {
      try {
        let cleared = false;
        try {
          const res = await apiFetch('/api/campaigns', { method: 'DELETE' });
          if (res.ok) {
            cleared = true;
          }
        } catch (err) {
          // Fall back to deleting items individually
        }

        if (!cleared && campaignHistory.length > 0) {
          await Promise.all(
            campaignHistory.map((c) =>
              apiFetch(`/api/campaigns/${c.id}`, { method: 'DELETE' }).catch(() => {})
            )
          );
        }

        onShowToast('All campaign history cleared successfully', 'success');
        loadHistory();
      } catch (e) {
        onShowToast('Error clearing history: ' + e.message, 'error');
      }
    }
  }

  const campaignInfo = activeCampaign?.campaign || activeCampaign;
  const currentStatus = (activeCampaign?.status || activeCampaign?.state || 'idle').toLowerCase();
  const isRunning = currentStatus === 'running' || currentStatus === 'paused';
  const progressPercent = campaignInfo?.currentProgress || 0;

  return (
    <section className="tab-panel active">
      {/* Top: Live Progress & Live Terminal Feed */}
      <div className="grid-2-col" style={{ marginBottom: 24 }}>
        {/* Progress & Stats Card */}
        <div className="card glass-card">
          <div className="card-header">
            <div>
              <h3>
                <Activity size={20} color="var(--wa-green)" /> Live Dispatch Monitor
              </h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: 2 }}>
                {campaignInfo?.name || 'No active campaign running'}
              </p>
            </div>
            <span className={`badge ${isRunning ? 'badge-safe' : 'badge-outline'}`}>
              {currentStatus.toUpperCase()}
            </span>
          </div>

          {/* Progress Bar */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: '0.85rem' }}>
              <span>Progress</span>
              <strong>{progressPercent}%</strong>
            </div>
            <div style={{ width: '100%', height: 10, background: 'rgba(255,255,255,0.08)', borderRadius: 10, overflow: 'hidden' }}>
              <div
                style={{
                  width: `${progressPercent}%`,
                  height: '100%',
                  background: 'linear-gradient(90deg, #25d366, #3b82f6)',
                  transition: 'width 0.3s ease'
                }}
              />
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid-3-col" style={{ marginBottom: 20 }}>
            <div className="glass-card" style={{ padding: 12, textAlign: 'center', borderRadius: 8 }}>
              <div style={{ fontSize: '1.25rem', fontWeight: 800 }}>{campaignInfo?.total || 0}</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Total</div>
            </div>
            <div className="glass-card" style={{ padding: 12, textAlign: 'center', borderRadius: 8, borderColor: 'rgba(37, 211, 102, 0.3)' }}>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--wa-green)' }}>
                {campaignInfo?.sent || 0}
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--wa-green)' }}>Sent</div>
            </div>
            <div className="glass-card" style={{ padding: 12, textAlign: 'center', borderRadius: 8, borderColor: 'rgba(244, 63, 94, 0.3)' }}>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--accent-rose)' }}>
                {campaignInfo?.failed || 0}
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--accent-rose)' }}>Failed</div>
            </div>
          </div>

          {/* Campaign Action Buttons */}
          <div style={{ display: 'flex', gap: 10 }}>
            {currentStatus === 'running' && (
              <button className="btn btn-outline btn-sm" onClick={handlePause}>
                <Pause size={14} /> Pause Campaign
              </button>
            )}
            {currentStatus === 'paused' && (
              <button className="btn btn-primary btn-sm" onClick={handleResume}>
                <Play size={14} /> Resume Campaign
              </button>
            )}
            {isRunning && (
              <button className="btn btn-danger btn-sm" onClick={handleStop}>
                <Square size={14} /> Stop Campaign
              </button>
            )}
          </div>
        </div>

        {/* Real-time Terminal Log Feed */}
        <div className="card glass-card">
          <div className="card-header">
            <h3>Live Execution Logs</h3>
            <button className="btn btn-outline btn-xs" onClick={() => setTerminalLogs([])}>
              <Trash2 size={12} /> Clear Logs
            </button>
          </div>

          <div className="terminal-window">
            {terminalLogs.length === 0 ? (
              <div style={{ color: 'var(--text-dim)', fontStyle: 'italic', padding: 10 }}>
                Logs will appear here once dispatching starts...
              </div>
            ) : (
              terminalLogs.map((log, i) => (
                <div key={i} className={`log-line log-${log.type || 'info'}`}>
                  [{log.timestamp}] {log.message}
                </div>
              ))
            )}
            <div ref={terminalEndRef} />
          </div>
        </div>
      </div>

      {/* Bottom: Campaign History Archive */}
      <div className="card glass-card">
        <div className="card-header">
          <h3>Campaign History & Delivery Reports</h3>
          <div style={{ display: 'flex', gap: 8 }}>
            {campaignHistory.length > 0 && (
              <button
                className="btn btn-danger btn-xs"
                onClick={handleClearAll}
                title="Clear all campaign history"
              >
                <Trash2 size={13} /> Clear All
              </button>
            )}
            <button className="btn btn-outline btn-xs" onClick={loadHistory}>
              <RefreshCw size={13} /> Refresh History
            </button>
          </div>
        </div>

        <div className="table-responsive">
          {campaignHistory.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '30px 10px', color: 'var(--text-muted)' }}>
              No past campaigns recorded yet.
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Campaign Name</th>
                  <th>Date & Time</th>
                  <th>Total</th>
                  <th>Delivered</th>
                  <th>Failed</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {campaignHistory.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <strong>{c.name}</strong>
                    </td>
                    <td>
                      <small className="text-muted">{new Date(c.startTime).toLocaleString()}</small>
                    </td>
                    <td>{c.total}</td>
                    <td>
                      <span style={{ color: 'var(--wa-green)', fontWeight: 700 }}>{c.sent}</span>
                    </td>
                    <td>
                      <span style={{ color: 'var(--accent-rose)' }}>{c.failed}</span>
                    </td>
                    <td>
                      <span
                        className={`badge ${
                          c.outcome === 'completed'
                            ? 'badge-safe'
                            : c.outcome === 'stopped'
                            ? 'badge-danger'
                            : 'badge-outline'
                        }`}
                      >
                        {c.outcome || 'Finished'}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          className="btn btn-outline btn-xs"
                          onClick={() => onViewCampaignDetails(c.id)}
                          title="View Details"
                        >
                          <Eye size={12} /> Details
                        </button>
                        <a
                          className="btn btn-success btn-xs"
                          href={getFullApiUrl(`/api/campaigns/${c.id}/export`)}
                          target="_blank"
                          rel="noreferrer"
                          title="Export CSV"
                        >
                          <FileSpreadsheet size={12} /> CSV
                        </a>
                        <button
                          className="btn btn-danger btn-xs"
                          onClick={() => handleDeleteCampaign(c.id, c.name)}
                          title="Delete Campaign"
                        >
                          <Trash2 size={12} /> Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </section>
  );
}
