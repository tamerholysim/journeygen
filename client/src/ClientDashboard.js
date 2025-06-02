// client/src/ClientDashboard.jsx
import React, { useState, useEffect } from 'react';
import JournalUI from './JournalUI';

export default function ClientDashboard({ apiUrl, authHeader }) {
  const [clientId, setClientId] = useState(null);
  const [journals, setJournals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [viewingJournalId, setViewingJournalId] = useState(null);

  // 1) Read clientId from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('clientId');
    if (!stored) {
      setError('No client ID found. Please log in again.');
      setLoading(false);
      return;
    }
    setClientId(stored);
  }, []);

  // 2) Once we have clientId, fetch that client’s journals
  useEffect(() => {
    if (!clientId) return;
    setLoading(true);
    setError(null);

    fetch(`${apiUrl}/api/journals/client/${clientId}`, {
      headers: {
        Authorization: authHeader
      }
    })
      .then((res) => {
        if (!res.ok) {
          throw new Error(`Status ${res.status}`);
        }
        return res.json();
      })
      .then((data) => {
        setJournals(data);
      })
      .catch((err) => {
        console.error(err);
        setError('Failed to fetch your journals.');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [apiUrl, authHeader, clientId]);

  // 3) If a journal is selected, render JournalUI for it
  if (viewingJournalId) {
    return (
      <div style={{ height: '100vh' }}>
        <button
          onClick={() => setViewingJournalId(null)}
          style={{ margin: '1rem', padding: '0.5rem 1rem' }}
        >
          ← Back to Your Journals
        </button>
        <JournalUI
          journalId={viewingJournalId}
          apiUrl={apiUrl}
          authHeader={authHeader}
        />
      </div>
    );
  }

  // 4) Otherwise show the two-pane layout
  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      {/* Sidebar */}
      <div
        style={{
          width: '260px',
          borderRight: '1px solid #ddd',
          overflowY: 'auto'
        }}
      >
        <h3 style={{ padding: '1rem 0', textAlign: 'center' }}>Your Journals</h3>
        {loading && <p style={{ padding: '0 1rem' }}>Loading...</p>}
        {!loading && journals.length === 0 && (
          <p style={{ padding: '0 1rem', color: '#666' }}>
            No journals assigned.
          </p>
        )}
        {!loading &&
          journals.map((j) => (
            <div
              key={j._id}
              onClick={() => setViewingJournalId(j._id)}
              style={{
                padding: '0.75rem 1rem',
                marginBottom: '0.25rem',
                cursor: 'pointer',
                backgroundColor: '#f9f9f9',
                borderBottom: '1px solid #eee'
              }}
            >
              {j.title}
            </div>
          ))}
      </div>

      {/* Main Pane */}
      <div
        style={{
          flex: 1,
          padding: '2rem',
          overflowY: 'auto'
        }}
      >
        {loading && <p>Loading your journals…</p>}
        {!loading && journals.length === 0 && (
          <p style={{ color: '#666' }}>You haven’t been assigned any journals yet.</p>
        )}
        {!loading && journals.length > 0 && (
          <p style={{ color: '#666' }}>Select a journal from the left to begin.</p>
        )}
        {error && (
          <p style={{ color: 'red', marginTop: '1rem' }}>{error}</p>
        )}
      </div>
    </div>
  );
}
