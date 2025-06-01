import React, { useState } from 'react';
import JournalUI from './JournalUI';

export default function CreateJournalUI() {
  const [topic, setTopic] = useState('');
  const [background, setBackground] = useState('');
  const [bookingLink, setBookingLink] = useState('');        // ← NEW
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

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/journals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic:      topic.trim(),
          background: background.trim(),
          bookingLink: bookingLink.trim()             // ← NEW
        })
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Status ${res.status}`);
      }

      const savedJournal = await res.json();
      setNewJournalId(savedJournal._id);
    } catch (err) {
      setError('Failed to create journal: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  // Show the newly‐created journal immediately
  if (newJournalId) {
    return <JournalUI journalId={newJournalId} />;
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
            placeholder="Paste your own background/framework text here… or leave blank to use default."
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

        <button type="submit" disabled={isSubmitting} style={{ padding: '0.75rem' }}>
          {isSubmitting ? 'Generating…' : 'Generate Journal'}
        </button>
        {error && <p style={{ color: 'red' }}>{error}</p>}
      </form>
    </div>
  );
}
