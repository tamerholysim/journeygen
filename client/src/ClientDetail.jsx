// client/src/ClientDetail.jsx
import React, { useState, useEffect } from 'react';

export default function ClientDetail({ apiUrl, clientId, onBack, authHeader }) {
  const [client, setClient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // For editing general info:
  const [editFirstName, setEditFirstName] = useState('');
  const [editLastName, setEditLastName] = useState('');
  const [editGender, setEditGender] = useState('Other');
  const [editDOB, setEditDOB] = useState('');
  const [editBackground, setEditBackground] = useState('');
  const [savingInfo, setSavingInfo] = useState(false);
  const [saveInfoError, setSaveInfoError] = useState(null);

  // For adding a new admin note:
  const [newNote, setNewNote] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [saveNoteError, setSaveNoteError] = useState(null);

  // Fetch client (including profileEntries) on mount:
  useEffect(() => {
    setLoading(true);
    setError(null);

    fetch(`${apiUrl}/api/clients/${clientId}`, {
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
        setClient(data);
        // Initialize edit state from fetched data:
        setEditFirstName(data.firstName);
        setEditLastName(data.lastName);
        setEditGender(data.gender || 'Other');
        setEditDOB(data.dateOfBirth ? data.dateOfBirth.split('T')[0] : '');
        setEditBackground(data.background || '');
      })
      .catch((err) => {
        console.error(err);
        setError('Failed to load client.');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [apiUrl, clientId, authHeader]);

  // Handle “Save Info” button:
  const handleSaveInfo = async () => {
    setSaveInfoError(null);

    // Basic validation:
    if (!editFirstName.trim() || !editLastName.trim()) {
      setSaveInfoError('First and last name are required.');
      return;
    }

    setSavingInfo(true);
    try {
      const res = await fetch(`${apiUrl}/api/clients/${clientId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: authHeader
        },
        body: JSON.stringify({
          firstName: editFirstName.trim(),
          lastName: editLastName.trim(),
          gender: editGender,
          dateOfBirth: editDOB || null,
          background: editBackground.trim()
        })
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Status ${res.status}`);
      }
      const updated = await res.json();
      setClient(updated);
      setSaveInfoError(null);
    } catch (err) {
      console.error(err);
      setSaveInfoError('Failed to save client info: ' + err.message);
    } finally {
      setSavingInfo(false);
    }
  };

  // Handle “Add Note” button:
  const handleAddNote = async () => {
    if (!newNote.trim()) {
      setSaveNoteError('Note cannot be empty.');
      return;
    }
    setSavingNote(true);
    setSaveNoteError(null);

    try {
      const res = await fetch(`${apiUrl}/api/clients/${clientId}/note`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: authHeader
        },
        body: JSON.stringify({ noteText: newNote.trim() })
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Status ${res.status}`);
      }
      const resp = await res.json();
      // resp.profileEntries contains the updated array
      setClient((prev) => ({
        ...prev,
        profileEntries: resp.profileEntries
      }));
      setNewNote('');
    } catch (err) {
      console.error(err);
      setSaveNoteError('Failed to save note: ' + err.message);
    } finally {
      setSavingNote(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <h3>Loading client…</h3>
      </div>
    );
  }
  if (error) {
    return (
      <div style={{ padding: '2rem' }}>
        <button onClick={onBack} style={{ marginBottom: '1rem' }}>← Back</button>
        <p style={{ color: 'red' }}>{error}</p>
      </div>
    );
  }
  if (!client) {
    return null; // should never happen
  }

  return (
    <div style={{ padding: '2rem', maxWidth: 800, margin: 'auto' }}>
      <button onClick={onBack} style={{ marginBottom: '1rem' }}>← Back</button>
      <h2>
        {client.firstName} {client.lastName} ({client.email})
      </h2>

      {/* ─────── Edit General Info ─────────────────────────────────────────── */}
      <section style={{ marginBottom: '2rem' }}>
        <h3>General Info</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <label>
            First Name<br />
            <input
              type="text"
              value={editFirstName}
              onChange={(e) => setEditFirstName(e.target.value)}
              style={{ width: '100%', padding: '0.5rem' }}
            />
          </label>
          <label>
            Last Name<br />
            <input
              type="text"
              value={editLastName}
              onChange={(e) => setEditLastName(e.target.value)}
              style={{ width: '100%', padding: '0.5rem' }}
            />
          </label>
          <label>
            Gender<br />
            <select
              value={editGender}
              onChange={(e) => setEditGender(e.target.value)}
              style={{ width: '100%', padding: '0.5rem' }}
            >
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Other">Other</option>
            </select>
          </label>
          <label>
            Date of Birth<br />
            <input
              type="date"
              value={editDOB}
              onChange={(e) => setEditDOB(e.target.value)}
              style={{ width: '100%', padding: '0.5rem' }}
            />
          </label>
          <label>
            Background / Notes<br />
            <textarea
              rows={3}
              value={editBackground}
              onChange={(e) => setEditBackground(e.target.value)}
              style={{ width: '100%', padding: '0.5rem' }}
            />
          </label>

          <button
            onClick={handleSaveInfo}
            disabled={savingInfo}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: savingInfo ? '#999' : '#007bff',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: savingInfo ? 'default' : 'pointer',
              width: '200px'
            }}
          >
            {savingInfo ? 'Saving…' : 'Save Changes'}
          </button>
          {saveInfoError && <p style={{ color: 'red' }}>{saveInfoError}</p>}
        </div>
      </section>

      {/* ─────── Add Admin Note ─────────────────────────────────────────────── */}
      <section style={{ marginBottom: '2rem' }}>
        <h3>Add a Note</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <textarea
            rows={4}
            placeholder="Type your note here…"
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            style={{ width: '100%', padding: '0.5rem', fontFamily: 'monospace' }}
          />
          <button
            onClick={handleAddNote}
            disabled={savingNote}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: savingNote ? '#999' : '#28a745',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: savingNote ? 'default' : 'pointer',
              width: '200px'
            }}
          >
            {savingNote ? 'Saving Note…' : 'Save Note'}
          </button>
          {saveNoteError && <p style={{ color: 'red' }}>{saveNoteError}</p>}
        </div>
      </section>

      {/* ─────── Client Profile History ─────────────────────────────────────── */}
      <section>
        <h3>Profile History</h3>
        {(!client.profileEntries || client.profileEntries.length === 0) ? (
          <p><em>No profile entries yet.</em></p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {client.profileEntries.map((entry, idx) => (
              <li
                key={idx}
                style={{
                  marginBottom: '1rem',
                  padding: '0.75rem',
                  border: '1px solid #eee',
                  borderRadius: '4px',
                  backgroundColor: '#fafafa'
                }}
              >
                <small style={{ color: '#666' }}>
                  [{new Date(entry.timestamp).toLocaleString()}] ({entry.type})
                </small>
                <p style={{ marginTop: '0.5rem', lineHeight: 1.4 }}>
                  {entry.content}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
