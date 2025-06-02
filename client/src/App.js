// client/src/App.js

import React, { useState } from 'react';
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useNavigate,
  useLocation,
} from 'react-router-dom';

import Login from './Login';
import Dashboard from './Dashboard';
import KnowledgeBank from './KnowledgeBank';
import Clients from './Clients';
import ClientDetail from './ClientDetail';
import Journals from './Journals';
import JournalUI from './JournalUI';
import ClientDashboard from './ClientDashboard';
import SetPassword from './SetPassword';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* 1) “Set Password” screen: extracts ?token= from URL */}
        <Route path="/set-password" element={<SetPassword />} />

        {/* 2) All other routes (login/admin/client) */}
        <Route path="/*" element={<MainApp />} />
      </Routes>
    </BrowserRouter>
  );
}

/**
 * MainApp contains your existing “login → admin/client routes” logic,
 * but now lives inside a <Route path="/*">.
 */
function MainApp() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [role, setRole] = useState(null);             // "admin" or "client"
  const [authHeader, setAuthHeader] = useState(null); // used by admin‐only endpoints
  const [view, setView] = useState('dashboard');      // admin: 'dashboard'|'knowledge'|'clients'|'clientDetail'|'journals'|'journal'
  const [selectedClientId, setSelectedClientId] = useState(null);
  const [selectedJournalId, setSelectedJournalId] = useState(null);
  const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:3001';

  function handleLoginSuccess({ role, authHeader }) {
    setRole(role);
    setAuthHeader(authHeader);
    setIsLoggedIn(true);
    setView('dashboard');
  }

  // If not logged in, show <Login> regardless of the path (except /set-password)
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
    return <ClientDashboard apiUrl={apiUrl} />;
  }

  return null;
}
