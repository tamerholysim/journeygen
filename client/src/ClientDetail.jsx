// client/src/ClientDetail.jsx
import React, { useState, useEffect } from 'react';

export default function ClientDetail({ apiUrl, clientId, onBack }) {
  const [client, setClient] = useState(null);
  const [error, setError] = useState(null);

  // Precompute the Basic Auth header (admin:pass)
  const authHeader = 'Basic ' + btoa('admin:pass');

  useEffect(() => {
    fetch(`${apiUrl}/api/clients/${clientId}`, {
      headers: {
        Authorization: authHeader
      }
    })
      .then(res => {
        if (!res.ok) throw new Error(`Status ${res.status}`);
        return res.json();
      })
      .then(setClient)
      .catch(err => {
        console.error(err);
        setError('Failed to load client.');
      });
  }, [apiUrl, clientId, authHeader]);

  if (error) {
    return (
      <div style={{ padding: '2rem' }}>
        <button onClick={onBack} style={{ marginBottom: '1rem' }}>← Back to Clients</button>
        <p style={{ color: 'red' }}>{error}</p>
      </div>
    );
  }

  if (!client) {
    return (
      <div style={{ padding: '2rem' }}>
        <h3>Loading client…</h3>
      </div>
    );
  }

  return (
    <div style={{ padding: '2rem' }}>
      <button onClick={onBack} style={{ marginBottom: '1rem' }}>← Back to Clients</button>
      <h2>{client.firstName} {client.lastName}</h2>
      <p><strong>Email:</strong> {client.email}</p>
      <p><strong>Gender:</strong> {client.gender}</p>
      <p>
        <strong>Date of Birth:</strong>{' '}
        {client.dateOfBirth
          ? new Date(client.dateOfBirth).toLocaleDateString()
          : '—'}
      </p>
      <p><strong>Background:</strong> {client.background || '—'}</p>
      {client.fileUrl && (
        <p>
          <strong>File:</strong>{' '}
          <a href={client.fileUrl} target="_blank" rel="noopener noreferrer">
            {client.fileUrl}
          </a>
        </p>
      )}

      {/* Placeholder: extend this later */}
      <p style={{ marginTop: '2rem', fontStyle: 'italic', color: '#666' }}>
        [Client-specific dashboard content will go here]
      </p>
    </div>
  );
}
