import React, { useState, useEffect } from 'react'

// SUPABASE CONFIG
const SUPABASE_URL = 'https://svrwybfxtcibqwijltwh.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN2cnd5YmZ4dGNpYnF3aWpsdHdoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzg5NTI0MDYsImV4cCI6MjA1NDUyODQwNn0.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN2cnd5YmZ4dGNpYnF3aWpsdHdoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzg5NTI0MDYsImV4cCI6MjA1NDUyODQwNn0';

const cloudEnabled = () => !!(SUPABASE_URL && SUPABASE_KEY);

export default function App() {
  const [status, setStatus] = useState('Checking...');
  const [color, setColor] = useState('orange');
  const [details, setDetails] = useState([]);

  useEffect(() => {
    async function testSupabase() {
      const logs = [];
      
      // Test 1: Check credentials
      logs.push(`✓ URL: ${SUPABASE_URL ? 'SET' : 'MISSING'}`);
      logs.push(`✓ Key: ${SUPABASE_KEY ? SUPABASE_KEY.slice(0, 20) + '...' : 'MISSING'}`);
      logs.push(`✓ Cloud enabled: ${cloudEnabled() ? 'YES' : 'NO'}`);
      
      if (!cloudEnabled()) {
        setStatus('❌ Credentials Missing');
        setColor('red');
        setDetails(logs);
        return;
      }

      // Test 2: Try to fetch from Supabase
      try {
        logs.push('→ Attempting Supabase connection...');
        const res = await fetch(`${SUPABASE_URL}/rest/v1/users`, {
          method: 'GET',
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json'
          }
        });
        
        logs.push(`→ Response status: ${res.status}`);
        
        if (res.ok) {
          const data = await res.json();
          logs.push(`✅ SUCCESS! Got ${data.length} users`);
          setStatus('✅ Supabase Connected!');
          setColor('green');
        } else {
          const text = await res.text();
          logs.push(`❌ Error: ${text}`);
          setStatus('❌ Supabase Error');
          setColor('red');
        }
      } catch (err) {
        logs.push(`❌ Network error: ${err.message}`);
        setStatus('❌ Network Error');
        setColor('red');
      }
      
      setDetails(logs);
    }

    testSupabase();
  }, []);

  return (
    <div style={{ 
      minHeight: '100vh', 
      padding: '40px',
      fontFamily: 'monospace',
      backgroundColor: '#1a1a1a',
      color: '#fff'
    }}>
      <h1 style={{ fontSize: '32px', marginBottom: '20px' }}>
        🔧 Energy CRM - Debug Mode
      </h1>
      
      <div style={{
        padding: '20px',
        backgroundColor: color === 'green' ? '#064e3b' : color === 'red' ? '#7f1d1d' : '#78350f',
        border: `2px solid ${color}`,
        borderRadius: '8px',
        marginBottom: '20px'
      }}>
        <h2 style={{ fontSize: '24px', margin: 0 }}>{status}</h2>
      </div>

      <div style={{
        backgroundColor: '#262626',
        padding: '20px',
        borderRadius: '8px',
        border: '1px solid #404040'
      }}>
        <h3 style={{ marginTop: 0 }}>Debug Log:</h3>
        {details.map((log, i) => (
          <div key={i} style={{ 
            padding: '4px 0',
            fontFamily: 'monospace',
            fontSize: '14px'
          }}>
            {log}
          </div>
        ))}
      </div>

      <div style={{ marginTop: '20px', padding: '20px', backgroundColor: '#262626', borderRadius: '8px' }}>
        <h3>What to do:</h3>
        <ul style={{ lineHeight: '1.8' }}>
          <li>If ✅ GREEN: Supabase works! Replace with real App.jsx</li>
          <li>If ❌ RED: Check the error message above</li>
          <li>If "CORS error": Add Netlify URL to Supabase settings</li>
          <li>If "Network error": Check internet connection</li>
        </ul>
      </div>
    </div>
  );
}
