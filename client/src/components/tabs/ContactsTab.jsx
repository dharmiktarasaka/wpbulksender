import React, { useState } from 'react';
import {
  Upload,
  FileSpreadsheet,
  Download,
  ListPlus,
  Trash2,
  CopyX,
  Search,
  Edit2,
  CheckCircle,
  Users
} from 'lucide-react';
import { apiFetch } from '../../services/api';

export default function ContactsTab({
  contacts,
  setContacts,
  defaultCountryCode,
  onShowToast,
  onEditContact,
  onNext
}) {
  const [subTab, setSubTab] = useState('upload'); // 'upload' | 'manual'
  const [uploadResult, setUploadResult] = useState(null);
  const [phoneCol, setPhoneCol] = useState('');
  const [nameCol, setNameCol] = useState('');
  const [countryCode, setCountryCode] = useState(defaultCountryCode || '91');
  const [manualText, setManualText] = useState('');
  const [manualCC, setManualCC] = useState(defaultCountryCode || '91');
  const [searchQuery, setSearchQuery] = useState('');
  const [isDragging, setIsDragging] = useState(false);

  function cleanPhoneNumber(val, defaultCC = '91') {
    if (val === null || val === undefined) return '';
    let str = String(val).trim();
    if (str.includes('e') || str.includes('E')) {
      const num = Number(str);
      if (!isNaN(num)) {
        str = num.toLocaleString('fullwide', { useGrouping: false });
      }
    }
    let digits = str.replace(/\D/g, '');
    if (!digits) return '';

    if (digits.startsWith('0') && digits.length > 10) {
      digits = digits.substring(1);
    }

    const cleanCC = String(defaultCC || '').replace(/\D/g, '');
    if (digits.length === 10 && cleanCC) {
      digits = cleanCC + digits;
    }

    return digits;
  }

  // File Upload Handler
  async function handleFileUpload(file) {
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);

    onShowToast(`Parsing ${file.name}...`, 'info');

    try {
      const res = await apiFetch('/api/contacts/parse', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      setUploadResult(data);
      const chosenPhone = data.suggestedPhoneCol || (data.columns && data.columns.find(c => /phone|mobile|contact|number/i.test(c))) || (data.columns && data.columns[0]) || '';
      const chosenName = data.suggestedNameCol || (data.columns && data.columns.find(c => c !== chosenPhone && /name/i.test(c))) || '';
      setPhoneCol(chosenPhone);
      setNameCol(chosenName);
      onShowToast(`Loaded ${data.totalRows} rows from ${file.name}`, 'success');
    } catch (err) {
      onShowToast('File parse failed: ' + err.message, 'error');
    }
  }

  // Apply Column Mapping
  function applyMapping() {
    const rows = uploadResult?.allRows || uploadResult?.data || [];
    if (!uploadResult) {
      return onShowToast('Please upload a spreadsheet first', 'error');
    }
    if (!phoneCol) {
      return onShowToast('Please select the phone number column', 'error');
    }
    if (!rows.length) {
      return onShowToast('No rows found in uploaded file', 'error');
    }

    const newContacts = [];
    const seen = new Set();
    const cleanCC = countryCode.replace(/[^0-9]/g, '');

    rows.forEach((row) => {
      // 1. Read phone from mapped column
      let rawPhone = row[phoneCol];

      // 2. Fallback: if selected column is blank for this row, look for any column with 7-15 digits
      if (rawPhone === undefined || rawPhone === null || String(rawPhone).trim() === '') {
        for (const col of Object.keys(row)) {
          const val = String(row[col] || '').replace(/\D/g, '');
          if (val.length >= 7 && val.length <= 15) {
            rawPhone = row[col];
            break;
          }
        }
      }

      const cleanPhone = cleanPhoneNumber(rawPhone, cleanCC);
      if (!cleanPhone || cleanPhone.length < 7) return;

      if (!seen.has(cleanPhone)) {
        seen.add(cleanPhone);

        let contactName = '';
        if (nameCol && row[nameCol] !== undefined && row[nameCol] !== null) {
          contactName = String(row[nameCol]).trim();
        }

        // Capture all spreadsheet columns as custom variables (e.g. {{Company}}, {{Plan}})
        // while guaranteeing clean phone and name are never overwritten
        const contactObj = {
          ...row,
          name: contactName,
          phone: cleanPhone,
          rawPhone: String(rawPhone || cleanPhone).trim()
        };

        newContacts.push(contactObj);
      }
    });

    if (newContacts.length === 0) {
      return onShowToast(
        `Could not extract valid phone numbers from column "${phoneCol}". Please verify column mapping.`,
        'error'
      );
    }

    setContacts(newContacts);
    onShowToast(`Successfully ingested ${newContacts.length} contacts!`, 'success');
  }

  // Manual Add Contacts
  function handleManualAdd() {
    if (!manualText.trim()) {
      return onShowToast('Please paste at least one phone number', 'error');
    }

    const lines = manualText.split('\n');
    const newContacts = [...contacts];
    const seen = new Set(contacts.map((c) => c.phone));
    let added = 0;
    const cleanCC = manualCC.replace(/[^0-9]/g, '');

    lines.forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed) return;

      let name = '';
      let rawPhone = trimmed;

      if (trimmed.includes(',')) {
        const parts = trimmed.split(',');
        rawPhone = parts[0].trim();
        name = parts.slice(1).join(',').trim();
      }

      let cleanPhone = rawPhone.replace(/[^0-9]/g, '');
      if (cleanPhone.length <= 10 && cleanCC) {
        cleanPhone = cleanCC + cleanPhone;
      }

      if (cleanPhone.length >= 7 && !seen.has(cleanPhone)) {
        seen.add(cleanPhone);
        newContacts.push({
          phone: cleanPhone,
          name,
          rawPhone
        });
        added++;
      }
    });

    setContacts(newContacts);
    setManualText('');
    onShowToast(`Added ${added} new contacts!`, 'success');
  }

  // Remove Duplicates
  function removeDuplicates() {
    const seen = new Set();
    const unique = [];
    contacts.forEach((c) => {
      if (!seen.has(c.phone)) {
        seen.add(c.phone);
        unique.push(c);
      }
    });
    const removed = contacts.length - unique.length;
    setContacts(unique);
    onShowToast(`Removed ${removed} duplicates! (${unique.length} unique)`, 'info');
  }

  // Filtered contacts
  const filteredContacts = contacts.filter((c) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return c.phone.includes(q) || (c.name && c.name.toLowerCase().includes(q));
  });

  return (
    <section className="tab-panel active">
      <div className="grid-2-col">
        {/* Left: Input Sources (Excel / Manual) */}
        <div className="card glass-card">
          <div className="card-header">
            <h3>
              <Users size={20} color="var(--wa-green)" /> Import Contact Lists
            </h3>
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                className={`btn btn-xs ${subTab === 'upload' ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setSubTab('upload')}
              >
                <FileSpreadsheet size={13} /> Excel / CSV
              </button>
              <button
                className={`btn btn-xs ${subTab === 'manual' ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setSubTab('manual')}
              >
                <ListPlus size={13} /> Paste Numbers
              </button>
            </div>
          </div>

          {subTab === 'upload' ? (
            <div>
              {/* Dropzone */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  if (e.dataTransfer.files.length) {
                    handleFileUpload(e.dataTransfer.files[0]);
                  }
                }}
                style={{
                  border: `2px dashed ${isDragging ? 'var(--wa-green)' : 'var(--border-color)'}`,
                  background: isDragging ? 'rgba(37, 211, 102, 0.08)' : 'rgba(0,0,0,0.15)',
                  borderRadius: 12,
                  padding: '28px 16px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                onClick={() => document.getElementById('contactFileInput')?.click()}
              >
                <Upload size={32} color="var(--wa-green)" style={{ margin: '0 auto 10px' }} />
                <h4 style={{ fontSize: '0.95rem', fontWeight: 700 }}>
                  Drag & Drop your Excel or CSV file here
                </h4>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginTop: 4 }}>
                  Supports <code>.xlsx</code>, <code>.xls</code>, and <code>.csv</code> sheets
                </p>
                <input
                  type="file"
                  id="contactFileInput"
                  accept=".xlsx,.xls,.csv"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    if (e.target.files && e.target.files.length) {
                      handleFileUpload(e.target.files[0]);
                    }
                  }}
                />
              </div>

              {/* Sample Download */}
              <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Need a template?</span>
                <a
                  href="/sample_contacts.xlsx"
                  download="sample_contacts.xlsx"
                  className="btn btn-outline btn-xs"
                  style={{ textDecoration: 'none' }}
                >
                  <Download size={13} /> Download Sample Excel
                </a>
              </div>

              {/* Column Mapping Section */}
              {uploadResult && (
                <div
                  style={{
                    marginTop: 18,
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 10,
                    padding: 14
                  }}
                >
                  <h4 style={{ fontSize: '0.88rem', fontWeight: 700, marginBottom: 10 }}>
                    Map Spreadsheet Columns:
                  </h4>
                  <div className="grid-2-col" style={{ gap: 10, marginBottom: 10 }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.75rem' }}>
                        Phone Number Column:
                      </label>
                      <select
                        className="form-control"
                        value={phoneCol}
                        onChange={(e) => setPhoneCol(e.target.value)}
                        style={{ fontSize: '0.82rem', padding: '8px 10px' }}
                      >
                        {uploadResult.columns.map((col) => (
                          <option key={col} value={col}>
                            {col}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.75rem' }}>
                        Name Column (Optional):
                      </label>
                      <select
                        className="form-control"
                        value={nameCol}
                        onChange={(e) => setNameCol(e.target.value)}
                        style={{ fontSize: '0.82rem', padding: '8px 10px' }}
                      >
                        <option value="">-- None --</option>
                        {uploadResult.columns.map((col) => (
                          <option key={col} value={col}>
                            {col}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 10 }}>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Prefix CC (e.g. 91)"
                      value={countryCode}
                      onChange={(e) => setCountryCode(e.target.value)}
                      style={{ width: 130, fontSize: '0.82rem', padding: '8px 10px' }}
                    />
                    <button className="btn btn-primary btn-sm" style={{ flexGrow: 1 }} onClick={applyMapping}>
                      <CheckCircle size={15} /> Apply & Ingest {uploadResult.totalRows} Contacts
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div>
              <div className="form-group">
                <label className="form-label">
                  Paste Phone Numbers (One per line, optional name: <code>9876543210, Alex</code>):
                </label>
                <textarea
                  className="form-control"
                  rows={8}
                  placeholder={`9876543210, Alex Smith\n919876543211, Maria Garcia\n+14155552671`}
                  value={manualText}
                  onChange={(e) => setManualText(e.target.value)}
                  style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}
                />
              </div>

              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Default Country Code (e.g. 91)"
                  value={manualCC}
                  onChange={(e) => setManualCC(e.target.value)}
                  style={{ width: 140, fontSize: '0.85rem' }}
                />
                <button className="btn btn-primary btn-sm" style={{ flexGrow: 1 }} onClick={handleManualAdd}>
                  <ListPlus size={15} /> Add to Recipient List
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right: Ingested Contacts Table */}
        <div className="card glass-card">
          <div className="card-header">
            <h3>
              Recipient List <span className="badge badge-whatsapp">{contacts.length}</span>
            </h3>
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                className="btn btn-outline btn-xs"
                onClick={removeDuplicates}
                title="Remove duplicate phone numbers"
              >
                <CopyX size={13} /> Deduplicate
              </button>
              <button
                className="btn btn-danger btn-xs"
                onClick={() => {
                  if (confirm('Clear all contacts?')) {
                    setContacts([]);
                    onShowToast('Contact list cleared', 'info');
                  }
                }}
              >
                <Trash2 size={13} /> Clear
              </button>
            </div>
          </div>

          {/* Search */}
          <div style={{ position: 'relative', marginBottom: 12 }}>
            <input
              type="text"
              className="form-control"
              placeholder="Search recipients by phone or name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ paddingLeft: 36, fontSize: '0.85rem' }}
            />
            <Search size={15} style={{ position: 'absolute', left: 12, top: 12, color: 'var(--text-muted)' }} />
          </div>

          {/* Table */}
          <div className="table-responsive" style={{ flexGrow: 1, maxHeight: 340 }}>
            {contacts.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 10px', color: 'var(--text-muted)' }}>
                <Users size={36} style={{ margin: '0 auto 10px', opacity: 0.4 }} />
                <p style={{ fontSize: '0.88rem' }}>No contacts added yet.</p>
                <small>Upload an Excel file or paste numbers on the left.</small>
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th className="col-idx">#</th>
                    <th>Phone</th>
                    <th>Name</th>
                    <th className="hide-on-mobile">Custom Fields</th>
                    <th style={{ textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredContacts.slice(0, 50).map((c, idx) => {
                    const customKeys = Object.keys(c).filter(
                      (k) => !['phone', 'name', 'rawPhone'].includes(k)
                    );
                    return (
                      <tr key={idx}>
                        <td className="col-idx" style={{ color: 'var(--text-dim)', fontSize: '0.75rem' }}>
                          {idx + 1}
                        </td>
                        <td>
                          <strong style={{ fontSize: '0.88rem', letterSpacing: '-0.2px' }}>+{c.phone}</strong>
                          {customKeys.length > 0 && (
                            <div className="show-on-mobile" style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: 2 }}>
                              {customKeys.length} vars ({customKeys.slice(0, 2).join(', ')})
                            </div>
                          )}
                        </td>
                        <td>{c.name || <span className="text-muted" style={{ fontSize: '0.78rem' }}>-</span>}</td>
                        <td className="hide-on-mobile">
                          {customKeys.length > 0 ? (
                            <span className="badge badge-outline" style={{ fontSize: '0.7rem' }}>
                              {customKeys.length} vars ({customKeys.slice(0, 2).join(', ')})
                            </span>
                          ) : (
                            <span className="text-muted" style={{ fontSize: '0.75rem' }}>
                              none
                            </span>
                          )}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <button
                            className="btn btn-outline btn-xs"
                            onClick={() => onEditContact(c)}
                            title="Edit details & custom fields"
                            style={{ padding: '5px 8px' }}
                          >
                            <Edit2 size={12} /> <span className="hide-on-mobile">Edit</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {contacts.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <button
                className="btn btn-primary btn-sm btn-proceed-mobile"
                onClick={onNext}
                style={{ width: '100%', justifyContent: 'center' }}
              >
                Proceed to Message Composer ➔
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
