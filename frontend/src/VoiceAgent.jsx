import { useState, useRef } from 'react';

export default function VoiceAgent() {
  const [isRecording, setIsRecording] = useState(false);
  const [status, setStatus] = useState('Idle');
  const [chatHistory, setChatHistory] = useState([]);
  const [region, setRegion] = useState('US'); // US, PH, ID
  const [textInput, setTextInput] = useState('');
  const recognitionRef = useRef(null);

  const speechSupported = typeof window !== 'undefined' && ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window);

  const getLanguageTag = () => {
      if (region === 'PH') return 'fil-PH';
      if (region === 'ID') return 'id-ID';
      return 'en-US';
  };

  // Initialize Web Speech API
  const startInteraction = () => {
    if (!speechSupported) {
      alert('Your browser does not support Speech Recognition. Use the text input below, or switch to Chrome.');
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognitionRef.current = new SpeechRecognition();
    recognitionRef.current.continuous = false;
    recognitionRef.current.interimResults = false;
    recognitionRef.current.lang = getLanguageTag();

    recognitionRef.current.onstart = () => {
      setIsRecording(true);
      setStatus(`Listening (${getLanguageTag()})...`);
    };

    recognitionRef.current.onresult = async (event) => {
      const userMessage = event.results[0][0].transcript;
      setStatus('Processing...');
      setIsRecording(false);
      
      const updatedHistory = [...chatHistory, { role: 'user', content: userMessage }];
      setChatHistory(updatedHistory);
      
      await sendToBackend(updatedHistory, userMessage);
    };

    recognitionRef.current.onerror = (e) => {
      setStatus('Error listening. Use text input instead.');
      setIsRecording(false);
    };

    recognitionRef.current.onend = () => {
      setIsRecording(false);
    };

    recognitionRef.current.start();
  };

  const handleTextSend = async () => {
    if (!textInput.trim()) return;
    const userMessage = textInput.trim();
    setTextInput('');
    setStatus('Processing...');
    
    const updatedHistory = [...chatHistory, { role: 'user', content: userMessage }];
    setChatHistory(updatedHistory);
    
    await sendToBackend(updatedHistory, userMessage);
  };

  const sendToBackend = async (history, userMessage) => {
    try {
      const endpoint = region === 'US' ? '/api/voice/chat' : '/api/voice/localized-chat';
      
      const response = await fetch(`http://localhost:5000${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ history, userMessage, region }),
      });
      const data = await response.json();
      
      const newHistory = [...history, { role: 'agent', content: data.answer }];
      setChatHistory(newHistory);
      
      speakResponse(data.answer);

      if (data.end_call) {
        setStatus(data.escalate ? 'Call Ended (Escalated)' : 'Call Ended (Completed)');
        saveTranscript(newHistory, data.escalate, data.lead_qualified);
      } else {
        setStatus('Ready');
      }

    } catch (error) {
      setStatus('Connection error.');
    }
  };

  const speakResponse = (text) => {
    if (!('speechSynthesis' in window)) return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = getLanguageTag();
    window.speechSynthesis.speak(utterance);
  };

  const saveTranscript = async (history, escalate, lead_qualified) => {
    await fetch('http://localhost:5000/api/voice/transcript', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        transcript: history,
        status: escalate ? 'escalated' : 'completed',
        qualification_result: lead_qualified,
        region: region
      }),
    });
  };

  const clearChat = () => setChatHistory([]);

  return (
    <div style={{ border: '2px solid #007bff', padding: '20px', borderRadius: '8px', marginTop: '20px' }}>
      <h2>Voice Agent Dashboard</h2>
      
      <div style={{ marginBottom: '15px' }}>
          <label style={{ marginRight: '10px' }}><strong>Select Region/Bot:</strong></label>
          <select value={region} onChange={(e) => { setRegion(e.target.value); clearChat(); }} style={{ padding: '5px' }}>
              <option value="US">US English (Q1 - Loan Qualification)</option>
              <option value="PH">Philippines (Q3 - Taglish Reminder)</option>
              <option value="ID">Indonesia (Q3 - Bahasa Reminder)</option>
          </select>
          <button onClick={clearChat} style={{ marginLeft: '10px', padding: '5px' }}>Reset Call</button>
      </div>

      <p>Status: <strong>{status}</strong></p>
      
      {speechSupported && (
        <button 
          onClick={startInteraction} 
          disabled={isRecording}
          style={{ padding: '15px 30px', fontSize: '16px', backgroundColor: isRecording ? '#ccc' : '#007bff', color: '#fff', borderRadius: '5px', cursor: 'pointer', marginBottom: '10px' }}
        >
          {isRecording ? 'Listening (Speak Now)' : 'Hold to Speak'}
        </button>
      )}

      <div style={{ display: 'flex', marginBottom: '10px' }}>
        <input 
          type="text" 
          value={textInput} 
          onChange={e => setTextInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleTextSend()}
          placeholder={speechSupported ? "Or type here instead..." : "Type your message here..."}
          style={{ flex: 1, padding: '10px' }}
        />
        <button onClick={handleTextSend} style={{ padding: '10px 20px', marginLeft: '10px' }}>Send</button>
      </div>

      <div style={{ marginTop: '10px', height: '300px', overflowY: 'auto', backgroundColor: '#f4f4f4', padding: '15px', borderRadius: '5px' }}>
        {chatHistory.map((msg, idx) => (
          <div key={idx} style={{ marginBottom: '10px', textAlign: msg.role === 'user' ? 'right' : 'left' }}>
            <span style={{ backgroundColor: msg.role === 'user' ? '#007bff' : '#28a745', color: 'white', padding: '5px 10px', borderRadius: '10px', display: 'inline-block' }}>
              {msg.content}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

