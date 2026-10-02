import { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';

export default function AgentDashboard() {
  const [isCallActive, setIsCallActive] = useState(false);
  const [transcript, setTranscript] = useState([]);
  const [nudges, setNudges] = useState([]);
  const [suppressions, setSuppressions] = useState([]);
  
  const socketRef = useRef(null);
  const recognitionRef = useRef(null);

  useEffect(() => {
    socketRef.current = io('http://localhost:5000');

    socketRef.current.on('new_nudge', (nudge) => {
        setNudges(prev => [nudge, ...prev]);
    });

    socketRef.current.on('nudge_suppressed', (info) => {
        setSuppressions(prev => [{...info, timestamp: new Date().toLocaleTimeString()}, ...prev]);
    });

    return () => {
        socketRef.current.disconnect();
    };
  }, []);

  const startCall = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert('Browser does not support Speech Recognition.');
      return;
    }

    setTranscript([]);
    setNudges([]);
    setSuppressions([]);

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognitionRef.current = new SpeechRecognition();
    // Continuous allows us to keep listening
    recognitionRef.current.continuous = true; 
    // We only send finalized phrases to the LLM to avoid overwhelming the token limit
    recognitionRef.current.interimResults = false; 

    recognitionRef.current.onstart = () => {
      setIsCallActive(true);
    };

    recognitionRef.current.onresult = (event) => {
      // The last result is the newest finalized phrase
      const last = event.results.length - 1;
      const text = event.results[last][0].transcript.trim();
      
      const chunk = {
          text,
          isAgent: text.toLowerCase().includes("agent"), // Simple mock: if you say the word 'agent' it treats it as agent speech
          timestamp: Date.now(),
          timeStr: new Date().toLocaleTimeString()
      };

      setTranscript(prev => [...prev, chunk]);
      
      // Emit to WebSocket for Nudge Engine
      socketRef.current.emit('transcript_chunk', chunk);
    };

    recognitionRef.current.onerror = (e) => {
      console.error("ASR Error:", e);
    };

    recognitionRef.current.start();
  };

  const endCall = () => {
    setIsCallActive(false);
    if (recognitionRef.current) {
        recognitionRef.current.stop();
    }
  };

  return (
    <div style={{ border: '2px solid #ff4500', padding: '20px', borderRadius: '8px', marginTop: '40px' }}>
      <h2>Q4: Real-Time Agent Dashboard</h2>
      <p style={{ fontSize: '14px', color: '#666' }}>
        *Speak into the microphone. To simulate the agent speaking, include the word "agent" in your sentence (e.g., "Agent says this call is recorded"). Otherwise, you are the customer.*
      </p>
      
      <div style={{ marginBottom: '20px' }}>
        {isCallActive ? (
            <button onClick={endCall} style={{ padding: '10px 20px', backgroundColor: '#dc3545', color: '#fff', borderRadius: '5px' }}>End Live Call</button>
        ) : (
            <button onClick={startCall} style={{ padding: '10px 20px', backgroundColor: '#28a745', color: '#fff', borderRadius: '5px' }}>Start Live Call</button>
        )}
      </div>

      <div style={{ display: 'flex', gap: '20px' }}>
          {/* Live Transcript Panel */}
          <div style={{ flex: 1, border: '1px solid #ccc', borderRadius: '5px', height: '400px', display: 'flex', flexDirection: 'column' }}>
              <div style={{ padding: '10px', backgroundColor: '#f4f4f4', borderBottom: '1px solid #ccc', fontWeight: 'bold' }}>Live Transcript</div>
              <div style={{ padding: '10px', overflowY: 'auto', flex: 1 }}>
                  {transcript.map((t, idx) => (
                      <div key={idx} style={{ marginBottom: '10px', color: t.isAgent ? '#007bff' : '#333' }}>
                          <span style={{ fontSize: '12px', color: '#999' }}>[{t.timeStr}]</span> 
                          <strong> {t.isAgent ? 'Agent' : 'Customer'}:</strong> {t.text}
                      </div>
                  ))}
              </div>
          </div>

          {/* Nudge Panel */}
          <div style={{ width: '350px', border: '1px solid #ccc', borderRadius: '5px', height: '400px', display: 'flex', flexDirection: 'column' }}>
              <div style={{ padding: '10px', backgroundColor: '#fff3cd', borderBottom: '1px solid #ccc', fontWeight: 'bold' }}>Active Nudges</div>
              <div style={{ padding: '10px', overflowY: 'auto', flex: 1 }}>
                  {nudges.map((nudge, idx) => (
                      <div key={idx} style={{ marginBottom: '15px', padding: '10px', backgroundColor: '#cce5ff', border: '1px solid #b8daff', borderRadius: '5px' }}>
                          <div style={{ fontWeight: 'bold', color: '#004085' }}>🚨 {nudge.signal}</div>
                          <div style={{ margin: '5px 0' }}>{nudge.message}</div>
                          <div style={{ fontSize: '11px', color: '#666' }}>
                              Conf: {nudge.confidence} | LLM: {nudge.metrics.llm_latency_ms}ms<br/>
                              P50: {nudge.metrics.p50_e2e}ms | P95: {nudge.metrics.p95_e2e}ms
                          </div>
                      </div>
                  ))}
                  
                  {suppressions.length > 0 && (
                      <div style={{ marginTop: '20px', fontSize: '12px', color: '#666' }}>
                          <strong>Suppressed (Cooldown):</strong>
                          <ul>
                              {suppressions.map((s, i) => (
                                  <li key={i}>{s.type} at {s.timestamp}</li>
                              ))}
                          </ul>
                      </div>
                  )}
              </div>
          </div>
      </div>
    </div>
  );
}
