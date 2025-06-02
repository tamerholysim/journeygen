// client/src/Dashboard.js (admin)
import React from 'react';

/**
 * Props:
 *   onLogout()      → call to log out
 *   onNavigate(sec) → e.g. onNavigate('knowledge') or onNavigate('clients') or onNavigate('journals')
 */
export default function Dashboard({ onLogout, onNavigate }) {
  return (
    <div style={{ maxWidth: 400, margin: '4rem auto', textAlign: 'center' }}>
      <h1>Admin Dashboard</h1>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '2rem' }}>
        <button
          onClick={() => onNavigate('knowledge')}
          style={{ padding: '1rem', fontSize: '1rem' }}
        >
          Knowledge Bank
        </button>
        <button
          onClick={() => onNavigate('clients')}
          style={{ padding: '1rem', fontSize: '1rem' }}
        >
          Clients
        </button>
        <button
          onClick={() => onNavigate('journals')}
          style={{ padding: '1rem', fontSize: '1rem' }}
        >
          Journals
        </button>
        <button
          onClick={onLogout}
          style={{
            padding: '1rem',
            fontSize: '1rem',
            backgroundColor: '#dc3545',
            color: '#fff',
            border: 'none',
            borderRadius: '4px'
          }}
        >
          Log Out
        </button>
      </div>
    </div>
  );
}
