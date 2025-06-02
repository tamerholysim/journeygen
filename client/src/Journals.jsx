// client/src/Journals.jsx
import React, { useState, useEffect } from 'react';
import CreateJournalUI from './CreateJournalUI';

export default function Journals({ apiUrl, authHeader, onViewJournal }) {
  const [journals, setJournals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    async function fetchJournals() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${apiUrl}/api/journals`, {
          headers: { Authorization: authHeader }
        });
        if (!res.ok) throw new Error(`Status ${res.status}`);
        const data = await res.json();
        setJournals(data);
      } catch (err) {
        console.error(err);
        setError('Failed to load journals.');
      } finally {
        setLoading(false);
      }
    }
    fetchJournals();
  }, [apiUrl, authHeader]);

  if (showCreate) {
    return (
      <CreateJournalUI
        apiUrl={apiUrl}
        authHeader={authHeader}
        onCreated={() => setShowCreate(false)}
      />
    );
  }

  return (
    <div style={{ padding: '2rem' }}>
      <h2>Journals</h2>
      <button
        onClick={() => setShowCreate(true)}
        style={{
          marginBottom: '1rem',
          padding: '.5rem 1rem',
          background: '#007bff',
          color: '#fff',
          borderRadius: 4,
          border: 'none'
        }}
      >
        Create New Journal
      </button>

      {loading && <p>Loading journals…</p>}
      {error && <p style={{ color: 'red' }}>{error}</p>}

      {!loading && !error && (
        <ul>
          {journals.map((j) => (
            <li key={j._id} style={{ marginBottom: '1rem' }}>
              <strong>{j.title}</strong> <em>– client ID {j.clientId}</em>
              &nbsp;–&nbsp;
              <button
                onClick={() => onViewJournal(j._id)}
                style={{
                  background: 'none',
                  color: '#007bff',
                  textDecoration: 'underline',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer'
                }}
              >
                Open
              </button>
            </li>
          ))}
          {journals.length === 0 && <p>No journals yet.</p>}
        </ul>
      )}
    </div>
  );
}
