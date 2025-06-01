// client/src/JournalUI.js
import React, { useState, useEffect } from 'react';

export default function JournalUI({ journalId }) {
  const [journal, setJournal] = useState(null);
  // currentIndex = 0 → Overview; 1..N → sections; N+1 → Report
  const [currentIndex, setCurrentIndex] = useState(0);

  // responses[sectionIdx][promptIdx]
  const [responses, setResponses] = useState([]);

  // Report state
  const [report, setReport] = useState(null);
  const [loadingReport, setLoadingReport] = useState(false);
  const [reportError, setReportError] = useState(null);

  // Fetch journal on mount
  useEffect(() => {
    const apiUrl = process.env.REACT_APP_API_URL || '';
    fetch(`${apiUrl}/api/journals/${journalId}`)
      .then((res) => {
        if (!res.ok) throw new Error('Network response was not OK');
        return res.json();
      })
      .then((data) => {
        setJournal(data);
        // Initialize one subarray per section
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

  const handlePromptChange = (secIdx, promptIdx, text) => {
    setResponses((prev) => {
      const copy = prev.map((arr) => [...arr]);
      copy[secIdx][promptIdx] = text;
      return copy;
    });
  };

  const handleSubmit = () => {
    if (!journal) return;

    setLoadingReport(true);
    setReportError(null);

    const apiUrl = process.env.REACT_APP_API_URL || '';
    fetch(`${apiUrl}/api/journals/${journalId}/report`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ responses })
    })
      .then((res) => {
        if (!res.ok) {
          return res.json().then((body) => {
            throw new Error(body.error || 'Unknown error');
          });
        }
        return res.json();
      })
      .then((data) => {
        setReport(data.report);
        // Jump to Report pane, index = 1 + number of sections
        setCurrentIndex(1 + journal.tableOfContents.length);
      })
      .catch((err) => {
        console.error(err);
        setReportError(err.message);
      })
      .finally(() => {
        setLoadingReport(false);
      });
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

  const numSections = journal.tableOfContents.length;
  const isOverview = currentIndex === 0;
  const isReport = report && currentIndex === numSections + 1;
  const sectionIndex = !isOverview && !isReport ? currentIndex - 1 : null;

  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      {/* Sidebar */}
      <div
        style={{
          width: '260px',
          borderRight: '1px solid #ddd',
          padding: '1rem',
          overflowY: 'auto'
        }}
      >
        <h3 style={{ marginTop: 0 }}>Contents</h3>

        {/* Overview */}
        <div
          onClick={() => setCurrentIndex(0)}
          style={{
            padding: '0.5rem',
            marginBottom: '0.25rem',
            cursor: 'pointer',
            backgroundColor: currentIndex === 0 ? '#f0f8ff' : 'transparent',
            borderRadius: '4px'
          }}
        >
          Overview
        </div>

        {/* Sections */}
        {journal.tableOfContents.map((sec, idx) => (
          <div
            key={idx}
            onClick={() => setCurrentIndex(idx + 1)}
            style={{
              padding: '0.5rem',
              marginBottom: '0.25rem',
              cursor: 'pointer',
              backgroundColor: currentIndex === idx + 1 ? '#f0f8ff' : 'transparent',
              borderRadius: '4px'
            }}
          >
            {sec.title}
          </div>
        ))}

        {/* Report (if generated) */}
        {report && (
          <div
            onClick={() => setCurrentIndex(numSections + 1)}
            style={{
              padding: '0.5rem',
              marginTop: '1rem',
              borderTop: '1px solid #ccc',
              cursor: 'pointer',
              backgroundColor:
                currentIndex === numSections + 1 ? '#f0f8ff' : 'transparent',
              borderRadius: '4px'
            }}
          >
            Report
          </div>
        )}
      </div>

      {/* Main Pane */}
      <div
        style={{
          flex: 1,
          padding: '2rem',
          overflowY: 'auto'
        }}
      >
        {isOverview && (
          <>
            <h1>{journal.title}</h1>
            <p style={{ lineHeight: 1.6, marginBottom: '2rem' }}>
              {journal.description}
            </p>
            <button
              onClick={() => setCurrentIndex(1)}
              style={{
                padding: '0.75rem 1.5rem',
                backgroundColor: '#007bff',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '1rem'
              }}
            >
              Start Journal
            </button>
          </>
        )}

        {!isOverview && !isReport && sectionIndex !== null && (
          <>
            <h2>{journal.tableOfContents[sectionIndex].title}</h2>
            <div style={{ marginBottom: '1.5rem' }}>
              {journal.tableOfContents[sectionIndex].content
                .split('\n')
                .map((para, i) => (
                  <p key={i} style={{ lineHeight: 1.6 }}>
                    {para.trim()}
                  </p>
                ))}
            </div>

            {journal.tableOfContents[sectionIndex].prompts.map(
              (pObj, pIdx) => (
                <div key={pIdx} style={{ marginBottom: '1.25rem' }}>
                  <label
                    style={{
                      fontWeight: '500',
                      display: 'block',
                      marginBottom: '0.5rem'
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
                      fontSize: '1rem'
                    }}
                    value={responses[sectionIndex][pIdx] || ''}
                    onChange={(e) =>
                      handlePromptChange(sectionIndex, pIdx, e.target.value)
                    }
                  />
                </div>
              )
            )}

            <div style={{ marginTop: '2rem' }}>
              {sectionIndex < numSections - 1 ? (
                <button
                  onClick={() => setCurrentIndex((ci) => ci + 1)}
                  style={{
                    padding: '0.75rem 1.5rem',
                    backgroundColor: '#007bff',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '1rem'
                  }}
                >
                  Next
                </button>
              ) : (
                <button
                  onClick={handleSubmit}
                  disabled={loadingReport}
                  style={{
                    padding: '0.75rem 1.5rem',
                    backgroundColor: loadingReport ? '#999' : '#28a745',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: loadingReport ? 'default' : 'pointer',
                    fontSize: '1rem'
                  }}
                >
                  {loadingReport ? 'Generating Report…' : 'Submit'}
                </button>
              )}
            </div>

            {reportError && (
              <p style={{ color: 'red', marginTop: '1rem' }}>
                Error generating report: {reportError}
              </p>
            )}
          </>
        )}

        {isReport && (
          <>
            <h1>Report</h1>
            <div
              style={{
                marginTop: '1rem',
                whiteSpace: 'pre-wrap',
                lineHeight: 1.6
              }}
            >
              {report}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
