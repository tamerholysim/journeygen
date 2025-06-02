// client/src/App.js
import React, { useState } from 'react';
import Login from './Login';
import Dashboard from './Dashboard';
import KnowledgeBank from './KnowledgeBank';
import Clients from './Clients';
import ClientDetail from './ClientDetail';
import Journals from './Journals';
import JournalUI from './JournalUI';
import ClientDashboard from './ClientDashboard';

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [role, setRole] = useState(null);               // "admin" or "client"
  const [authHeader, setAuthHeader] = useState(null);   // e.g. "Basic YWRtaW46cGFzcw=="
  const [view, setView] = useState('dashboard');        // admin: 'dashboard'|'knowledge'|'clients'|'clientDetail'|'journals'|'journal'
  const [selectedClientId, setSelectedClientId] = useState(null);
  const [selectedJournalId, setSelectedJournalId] = useState(null);
  const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:3001';

  function handleLoginSuccess({ role, authHeader }) {
    setRole(role);
    setAuthHeader(authHeader);
    setIsLoggedIn(true);
    setView('dashboard');
  }

  if (!isLoggedIn) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  // ── ADMIN ROUTES ───────────────────────────────────────────
  if (role === 'admin') {
    if (view === 'dashboard') {
      return (
        <Dashboard
          onLogout={() => {
            setIsLoggedIn(false);
            setRole(null);
            setAuthHeader(null);
            setView('dashboard');
          }}
          onNavigate={(section) => setView(section)}
        />
      );
    }

    if (view === 'knowledge') {
      return (
        <div>
          <button onClick={() => setView('dashboard')} style={{ margin: '1rem' }}>
            ← Back
          </button>
          <KnowledgeBank apiUrl={apiUrl} authHeader={authHeader} />
        </div>
      );
    }

    if (view === 'clients') {
      return (
        <div>
          <button onClick={() => setView('dashboard')} style={{ margin: '1rem' }}>
            ← Back
          </button>
          <Clients
            apiUrl={apiUrl}
            authHeader={authHeader}
            onViewClient={(id) => {
              setSelectedClientId(id);
              setView('clientDetail');
            }}
          />
        </div>
      );
    }

    if (view === 'clientDetail') {
      return (
        <div>
          <button onClick={() => setView('clients')} style={{ margin: '1rem' }}>
            ← Back to Clients
          </button>
          <ClientDetail
            apiUrl={apiUrl}
            authHeader={authHeader}
            clientId={selectedClientId}
            onBack={() => setView('clients')}
          />
        </div>
      );
    }

    if (view === 'journals') {
      return (
        <div>
          <button onClick={() => setView('dashboard')} style={{ margin: '1rem' }}>
            ← Back
          </button>
          <Journals
            apiUrl={apiUrl}
            authHeader={authHeader}
            onViewJournal={(jid) => {
              setSelectedJournalId(jid);
              setView('journal');
            }}
          />
        </div>
      );
    }

    if (view === 'journal') {
      return (
        <div>
          <button onClick={() => setView('journals')} style={{ margin: '1rem' }}>
            ← Back to Journals
          </button>
          <JournalUI
            journalId={selectedJournalId}
            apiUrl={apiUrl}
            authHeader={authHeader}
          />
        </div>
      );
    }

    return null;
  }

  // ── CLIENT ROUTE ────────────────────────────────────────────
  if (role === 'client') {
    return (
      <ClientDashboard
        apiUrl={apiUrl}
        authHeader={authHeader}
      />
    );
  }

  return null;
}
