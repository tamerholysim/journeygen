// client/src/JournalUI.js
import React, { useState, useEffect } from 'react';

export default function JournalUI({ journalId }) {
  const [journal, setJournal] = useState(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  // responses[sectionIndex][promptIndex] = user’s typed text
  const [responses, setResponses] = useState([]);

  useEffect(() => {
    // Fetch the journal from backend
    const apiUrl = process.env.REACT_APP_API_URL || '';
    fetch(`${apiUrl}/api/journals/${journalId}`)
      .then((res) => {
        if (!res.ok) throw new Error('Network response was not OK');
        return res.json();
      })
      .then((data) => {
        setJournal(data);
        // Initialize responses as an array of arrays of empty strings
        const initial = data.tableOfContents.map((section) =>
          section.prompts.map(() => '')
        );
        setResponses(initial);
      })
      .catch((err) => {
        console.error(err);
        setJournal({ error: 'Failed to load journal.' });
      });
  }, [journalId]);

  const handlePromptChange = (sectionIdx, promptIdx, text) => {
    setResponses((prev) => {
      const copy = prev.map((arr) => [...arr]);
      copy[sectionIdx][promptIdx] = text;
      return copy;
    });
  };

  const handleSubmit = () => {
    // For now, just log responses. Later you can POST these to the server.
    console.log('User Responses:', responses);
    alert('Responses logged to console. (Add submit logic later.)');
  };

  if (!journal) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <h3>Loading journal...</h3>
      </div>
    );
  }

  if (journal.error) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: 'red' }}>
        <h3>Error: {journal.error}</h3>
      </div>
    );
  }

  const section = journal.tableOfContents[currentIndex];
  const isLast = currentIndex === journal.tableOfContents.length - 1;

  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      {/* Sidebar */}
      <div
        style={{
          width: '260px',
          borderRight: '1px solid #ddd',
          padding: '1rem',
          overflowY: 'auto',
        }}
      >
        <h3 style={{ marginTop: 0 }}>Contents</h3>
        {journal.tableOfContents.map((sec, idx) => (
          <div
            key={idx}
            onClick={() => setCurrentIndex(idx)}
            style={{
              padding: '0.5rem',
              marginBottom: '0.25rem',
              cursor: 'pointer',
              backgroundColor: idx === currentIndex ? '#f0f8ff' : 'transparent',
              borderRadius: '4px',
            }}
          >
            {sec.title}
          </div>
        ))}
      </div>

      {/* Section Detail */}
      <div
        style={{
          flex: 1,
          padding: '2rem',
          overflowY: 'auto',
        }}
      >
        <h2>{section.title}</h2>
        <div style={{ marginBottom: '1.5rem' }}>
          {section.content.split('\n').map((para, i) => (
            <p key={i} style={{ lineHeight: 1.6 }}>
              {para.trim()}
            </p>
          ))}
        </div>

        {section.prompts.map((pObj, pIdx) => (
          <div key={pIdx} style={{ marginBottom: '1.25rem' }}>
            <label
              style={{
                fontWeight: '500',
                display: 'block',
                marginBottom: '0.5rem',
              }}
            >
              {pObj.text}
            </label>
            <textarea
              style={{
                width: '100%',
                minHeight: '60px',
                padding: '0.5rem',
                borderRadius: '4px',
                border: '1px solid #ccc',
                fontSize: '1rem',
              }}
              value={responses[currentIndex][pIdx] || ''}
              onChange={(e) =>
                handlePromptChange(currentIndex, pIdx, e.target.value)
              }
            />
          </div>
        ))}

        <div style={{ marginTop: '2rem' }}>
          {!isLast ? (
            <button
              onClick={() => setCurrentIndex((ci) => ci + 1)}
              style={{
                padding: '0.75rem 1.5rem',
                backgroundColor: '#007bff',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '1rem',
              }}
            >
              Next
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              style={{
                padding: '0.75rem 1.5rem',
                backgroundColor: '#28a745',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '1rem',
              }}
            >
              Submit
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
