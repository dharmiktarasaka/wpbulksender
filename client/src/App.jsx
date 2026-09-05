import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import {
  getSocket,
  reconnectSocket,
  getBackendUrl,
  setBackendUrl,
  apiFetch
} from './services/api';

import Header from './components/Header';
import Sidebar from './components/Sidebar';
import ServerConfigModal from './components/ServerConfigModal';
import ContactEditModal from './components/ContactEditModal';
import CampaignDetailModal from './components/CampaignDetailModal';

import ConnectionTab from './components/tabs/ConnectionTab';
import ContactsTab from './components/tabs/ContactsTab';
import ComposerTab from './components/tabs/ComposerTab';
import SafetyTab from './components/tabs/SafetyTab';
import ConsoleTab from './components/tabs/ConsoleTab';

const tabMeta = {
  'tab-connection': {
    title: 'Step 1: Connect WhatsApp',
    subtitle: 'Pair your WhatsApp account to begin sending campaigns'
  },
  'tab-contacts': {
    title: 'Step 2: Add Recipients & Contacts',
    subtitle: 'Upload an Excel/CSV file or paste your numbers directly'
  },
  'tab-composer': {
    title: 'Step 3: Message & Template Variations',
    subtitle: 'Create 1 or more message variations to rotate automatically'
  },
  'tab-settings': {
    title: 'Step 4: Anti-Ban Pacing & Launch',
    subtitle: 'Configure safety pacing and trigger your campaign'
  },
  'tab-console': {
    title: 'Step 5: Live Dispatch Monitor & History',
    subtitle: 'Watch messages being delivered in real-time with anti-ban pacing'
  }
};

export default function App() {
  const [activeTab, setActiveTab] = useState('tab-connection');

  // Theme State: 'light' (Default) | 'dark'
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('wa_theme') || 'light';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('wa_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  // WhatsApp & Server State
  const [waStatus, setWaStatus] = useState('disconnected');
  const [waQr, setWaQr] = useState(null);
  const [waUser, setWaUser] = useState(null);
  const [serverStatus, setServerStatus] = useState('connecting'); // 'connected' | 'connecting' | 'error' | 'disconnected'
  const [backendUrl, setBackendUrlState] = useState(getBackendUrl());

  // Campaign State
  const [contacts, setContacts] = useState([]);
  const [templateVariations, setTemplateVariations] = useState([
    'Hi {{name}}, {Welcome to our service!|Glad to connect with you!}\n\nFeel free to reach out if you have any questions.'
  ]);
  const [activeVariationIndex, setActiveVariationIndex] = useState(0);
  const [selectedMedia, setSelectedMedia] = useState(null);
  const [settings, setSettings] = useState({
    minDelay: 8,
    maxDelay: 18,
    batchSize: 15,
    batchPause: 45,
    defaultCountryCode: '91'
  });
  const [campaignName, setCampaignName] = useState('');
  const [activeCampaign, setActiveCampaign] = useState(null);
  const [terminalLogs, setTerminalLogs] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [campaignHistory, setCampaignHistory] = useState([]);

  // Modals & Toasts
  const [isServerModalOpen, setIsServerModalOpen] = useState(false);
  const [editingContact, setEditingContact] = useState(null);
  const [viewingCampaign, setViewingCampaign] = useState(null);
  const [toasts, setToasts] = useState([]);

  // Toast Helper
  function showToast(message, type = 'info') {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }

  // Socket Connection Setup
  useEffect(() => {
    const socket = getSocket((status, url) => {
      setServerStatus(status);
      setBackendUrlState(url);
    });

    socket.on('wa:status', (data) => {
      setWaStatus(data.status);
      setWaUser(data.userInfo);
      if (data.qr) setWaQr(data.qr);
    });

    socket.on('wa:qr', (data) => {
      if (data.qr) {
        setWaQr(data.qr);
        setWaStatus('qr_ready');
      }
    });

    socket.on('campaign:status', (data) => {
      setActiveCampaign(data);
    });

    socket.on('campaign:log', (log) => {
      setTerminalLogs((prev) => [...prev, log]);
    });

    socket.on('campaign:finished', (camp) => {
      showToast(`Campaign "${camp?.name || 'Bulk'}" finished!`, 'success');
      confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
      loadHistory();
    });

    // Load initial data
    loadTemplates();
    loadSettings();
    loadHistory();

    return () => {
      socket.off('wa:status');
      socket.off('wa:qr');
      socket.off('campaign:status');
      socket.off('campaign:log');
      socket.off('campaign:finished');
    };
  }, []);

  async function loadTemplates() {
    try {
      const res = await apiFetch('/api/templates');
      if (res.ok) {
        const data = await res.json();
        setTemplates(data || []);
      }
    } catch (e) {}
  }

  async function loadSettings() {
    try {
      const res = await apiFetch('/api/settings');
      if (res.ok) {
        const data = await res.json();
        if (data) setSettings((prev) => ({ ...prev, ...data }));
      }
    } catch (e) {}
  }

  async function loadHistory() {
    try {
      const res = await apiFetch('/api/campaigns');
      if (res.ok) {
        const data = await res.json();
        setCampaignHistory(data || []);
      }
    } catch (e) {}
  }

  async function handleViewCampaignDetails(campaignId) {
    try {
      const res = await apiFetch(`/api/campaigns/${campaignId}`);
      if (res.ok) {
        const data = await res.json();
        setViewingCampaign(data);
      }
    } catch (err) {
      showToast('Failed to load campaign: ' + err.message, 'error');
    }
  }

  function handleSaveServerConfig(newUrl) {
    setBackendUrl(newUrl);
    setBackendUrlState(getBackendUrl());
    showToast(`Backend set to: ${getBackendUrl()}`, 'success');

    reconnectSocket((status, url) => {
      setServerStatus(status);
      setBackendUrlState(url);
    });

    loadTemplates();
    loadSettings();
    loadHistory();
  }

  async function handleRefreshSession() {
    showToast('Refreshing WhatsApp session...', 'info');
    try {
      await apiFetch('/api/whatsapp/init', { method: 'POST' });
    } catch (err) {
      showToast('Refresh failed: ' + err.message, 'error');
    }
  }

  // Start Bulk Campaign
  async function handleStartCampaign() {
    if (!contacts.length) return showToast('Add contacts first!', 'error');
    if (!templateVariations.some((v) => v.trim())) return showToast('Enter message text!', 'error');

    const validName = campaignName.trim() || `Campaign ${new Date().toLocaleDateString()}`;
    const formData = new FormData();
    formData.append('name', validName);
    formData.append('contacts', JSON.stringify(contacts));
    formData.append('templates', JSON.stringify(templateVariations));
    formData.append('settings', JSON.stringify(settings));

    if (selectedMedia) {
      formData.append('mediaFile', selectedMedia);
    }

    showToast('Launching campaign...', 'info');
    setActiveTab('tab-console');

    try {
      const res = await apiFetch('/api/campaign/start', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      showToast(`Campaign "${validName}" launched!`, 'success');
      loadHistory();
    } catch (err) {
      showToast('Failed to start campaign: ' + err.message, 'error');
    }
  }

  const isWaConnected = waStatus === 'open';
  const isCampaignRunning =
    activeCampaign && (activeCampaign.state === 'running' || activeCampaign.state === 'paused');

  return (
    <div className="app-container">
      {/* Left Sidebar */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        waConnected={isWaConnected}
        waStatus={waStatus}
        waUser={waUser}
        contactCount={contacts.length}
        isCampaignRunning={isCampaignRunning}
      />

      {/* Main Content */}
      <main className="main-content">
        <Header
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          tabMeta={tabMeta}
          serverStatus={serverStatus}
          backendUrl={backendUrl}
          waConnected={isWaConnected}
          waUser={waUser}
          theme={theme}
          onToggleTheme={toggleTheme}
          onOpenServerModal={() => setIsServerModalOpen(true)}
          onRefreshSession={handleRefreshSession}
        />

        {/* Tab 1: Connect */}
        {activeTab === 'tab-connection' && (
          <ConnectionTab
            waStatus={waStatus}
            waQr={waQr}
            waUser={waUser}
            waConnected={isWaConnected}
            onShowToast={showToast}
            onNext={() => setActiveTab('tab-contacts')}
          />
        )}

        {/* Tab 2: Contacts */}
        {activeTab === 'tab-contacts' && (
          <ContactsTab
            contacts={contacts}
            setContacts={setContacts}
            defaultCountryCode={settings.defaultCountryCode}
            onShowToast={showToast}
            onEditContact={(c) => setEditingContact(c)}
            onNext={() => setActiveTab('tab-composer')}
          />
        )}

        {/* Tab 3: Composer */}
        {activeTab === 'tab-composer' && (
          <ComposerTab
            templateVariations={templateVariations}
            setTemplateVariations={setTemplateVariations}
            activeVariationIndex={activeVariationIndex}
            setActiveVariationIndex={setActiveVariationIndex}
            selectedMedia={selectedMedia}
            setSelectedMedia={setSelectedMedia}
            contacts={contacts}
            templates={templates}
            loadTemplates={loadTemplates}
            onShowToast={showToast}
            onNext={() => setActiveTab('tab-settings')}
          />
        )}

        {/* Tab 4: Safety */}
        {activeTab === 'tab-settings' && (
          <SafetyTab
            settings={settings}
            setSettings={setSettings}
            campaignName={campaignName}
            setCampaignName={setCampaignName}
            contacts={contacts}
            templateVariations={templateVariations}
            waConnected={isWaConnected}
            isCampaignRunning={isCampaignRunning}
            onStartCampaign={handleStartCampaign}
            onShowToast={showToast}
          />
        )}

        {/* Tab 5: Live Console & History */}
        {activeTab === 'tab-console' && (
          <ConsoleTab
            activeCampaign={activeCampaign}
            terminalLogs={terminalLogs}
            setTerminalLogs={setTerminalLogs}
            campaignHistory={campaignHistory}
            loadHistory={loadHistory}
            onViewCampaignDetails={handleViewCampaignDetails}
            onShowToast={showToast}
          />
        )}
      </main>

      {/* Backend Server Config Modal */}
      <ServerConfigModal
        isOpen={isServerModalOpen}
        onClose={() => setIsServerModalOpen(false)}
        currentUrl={backendUrl}
        onSave={handleSaveServerConfig}
      />

      {/* Contact Details Edit Modal */}
      <ContactEditModal
        isOpen={!!editingContact}
        contact={editingContact}
        onClose={() => setEditingContact(null)}
        onSave={(updated) => {
          setContacts((prev) =>
            prev.map((c) => (c.phone === updated.phone || c.rawPhone === updated.rawPhone ? updated : c))
          );
          showToast(`Updated contact details for +${updated.phone}`, 'success');
        }}
      />

      {/* Campaign Detail Modal */}
      <CampaignDetailModal
        isOpen={!!viewingCampaign}
        campaign={viewingCampaign}
        onClose={() => setViewingCampaign(null)}
      />

      {/* Toast Notifications */}
      <div className="toast-container">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.type}`}>
            <span>{t.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
