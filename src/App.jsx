import React, { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'

// ============================================================
// SUPABASE CONFIG
// ============================================================
const SUPABASE_URL = 'https://svrwybfxtcibqwijltwh.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN2cnd5YmZ4dGNpYnF3aWpsdHdoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA0NzUzNDcsImV4cCI6MjA4NjA1MTM0N30.gYO5vyfV0KKUc3qWbUx5_eGW7q7BB5T7NtkOBs3LQWc';

const supabase = SUPABASE_URL && SUPABASE_KEY 
  ? createClient(SUPABASE_URL, SUPABASE_KEY)
  : null;

const cloudEnabled = () => !!supabase;

// ============================================================
// DEMO DATA & SYNC
// ============================================================
function initDemoData() {
  if (!localStorage.getItem('crm_users')) {
    const users = [
      { id: 1, email: 'director@crm.com', password: 'dir123', name: 'Director', role: 'director' },
      { id: 2, email: 'agent@crm.com', password: 'agent123', name: 'Agent Demo', role: 'agent' }
    ];
    localStorage.setItem('crm_users', JSON.stringify(users));
    localStorage.setItem('crm_customers', JSON.stringify([]));
  }
}

async function syncToCloud() {
  if (!cloudEnabled()) return;
  
  try {
    const { data: existing, error } = await supabase
      .from('users')
      .select('*');
    
    if (error) {
      console.warn('Supabase sync error:', error);
      return;
    }
    
    if (existing && existing.length > 0) {
      localStorage.setItem('crm_users', JSON.stringify(existing));
    } else {
      const users = JSON.parse(localStorage.getItem('crm_users') || '[]');
      for (const u of users) {
        await supabase.from('users').insert(u);
      }
    }
  } catch (e) {
    console.warn('Sync failed:', e);
  }
}

async function login(email, password) {
  let users = null;
  
  if (cloudEnabled()) {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email);
    
    if (!error && data) {
      users = data;
    }
  }
  
  if (!users || users.length === 0) {
    users = JSON.parse(localStorage.getItem('crm_users') || '[]');
  }
  
  return users.find(u => u.email === email && u.password === password) || null;
}

function exportBackupJSON() {
  const data = {
    customers: JSON.parse(localStorage.getItem('crm_customers') || '[]'),
    users: JSON.parse(localStorage.getItem('crm_users') || '[]'),
    exportTime: new Date().toISOString()
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `energy_crm_backup_${new Date().toISOString().slice(0,10)}.json`;
  document.body.appendChild(link);
  link.click();
  setTimeout(() => { document.body.removeChild(link); URL.revokeObjectURL(url); }, 200);
}

// ============================================================
// LOGIN COMPONENT
// ============================================================
function LoginPage({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    const user = await login(email, password);
    setLoading(false);
    if (user) {
      onLogin(user);
    } else {
      alert('Wrong credentials');
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f9fafb', padding: '1rem' }}>
      <div style={{ width: '100%', maxWidth: '28rem' }}>
        <div style={{ backgroundColor: 'white', borderRadius: '1rem', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', padding: '2rem' }}>
          <h1 style={{ fontSize: '1.875rem', fontWeight: 'bold', color: '#111827', marginBottom: '1.5rem' }}>Energy CRM</h1>
          
          <div style={{ backgroundColor: '#eff6ff', padding: '0.75rem', borderRadius: '0.5rem', marginBottom: '1rem', fontSize: '0.75rem' }}>
            <div>Director: director@crm.com / dir123</div>
            <div>Agent: agent@crm.com / agent123</div>
          </div>

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem' }}>Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{ width: '100%', padding: '0.5rem 1rem', border: '1px solid #d1d5db', borderRadius: '0.5rem', fontSize: '16px' }}
                required
              />
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem' }}>Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{ width: '100%', padding: '0.5rem 1rem', border: '1px solid #d1d5db', borderRadius: '0.5rem', fontSize: '16px' }}
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{ 
                width: '100%', 
                backgroundColor: '#0f172a', 
                color: 'white', 
                padding: '0.75rem', 
                borderRadius: '0.5rem', 
                fontWeight: '600',
                border: 'none',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.5 : 1
              }}
            >
              {loading ? 'Loading...' : 'Login'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// DASHBOARD COMPONENT
// ============================================================
function Dashboard({ user, onLogout, cloudStatus, onExport }) {
  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f9fafb', padding: '2rem' }}>
      <div style={{ maxWidth: '64rem', margin: '0 auto' }}>
        <div style={{ 
          background: 'linear-gradient(to right, #0f172a, #334155)', 
          borderRadius: '1rem', 
          padding: '2rem', 
          color: 'white', 
          marginBottom: '1.5rem' 
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h1 style={{ fontSize: '1.875rem', fontWeight: 'bold', margin: 0 }}>Welcome, {user.name}</h1>
              <p style={{ color: '#cbd5e1', marginTop: '0.5rem' }}>{user.role}</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ 
                padding: '0.25rem 0.75rem', 
                borderRadius: '9999px', 
                fontSize: '0.75rem', 
                fontWeight: '500',
                backgroundColor: cloudStatus ? '#10b981' : '#f59e0b'
              }}>
                {cloudStatus ? '✓ Sync' : '⚠ Local'}
              </span>
              <button
                onClick={onExport}
                style={{ 
                  padding: '0.5rem', 
                  backgroundColor: 'rgba(255,255,255,0.1)', 
                  border: 'none',
                  borderRadius: '0.5rem',
                  color: 'white',
                  cursor: 'pointer'
                }}
                title="Export JSON"
              >
                ⬇
              </button>
            </div>
          </div>
        </div>

        <div style={{ backgroundColor: 'white', borderRadius: '1rem', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', padding: '2rem' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1rem' }}>Dashboard</h2>
          <p style={{ color: '#6b7280', marginBottom: '1.5rem' }}>System is running</p>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
            <div style={{ backgroundColor: '#eff6ff', padding: '1rem', borderRadius: '0.5rem' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#2563eb' }}>0</div>
              <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>Total Customers</div>
            </div>
            <div style={{ backgroundColor: '#f0fdf4', padding: '1rem', borderRadius: '0.5rem' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#16a34a' }}>0</div>
              <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>Active</div>
            </div>
            <div style={{ backgroundColor: '#fff7ed', padding: '1rem', borderRadius: '0.5rem' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#ea580c' }}>0</div>
              <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>Pending</div>
            </div>
          </div>

          <button
            onClick={onLogout}
            style={{ 
              backgroundColor: '#e5e7eb', 
              color: '#374151', 
              padding: '0.5rem 1.5rem', 
              borderRadius: '0.5rem',
              border: 'none',
              cursor: 'pointer',
              fontWeight: '500'
            }}
          >
            Logout
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// MAIN APP
// ============================================================
export default function App() {
  const [user, setUser] = useState(null);
  const [cloudStatus, setCloudStatus] = useState(cloudEnabled());

  useEffect(() => {
    initDemoData();
    if (cloudEnabled()) {
      syncToCloud().then(() => setCloudStatus(true));
    }
  }, []);

  if (!user) {
    return <LoginPage onLogin={setUser} />;
  }

  return (
    <Dashboard 
      user={user} 
      onLogout={() => setUser(null)} 
      cloudStatus={cloudStatus}
      onExport={exportBackupJSON}
    />
  );
}