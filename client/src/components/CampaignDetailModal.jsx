import React from 'react';
import { X, FileSpreadsheet, Send, XCircle, CheckCircle, Clock } from 'lucide-react';
import { getFullApiUrl } from '../services/api';

export default function CampaignDetailModal({
  isOpen,
  onClose,
  campaign
}) {
  if (!isOpen || !campaign) return null;

  function exportCsv() {
    const url = getFullApiUrl(`/api/campaigns/${campaign.id}/export`);
    window.open(url, '_blank');
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content glass-card" style={{ maxWidth: 680 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h3 style={{ margin: 0, fontSize: '1.2rem' }}>{campaign.name}</h3>
            <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Campaign ID: <code>{campaign.id}</code>
            </p>
          </div>
          <button className="btn-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="modal-body" style={{ padding: '20px 24px' }}>
          {/* Top Stats */}
          <div className="grid-3-col" style={{ marginBottom: 20 }}>
            <div className="glass-card" style={{ padding: 14, textAlign: 'center', borderRadius: 10 }}>
              <div style={{ fontSize: '1.4rem', fontWeight: 800 }}>{campaign.total}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Total Recipients</div>
            </div>
            <div className="glass-card" style={{ padding: 14, textAlign: 'center', borderRadius: 10, borderColor: 'rgba(37, 211, 102, 0.3)' }}>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--wa-green)' }}>
                {campaign.sent}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--wa-green)' }}>Delivered</div>
            </div>
            <div className="glass-card" style={{ padding: 14, textAlign: 'center', borderRadius: 10, borderColor: 'rgba(244, 63, 94, 0.3)' }}>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--accent-rose)' }}>
                {campaign.failed}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--accent-rose)' }}>Failed</div>
            </div>
          </div>

          <div style={{ fontSize: '0.85rem', marginBottom: 14, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div>
              <strong>Started: </strong>
              <span className="text-muted">{new Date(campaign.startTime).toLocaleString()}</span>
            </div>
            <div>
              <strong>Finished: </strong>
              <span className="text-muted">
                {campaign.endTime ? new Date(campaign.endTime).toLocaleString() : 'Incomplete / Stopped'}
              </span>
            </div>
          </div>

          {campaign.template && (
            <div
              style={{
                marginBottom: 16,
                background: 'rgba(0,0,0,0.25)',
                padding: 12,
                borderRadius: 8,
                border: '1px solid var(--border-color)'
              }}
            >
              <strong style={{ fontSize: '0.82rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                Primary Template:
              </strong>
              <pre style={{ whiteSpace: 'pre-wrap', fontSize: '0.82rem', fontFamily: 'inherit' }}>
                {campaign.template}
              </pre>
            </div>
          )}

          {campaign.records && campaign.records.length > 0 && (
            <div style={{ marginTop: 14 }}>
              <h4 style={{ fontSize: '0.9rem', marginBottom: 8 }}>Recipient Delivery Log</h4>
              <div className="table-responsive" style={{ maxHeight: 220 }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Phone</th>
                      <th>Status</th>
                      <th>Notes / Error</th>
                    </tr>
                  </thead>
                  <tbody>
                    {campaign.records.map((r, i) => (
                      <tr key={i}>
                        <td>+{r.phone}</td>
                        <td>
                          <span className={`badge ${r.status === 'sent' ? 'badge-safe' : 'badge-danger'}`}>
                            {r.status}
                          </span>
                        </td>
                        <td>
                          <small className="text-muted">{r.reason || r.message || '-'}</small>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
          <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>
            Close
          </button>
          <button type="button" className="btn btn-success btn-sm" onClick={exportCsv}>
            <FileSpreadsheet size={15} /> Download CSV Report
          </button>
        </div>
      </div>
    </div>
  );
}
