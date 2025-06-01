// client/src/JournalUI.js
import React, { useState, useEffect } from 'react';

export default function JournalUI({ journalId }) {
  const [journal, setJournal] = useState(null);
  // We’ll call currentIndex = 0 “Overview”; indices 1..N correspond to tableOfContents[0..N-1]
  const [currentIndex, setCurrentIndex] = useState(0);
  // responses[sectionIndex][promptIndex] will now be 0-based for actual sections only.
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
        // Initialize responses only for actual sections (tableOfContents)
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

  // totalItems = 1 (Overview) + journal.tableOfContents.length
  const totalItems = 1 + journal.tableOfContents.length;
  const isOverview = currentIndex === 0;
  const isLast = currentIndex === totalItems - 1; // last index = final section/closing

  // If not overview, map back to journal sections:
  const section =
    !isOverview && journal.tableOfContents[currentIndex - 1];

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
        {/* Overview entry */}
        <div
          onClick={() => setCurrentIndex(0)}
          style={{
            padding: '0.5rem',
            marginBottom: '0.25rem',
            cursor: 'pointer',
            backgroundColor: isOverview ? '#f0f8ff' : 'transparent',
            borderRadius: '4px',
            fontWeight: 'bold',
          }}
        >
          Overview
        </div>
        {/* Each section in the journal */}
        {journal.tableOfContents.map((sec, idx) => {
          const sidebarIndex = idx + 1; // because Overview = 0
          return (
            <div
              key={idx}
              onClick={() => setCurrentIndex(sidebarIndex)}
              style={{
                padding: '0.5rem',
                marginBottom: '0.25rem',
                cursor: 'pointer',
                backgroundColor:
                  currentIndex === sidebarIndex ? '#f0f8ff' : 'transparent',
                borderRadius: '4px',
              }}
            >
              {sec.title}
            </div>
          );
        })}
      </div>

      {/* Main Pane */}
      <div
        style={{
          flex: 1,
          padding: '2rem',
          overflowY: 'auto',
        }}
      >
        {isOverview ? (
          // Overview: show journal title + description
          <>
            <h1 style={{ marginBottom: '0.5rem' }}>{journal.title}</h1>
            <div style={{ marginBottom: '2rem', lineHeight: 1.6 }}>
              {journal.description.split('\n').map((para, i) => (
                <p key={i}>{para.trim()}</p>
              ))}
            </div>
            {/* Next button jumps to first section */}
            <button
              onClick={() => setCurrentIndex(1)}
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
              Start Journal
            </button>
          </>
        ) : (
          // A real section (currentIndex >= 1)
          <>
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
                  value={
                    responses[currentIndex - 1]?.[pIdx] || ''
                  }
                  onChange={(e) =>
                    handlePromptChange(currentIndex - 1, pIdx, e.target.value)
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
          </>
        )}
      </div>
    </div>
  );
}
