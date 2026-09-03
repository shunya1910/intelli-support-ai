import { useState, useEffect } from 'react';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import './index.css';
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

function App() {
  const [tickets, setTickets] = useState([]);
  const [formData, setFormData] = useState({ title: '', description: '', severity: 'LOW', category: 'SOFTWARE' });
  const [replyData, setReplyData] = useState({});
  const [filter, setFilter] = useState({ status: 'ALL', severity: 'ALL', category: 'ALL' });
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [token, setToken] = useState(localStorage.getItem('jwt') || null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isRegistering, setIsRegistering] = useState(false);

  const userRole = token ? JSON.parse(atob(token.split('.')[1])).role : null;

  useEffect(() => {
    if (!token) return;

    fetchTickets();
    
    const socket = new SockJS(`${API_BASE_URL}/ws`);
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
      const response = await fetch(`${API_BASE_URL}/api/tickets`, { 
        cache: 'no-store',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) {
        if (response.status === 401) handleLogout();
        throw new Error('Failed to fetch tickets');
      }
      const data = await response.json();
      setTickets(data.content || []);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/tickets`, {
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
      setFormData({ title: '', description: '', severity: 'LOW', category: 'SOFTWARE' });
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
      const response = await fetch(`${API_BASE_URL}/api/tickets/${ticketId}/reply`, {
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

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginForm)
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Registration failed');
      localStorage.setItem('jwt', data.token);
      setToken(data.token);
      setError(null);
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
      const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
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
            
            <div style={{ display: 'flex', marginBottom: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
              <button 
                onClick={() => {setIsRegistering(false); setError(null);}} 
                style={{ flex: 1, padding: '10px', background: 'none', border: 'none', color: !isRegistering ? 'var(--primary)' : 'var(--text-muted)', borderBottom: !isRegistering ? '2px solid var(--primary)' : 'none', cursor: 'pointer', fontWeight: 'bold' }}
              >
                Login
              </button>
              <button 
                onClick={() => {setIsRegistering(true); setError(null);}} 
                style={{ flex: 1, padding: '10px', background: 'none', border: 'none', color: isRegistering ? 'var(--primary)' : 'var(--text-muted)', borderBottom: isRegistering ? '2px solid var(--primary)' : 'none', cursor: 'pointer', fontWeight: 'bold' }}
              >
                Register
              </button>
            </div>

            <form onSubmit={isRegistering ? handleRegister : handleLogin}>
              <div className="form-group">
                <label>Username</label>
                <input 
                  type="text" 
                  required 
                  value={loginForm.username}
                  onChange={(e) => setLoginForm({...loginForm, username: e.target.value})}
                  placeholder="Enter username"
                />
              </div>
              <div className="form-group" style={{ position: 'relative' }}>
                <label>Password</label>
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
                {loading ? 'Processing...' : (isRegistering ? 'Create Account' : 'Login Securely')}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  const handleEscalate = async (ticketId) => {
    try {
      setLoading(true);
      const res = await fetch(`http://localhost:8080/api/tickets/${ticketId}/escalate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!res.ok) throw new Error('Failed to escalate ticket');
      // The websocket will broadcast the update
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const filteredTickets = tickets.filter(ticket => {
    if (filter.status !== 'ALL' && ticket.status !== filter.status) return false;
    if (filter.severity !== 'ALL' && ticket.severity !== filter.severity) return false;
    if (filter.category !== 'ALL' && ticket.category !== filter.category) return false;
    return true;
  });

  return (
    <div className="app-container">
      <div className="background-shapes">
        <div className="shape shape-1"></div>
        <div className="shape shape-2"></div>
      </div>

      <main className="main-content">
        <header className="header" style={{ position: 'relative' }}>
          <h1 className="title">IntelliSupport <span className="highlight">AI</span></h1>
          <p className="subtitle">AI-Powered Incident Engine</p>
          <button 
            onClick={handleLogout}
            style={{ position: 'absolute', top: '20px', right: '0', background: 'rgba(239, 68, 68, 0.2)', border: '1px solid rgba(239, 68, 68, 0.5)', color: '#fca5a5', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
          >
            Logout
          </button>
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
              <div className="form-group" style={{ display: 'flex', gap: '1rem' }}>
                <div style={{ flex: 1 }}>
                  <label htmlFor="severity">Severity</label>
                  <select 
                    id="severity" 
                    value={formData.severity} 
                    onChange={(e) => setFormData({ ...formData, severity: e.target.value })}
                    style={{ width: '100%', background: 'rgba(15, 23, 42, 0.6)', border: '1px solid var(--border-light)', color: 'var(--text-main)', padding: '1rem', borderRadius: '12px' }}
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label htmlFor="category">Category</label>
                  <select 
                    id="category" 
                    value={formData.category} 
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    style={{ width: '100%', background: 'rgba(15, 23, 42, 0.6)', border: '1px solid var(--border-light)', color: 'var(--text-main)', padding: '1rem', borderRadius: '12px' }}
                  >
                    <option value="SOFTWARE">Software</option>
                    <option value="HARDWARE">Hardware</option>
                    <option value="NETWORK">Network</option>
                  </select>
                </div>
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 className="card-title" style={{ marginBottom: 0 }}>Active Tickets</h2>
              <div style={{ display: 'flex', gap: '8px' }}>
                <select value={filter.status} onChange={e => setFilter({...filter, status: e.target.value})} style={{ background: 'rgba(15,23,42,0.6)', color: 'white', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '6px', padding: '4px 8px' }}>
                  <option value="ALL">All Status</option>
                  <option value="OPEN">Open</option>
                  <option value="AI_RESOLVED">AI Resolved</option>
                  <option value="ESCALATED">Escalated</option>
                  <option value="ADMIN_REPLIED">Admin Replied</option>
                  <option value="FAILED">Failed</option>
                </select>
                <select value={filter.severity} onChange={e => setFilter({...filter, severity: e.target.value})} style={{ background: 'rgba(15,23,42,0.6)', color: 'white', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '6px', padding: '4px 8px' }}>
                  <option value="ALL">All Severity</option>
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                </select>
              </div>
            </div>
            
            <div className="ticket-list">
              {filteredTickets.length === 0 ? (
                <div className="empty-state">No tickets found matching filters.</div>
              ) : (
                filteredTickets.map(ticket => (
                  <div key={ticket.id} className="ticket-item">
                    <div className="ticket-header">
                      <span className={`ticket-status ${ticket.status === 'AI_RESOLVED' ? 'status-ai' : ticket.status === 'FAILED' ? 'status-failed' : ticket.status === 'ESCALATED' ? 'status-escalated' : ''}`}
                            style={ticket.status === 'ESCALATED' ? { background: 'rgba(245, 158, 11, 0.2)', color: '#fcd34d', border: '1px solid rgba(245, 158, 11, 0.5)' } : {}}>
                        {ticket.status === 'AI_RESOLVED' ? '✨ AI_RESOLVED' : ticket.status === 'FAILED' ? '❌ FAILED' : ticket.status === 'ESCALATED' ? '⚠️ ESCALATED' : ticket.status}
                      </span>
                      <span className="ticket-date">
                        {ticket.username} • {new Date(ticket.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <div style={{ marginBottom: '8px', display: 'flex', gap: '8px' }}>
                        <span style={{ fontSize: '0.75rem', background: 'rgba(255,255,255,0.1)', padding: '4px 8px', borderRadius: '4px' }}>{ticket.severity}</span>
                        <span style={{ fontSize: '0.75rem', background: 'rgba(255,255,255,0.1)', padding: '4px 8px', borderRadius: '4px' }}>{ticket.category}</span>
                    </div>
                    <h3 className="ticket-item-title">{ticket.title}</h3>
                    <div className="ticket-item-desc" style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '400px', overflowY: 'auto', padding: '8px 0' }}>
                      {ticket.messages && ticket.messages.length > 0 ? (
                        ticket.messages.map((msg, i) => (
                          <div key={i} style={{ 
                            alignSelf: msg.senderRole === 'USER' ? 'flex-end' : 'flex-start',
                            background: msg.senderRole === 'USER' ? 'var(--primary)' : msg.senderRole === 'ADMIN' ? 'rgba(245, 158, 11, 0.2)' : 'rgba(255,255,255,0.1)',
                            border: msg.senderRole === 'ADMIN' ? '1px solid rgba(245, 158, 11, 0.5)' : 'none',
                            padding: '10px 14px', 
                            borderRadius: '12px',
                            maxWidth: '85%',
                            fontSize: '0.9rem'
                          }}>
                            <div style={{ fontSize: '0.7rem', opacity: 0.7, marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                              {msg.senderRole} • {new Date(msg.createdAt).toLocaleTimeString()}
                            </div>
                            <div style={{ whiteSpace: 'pre-wrap' }}>
                              {msg.message}
                            </div>
                          </div>
                        ))
                      ) : (
                        <div style={{ whiteSpace: 'pre-wrap' }}>{ticket.description}</div>
                      )}
                      
                      {ticket.status === 'OPEN' && (
                        <div style={{ alignSelf: 'flex-start', background: 'rgba(255,255,255,0.05)', padding: '10px 14px', borderRadius: '12px', fontSize: '0.9rem', fontStyle: 'italic', opacity: 0.8 }}>
                          <span className="typing-dot">.</span><span className="typing-dot">.</span><span className="typing-dot">.</span> AI is analyzing your issue
                        </div>
                      )}
                    </div>
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', gap: '8px' }}>
                      {ticket.status !== 'FAILED' && (
                        <form onSubmit={(e) => handleReply(e, ticket.id)} style={{ display: 'flex', gap: '8px', flex: 1 }}>
                          <input 
                            type="text" 
                            placeholder="Type a reply..."
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
                      
                      {ticket.status !== 'ESCALATED' && ticket.status !== 'FAILED' && userRole === 'USER' && (
                        <button onClick={() => handleEscalate(ticket.id)} disabled={loading} style={{ padding: '8px 16px', background: 'rgba(245, 158, 11, 0.2)', color: '#fcd34d', border: '1px solid rgba(245, 158, 11, 0.5)', borderRadius: '6px', cursor: 'pointer', fontWeight: '500', whiteSpace: 'nowrap' }}>
                          Escalate to Admin
                        </button>
                      )}
                    </div>
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
