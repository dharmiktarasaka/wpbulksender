import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Save, UserCheck } from 'lucide-react';

export default function ContactEditModal({
  isOpen,
  onClose,
  contact,
  onSave
}) {
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [customFields, setCustomFields] = useState([]);

  useEffect(() => {
    if (contact) {
      setPhone(contact.phone || '');
      setName(contact.name || '');

      const fields = [];
      const standardKeys = ['phone', 'name', 'rawPhone'];
      Object.keys(contact).forEach((k) => {
        if (!standardKeys.includes(k)) {
          fields.push({ key: k, value: contact[k] });
        }
      });
      setCustomFields(fields);
    }
  }, [contact]);

  if (!isOpen || !contact) return null;

  function addField() {
    setCustomFields([...customFields, { key: '', value: '' }]);
  }

  function updateField(idx, field, val) {
    const updated = [...customFields];
    updated[idx][field] = val;
    setCustomFields(updated);
  }

  function removeField(idx) {
    setCustomFields(customFields.filter((_, i) => i !== idx));
  }

  function handleSave() {
    const updatedContact = {
      ...contact,
      phone: phone.trim().replace(/[^0-9]/g, ''),
      name: name.trim()
    };

    // Clean old custom fields
    const standardKeys = ['phone', 'name', 'rawPhone'];
    Object.keys(updatedContact || {}).forEach((k) => {
      if (!standardKeys.includes(k)) {
        delete updatedContact[k];
      }
    });

    // Add new fields
    (customFields || []).forEach(({ key, value }) => {
      if (key && key.trim()) {
        updatedContact[key.trim()] = value;
      }
    });

    onSave(updatedContact);
    onClose();
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content glass-card" style={{ maxWidth: 520 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                background: 'rgba(37, 211, 102, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--wa-green)'
              }}
            >
              <UserCheck size={18} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.15rem' }}>Edit Recipient Details</h3>
              <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Customize phone, name, and template placeholder variables
              </p>
            </div>
          </div>
          <button className="btn-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="modal-body" style={{ padding: '20px 24px' }}>
          <div className="form-group">
            <label className="form-label">Phone Number (with Country Code)</label>
            <input
              type="text"
              className="form-control"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="e.g. 919876543210"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Full Name</label>
            <input
              type="text"
              className="form-control"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. John Doe"
            />
          </div>

          <div style={{ marginTop: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <label className="form-label" style={{ margin: 0 }}>
                Custom Variables & Fields
              </label>
              <button type="button" className="btn btn-outline btn-xs" onClick={addField}>
                <Plus size={14} /> Add Variable
              </button>
            </div>

            {customFields.length === 0 ? (
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                No custom variables attached to this contact. Click "+ Add Variable" to inject values like <code>{`{{company}}`}</code>.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {customFields.map((f, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Variable Name (e.g. company)"
                      value={f.key}
                      onChange={(e) => updateField(i, 'key', e.target.value)}
                      style={{ flex: 1, fontSize: '0.85rem' }}
                    />
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Value"
                      value={f.value}
                      onChange={(e) => updateField(i, 'value', e.target.value)}
                      style={{ flex: 1.5, fontSize: '0.85rem' }}
                    />
                    <button
                      type="button"
                      className="btn btn-danger btn-xs"
                      onClick={() => removeField(i)}
                      title="Remove field"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
          <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn btn-success btn-sm" onClick={handleSave}>
            <Save size={15} /> Save Contact Details
          </button>
        </div>
      </div>
    </div>
  );
}
