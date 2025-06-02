// client/src/CreateJournalUI.js
import React, { useState } from 'react';
import JournalUI from './JournalUI';

export default function CreateJournalUI({ apiUrl, authHeader, onCreated }) {
  // For now, just hard-code the server URL:
  // (you could also pass apiUrl down from App.js instead of process.env)
  const SERVER_URL = 'http://localhost:3001';

  const [topic, setTopic] = useState('');
  const [background, setBackground] = useState('');
  const [bookingLink, setBookingLink] = useState('');
  const [clientId, setClientId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [newJournalId, setNewJournalId] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);

    if (!topic.trim()) {
      setError('Topic is required.');
      return;
    }
    if (!clientId.trim()) {
      setError('Client ID is required.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(`${SERVER_URL}/api/journals`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: authHeader
        },
        body: JSON.stringify({
          topic:       topic.trim(),
          background:  background.trim(),
          bookingLink: bookingLink.trim(),
          clientId:    clientId.trim()
        })
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Status ${res.status}`);
      }
      const savedJournal = await res.json();
      setNewJournalId(savedJournal._id);

      // Replace “onCreated?.()” with:
      if (onCreated) {
        onCreated();
      }
    } catch (err) {
      console.error(err);
      setError('Failed to create journal: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  // If the journal has just been created, show it immediately:
  if (newJournalId) {
    return (
      <JournalUI
        journalId={newJournalId}
        apiUrl={SERVER_URL}
        authHeader={authHeader}
      />
    );
  }

  return (
    <div style={{ maxWidth: 600, margin: '2rem auto', padding: '0 1rem' }}>
      <h2>Create a New Guided Journal</h2>
      <form
        onSubmit={handleSubmit}
        style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}
      >
        <label>
          <strong>Journal Topic</strong><br />
          <input
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="e.g. How to Overcome Procrastination"
            style={{ width: '100%', padding: '0.5rem' }}
          />
        </label>

        <label>
          <strong>Background / Framework</strong><br />
          <textarea
            value={background}
            onChange={(e) => setBackground(e.target.value)}
            placeholder="Paste your own background text here… or leave blank to use default."
            rows={6}
            style={{ width: '100%', padding: '0.5rem', fontFamily: 'monospace' }}
          />
        </label>

        <label>
          <strong>Booking Link</strong><br />
          <input
            type="text"
            value={bookingLink}
            onChange={(e) => setBookingLink(e.target.value)}
            placeholder="https://coach.example.com/booking/your‐name"
            style={{ width: '100%', padding: '0.5rem' }}
          />
        </label>

        <label>
          <strong>Client ID</strong><br />
          <input
            type="text"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            placeholder="Paste the client’s ObjectId here"
            style={{ width: '100%', padding: '0.5rem' }}
          />
        </label>

        <button
          type="submit"
          disabled={isSubmitting}
          style={{
            padding: '0.75rem',
            backgroundColor: isSubmitting ? '#999' : '#007bff',
            color: '#fff',
            border: 'none',
            borderRadius: 4,
            cursor: isSubmitting ? 'default' : 'pointer'
          }}
        >
          {isSubmitting ? 'Generating…' : 'Generate Journal'}
        </button>
        {error && <p style={{ color: 'red' }}>{error}</p>}
      </form>
    </div>
  );
}
