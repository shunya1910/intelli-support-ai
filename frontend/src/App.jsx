import { useState, useEffect } from 'react';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import './index.css';

function App() {
  const [tickets, setTickets] = useState([]);
  const [formData, setFormData] = useState({ title: '', description: '' });
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [token, setToken] = useState(localStorage.getItem('jwt') || null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [replyData, setReplyData] = useState({});

  useEffect(() => {
    if (!token) return;

    fetchTickets();
    
    const socket = new SockJS('http://localhost:8080/ws');
    const stompClient = new Client({
      webSocketFactory: () => socket,
      connectHeaders: {
        Authorization: `Bearer ${token}`
      },
      reconnectDelay: 5000,
      onConnect: () => {
        console.log('Connected to WebSocket for Real-Time Updates!');
        stompClient.subscribe('/topic/tickets', (msg) => {
          const updatedTicket = JSON.parse(msg.body);
          setTickets(prev => prev.map(t => (t.id === updatedTicket.id ? updatedTicket : t)));
        });
      }
    });
    
    stompClient.activate();

    return () => {
      stompClient.deactivate();
    };
  }, [token]);

  const fetchTickets = async () => {
    try {
      const response = await fetch('http://localhost:8080/api/tickets', { 
        cache: 'no-store',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) {
        if (response.status === 401) handleLogout();
        throw new Error('Failed to fetch tickets');
      }
      const data = await response.json();
      setTickets(data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await fetch('http://localhost:8080/api/tickets', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });
      if (!response.ok) throw new Error('Failed to create ticket');
      
      const newTicket = await response.json();
      setTickets(prevTickets => [...prevTickets, newTicket]);
      setFormData({ title: '', description: '' });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleReply = async (e, ticketId) => {
    e.preventDefault();
    const replyMessage = replyData[ticketId];
    if (!replyMessage) return;
    
    setLoading(true);
    try {
      const response = await fetch(`http://localhost:8080/api/tickets/${ticketId}/reply`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ message: replyMessage })
      });
      if (!response.ok) throw new Error('Failed to send reply');
      
      const updatedTicket = await response.json();
      setTickets(prev => prev.map(t => (t.id === updatedTicket.id ? updatedTicket : t)));
      setReplyData(prev => ({...prev, [ticketId]: ''}));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await fetch('http://localhost:8080/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginForm)
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Login failed');
      localStorage.setItem('jwt', data.token);
      setToken(data.token);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('jwt');
    setToken(null);
    setTickets([]);
  };

  if (!token) {
    return (
      <div className="app-container">
        <div className="background-shapes">
          <div className="shape shape-1"></div>
          <div className="shape shape-2"></div>
        </div>
        <div className="main-content" style={{ maxWidth: '400px' }}>
          <div className="header" style={{ marginBottom: '2rem' }}>
            <h1 className="title">Secure <span className="highlight">Login</span></h1>
            <p className="subtitle">Please authenticate to continue</p>
          </div>
          
          <div className="glass-card">
            {error && <div style={{ color: '#ef4444', marginBottom: '1rem', textAlign: 'center' }}>{error}</div>}
            <form onSubmit={handleLogin}>
              <div className="form-group">
                <label>Username (admin)</label>
                <input 
                  type="text" 
                  required 
                  value={loginForm.username}
                  onChange={(e) => setLoginForm({...loginForm, username: e.target.value})}
                  placeholder="admin"
                />
              </div>
              <div className="form-group" style={{ position: 'relative' }}>
                <label>Password (password)</label>
                <input 
                  type={showPassword ? "text" : "password"} 
                  required 
                  value={loginForm.password}
                  onChange={(e) => setLoginForm({...loginForm, password: e.target.value})}
                  placeholder="••••••••"
                  style={{ paddingRight: '50px' }}
                />
                <button 
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute',
                    right: '12px',
                    top: '38px',
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '4px'
                  }}
                  title={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" y1="2" x2="22" y2="22"/></svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
                  )}
                </button>
              </div>
              <button type="submit" className="submit-btn" disabled={loading}>
                {loading ? 'Authenticating...' : 'Login Securely'}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      <div className="background-shapes">
        <div className="shape shape-1"></div>
        <div className="shape shape-2"></div>
      </div>

      <main className="main-content">
        <header className="header">
          <h1 className="title">IntelliSupport <span className="highlight">AI</span></h1>
          <p className="subtitle">AI-Powered Incident Engine</p>
        </header>

        <div className="dashboard-grid">
          {/* Submission Form */}
          <div className="glass-card form-section">
            <h2 className="card-title">Create New Ticket</h2>
            {error && <div className="error-badge">{error}</div>}
            
            <form onSubmit={handleSubmit} className="ticket-form">
              <div className="form-group">
                <label htmlFor="title">Issue Title</label>
                <input
                  id="title"
                  type="text"
                  placeholder="e.g. Cannot access dashboard"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="description">Detailed Description</label>
                <textarea
                  id="description"
                  placeholder="Provide steps to reproduce..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  required
                  rows="4"
                />
              </div>
              <button type="submit" className="submit-btn" disabled={loading}>
                {loading ? 'Submitting...' : 'Submit Ticket'}
                <div className="btn-glow"></div>
              </button>
            </form>
          </div>

          {/* Ticket List */}
          <div className="glass-card list-section">
            <h2 className="card-title">Active Tickets</h2>
            <div className="ticket-list">
              {tickets.length === 0 ? (
                <div className="empty-state">No active tickets found.</div>
              ) : (
                tickets.map(ticket => (
                  <div key={ticket.id} className="ticket-item">
                    <div className="ticket-header">
                      <span className={`ticket-status ${ticket.status === 'AI_RESOLVED' ? 'status-ai' : ticket.status === 'FAILED' ? 'status-failed' : ''}`}>
                        {ticket.status === 'AI_RESOLVED' ? '✨ AI_RESOLVED' : ticket.status === 'FAILED' ? '❌ FAILED' : ticket.status}
                      </span>
                      <span className="ticket-date">
                        {new Date(ticket.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <h3 className="ticket-item-title">{ticket.title}</h3>
                    <div className="ticket-item-desc" style={{ whiteSpace: 'pre-wrap', maxHeight: '300px', overflowY: 'auto' }}>
                      {ticket.description}
                    </div>
                    
                    {ticket.status !== 'FAILED' && (
                      <form onSubmit={(e) => handleReply(e, ticket.id)} style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
                        <input 
                          type="text" 
                          placeholder="Reply to AI..."
                          value={replyData[ticket.id] || ''}
                          onChange={(e) => setReplyData({...replyData, [ticket.id]: e.target.value})}
                          style={{ flex: 1, padding: '8px 12px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(0,0,0,0.2)', color: 'white' }}
                          required
                        />
                        <button type="submit" disabled={loading} style={{ padding: '8px 16px', background: 'var(--primary)', color: 'white', borderRadius: '6px', border: 'none', cursor: 'pointer', fontWeight: '500' }}>
                          Send
                        </button>
                      </form>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
