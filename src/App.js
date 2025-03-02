import React, { useState, useEffect, useRef } from 'react';

// Main App Component
const VoiceAssistantApp = () => {
  // Set dark mode as the default
  const [darkMode, setDarkMode] = useState(true);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [messages, setMessages] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [animation, setAnimation] = useState('wave');
  const [wavePoints, setWavePoints] = useState(Array(10).fill(10));
  const [apiUrl, setApiUrl] = useState('http://127.0.0.1:5000');
  
  const recognitionRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const messagesEndRef = useRef(null);
  const waveAnimationRef = useRef(null);
  
  // Dark mode toggle
  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
  };
  
  // Scroll to the latest message
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };
  
  useEffect(() => {
    scrollToBottom();
  }, [messages]);
  
  // Wave animation effect
  useEffect(() => {
    if (isListening) {
      const animateWave = () => {
        const newPoints = Array.from({ length: 10 }, () => Math.random() * 50 + 10);
        setWavePoints(newPoints);
      };
      
      waveAnimationRef.current = setInterval(animateWave, 300);
      return () => clearInterval(waveAnimationRef.current);
    }
  }, [isListening]);
  
  // Initialize speech recognition
  useEffect(() => {
    // Check if browser supports SpeechRecognition or MediaRecorder
    const useBrowserRecognition = 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window;
    
    if (useBrowserRecognition) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      
      recognitionRef.current.onresult = (event) => {
        const current = event.resultIndex;
        const transcriptText = event.results[current][0].transcript;
        setTranscript(transcriptText);
      };
      
      recognitionRef.current.onend = () => {
        if (isListening) {
          recognitionRef.current.start();
        }
      };
    } else {
      alert('Your browser does not support voice recognition. Try Chrome or Edge.');
    }
    
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);
  
  // Initialize media recorder for sending audio to the Python backend
  const initializeMediaRecorder = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      
      mediaRecorderRef.current.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };
      
      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        audioChunksRef.current = [];
        
        // Convert to base64 for sending to the server
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => {
          const base64Audio = reader.result.split(',')[1];
          
          // Send to server
          try {
            const response = await fetch(`${apiUrl}/api/process-audio`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ audio: base64Audio }),
            });
            
            const data = await response.json();
            if (data.success) {
              setTranscript(data.command);
              handleServerResponse(data.command, data.response);
            }
          } catch (error) {
            console.error('Error sending audio to server:', error);
          }
        };
      };
      
      return true;
    } catch (error) {
      console.error('Error initializing media recorder:', error);
      return false;
    }
  };
  
  // Toggle listening state
  const toggleListening = async () => {
    if (isListening) {
      // Stop listening
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
      
      setIsListening(false);
      
      if (transcript) {
        handleMessage(transcript);
      }
    } else {
      // Start listening
      setTranscript('');
      
      // Initialize media recorder if not already
      if (!mediaRecorderRef.current) {
        const initialized = await initializeMediaRecorder();
        if (!initialized) {
          alert('Could not access microphone. Please check your permissions.');
          return;
        }
      }
      
      if (recognitionRef.current) {
        recognitionRef.current.start();
      }
      
      if (mediaRecorderRef.current) {
        audioChunksRef.current = [];
        mediaRecorderRef.current.start();
      }
      
      setIsListening(true);
    }
  };
  
  // Handle server response
  const handleServerResponse = (userText, assistantResponse) => {
    // Add user message to chat
    setMessages(prev => [...prev, { type: 'user', text: userText, id: Date.now() }]);
    
    // Add assistant response
    setTimeout(() => {
      setMessages(prev => [...prev, { type: 'assistant', text: assistantResponse, id: Date.now() + 1 }]);
      setIsProcessing(false);
    }, 500);
  };
  
  // Handle the user message and get a response
  const handleMessage = async (text) => {
    // Add user message to chat
    setMessages(prev => [...prev, { type: 'user', text, id: Date.now() }]);
    setIsProcessing(true);
    
    try {
      // Send the text command to the Python backend
      const response = await fetch(`${apiUrl}/api/process-text`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ command: text }),
      });
      
      const data = await response.json();
      if (data.success) {
        setMessages(prev => [...prev, { type: 'assistant', text: data.response, id: Date.now() + 1 }]);
      } else {
        setMessages(prev => [...prev, { 
          type: 'assistant', 
          text: "Sorry, I encountered an error processing your request.", 
          id: Date.now() + 1 
        }]);
      }
    } catch (error) {
      console.error('Error sending request to server:', error);
      setMessages(prev => [...prev, { 
        type: 'assistant', 
        text: "Sorry, I couldn't connect to the server. Please check your connection.", 
        id: Date.now() + 1 
      }]);
    } finally {
      setIsProcessing(false);
      setTranscript('');
    }
  };
  
  // Send message with button
  const sendMessage = () => {
    if (transcript.trim()) {
      handleMessage(transcript);
      setTranscript('');
    }
  };
  
  // Send message with Enter key
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Update API URL
  const handleApiUrlChange = (e) => {
    setApiUrl(e.target.value);
  };

  return (
    <div className="app-container" style={{ backgroundColor: darkMode ? '#121212' : '#f5f5f5', color: darkMode ? '#ffffff' : '#333333' }}>
      {/* Header */}
      <header style={{ backgroundColor: darkMode ? '#1e1e1e' : '#ffffff' }}>
        <div className="logo">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
          </svg>
          <h1>Voice Assistant</h1>
        </div>
        
        <div className="header-controls">
          <button 
            className="icon-button" 
            onClick={() => setShowSettings(!showSettings)}
            style={{ backgroundColor: darkMode ? '#333333' : '#e5e5e5' }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3"></circle>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
            </svg>
          </button>
          
          <button 
            className="icon-button"
            onClick={toggleDarkMode}
            style={{ backgroundColor: darkMode ? '#333333' : '#e5e5e5' }}
          >
            {darkMode ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="5"></circle>
                <line x1="12" y1="1" x2="12" y2="3"></line>
                <line x1="12" y1="21" x2="12" y2="23"></line>
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
                <line x1="1" y1="12" x2="3" y2="12"></line>
                <line x1="21" y1="12" x2="23" y2="12"></line>
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
              </svg>
            )}
          </button>
        </div>
      </header>
      
      {/* Settings panel */}
      {showSettings && (
        <div className="settings-panel" style={{ backgroundColor: darkMode ? '#1e1e1e' : '#ffffff' }}>
          <div className="settings-header">
            <h2>Settings</h2>
            <button onClick={() => setShowSettings(false)}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
          
          <div className="settings-item">
            <p>Animation Style</p>
            <select 
              value={animation} 
              onChange={(e) => setAnimation(e.target.value)}
              style={{ backgroundColor: darkMode ? '#333333' : '#e5e5e5', color: darkMode ? '#ffffff' : '#333333' }}
            >
              <option value="wave">Wave</option>
              <option value="pulse">Pulse</option>
              <option value="bars">Bars</option>
            </select>
          </div>
          
          <div className="settings-item">
            <p>API URL</p>
            <input
              type="text"
              value={apiUrl}
              onChange={handleApiUrlChange}
              placeholder="http://localhost:5000"
              style={{ 
                backgroundColor: darkMode ? '#333333' : '#e5e5e5', 
                color: darkMode ? '#ffffff' : '#333333',
                width: '100%',
                padding: '8px',
                borderRadius: '4px',
                border: 'none',
                marginBottom: '10px'
              }}
            />
          </div>
          
          <div className="settings-item">
            <p>Dark Mode</p>
            <div
              className={`toggle ${darkMode ? 'toggle-active' : ''}`}
              onClick={toggleDarkMode}
              style={{ backgroundColor: darkMode ? '#3b82f6' : '#9ca3af' }}
            >
              <div className="toggle-thumb"></div>
            </div>
          </div>
        </div>
      )}
      
      {/* Main chat area */}
      <div className="chat-area">
        {messages.length === 0 ? (
          <div className="empty-state">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
              <path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
              <path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path>
            </svg>
            <h2>Voice Assistant Ready</h2>
            <p style={{ color: darkMode ? '#9ca3af' : '#6b7280' }}>
              Click the microphone button or type a message to get started.
            </p>
          </div>
        ) : (
          <div className="messages">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`message-container ${message.type === 'user' ? 'user-message' : 'assistant-message'}`}
              >
                <div 
                  className="message"
                  style={{ 
                    backgroundColor: message.type === 'user' 
                      ? '#3b82f6' 
                      : darkMode ? '#333333' : '#e5e5e5',
                    color: message.type === 'user' 
                      ? '#ffffff' 
                      : darkMode ? '#ffffff' : '#333333'
                  }}
                >
                  {message.text}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>
      
      {/* Voice visualization */}
      {isListening && (
        <div className="wave-container">
          <div className="wave">
            {wavePoints.map((height, i) => (
              <div
                key={i}
                className="wave-bar"
                style={{ height: `${height}px` }}
              />
            ))}
          </div>
        </div>
      )}
      
      {/* Processing indicator */}
      {isProcessing && (
        <div className="loading-indicator">
          <div className="loading-dot" style={{ animationDelay: '0s' }}></div>
          <div className="loading-dot" style={{ animationDelay: '0.2s' }}></div>
          <div className="loading-dot" style={{ animationDelay: '0.4s' }}></div>
        </div>
      )}
      
      {/* Input area */}
      <div className="input-area" style={{ backgroundColor: darkMode ? '#1e1e1e' : '#ffffff', borderColor: darkMode ? '#333333' : '#e5e5e5' }}>
        <button
          className="mic-button"
          onClick={toggleListening}
          style={{ 
            backgroundColor: isListening 
              ? '#ef4444' 
              : '#3b82f6',
            animation: isListening ? 'pulse 1.5s infinite' : 'none'
          }}
        >
          {isListening ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="1" y1="1" x2="23" y2="23"></line>
              <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"></path>
              <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2c0 .95-.19 1.85-.52 2.67"></path>
              <line x1="12" y1="19" x2="12" y2="23"></line>
              <line x1="8" y1="23" x2="16" y2="23"></line>
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
              <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
              <line x1="12" y1="19" x2="12" y2="23"></line>
              <line x1="8" y1="23" x2="16" y2="23"></line>
            </svg>
          )}
        </button>
        
        <div className="input-container">
          <input
            type="text"
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message or speak..."
            style={{ 
              backgroundColor: darkMode ? '#333333' : '#e5e5e5', 
              color: darkMode ? '#ffffff' : '#333333',
              caretColor: darkMode ? '#ffffff' : '#333333'
            }}
          />
          
          {transcript && (
            <button
              className="send-button"
              onClick={sendMessage}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13"></line>
                <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
              </svg>
            </button>
          )}
        </div>
      </div>
      
      {/* CSS styles - same as before */}
      {/* ... */}
      <style jsx>{`
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
        }
        
        .app-container {
          display: flex;
          flex-direction: column;
          height: 100vh;
          width: 100%;
          transition: background-color 0.3s ease, color 0.3s ease;
        }
        
        header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
          transition: background-color 0.3s ease;
          z-index: 10;
          animation: slideDown 0.5s ease-out;
        }
        
        .logo {
          display: flex;
          align-items: center;
          cursor: pointer;
          transition: transform 0.3s ease;
        }
        
        .logo:hover {
          transform: scale(1.05);
        }
        
        .logo h1 {
          margin-left: 8px;
          font-size: 1.25rem;
          font-weight: bold;
        }
        
        .header-controls {
          display: flex;
          align-items: center;
          gap: 16px;
        }
        
        .icon-button {
          display: flex;
          justify-content: center;
          align-items: center;
          width: 40px;
          height: 40px;
          border-radius: 50%;
          border: none;
          cursor: pointer;
          transition: transform 0.3s ease, background-color 0.3s ease;
        }
        
        .icon-button:hover {
          transform: scale(1.1);
        }
        
        .icon-button:active {
          transform: scale(0.95);
        }
        
        .settings-panel {
          position: absolute;
          right: 16px;
          top: 64px;
          width: 250px;
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
          padding: 16px;
          transition: opacity 0.3s ease, transform 0.3s ease, background-color 0.3s ease;
          z-index: 20;
          animation: fadeIn 0.3s ease-out;
        }
        
        .settings-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
        }
        
        .settings-header h2 {
          font-weight: bold;
          font-size: 1rem;
        }
        
        .settings-header button {
          background: none;
          border: none;
          cursor: pointer;
          display: flex;
        }
        
        .settings-item {
          margin-bottom: 12px;
        }
        
        .settings-item p {
          margin-bottom: 8px;
          font-size: 0.875rem;
        }
        
        .settings-item select {
          width: 100%;
          padding: 8px;
          border-radius: 4px;
          border: none;
          font-size: 0.875rem;
          transition: background-color 0.3s ease, color 0.3s ease;
        }
        
        .toggle {
          position: relative;
          width: 48px;
          height: 24px;
          border-radius: 12px;
          cursor: pointer;
          transition: background-color 0.3s ease;
        }
        
        .toggle-thumb {
          position: absolute;
          top: 2px;
          left: 2px;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background-color: white;
          transition: left 0.3s ease;
        }
        
        .toggle-active .toggle-thumb {
          left: 26px;
        }
        
        .chat-area {
          flex: 1;
          overflow-y: auto;
          padding: 16px;
          animation: fadeIn 0.5s ease-out;
        }
        
        .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100%;
          text-align: center;
          animation: fadeInUp 0.5s ease-out;
        }
        
        .empty-state h2 {
          margin-top: 16px;
          margin-bottom: 8px;
          font-size: 1.25rem;
          font-weight: bold;
        }
        
        .empty-state p {
          max-width: 400px;
        }
        
        .messages {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        
        .message-container {
          display: flex;
          animation: fadeInUp 0.3s ease-out;
        }
        
        .user-message {
          justify-content: flex-end;
        }
        
        .assistant-message {
          justify-content: flex-start;
        }
        
        .message {
          max-width: 75%;
          padding: 12px;
          border-radius: 12px;
          word-break: break-word;
          transition: background-color 0.3s ease, color 0.3s ease;
        }
        
        .wave-container {
          height: 64px;
          display: flex;
          justify-content: center;
          align-items: center;
          overflow: hidden;
          animation: expandHeight 0.3s ease-out;
        }
        
        .wave {
          display: flex;
          align-items: flex-end;
          gap: 4px;
          height: 48px;
        }
        
        .wave-bar {
          width: 4px;
          background-color: #3b82f6;
          border-radius: 2px 2px 0 0;
          transition: height 0.3s ease;
        }
        
        .loading-indicator {
          display: flex;
          justify-content: center;
          padding: 8px;
          animation: fadeIn 0.3s ease-out;
        }
        
        .loading-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background-color: #3b82f6;
          margin: 0 4px;
          animation: bounce 0.8s infinite;
        }
        
        .input-area {
          display: flex;
          align-items: center;
          padding: 16px;
          border-top-width: 1px;
          border-top-style: solid;
          animation: slideUp 0.5s ease-out;
          transition: background-color 0.3s ease, border-color 0.3s ease;
        }
        
        .mic-button {
          display: flex;
          justify-content: center;
          align-items: center;
          width: 48px;
          height: 48px;
          border-radius: 50%;
          border: none;
          margin-right: 12px;
          cursor: pointer;
          transition: background-color 0.3s ease, transform 0.3s ease;
        }
        
        .mic-button:hover {
          transform: scale(1.05);
        }
        
        .mic-button:active {
          transform: scale(0.95);
        }
        
        .input-container {
          position: relative;
          flex: 1;
        }
        
        .input-container input {
          width: 100%;
          padding: 12px;
          padding-right: 40px;
          border-radius: 12px;
          border: none;
          outline: none;
          font-size: 1rem;
          transition: background-color 0.3s ease, color 0.3s ease;
        }
        
        .send-button {
          position: absolute;
          right: 8px;
          top: 8px;
          display: flex;
          justify-content: center;
          align-items: center;
          width: 32px;
          height: 32px;
          border-radius: 50%;
          border: none;
          background-color: #3b82f6;
          cursor: pointer;
          transition: transform 0.3s ease;
          animation: fadeIn 0.2s ease-out;
        }
        
        .send-button:hover {
          transform: scale(1.1);
        }
        
        .send-button:active {
          transform: scale(0.9);
        }
        
        /* Animations */
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        @keyframes slideDown {
          from { transform: translateY(-50px); }
          to { transform: translateY(0); }
        }
        
        @keyframes slideUp {
          from { transform: translateY(50px); }
          to { transform: translateY(0); }
        }
        
        @keyframes expandHeight {
          from { height: 0; }
          to { height: 64px; }
        }
        
        @keyframes pulse {
          0% { transform: scale(1); opacity: 0.7; }
          50% { transform: scale(1.1); opacity: 1; }
          100% { transform: scale(1); opacity: 0.7; }
        }
        
        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-5px); }
        }
      `}</style>
    </div>
  );
};

export default VoiceAssistantApp;