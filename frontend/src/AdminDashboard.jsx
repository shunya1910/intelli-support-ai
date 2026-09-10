import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Users, Ticket, AlertTriangle, CheckCircle, Clock } from 'lucide-react';
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

const AdminDashboard = ({ token, onLogout, onSwitchView }) => {
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [statsRes, usersRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/admin/stats`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${API_BASE_URL}/api/admin/users`, { headers: { 'Authorization': `Bearer ${token}` } })
      ]);

      if (!statsRes.ok || !usersRes.ok) throw new Error('Failed to fetch admin data');

      const statsData = await statsRes.json();
      const usersData = await usersRes.json();

      setStats(statsData);
      setUsers(usersData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = async (userId, newRole) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/users/${userId}/role`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ role: newRole })
      });

      if (!res.ok) throw new Error('Failed to update role');
      fetchData(); // Refresh list
    } catch (err) {
      alert(err.message);
    }
  };

  if (loading) return <div style={{ color: 'white', textAlign: 'center', marginTop: '50px' }}>Loading Admin Dashboard...</div>;
  if (error) return <div style={{ color: 'red', textAlign: 'center', marginTop: '50px' }}>Error: {error}</div>;

  const COLORS = ['#0ea5e9', '#22c55e', '#f59e0b', '#ef4444'];
  const statusData = [
    { name: 'Open', value: stats.openTickets },
    { name: 'Resolved', value: stats.resolvedTickets },
    { name: 'Escalated', value: stats.escalatedTickets },
  ];

  return (
    <div className="app-container">
      <div className="background-shapes">
        <div className="shape shape-1"></div>
        <div className="shape shape-2"></div>
      </div>

      <main className="main-content fade-in" style={{ maxWidth: '1200px' }}>
        <header className="header" style={{ position: 'relative' }}>
          <h1 className="title">Admin <span className="highlight">Command Center</span></h1>
          <p className="subtitle">System Overview & User Management</p>
          <div style={{ position: 'absolute', top: '20px', right: '0', display: 'flex', gap: '10px' }}>
            <button 
              onClick={onSwitchView}
              style={{ background: 'var(--primary)', border: 'none', color: 'white', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
            >
              View Tickets
            </button>
            <button 
              onClick={onLogout}
              style={{ background: 'rgba(239, 68, 68, 0.2)', border: '1px solid rgba(239, 68, 68, 0.5)', color: '#fca5a5', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
            >
              Logout
            </button>
          </div>
        </header>

        {/* 4 Stat Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', marginBottom: '20px' }}>
          <div className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: '15px', padding: '15px' }}>
            <div style={{ background: 'rgba(14, 165, 233, 0.2)', padding: '12px', borderRadius: '12px', color: '#38bdf8' }}><Ticket size={24}/></div>
            <div>
              <h3 style={{ margin: '0 0 5px 0', color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Total Tickets</h3>
              <p style={{ fontSize: '1.5rem', fontWeight: 'bold', margin: 0 }}>{stats.totalTickets}</p>
            </div>
          </div>
          <div className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: '15px', padding: '15px' }}>
            <div style={{ background: 'rgba(34, 197, 94, 0.2)', padding: '12px', borderRadius: '12px', color: '#4ade80' }}><CheckCircle size={24}/></div>
            <div>
              <h3 style={{ margin: '0 0 5px 0', color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Resolved</h3>
              <p style={{ fontSize: '1.5rem', fontWeight: 'bold', margin: 0 }}>{stats.resolvedTickets}</p>
            </div>
          </div>
          <div className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: '15px', padding: '15px' }}>
            <div style={{ background: 'rgba(245, 158, 11, 0.2)', padding: '12px', borderRadius: '12px', color: '#fbbf24' }}><AlertTriangle size={24}/></div>
            <div>
              <h3 style={{ margin: '0 0 5px 0', color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Escalated</h3>
              <p style={{ fontSize: '1.5rem', fontWeight: 'bold', margin: 0 }}>{stats.escalatedTickets}</p>
            </div>
          </div>
          <div className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: '15px', padding: '15px' }}>
            <div style={{ background: 'rgba(168, 85, 247, 0.2)', padding: '12px', borderRadius: '12px', color: '#c084fc' }}><Users size={24}/></div>
            <div>
              <h3 style={{ margin: '0 0 5px 0', color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Total Users</h3>
              <p style={{ fontSize: '1.5rem', fontWeight: 'bold', margin: 0 }}>{stats.totalUsers}</p>
            </div>
          </div>
        </div>

        {/* Charts & Graphs Row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px', marginBottom: '20px' }}>
          <div className="glass-card" style={{ height: '260px', display: 'flex', flexDirection: 'column', padding: '15px' }}>
            <h3 className="card-title" style={{ fontSize: '1.1rem', marginBottom: '10px' }}>Ticket Status Distribution</h3>
            <div style={{ flex: 1, minHeight: 0 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={statusData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={5} dataKey="value">
                    {statusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: 'rgba(15,23,42,0.9)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: 'white', padding: '5px' }} itemStyle={{ color: 'white', fontSize: '0.8rem' }} />
                  <Legend verticalAlign="bottom" height={20} iconSize={10} wrapperStyle={{ fontSize: '0.8rem' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="glass-card" style={{ height: '260px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '15px' }}>
             <h3 className="card-title" style={{ alignSelf: 'flex-start', fontSize: '1.1rem', margin: 0 }}>System Alerts</h3>
             <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flexDirection: 'column', color: '#ef4444', flex: 1 }}>
                <div style={{ background: 'rgba(239, 68, 68, 0.1)', padding: '15px', borderRadius: '50%', marginBottom: '10px' }}>
                  <AlertTriangle size={50} />
                </div>
                <div style={{ fontSize: '2.5rem', fontWeight: '900', lineHeight: 1 }}>{stats.highSeverityTickets}</div>
                <div style={{ color: '#fca5a5', marginTop: '5px', fontSize: '0.9rem', fontWeight: '500' }}>High Severity Tickets Require Attention</div>
             </div>
          </div>
        </div>

        {/* User Management Table */}
        <div className="glass-card" style={{ padding: '15px' }}>
          <h3 className="card-title" style={{ fontSize: '1.1rem', marginBottom: '10px' }}>User Management</h3>
          <div style={{ overflowX: 'auto', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', padding: '1px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.05)' }}>
                  <th style={{ padding: '10px 15px', fontWeight: '600', color: 'var(--text-muted)', fontSize: '0.9rem' }}>Email / Username</th>
                  <th style={{ padding: '10px 15px', fontWeight: '600', color: 'var(--text-muted)', fontSize: '0.9rem' }}>Current Role</th>
                  <th style={{ padding: '10px 15px', fontWeight: '600', color: 'var(--text-muted)', textAlign: 'right', fontSize: '0.9rem' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user, idx) => (
                  <tr key={user.id} style={{ borderTop: '1px solid rgba(255,255,255,0.05)', background: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)' }}>
                    <td style={{ padding: '10px 15px', fontWeight: '500', fontSize: '0.9rem' }}>{user.username}</td>
                    <td style={{ padding: '10px 15px' }}>
                      <span style={{ 
                        background: user.role === 'ADMIN' ? 'rgba(168, 85, 247, 0.2)' : 'rgba(14, 165, 233, 0.2)', 
                        color: user.role === 'ADMIN' ? '#c084fc' : '#38bdf8',
                        border: user.role === 'ADMIN' ? '1px solid rgba(168, 85, 247, 0.5)' : '1px solid rgba(14, 165, 233, 0.5)',
                        padding: '4px 8px', borderRadius: '12px', fontSize: '0.7rem', fontWeight: 'bold', letterSpacing: '0.5px'
                      }}>
                        {user.role}
                      </span>
                    </td>
                    <td style={{ padding: '10px 15px', textAlign: 'right' }}>
                      {user.role === 'USER' ? (
                         <button onClick={() => handleRoleChange(user.id, 'ADMIN')} style={{ background: 'var(--primary)', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.8rem', transition: 'all 0.2s' }} onMouseOver={e => e.target.style.background = '#4f46e5'} onMouseOut={e => e.target.style.background = 'var(--primary)'}>
                           Promote to Admin
                         </button>
                      ) : (
                         <button onClick={() => handleRoleChange(user.id, 'USER')} style={{ background: 'transparent', color: '#fca5a5', border: '1px solid rgba(239, 68, 68, 0.5)', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.8rem', transition: 'all 0.2s' }} onMouseOver={e => e.target.style.background = 'rgba(239, 68, 68, 0.1)'} onMouseOut={e => e.target.style.background = 'transparent'}>
                           Demote to User
                         </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
};

export default AdminDashboard;
