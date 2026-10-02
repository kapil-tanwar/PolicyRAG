import { useState } from 'react';
import './App.css';
import VoiceAgent from './VoiceAgent';
import AgentDashboard from './AgentDashboard';

function App() {
  const [file, setFile] = useState(null);
  const [uploadStatus, setUploadStatus] = useState('');
  
  const [question, setQuestion] = useState('');
  const [chatHistory, setChatHistory] = useState([]);
  const [loading, setLoading] = useState(false);

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploadStatus('Uploading...');
    const formData = new FormData();
    formData.append('file', file);
    formData.append('category', 'general');

    try {
      const response = await fetch('http://localhost:5000/api/knowledge/upload', {
        method: 'POST',
        body: formData,
      });
      const data = await response.json();
      if (response.ok) {
        setUploadStatus(`Success! Created ${data.chunks_created} chunks.`);
      } else {
        setUploadStatus(`Error: ${data.error}`);
      }
    } catch (error) {
      setUploadStatus('Failed to connect to server.');
    }
  };

  const handleAsk = async () => {
    if (!question) return;
    const userQ = question;
    setQuestion('');
    setChatHistory(prev => [...prev, { role: 'user', content: userQ }]);
    setLoading(true);

    try {
      const response = await fetch('http://localhost:5000/api/rag/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: userQ }),
      });
      const data = await response.json();
      
      setChatHistory(prev => [...prev, { 
        role: 'agent', 
        content: data.answer,
        sources: data.sources 
      }]);
    } catch (error) {
      setChatHistory(prev => [...prev, { role: 'agent', content: 'Error connecting to server.' }]);
    }
    setLoading(false);
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '20px', fontFamily: 'sans-serif' }}>
      <h1>RAG Knowledge Base</h1>
      
      <div style={{ border: '1px solid #ccc', padding: '20px', marginBottom: '20px', borderRadius: '8px' }}>
        <h3>1. Ingestion</h3>
        <input type="file" onChange={handleFileChange} />
        <button onClick={handleUpload} style={{ marginLeft: '10px' }}>Upload to Knowledge Base</button>
        <p>{uploadStatus}</p>
      </div>

      <div style={{ border: '1px solid #ccc', padding: '20px', borderRadius: '8px', minHeight: '400px', display: 'flex', flexDirection: 'column' }}>
        <h3>2. Retrieval & Generation</h3>
        <div style={{ flex: 1, overflowY: 'auto', marginBottom: '20px', padding: '10px', backgroundColor: '#f9f9f9' }}>
          {chatHistory.map((msg, idx) => (
            <div key={idx} style={{ marginBottom: '15px', textAlign: msg.role === 'user' ? 'right' : 'left' }}>
              <strong style={{ color: msg.role === 'user' ? 'blue' : 'green' }}>
                {msg.role === 'user' ? 'You' : 'AI'}
              </strong>
              <div style={{ whiteSpace: 'pre-wrap', marginTop: '5px' }}>{msg.content}</div>
              
              {msg.sources && msg.sources.length > 0 && (
                <div style={{ fontSize: '12px', color: '#666', marginTop: '10px', backgroundColor: '#eee', padding: '5px' }}>
                  <strong>Sources:</strong>
                  <ul>
                    {msg.sources.map((s, i) => (
                      <li key={i}>{s.document} (Distance: {s.distance?.toFixed(3)})</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))}
          {loading && <div><em>AI is thinking...</em></div>}
        </div>
        
        <div style={{ display: 'flex' }}>
          <input 
            type="text" 
            value={question} 
            onChange={e => setQuestion(e.target.value)}
            onKeyPress={e => e.key === 'Enter' && handleAsk()}
            placeholder="Ask a question..."
            style={{ flex: 1, padding: '10px' }}
          />
          <button onClick={handleAsk} style={{ padding: '10px 20px', marginLeft: '10px' }}>Ask</button>
        </div>
      </div>
      
      {/* Question 1 & 3 Voice Agent Component */}
      <VoiceAgent />

      {/* Question 4 Real-Time Nudges */}
      <AgentDashboard />
    </div>
  );
}

export default App;
