import React, { useState, useEffect } from 'react';
import {
  PenTool,
  Plus,
  Trash2,
  Bookmark,
  Sparkles,
  Paperclip,
  X,
  Shuffle,
  Smile,
  CheckCheck,
  Send,
  Smartphone
} from 'lucide-react';
import { apiFetch } from '../../services/api';

export default function ComposerTab({
  templateVariations,
  setTemplateVariations,
  activeVariationIndex,
  setActiveVariationIndex,
  selectedMedia,
  setSelectedMedia,
  contacts,
  templates,
  loadTemplates,
  onShowToast,
  onNext
}) {
  const [activeText, setActiveText] = useState(templateVariations[0] || '');
  const [previewMediaUrl, setPreviewMediaUrl] = useState(null);
  const [simulatedVariantIndex, setSimulatedVariantIndex] = useState(0);

  // Sync variations with activeText
  useEffect(() => {
    setActiveText(templateVariations[activeVariationIndex] || '');
    setSimulatedVariantIndex(activeVariationIndex);
  }, [activeVariationIndex, templateVariations]);

  function handleTextChange(newVal) {
    setActiveText(newVal);
    const updated = [...templateVariations];
    updated[activeVariationIndex] = newVal;
    setTemplateVariations(updated);
  }

  function addVariation() {
    const newIdx = templateVariations.length;
    const newVariations = [
      ...templateVariations,
      `Hi {{name}}, {Thanks for reaching out!|Hope you are having a wonderful day!}\n\nLet us know if you need any assistance.`
    ];
    setTemplateVariations(newVariations);
    setActiveVariationIndex(newIdx);
    onShowToast(`Created Message Variant #${newIdx + 1}`, 'success');
  }

  function deleteVariation() {
    if (templateVariations.length <= 1) {
      return onShowToast('You must have at least one message variation', 'error');
    }
    const updated = templateVariations.filter((_, i) => i !== activeVariationIndex);
    setTemplateVariations(updated);
    setActiveVariationIndex(Math.max(0, activeVariationIndex - 1));
    onShowToast('Deleted message variation', 'info');
  }

  function insertTag(tag) {
    const textarea = document.getElementById('composerTextarea');
    if (!textarea) {
      handleTextChange(activeText + tag);
      return;
    }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = activeText;
    const before = text.substring(0, start);
    const after = text.substring(end, text.length);
    const updated = before + tag + after;
    handleTextChange(updated);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + tag.length, start + tag.length);
    }, 50);
  }

  // Handle Media Attachment
  function handleMediaSelect(e) {
    if (e.target.files && e.target.files.length) {
      const file = e.target.files[0];
      setSelectedMedia(file);

      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (ev) => {
          setPreviewMediaUrl(ev.target.result);
        };
        reader.readAsDataURL(file);
      } else {
        setPreviewMediaUrl(null);
      }
      onShowToast(`Attached: ${file.name}`, 'info');
    }
  }

  function clearMedia() {
    setSelectedMedia(null);
    setPreviewMediaUrl(null);
    onShowToast('Media attachment removed', 'info');
  }

  // Save template
  async function handleSaveTemplate() {
    if (!activeText.trim()) return onShowToast('Message is empty!', 'error');
    const name = prompt('Enter a name for this template:');
    if (!name) return;

    try {
      const res = await apiFetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, content: activeText })
      });
      const data = await res.json();
      if (data.success) {
        onShowToast('Template saved!', 'success');
        loadTemplates();
      }
    } catch (err) {
      onShowToast('Error saving: ' + err.message, 'error');
    }
  }

  // Load selected template
  function handleSelectTemplate(tplId) {
    if (!tplId) return;
    const tpl = templates.find((t) => t.id === tplId);
    if (tpl) {
      handleTextChange(tpl.content);
      onShowToast(`Loaded "${tpl.name}" into Variant #${activeVariationIndex + 1}`, 'info');
    }
  }

  // Delete selected template
  async function handleDeleteTemplate(tplId) {
    if (!tplId) return onShowToast('Select a template first', 'error');
    if (confirm('Delete this template?')) {
      try {
        await apiFetch(`/api/templates/${tplId}`, { method: 'DELETE' });
        onShowToast('Template deleted', 'info');
        loadTemplates();
      } catch (err) {
        onShowToast('Error deleting: ' + err.message, 'error');
      }
    }
  }

  // Parse Spintax helper for live mockup
  function renderMockupText() {
    const rawTemplate = templateVariations[simulatedVariantIndex] || activeText || '';
    const sampleContact = contacts.length > 0 ? contacts[0] : { name: 'John Doe', phone: '919876543210' };

    // 1. Spintax: {A|B|C} -> Pick one
    let parsed = rawTemplate.replace(/\{([^{}]+)\}/g, (match, choices) => {
      const options = choices.split('|');
      return options[Math.floor(Math.random() * options.length)];
    });

    // 2. Replace {{key}}
    parsed = parsed.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
      const cleanKey = key.trim();
      return sampleContact[cleanKey] !== undefined ? sampleContact[cleanKey] : `[${cleanKey}]`;
    });

    return parsed;
  }

  // Extract all custom variables from contacts
  const customTags = new Set(['name', 'phone']);
  (contacts || []).forEach((c) => {
    if (c && typeof c === 'object') {
      Object.keys(c).forEach((k) => {
        if (!['rawPhone'].includes(k)) {
          customTags.add(k);
        }
      });
    }
  });

  return (
    <section className="tab-panel active">
      <div className="grid-2-col">
        {/* Left: Multi-Variation Composer */}
        <div className="card glass-card">
          <div className="card-header">
            <h3>
              <PenTool size={20} color="var(--wa-green)" /> Message Variations
            </h3>
            <span className="badge badge-safe">
              <Sparkles size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} />
              Anti-Ban Rotation
            </span>
          </div>

          {/* Variant Tabs */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
            {templateVariations.map((_, idx) => (
              <button
                key={idx}
                className={`btn btn-xs ${activeVariationIndex === idx ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setActiveVariationIndex(idx)}
              >
                Variant #{idx + 1}
              </button>
            ))}
            <button className="btn btn-outline btn-xs" onClick={addVariation} title="Add template variation">
              <Plus size={13} /> Add Variant
            </button>
            {templateVariations.length > 1 && (
              <button
                className="btn btn-danger btn-xs"
                onClick={deleteVariation}
                title="Delete current variant"
                style={{ marginLeft: 'auto' }}
              >
                <Trash2 size={13} /> Delete Variant
              </button>
            )}
          </div>

          {/* Saved Templates Selector */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <select
              className="form-control"
              style={{ fontSize: '0.82rem', padding: '6px 10px' }}
              onChange={(e) => handleSelectTemplate(e.target.value)}
              defaultValue=""
            >
              <option value="">-- Load Saved Template --</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            <button className="btn btn-outline btn-xs" onClick={handleSaveTemplate} title="Save current as template">
              <Bookmark size={14} /> Save
            </button>
          </div>

          {/* Dynamic Variable Chips */}
          <div style={{ marginBottom: 10 }}>
            <label className="form-label" style={{ fontSize: '0.78rem', marginBottom: 4 }}>
              Click to Insert Variable Tag:
            </label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {Array.from(customTags).map((tag) => (
                <button
                  key={tag}
                  type="button"
                  className="btn btn-outline btn-xs"
                  style={{ fontSize: '0.75rem', padding: '3px 8px', borderRadius: 14 }}
                  onClick={() => insertTag(`{{${tag}}}`)}
                >
                  {`{{${tag}}}`}
                </button>
              ))}
              <button
                type="button"
                className="btn btn-outline btn-xs"
                style={{
                  fontSize: '0.75rem',
                  padding: '3px 8px',
                  borderRadius: 14,
                  borderColor: 'rgba(59, 130, 246, 0.4)',
                  color: 'var(--accent-blue)'
                }}
                onClick={() => insertTag('{Hello|Hi|Greetings}')}
              >
                <Sparkles size={11} /> Spintax: {'{Hi|Hello}'}
              </button>
            </div>
          </div>

          {/* Textarea */}
          <div className="form-group" style={{ marginBottom: 12 }}>
            <textarea
              id="composerTextarea"
              className="form-control"
              rows={8}
              value={activeText}
              onChange={(e) => handleTextChange(e.target.value)}
              placeholder="Write your WhatsApp message template here..."
              style={{ fontSize: '0.9rem' }}
            />
          </div>

          {/* Media File Attachment */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <input
                type="file"
                id="mediaUploadInput"
                style={{ display: 'none' }}
                onChange={handleMediaSelect}
              />
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => document.getElementById('mediaUploadInput')?.click()}
              >
                <Paperclip size={14} /> {selectedMedia ? 'Change Attachment' : 'Attach Image/Document'}
              </button>
            </div>

            {selectedMedia && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="badge badge-safe" style={{ fontSize: '0.75rem' }}>
                  {selectedMedia.name}
                </span>
                <button
                  type="button"
                  className="btn btn-danger btn-xs"
                  onClick={clearMedia}
                  title="Remove attachment"
                >
                  <X size={12} />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right: Interactive WhatsApp Chat Simulator */}
        <div className="card glass-card">
          <div className="card-header">
            <h3>
              <Smartphone size={20} color="var(--accent-blue)" /> Live WhatsApp Simulator
            </h3>
            <button
              className="btn btn-outline btn-xs"
              onClick={() => {
                const nextIdx = Math.floor(Math.random() * templateVariations.length);
                setSimulatedVariantIndex(nextIdx);
                onShowToast(`Simulated Variant #${nextIdx + 1} with randomized spintax!`, 'info');
              }}
              title="Test random variant & spintax rotation"
            >
              <Shuffle size={13} /> Test Rotation
            </button>
          </div>

          {/* WhatsApp Phone Mockup Container */}
          <div className="whatsapp-chat-preview">
            <div className="chat-header">
              <div className="chat-avatar">
                {contacts.length > 0 && contacts[0].name ? contacts[0].name[0].toUpperCase() : 'J'}
              </div>
              <div className="chat-title">
                <span className="chat-name">
                  {contacts.length > 0
                    ? contacts[0].name || `+${contacts[0].phone}`
                    : 'John Doe (+91 98765 43210)'}
                </span>
                <span className="chat-status">online • Variant #{simulatedVariantIndex + 1}</span>
              </div>
            </div>

            <div className="chat-body">
              <div className="message-bubble">
                {previewMediaUrl && (
                  <img src={previewMediaUrl} alt="Attached Preview" style={{ maxHeight: 180, objectFit: 'cover' }} />
                )}
                <div className="message-text">
                  {renderMockupText() || (
                    <span style={{ fontStyle: 'italic', opacity: 0.6 }}>
                      Start typing in the composer to preview message...
                    </span>
                  )}
                </div>
                <div className="message-meta">
                  <span>12:00 PM</span>
                  <CheckCheck size={14} color="#53bdeb" />
                </div>
              </div>
            </div>

            <div className="chat-footer">
              <Smile size={20} />
              <div className="chat-mock-input">
                Type a message
              </div>
              <Send size={18} />
            </div>
          </div>

          <div style={{ marginTop: 14, display: 'flex', justifyContent: 'flex-end' }}>
            <button className="btn btn-primary btn-sm" onClick={onNext}>
              Proceed to Anti-Ban Safety ➔
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
