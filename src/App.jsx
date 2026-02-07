import React, { useState, useEffect, useRef } from 'react';
import { Download, Plus, Trash2, Copy, Check, MessageSquare, X, Edit2, Filter, User, Users, Grid, FileText } from 'lucide-react';
import { exportToExcel } from './utils/exportExcel';
// ============================================================
// SUPABASE CONFIG — βάλε τις τιμές από το dashboard
// https://supabase.com/dashboard/project/[PROJECT_ID]/settings/api
// ============================================================
const SUPABASE_URL = '';   // π.χ. https://abcdefghijk.supabase.co
const SUPABASE_KEY = '';   // anon key

const cloudEnabled = () => !!(SUPABASE_URL && SUPABASE_KEY);

// ─── Generic Supabase fetch helper ───────────────────────────
const sb = async (path, method = 'GET', body = null) => {
  if (!cloudEnabled()) return null;
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
      method,
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      ...(body ? { body: JSON.stringify(body) } : {})
    });
    if (!res.ok) { console.warn('Supabase error', res.status, await res.text()); return null; }
    const text = await res.text();
    return text ? JSON.parse(text) : [];
  } catch (e) { console.warn('Supabase fetch failed:', e); return null; }
};

// ─── Local-only helpers (import/export JSON) ─────────────────
const exportBackupJSON = () => {
  const data = {
    customers: JSON.parse(localStorage.getItem('crm_customers') || '[]'),
    users: JSON.parse(localStorage.getItem('crm_users') || '[]'),
    customFields: JSON.parse(localStorage.getItem('crm_custom_fields') || '[]'),
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
};

const importBackupJSON = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        if (data.customers) localStorage.setItem('crm_customers', JSON.stringify(data.customers));
        if (data.users) localStorage.setItem('crm_users', JSON.stringify(data.users));
        if (data.customFields) localStorage.setItem('crm_custom_fields', JSON.stringify(data.customFields));
        resolve(data);
      } catch (err) { reject(err); }
    };
    reader.readAsText(file);
  });
};

// Provider list
const PROVIDERS = [
  'ΔΕΗ',
  'Protergia',
  'Enerwave',
  'NRG',
  'Heron',
  'Volton',
  'ZeniΘ',
  'Φυσικό Αέριο Ελλάδος',
  'We Energy',
  'Eunice Energy',
  'Ελινόιλ Ρεύμα',
  'Blue Power Energy',
  'Volterra',
  'EFA Energy'
];

// File upload categories
const FILE_CATEGORIES = [
  { id: 'identity', label: 'Ταυτότητα', required: true },
  { id: 'bill', label: 'Λογαριασμός', required: true },
  { id: 'meter', label: 'Ένδειξη Μετρητή', required: true },
  { id: 'other1', label: 'Άλλο 1', required: false },
  { id: 'other2', label: 'Άλλο 2', required: false },
  { id: 'other3', label: 'Άλλο 3', required: false },
  { id: 'other4', label: 'Άλλο 4', required: false },
  { id: 'other5', label: 'Άλλο 5', required: false },
  { id: 'other6', label: 'Άλλο 6', required: false },
  { id: 'other7', label: 'Άλλο 7', required: false }
];

// Email notification simulator
const sendEmailNotification = (to, subject, message) => {
  console.log(`📧 Email sent to ${to}`);
  console.log(`Subject: ${subject}`);
  console.log(`Message: ${message}`);
  // In production, this would call your backend email service
};

// ─── API: Supabase first → localStorage fallback ────────────
const API = {

  // ── LOGIN ──
  async login(email, password) {
    return new Promise(async (resolve) => {
      setTimeout(async () => {
        let users = null;
        if (cloudEnabled()) {
          users = await sb(`users?email=eq.${encodeURIComponent(email)}`);
        }
        if (!users || users.length === 0) {
          // fallback to localStorage
          users = JSON.parse(localStorage.getItem('crm_users') || '[]').filter(u => u.email === email);
        }
        const user = (users || []).find(u => u.password === password);
        resolve(user || null);
      }, 500);
    });
  },

  async googleLogin() {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({ id: Date.now(), email: 'demo@example.com', name: 'Demo User', role: 'agent' });
      }, 500);
    });
  },

  // ── CUSTOMERS ──
  async getCustomers(userId, userRole) {
    let customers;
    if (cloudEnabled()) {
      const result = await sb('customers');
      if (result && result.length >= 0) {
        customers = result;
        localStorage.setItem('crm_customers', JSON.stringify(customers)); // update cache
      } else {
        customers = JSON.parse(localStorage.getItem('crm_customers') || '[]');
      }
    } else {
      customers = JSON.parse(localStorage.getItem('crm_customers') || '[]');
    }

    const users = JSON.parse(localStorage.getItem('crm_users') || '[]');
    if (userRole === 'agent') return customers.filter(c => c.agentId === userId);
    if (userRole === 'super_user') {
      const agentIds = users.filter(u => u.role === 'agent' && u.superUserId === userId).map(u => u.id);
      return customers.filter(c => agentIds.includes(c.agentId));
    }
    return customers; // director / back_office see all
  },

  async saveCustomer(customer) {
    const newCustomer = {
      ...customer,
      id: Date.now(),
      commentHistory: [],
      files: customer.files || {},
      submissionDate: new Date().toISOString().split('T')[0],
      status: 'σε αναμονή'
    };

    // 1. Push to Supabase
    if (cloudEnabled()) { await sb('customers', 'POST', newCustomer); }

    // 2. Update local cache
    const customers = JSON.parse(localStorage.getItem('crm_customers') || '[]');
    customers.push(newCustomer);
    localStorage.setItem('crm_customers', JSON.stringify(customers));

    // 3. Notifications
    const users = JSON.parse(localStorage.getItem('crm_users') || '[]');
    users.filter(u => u.role === 'super_user').forEach(su => {
      sendEmailNotification(su.email, 'Νέα Καταχώρηση Πελάτη',
        `Ο ${customer.agentName} δημιούργησε νέα καταχώρηση για τον πελάτη ${customer.name} ${customer.surname}`);
    });
    return newCustomer;
  },

  async updateCustomer(id, updates) {
    const customers = JSON.parse(localStorage.getItem('crm_customers') || '[]');
    const index = customers.findIndex(c => c.id === id);
    if (index === -1) return null;

    const oldStatus = customers[index].status;
    customers[index] = { ...customers[index], ...updates };
    if (updates.status === 'ενεργό' && !customers[index].activationDate) {
      customers[index].activationDate = new Date().toISOString().split('T')[0];
    }
    if (updates.contract && !customers[index].contractLink) {
      customers[index].contractLink = `https://crm.energy.gr/contracts/${id}/${Date.now()}`;
    }

    // 1. Push to Supabase
    if (cloudEnabled()) { await sb(`customers?id=eq.${id}`, 'PATCH', customers[index]); }

    // 2. Update local cache
    localStorage.setItem('crm_customers', JSON.stringify(customers));

    // 3. Notifications on status change
    if (updates.status && oldStatus !== updates.status) {
      const users = JSON.parse(localStorage.getItem('crm_users') || '[]');
      const agent = users.find(u => u.id === customers[index].agentId);
      if (agent) sendEmailNotification(agent.email, 'Αλλαγή Κατάστασης Αίτησης',
        `Η αίτηση για τον πελάτη ${customers[index].name} ${customers[index].surname} άλλαξε σε: ${updates.status}`);
      users.filter(u => u.role === 'back_office').forEach(bo =>
        sendEmailNotification(bo.email, 'Αλλαγή Κατάστασης Αίτησης',
          `Η αίτηση για τον πελάτη ${customers[index].name} ${customers[index].surname} άλλαξε σε: ${updates.status}`));
    }
    return customers[index];
  },

  async deleteCustomer(id) {
    if (cloudEnabled()) { await sb(`customers?id=eq.${id}`, 'DELETE'); }
    const customers = JSON.parse(localStorage.getItem('crm_customers') || '[]').filter(c => c.id !== id);
    localStorage.setItem('crm_customers', JSON.stringify(customers));
    return true;
  },

  async addComment(customerId, comment, userName, userRole) {
    const customers = JSON.parse(localStorage.getItem('crm_customers') || '[]');
    const index = customers.findIndex(c => c.id === customerId);
    if (index === -1) return null;

    if (!customers[index].commentHistory) customers[index].commentHistory = [];
    customers[index].commentHistory.push({
      id: Date.now(), text: comment, author: userName, role: userRole, timestamp: new Date().toISOString()
    });

    // Sync full customer to Supabase
    if (cloudEnabled()) { await sb(`customers?id=eq.${customerId}`, 'PATCH', customers[index]); }
    localStorage.setItem('crm_customers', JSON.stringify(customers));

    const users = JSON.parse(localStorage.getItem('crm_users') || '[]');
    const agent = users.find(u => u.id === customers[index].agentId);
    if (userRole === 'back_office' && agent)
      sendEmailNotification(agent.email, 'Νέο Σχόλιο στην Αίτησή σας', `Νέο σχόλιο από ${userName}: ${comment}`);
    if (userRole === 'agent')
      users.filter(u => u.role === 'back_office').forEach(bo =>
        sendEmailNotification(bo.email, 'Νέο Σχόλιο από Agent',
          `Νέο σχόλιο από ${userName} για τον πελάτη ${customers[index].name} ${customers[index].surname}: ${comment}`));
    return customers[index];
  },

  // ── USERS ──
  async getUsers() {
    if (cloudEnabled()) {
      const result = await sb('users');
      if (result && result.length >= 0) {
        localStorage.setItem('crm_users', JSON.stringify(result));
        return result;
      }
    }
    return JSON.parse(localStorage.getItem('crm_users') || '[]');
  },

  async getUsersByHierarchy(userId, userRole) {
    const users = await this.getUsers();
    if (userRole === 'director' || userRole === 'back_office') return users;
    if (userRole === 'super_user') return users.filter(u => u.superUserId === userId || u.id === userId);
    return [];
  },

  async createUser(user, creatorId, creatorRole) {
    const users = JSON.parse(localStorage.getItem('crm_users') || '[]');
    const newUser = { ...user, id: Date.now(), assignedAgents: [], createdBy: creatorId };

    if ((creatorRole === 'director' || creatorRole === 'back_office') && user.role === 'super_user') {
      newUser.superUserId = null;
    } else if ((creatorRole === 'director' || creatorRole === 'back_office') && (user.role === 'agent' || user.role === 'back_office')) {
      newUser.superUserId = user.superUserId || null;
    } else if (creatorRole === 'super_user') {
      newUser.superUserId = creatorId;
    }

    if (cloudEnabled()) { await sb('users', 'POST', newUser); }
    users.push(newUser);
    localStorage.setItem('crm_users', JSON.stringify(users));
    return newUser;
  },

  async deleteUser(id) {
    if (cloudEnabled()) { await sb(`users?id=eq.${id}`, 'DELETE'); }
    const users = JSON.parse(localStorage.getItem('crm_users') || '[]').filter(u => u.id !== id);
    localStorage.setItem('crm_users', JSON.stringify(users));
    return true;
  },

  async updateUser(id, updates) {
    const users = JSON.parse(localStorage.getItem('crm_users') || '[]');
    const index = users.findIndex(u => u.id === id);
    if (index === -1) return null;
    users[index] = { ...users[index], ...updates };
    if (cloudEnabled()) { await sb(`users?id=eq.${id}`, 'PATCH', users[index]); }
    localStorage.setItem('crm_users', JSON.stringify(users));
    return users[index];
  },

  // ── CUSTOM FIELDS ──
  async getCustomFields() {
    if (cloudEnabled()) {
      const result = await sb('custom_fields');
      if (result && result.length >= 0) {
        localStorage.setItem('crm_custom_fields', JSON.stringify(result));
        return result;
      }
    }
    return JSON.parse(localStorage.getItem('crm_custom_fields') || '[]');
  },

  async addCustomField(field) {
    const newField = { ...field, id: Date.now() };
    if (cloudEnabled()) { await sb('custom_fields', 'POST', newField); }
    const fields = JSON.parse(localStorage.getItem('crm_custom_fields') || '[]');
    fields.push(newField);
    localStorage.setItem('crm_custom_fields', JSON.stringify(fields));
    return newField;
  },

  async deleteCustomField(id) {
    if (cloudEnabled()) { await sb(`custom_fields?id=eq.${id}`, 'DELETE'); }
    const fields = JSON.parse(localStorage.getItem('crm_custom_fields') || '[]').filter(f => f.id !== id);
    localStorage.setItem('crm_custom_fields', JSON.stringify(fields));
    return true;
  }
};

// ─── On first load: seed Supabase if empty ───────────────────
const syncDemoDataToCloud = async () => {
  if (!cloudEnabled()) return;
  const existing = await sb('users');
  if (existing && existing.length > 0) {
    // Cloud has data → push it to localStorage (source of truth is cloud)
    localStorage.setItem('crm_users', JSON.stringify(existing));
    const customers = await sb('customers');
    if (customers) localStorage.setItem('crm_customers', JSON.stringify(customers));
    const fields = await sb('custom_fields');
    if (fields) localStorage.setItem('crm_custom_fields', JSON.stringify(fields));
  } else {
    // Cloud is empty → seed from localStorage
    const users = JSON.parse(localStorage.getItem('crm_users') || '[]');
    for (const u of users) { await sb('users', 'POST', u); }
    const customers = JSON.parse(localStorage.getItem('crm_customers') || '[]');
    for (const c of customers) { await sb('customers', 'POST', c); }
    const fields = JSON.parse(localStorage.getItem('crm_custom_fields') || '[]');
    for (const f of fields) { await sb('custom_fields', 'POST', f); }
  }
};

// Initialize demo data (localStorage only — cloud sync runs after)
const initializeDemoData = () => {
  if (!localStorage.getItem('crm_users')) {
    const demoUsers = [
      { id: 1, email: 'director@crm.com', password: 'dir123', name: 'Director Admin', role: 'director', createdBy: null },
      { id: 2, email: 'superuser@crm.com', password: 'super123', name: 'George Tzagarakis', role: 'super_user', createdBy: 1, assignedAgents: [] },
      { id: 3, email: 'backoffice@crm.com', password: 'back123', name: 'Back Office User', role: 'back_office', createdBy: 1, superUserId: null },
      { id: 4, email: 'agent@crm.com', password: 'agent123', name: 'Agent Demo', role: 'agent', createdBy: 2, superUserId: 2 }
    ];
    localStorage.setItem('crm_users', JSON.stringify(demoUsers));
  }
  if (!localStorage.getItem('crm_customers')) localStorage.setItem('crm_customers', JSON.stringify([]));
  if (!localStorage.getItem('crm_custom_fields')) localStorage.setItem('crm_custom_fields', JSON.stringify([]));
};

// Login Component
const LoginPage = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    const user = await API.login(email, password);
    
    if (user) {
      onLogin(user);
    } else {
      setError('Λάθος email ή κωδικός');
    }
    setLoading(false);
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    const user = await API.googleLogin();
    onLogin(user);
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-white p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-slate-900 rounded-2xl mb-4">
            <svg className="w-10 h-10 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
            </svg>
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Energy CRM</h1>
          <p className="text-gray-500">Διαχείριση πελατών ενέργειας</p>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-3xl shadow-sm border border-gray-200 p-8">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Σύνδεση</h2>
            <p className="text-gray-500 text-sm">Συνδεθείτε με email ή Google</p>
          </div>

          {/* Demo credentials info */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6 text-xs">
            <strong className="text-blue-900">Demo Credentials:</strong><br/>
            <span className="text-blue-800">
              Director: director@crm.com / dir123<br/>
              Super User: superuser@crm.com / super123<br/>
              Back Office: backoffice@crm.com / back123<br/>
              Agent: agent@crm.com / agent123
            </span>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4 text-red-700 text-sm">
              {error}
            </div>
          )}

          {/* Google Login Button */}
          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full bg-white border-2 border-gray-200 text-gray-700 py-3 rounded-xl font-medium hover:bg-gray-50 transition-all flex items-center justify-center gap-3 mb-6"
          >
            <svg width="20" height="20" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Σύνδεση με Google
          </button>

          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-white text-gray-500">Ή ΜΕ EMAIL</span>
            </div>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-gray-700 text-sm font-medium mb-2">Email</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
                  </svg>
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none transition-all"
                  placeholder="email@example.com"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-gray-700 text-sm font-medium mb-2">Κωδικός</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none transition-all"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-slate-900 text-white py-3 rounded-xl font-semibold hover:bg-slate-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Σύνδεση...' : 'Σύνδεση'}
            </button>
          </form>
        </div>

        <p className="text-center text-gray-400 text-sm mt-6">
          © 2024 Energy CRM. Με επιφύλαξη παντός δικαιώματος.
        </p>
      </div>
    </div>
  );
};

// File Upload Component
const FileUploadSection = ({ files, onFilesChange }) => {
  const handleFileChange = (categoryId, event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        onFilesChange({
          ...files,
          [categoryId]: {
            name: file.name,
            data: reader.result,
            uploadedAt: new Date().toISOString()
          }
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveFile = (categoryId) => {
    const newFiles = { ...files };
    delete newFiles[categoryId];
    onFilesChange(newFiles);
  };

  const handleDownload = (categoryId) => {
    const file = files[categoryId];
    if (file) {
      const link = document.createElement('a');
      link.href = file.data;
      link.download = file.name;
      link.click();
    }
  };

  return (
    <div>
      <h3 className="text-lg font-semibold text-gray-800 mb-4 pb-2 border-b border-gray-200">
        Αρχεία Πελάτη (μέχρι 10)
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {FILE_CATEGORIES.map(category => (
          <div key={category.id} className="border-2 border-gray-200 rounded-xl p-4">
            <label className="block text-gray-700 font-medium mb-2 text-sm">
              {category.label}
              {category.required && <span className="text-red-500 ml-1">*</span>}
            </label>
            
            {files[category.id] ? (
              <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg p-3">
                <svg className="w-5 h-5 text-green-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-sm text-gray-700 flex-1 truncate">{files[category.id].name}</span>
                <button
                  type="button"
                  onClick={() => handleDownload(category.id)}
                  className="p-1 text-blue-600 hover:bg-blue-100 rounded transition-colors"
                  title="Download"
                >
                  <Download size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => handleRemoveFile(category.id)}
                  className="p-1 text-red-600 hover:bg-red-100 rounded transition-colors"
                  title="Remove"
                >
                  <X size={16} />
                </button>
              </div>
            ) : (
              <label className="flex items-center justify-center gap-2 border-2 border-dashed border-gray-300 rounded-lg p-3 cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-all">
                <Plus size={18} className="text-gray-400" />
                <span className="text-sm text-gray-500">Επιλέξτε αρχείο</span>
                <input
                  type="file"
                  onChange={(e) => handleFileChange(category.id, e)}
                  className="hidden"
                  accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                />
              </label>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

// Signature Modal Component
const SignatureModal = ({ onSave, onClose }) => {
  const canvasRef = React.useRef(null);
  const [isDrawing, setIsDrawing] = React.useState(false);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
    }
  }, []);

  const startDrawing = (e) => {
    setIsDrawing(true);
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX || e.touches?.[0]?.clientX) - rect.left;
    const y = (e.clientY || e.touches?.[0]?.clientY) - rect.top;
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX || e.touches?.[0]?.clientX) - rect.left;
    const y = (e.clientY || e.touches?.[0]?.clientY) - rect.top;
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const saveSignature = () => {
    const canvas = canvasRef.current;
    const signatureData = canvas.toDataURL();
    onSave(signatureData);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl p-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Υπογραφή Πελάτη</h2>
        
        <div className="mb-6">
          <div className="border-4 border-gray-300 rounded-xl overflow-hidden bg-white">
            <canvas
              ref={canvasRef}
              width={600}
              height={300}
              className="w-full cursor-crosshair touch-none"
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              onTouchStart={startDrawing}
              onTouchMove={draw}
              onTouchEnd={stopDrawing}
            />
          </div>
          <p className="text-sm text-gray-500 mt-2 text-center">
            Παρακαλώ υπογράψτε εδώ με το δάχτυλο ή το ποντίκι
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={clearSignature}
            className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-xl font-semibold hover:bg-gray-300 transition-all"
          >
            Καθαρισμός
          </button>
          <button
            onClick={saveSignature}
            className="flex-1 bg-green-600 text-white py-3 rounded-xl font-semibold hover:bg-green-700 transition-all"
          >
            Αποθήκευση Υπογραφής
          </button>
          <button
            onClick={onClose}
            className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-xl font-semibold hover:bg-gray-200 transition-all"
          >
            Ακύρωση
          </button>
        </div>
      </div>
    </div>
  );
};

// Customer Form Component
const CustomerForm = ({ user, onSave, onCancel, editingCustomer }) => {
  const [formData, setFormData] = useState({
    name: '',
    surname: '',
    email: '',
    phone: '',
    idNumber: '',
    birthDate: '',
    afm: '',
    provider: '',
    installationAddress: '',
    billingAddress: '',
    customFields: {},
    files: {},
    signature: null,
    ...editingCustomer
  });
  const [addressCopied, setAddressCopied] = useState(false);
  const [customFields, setCustomFields] = useState([]);
  const [isSignatureModalOpen, setIsSignatureModalOpen] = useState(false);

  useEffect(() => {
    loadCustomFields();
  }, []);

  const loadCustomFields = async () => {
    const fields = await API.getCustomFields();
    setCustomFields(fields);
  };

  const copyAddress = () => {
    setFormData({ ...formData, billingAddress: formData.installationAddress });
    setAddressCopied(true);
    setTimeout(() => setAddressCopied(false), 2000);
  };

  const validateRequiredFiles = () => {
    const requiredCategories = FILE_CATEGORIES.filter(c => c.required);
    return requiredCategories.every(cat => formData.files[cat.id]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!editingCustomer && !validateRequiredFiles()) {
      alert('Παρακαλώ ανεβάστε όλα τα υποχρεωτικά αρχεία (Ταυτότητα, Λογαριασμός, Ένδειξη Μετρητή)');
      return;
    }
    
    const customerData = {
      ...formData,
      agentId: user.id,
      agentName: user.name,
      agentEmail: user.email,
      submissionDate: editingCustomer?.submissionDate || new Date().toISOString().split('T')[0],
      status: editingCustomer?.status || 'σε αναμονή',
      comments: editingCustomer?.comments || '',
      activationDate: editingCustomer?.activationDate || null,
      commentHistory: editingCustomer?.commentHistory || []
    };

    if (editingCustomer) {
      await API.updateCustomer(editingCustomer.id, customerData);
    } else {
      await API.saveCustomer(customerData);
    }
    onSave();
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
      <h2 className="text-3xl font-bold mb-6 text-gray-900">
        {editingCustomer ? 'Επεξεργασία Πελάτη' : 'Νέος Πελάτης'}
      </h2>
      
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Info */}
        <div>
          <h3 className="text-lg font-semibold text-gray-800 mb-4 pb-2 border-b border-gray-200">
            Βασικά Στοιχεία
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-gray-700 font-medium mb-2 text-sm">Όνομα *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none transition-all"
                required
              />
            </div>

            <div>
              <label className="block text-gray-700 font-medium mb-2 text-sm">Επώνυμο *</label>
              <input
                type="text"
                value={formData.surname}
                onChange={(e) => setFormData({ ...formData, surname: e.target.value })}
                className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none transition-all"
                required
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-gray-700 font-medium mb-2 text-sm">Email *</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none transition-all"
                placeholder="example@email.com"
                required
              />
            </div>

            <div>
              <label className="block text-gray-700 font-medium mb-2 text-sm">Αριθμός Ταυτότητας *</label>
              <input
                type="text"
                value={formData.idNumber}
                onChange={(e) => setFormData({ ...formData, idNumber: e.target.value })}
                className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none transition-all"
                placeholder="ΑΒ123456"
                required
              />
            </div>

            <div>
              <label className="block text-gray-700 font-medium mb-2 text-sm">Ημερομηνία Γέννησης *</label>
              <input
                type="date"
                value={formData.birthDate}
                onChange={(e) => setFormData({ ...formData, birthDate: e.target.value })}
                className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none transition-all"
                required
              />
            </div>

            <div>
              <label className="block text-gray-700 font-medium mb-2 text-sm">Κινητό Επικοινωνίας *</label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none transition-all"
                placeholder="69XXXXXXXX"
                required
              />
            </div>

            <div>
              <label className="block text-gray-700 font-medium mb-2 text-sm">ΑΦΜ *</label>
              <input
                type="text"
                value={formData.afm}
                onChange={(e) => setFormData({ ...formData, afm: e.target.value })}
                className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none transition-all"
                pattern="[0-9]{9}"
                title="ΑΦΜ πρέπει να είναι 9 ψηφία"
                required
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-gray-700 font-medium mb-2 text-sm">Πάροχος που θέλει ο πελάτης *</label>
              <select
                value={formData.provider}
                onChange={(e) => setFormData({ ...formData, provider: e.target.value })}
                className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none transition-all"
                required
              >
                <option value="">Επιλέξτε πάροχο</option>
                {PROVIDERS.map(provider => (
                  <option key={provider} value={provider}>{provider}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Addresses */}
        <div>
          <h3 className="text-lg font-semibold text-gray-800 mb-4 pb-2 border-b border-gray-200">
            Διευθύνσεις
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-gray-700 font-medium mb-2 text-sm">Διεύθυνση Εγκατάστασης *</label>
              <input
                type="text"
                value={formData.installationAddress}
                onChange={(e) => setFormData({ ...formData, installationAddress: e.target.value })}
                className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none transition-all"
                placeholder="Οδός, αριθμός, ΤΚ, Πόλη"
                required
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-gray-700 font-medium text-sm">Διεύθυνση Αποστολής Λογαριασμών *</label>
                <button
                  type="button"
                  onClick={copyAddress}
                  className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors"
                >
                  {addressCopied ? (
                    <>
                      <Check size={16} />
                      Αντιγράφηκε!
                    </>
                  ) : (
                    <>
                      <Copy size={16} />
                      Ίδια με εγκατάσταση
                    </>
                  )}
                </button>
              </div>
              <input
                type="text"
                value={formData.billingAddress}
                onChange={(e) => setFormData({ ...formData, billingAddress: e.target.value })}
                className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none transition-all"
                placeholder="Οδός, αριθμός, ΤΚ, Πόλη"
                required
              />
            </div>
          </div>
        </div>

        {/* Custom Fields */}
        {customFields.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold text-gray-800 mb-4 pb-2 border-b border-gray-200">
              Πρόσθετα Πεδία
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {customFields.map(field => (
                <div key={field.id}>
                  <label className="block text-gray-700 font-medium mb-2 text-sm">{field.label}</label>
                  <input
                    type="text"
                    value={formData.customFields?.[field.id] || ''}
                    onChange={(e) => setFormData({
                      ...formData,
                      customFields: { ...formData.customFields, [field.id]: e.target.value }
                    })}
                    className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none transition-all"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* File Uploads */}
        <FileUploadSection
          files={formData.files}
          onFilesChange={(files) => setFormData({ ...formData, files })}
        />

        {/* Signature Section */}
        <div>
          <h3 className="text-lg font-semibold text-gray-800 mb-4 pb-2 border-b border-gray-200">
            Υπογραφή Πελάτη
          </h3>
          {formData.signature ? (
            <div className="border-2 border-green-200 rounded-xl p-4 bg-green-50">
              <div className="flex items-center justify-between mb-3">
                <p className="text-green-800 font-medium flex items-center gap-2">
                  <Check size={20} />
                  Υπογραφή ολοκληρώθηκε
                </p>
                <button
                  type="button"
                  onClick={() => setIsSignatureModalOpen(true)}
                  className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                >
                  Επανάληψη
                </button>
              </div>
              <img src={formData.signature} alt="Signature" className="border border-gray-300 rounded-lg max-h-32" />
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setIsSignatureModalOpen(true)}
              className="w-full border-2 border-dashed border-blue-300 rounded-xl p-6 hover:border-blue-500 hover:bg-blue-50 transition-all flex items-center justify-center gap-3 text-blue-600 font-medium"
            >
              <Edit2 size={20} />
              Λήψη Υπογραφής από Πελάτη
            </button>
          )}
        </div>

        <div className="flex gap-3 pt-4">
          <button
            type="submit"
            className="flex-1 bg-slate-900 text-white py-3 rounded-xl font-semibold hover:bg-slate-800 transition-all"
          >
            {editingCustomer ? 'Ενημέρωση' : 'Αποθήκευση'}
          </button>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-xl font-semibold hover:bg-gray-200 transition-all"
            >
              Ακύρωση
            </button>
          )}
        </div>
      </form>

      {/* Signature Modal */}
      {isSignatureModalOpen && (
        <SignatureModal
          onSave={(signatureData) => setFormData({ ...formData, signature: signatureData })}
          onClose={() => setIsSignatureModalOpen(false)}
        />
      )}
    </div>
  );
};

// Comment History Modal
const CommentHistoryModal = ({ customer, user, onClose, onAddComment }) => {
  const [newComment, setNewComment] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (newComment.trim()) {
      await onAddComment(customer.id, newComment);
      setNewComment('');
    }
  };

  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleString('el-GR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Ιστορικό Σχολίων</h2>
            <p className="text-sm text-gray-500 mt-1">{customer.name} {customer.surname}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={24} className="text-gray-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {customer.commentHistory && customer.commentHistory.length > 0 ? (
            customer.commentHistory.map(comment => (
              <div
                key={comment.id}
                className={`p-4 rounded-xl border-2 ${
                  comment.role === 'agent'
                    ? 'bg-blue-50 border-blue-200'
                    : 'bg-purple-50 border-purple-200'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-gray-900">{comment.author}</span>
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    comment.role === 'agent'
                      ? 'bg-blue-100 text-blue-800'
                      : 'bg-purple-100 text-purple-800'
                  }`}>
                    {comment.role === 'agent' ? 'Agent' : 'Back Office'}
                  </span>
                </div>
                <p className="text-gray-700 mb-2">{comment.text}</p>
                <p className="text-xs text-gray-500">{formatTimestamp(comment.timestamp)}</p>
              </div>
            ))
          ) : (
            <div className="text-center py-12 text-gray-400">
              Δεν υπάρχουν σχόλια ακόμα
            </div>
          )}
        </div>

        <div className="p-6 border-t border-gray-200">
          <form onSubmit={handleSubmit} className="flex gap-3">
            <input
              type="text"
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Προσθέστε ένα σχόλιο..."
              className="flex-1 px-4 py-2.5 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none transition-all"
            />
            <button
              type="submit"
              disabled={!newComment.trim()}
              className="bg-slate-900 text-white px-6 py-2.5 rounded-xl font-semibold hover:bg-slate-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Αποστολή
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

// Export Filter Modal
const ExportFilterModal = ({ onExport, onClose, user, agents }) => {
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    submissionStartDate: '',
    submissionEndDate: '',
    provider: '',
    status: '',
    agentIds: [],
    searchTerm: '',
  });

  // Collapsible sections state
  const [openSections, setOpenSections] = useState({ submission: false, activation: false, agents: false, other: false });

  const toggleSection = (section) => {
    setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const handleExport = () => {
    onExport(filters);
    onClose();
  };

  const hasActiveFilters = filters.submissionStartDate || filters.submissionEndDate ||
    filters.startDate || filters.endDate || filters.status ||
    filters.provider || filters.searchTerm || filters.agentIds.length > 0;

  const SectionHeader = ({ id, icon, title, color, badge }) => (
    <button
      type="button"
      onClick={() => toggleSection(id)}
      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-all ${openSections[id] ? color : 'bg-gray-50 hover:bg-gray-100'}`}
    >
      <div className="flex items-center gap-2">
        <span className="text-lg">{icon}</span>
        <span className={`text-sm font-semibold ${openSections[id] ? 'text-white' : 'text-gray-700'}`}>{title}</span>
        {badge && <span className={`text-xs px-2 py-0.5 rounded-full ${openSections[id] ? 'bg-white/20 text-white' : 'bg-blue-100 text-blue-700'}`}>{badge}</span>}
      </div>
      <span className={`text-sm ${openSections[id] ? 'text-white' : 'text-gray-400'}`}>{openSections[id] ? '▲' : '▼'}</span>
    </button>
  );

  return (
    <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-50">
      <div className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl shadow-2xl flex flex-col" style={{maxHeight: '90vh'}}>
        
        {/* Header - fixed */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 flex-shrink-0 bg-white rounded-t-2xl">
          <h2 className="text-base font-bold text-gray-900">📤 Εξαγωγή Excel</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg">
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        {/* Status pills - always visible, no section */}
        <div className="px-4 pt-3 pb-2 flex-shrink-0">
          <p className="text-xs text-gray-500 mb-2 font-medium">ΚΑΤΑΣΤΑΣΗ</p>
          <div className="flex gap-2 flex-wrap">
            {[
              { value: '', label: 'Όλες', active: 'bg-slate-800 text-white', inactive: 'bg-gray-100 text-gray-600' },
              { value: 'ενεργό', label: '✓ Ενεργές', active: 'bg-green-600 text-white', inactive: 'bg-green-100 text-green-700' },
              { value: 'εκκρεμότητα', label: '⏳ Εκκρεμ.', active: 'bg-orange-500 text-white', inactive: 'bg-orange-100 text-orange-700' },
              { value: 'σε αναμονή', label: '⏸ Αναμονή', active: 'bg-blue-600 text-white', inactive: 'bg-blue-100 text-blue-700' }
            ].map(s => (
              <button
                key={s.value}
                type="button"
                onClick={() => setFilters({ ...filters, status: s.value })}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${filters.status === s.value ? s.active : s.inactive}`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Collapsible Sections - scrollable */}
        <div className="flex-1 overflow-y-auto px-4 pb-2 space-y-2">

          {/* Submission Dates */}
          <SectionHeader id="submission" icon="📄" title="Καταχώρηση" color="bg-blue-600" badge={filters.submissionStartDate || filters.submissionEndDate ? '●' : null} />
          {openSections.submission && (
            <div className="bg-blue-50 rounded-lg p-3 -mt-1 border border-blue-200">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Από</label>
                  <input type="date" value={filters.submissionStartDate} onChange={(e) => setFilters({ ...filters, submissionStartDate: e.target.value })}
                    className="w-full px-2 py-2 border border-gray-300 rounded-lg text-sm focus:border-blue-500 focus:outline-none bg-white" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Μέχρι</label>
                  <input type="date" value={filters.submissionEndDate} onChange={(e) => setFilters({ ...filters, submissionEndDate: e.target.value })}
                    className="w-full px-2 py-2 border border-gray-300 rounded-lg text-sm focus:border-blue-500 focus:outline-none bg-white" />
                </div>
              </div>
            </div>
          )}

          {/* Activation Dates */}
          <SectionHeader id="activation" icon="✅" title="Ενεργοποίηση" color="bg-green-600" badge={filters.startDate || filters.endDate ? '●' : null} />
          {openSections.activation && (
            <div className="bg-green-50 rounded-lg p-3 -mt-1 border border-green-200">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Από</label>
                  <input type="date" value={filters.startDate} onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                    className="w-full px-2 py-2 border border-gray-300 rounded-lg text-sm focus:border-blue-500 focus:outline-none bg-white" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Μέχρι</label>
                  <input type="date" value={filters.endDate} onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                    className="w-full px-2 py-2 border border-gray-300 rounded-lg text-sm focus:border-blue-500 focus:outline-none bg-white" />
                </div>
              </div>
            </div>
          )}

          {/* Agents */}
          {(user.role === 'super_user' || user.role === 'back_office' || user.role === 'director') && agents.length > 0 && (
            <>
              <SectionHeader id="agents" icon="👤" title="Agents" color="bg-yellow-600" badge={filters.agentIds.length > 0 ? `${filters.agentIds.length}` : null} />
              {openSections.agents && (
                <div className="bg-yellow-50 rounded-lg p-3 -mt-1 border border-yellow-200">
                  <div className="max-h-36 overflow-y-auto space-y-1">
                    <label className="flex items-center gap-2 p-1.5 rounded-lg cursor-pointer hover:bg-yellow-100">
                      <input type="checkbox" checked={filters.agentIds.length === 0} onChange={() => setFilters({ ...filters, agentIds: [] })} className="w-4 h-4 accent-yellow-600" />
                      <span className="text-sm font-semibold text-gray-700">Όλοι οι Agents</span>
                    </label>
                    {agents.map(agent => (
                      <label key={agent.id} className="flex items-center gap-2 p-1.5 rounded-lg cursor-pointer hover:bg-yellow-100">
                        <input type="checkbox" checked={filters.agentIds.includes(agent.id)}
                          onChange={(e) => {
                            if (e.target.checked) setFilters({ ...filters, agentIds: [...filters.agentIds, agent.id] });
                            else setFilters({ ...filters, agentIds: filters.agentIds.filter(id => id !== agent.id) });
                          }}
                          className="w-4 h-4 accent-yellow-600" />
                        <span className="text-sm text-gray-700">{agent.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Provider + Search */}
          <SectionHeader id="other" icon="🔍" title="Πάροχος / Αναζήτηση" color="bg-gray-600" badge={filters.provider || filters.searchTerm ? '●' : null} />
          {openSections.other && (
            <div className="bg-gray-50 rounded-lg p-3 -mt-1 border border-gray-200 space-y-2">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Πάροχος</label>
                <select value={filters.provider} onChange={(e) => setFilters({ ...filters, provider: e.target.value })}
                  className="w-full px-2 py-2 border border-gray-300 rounded-lg text-sm focus:border-blue-500 focus:outline-none bg-white">
                  <option value="">Όλοι οι Πάροχοι</option>
                  {PROVIDERS.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Αναζήτηση</label>
                <input type="text" value={filters.searchTerm} onChange={(e) => setFilters({ ...filters, searchTerm: e.target.value })}
                  placeholder="Όνομα, ΑΦΜ, κινητό..."
                  className="w-full px-2 py-2 border border-gray-300 rounded-lg text-sm focus:border-blue-500 focus:outline-none bg-white" />
              </div>
            </div>
          )}

          {/* Clear all */}
          {hasActiveFilters && (
            <button type="button" onClick={() => setFilters({ startDate: '', endDate: '', submissionStartDate: '', submissionEndDate: '', provider: '', status: '', agentIds: [], searchTerm: '' })}
              className="w-full text-center text-xs text-red-500 py-2 hover:text-red-700 transition-colors">
              ✕ Καθαρισμός όλων φίλτρων
            </button>
          )}
        </div>

        {/* Bottom buttons - FIXED, always visible */}
        <div className="flex-shrink-0 bg-white border-t border-gray-200 p-3 flex gap-3">
          <button onClick={onClose} className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-xl font-semibold text-sm hover:bg-gray-200 transition-all">
            Ακύρωση
          </button>
          <button onClick={handleExport} className="flex-1 bg-green-600 text-white py-3 rounded-xl font-bold text-sm hover:bg-green-700 transition-all flex items-center justify-center gap-2 shadow-md">
            <Download size={18} />
            Εξαγωγή Excel
          </button>
        </div>
      </div>
    </div>
  );
};

// Customer List Component
const CustomerList = ({ user, customers, onEdit, onDelete, onExport, onViewComments, agents }) => {
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showExportModal, setShowExportModal] = useState(false);

  const filteredCustomers = customers.filter(customer => {
    const matchesFilter = filter === 'all' || customer.status === filter;
    const matchesSearch = 
      customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.surname.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.afm.includes(searchTerm) ||
      (customer.phone && customer.phone.includes(searchTerm));
    return matchesFilter && matchesSearch;
  });

  const getStatusColor = (status) => {
    switch (status) {
      case 'ενεργό': return 'bg-green-100 text-green-800 border-green-300';
      case 'εκκρεμότητα': return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'σε αναμονή': return 'bg-blue-100 text-blue-800 border-blue-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const handleExportWithFilters = (filters) => {
    let dataToExport = [...customers];

    // Apply submission date filters
    if (filters.submissionStartDate) {
      dataToExport = dataToExport.filter(c => c.submissionDate >= filters.submissionStartDate);
    }
    if (filters.submissionEndDate) {
      dataToExport = dataToExport.filter(c => c.submissionDate <= filters.submissionEndDate);
    }
    
    // Apply activation date filters
    if (filters.startDate) {
      dataToExport = dataToExport.filter(c => c.activationDate && c.activationDate >= filters.startDate);
    }
    if (filters.endDate) {
      dataToExport = dataToExport.filter(c => c.activationDate && c.activationDate <= filters.endDate);
    }
    
    // Apply other filters
    if (filters.provider) {
      dataToExport = dataToExport.filter(c => c.provider === filters.provider);
    }
    if (filters.status) {
      dataToExport = dataToExport.filter(c => c.status === filters.status);
    }
    if (filters.agentIds.length > 0) {
      dataToExport = dataToExport.filter(c => filters.agentIds.includes(c.agentId));
    }
    if (filters.searchTerm) {
      const term = filters.searchTerm.toLowerCase();
      dataToExport = dataToExport.filter(c =>
        c.name.toLowerCase().includes(term) ||
        c.surname.toLowerCase().includes(term) ||
        c.afm.includes(term) ||
        (c.phone && c.phone.includes(term))
      );
    }

 
  };

  // Calculate stats
  const stats = {
    total: filteredCustomers.length,
    active: filteredCustomers.filter(c => c.status === 'ενεργό').length,
    pending: filteredCustomers.filter(c => c.status === 'εκκρεμότητα').length,
    waiting: filteredCustomers.filter(c => c.status === 'σε αναμονή').length
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-gray-600 text-sm font-medium">Σύνολο Πελατών</h3>
            <Users className="text-blue-500" size={24} />
          </div>
          <p className="text-3xl font-bold text-gray-900">{stats.total}</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-gray-600 text-sm font-medium">Ενεργοί</h3>
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
          </div>
          <p className="text-3xl font-bold text-green-600">{stats.active}</p>
          <p className="text-xs text-gray-500 mt-1">Ενεργοποιημένες αιτήσεις</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-gray-600 text-sm font-medium">Εκκρεμότητα</h3>
            <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
          </div>
          <p className="text-3xl font-bold text-orange-600">{stats.pending}</p>
          <p className="text-xs text-gray-500 mt-1">Απαιτούν προσοχή</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-gray-600 text-sm font-medium">Σε Αναμονή</h3>
            <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
          </div>
          <p className="text-3xl font-bold text-blue-600">{stats.waiting}</p>
          <p className="text-xs text-gray-500 mt-1">Νέες αιτήσεις</p>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
          <h2 className="text-2xl font-bold text-gray-900">
            Πρόσφατοι Πελάτες
          </h2>
          <div className="flex gap-2">
            <button
              onClick={() => setShowExportModal(true)}
              className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-xl hover:bg-green-700 transition-all font-medium text-sm"
            >
              <Download size={18} />
              Εξαγωγή Excel
            </button>
          </div>
        </div>

        <div className="mb-6 space-y-4">
          <input
            type="text"
            placeholder="Αναζήτηση (όνομα, επώνυμο, ΑΦΜ, κινητό)..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none transition-all"
          />
          
          <div className="flex gap-2 flex-wrap">
            {[
              { value: 'all', label: 'Όλα', color: 'bg-gray-100 text-gray-700' },
              { value: 'ενεργό', label: 'Ενεργό', color: 'bg-green-100 text-green-700' },
              { value: 'εκκρεμότητα', label: 'Εκκρεμότητα', color: 'bg-orange-100 text-orange-700' },
              { value: 'σε αναμονή', label: 'Σε Αναμονή', color: 'bg-blue-100 text-blue-700' }
            ].map(status => (
              <button
                key={status.value}
                onClick={() => setFilter(status.value)}
                className={`px-4 py-2 rounded-xl font-medium transition-all ${
                  filter === status.value
                    ? 'bg-slate-900 text-white shadow-md scale-105'
                    : status.color + ' hover:scale-105'
                }`}
              >
                {status.label}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b-2 border-gray-200">
                <th className="text-left py-4 px-3 font-bold text-gray-700 text-sm">Ονοματεπώνυμο</th>
                <th className="text-left py-4 px-3 font-bold text-gray-700 text-sm">Κινητό</th>
                <th className="text-left py-4 px-3 font-bold text-gray-700 text-sm">ΑΦΜ</th>
                <th className="text-left py-4 px-3 font-bold text-gray-700 text-sm">Πάροχος</th>
                {(user.role === 'back_office' || user.role === 'super_user') && (
                  <th className="text-left py-4 px-3 font-bold text-gray-700 text-sm">Agent</th>
                )}
                <th className="text-left py-4 px-3 font-bold text-gray-700 text-sm">Ημ. Υποβολής</th>
                <th className="text-left py-4 px-3 font-bold text-gray-700 text-sm">Κατάσταση</th>
                <th className="text-left py-4 px-3 font-bold text-gray-700 text-sm">Ενέργειες</th>
              </tr>
            </thead>
            <tbody>
              {filteredCustomers.map((customer) => (
                <tr key={customer.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                  <td className="py-4 px-3">
                    <div className="font-medium text-gray-900">{customer.name} {customer.surname}</div>
                  </td>
                  <td className="py-4 px-3 text-sm text-gray-600">{customer.phone}</td>
                  <td className="py-4 px-3 font-mono text-sm text-gray-600">{customer.afm}</td>
                  <td className="py-4 px-3 text-sm">{customer.provider}</td>
                  {(user.role === 'back_office' || user.role === 'super_user') && (
                    <td className="py-4 px-3 text-sm text-gray-600">{customer.agentName}</td>
                  )}
                  <td className="py-4 px-3 text-sm text-gray-600">{customer.submissionDate}</td>
                  <td className="py-4 px-3">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getStatusColor(customer.status)}`}>
                      {customer.status}
                    </span>
                  </td>
                  <td className="py-4 px-3">
                    <div className="flex gap-2">
                      {/* Edit button - visible for agents on their own records, and back office/super user for all */}
                      {((user.role === 'agent' && customer.agentId === user.id) || 
                        user.role === 'back_office' || 
                        user.role === 'super_user') && (
                        <button
                          onClick={() => onEdit(customer)}
                          className="flex items-center gap-1 px-3 py-1.5 text-sm bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-all font-medium"
                          title="Επεξεργασία"
                        >
                          <Edit2 size={14} />
                          E
                        </button>
                      )}
                      
                      {/* Comment button - visible for everyone */}
                      <button
                        onClick={() => onViewComments(customer)}
                        className="flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all font-medium"
                        title="Σχόλια"
                      >
                        <MessageSquare size={14} />
                        Σχόλιο
                      </button>
                      
                      {/* Delete button - only for back office and super user */}
                      {(user.role === 'back_office' || user.role === 'super_user') && (
                        <button
                          onClick={() => onDelete(customer.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-all"
                          title="Διαγραφή"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredCustomers.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              Δεν βρέθηκαν πελάτες
            </div>
          )}
        </div>
      </div>

      {showExportModal && (
        <ExportFilterModal
          onExport={handleExportWithFilters}
          onClose={() => setShowExportModal(false)}
          user={user}
          agents={agents}
        />
      )}
    </div>
  );
};

// Back Office Edit Modal
const BackOfficeEditModal = ({ customer, onSave, onClose }) => {
  const [formData, setFormData] = useState(customer);
  const [contractFile, setContractFile] = useState(null);
  const [sendingContract, setSendingContract] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    await API.updateCustomer(customer.id, formData);
    onSave();
  };

  const handleDownloadFile = (categoryId) => {
    const file = customer.files?.[categoryId];
    if (file) {
      try {
        // Create a temporary link element
        const link = document.createElement('a');
        link.href = file.data;
        link.download = file.name;
        link.style.display = 'none';
        
        // Append to body, click, and remove
        document.body.appendChild(link);
        link.click();
        
        // Clean up
        setTimeout(() => {
          document.body.removeChild(link);
          URL.revokeObjectURL(file.data);
        }, 100);
      } catch (error) {
        console.error('Download error:', error);
        alert('Σφάλμα κατεβάσματος αρχείου. Παρακαλώ δοκιμάστε ξανά.');
      }
    }
  };

  const handleDownloadPDF = () => {
    // Real PDF generation using canvas
    const canvas = document.createElement('canvas');
    canvas.width = 595; // A4 width in points
    canvas.height = 842; // A4 height in points
    const ctx = canvas.getContext('2d');

    // White background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Header bar
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, 0, canvas.width, 70);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px Arial';
    ctx.fillText('ENERGY CRM', 30, 30);
    ctx.font = '12px Arial';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('Καταχώρηση Πελάτη', 30, 52);

    // Divider
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, 70);
    ctx.lineTo(canvas.width, 70);
    ctx.stroke();

    let y = 100;

    // Section: ΣΤΟΙΧΕΙΑ ΠΕΛΑΤΗ
    ctx.fillStyle = '#f1f5f9';
    ctx.fillRect(20, y - 5, 555, 24);
    ctx.fillStyle = '#1e293b';
    ctx.font = 'bold 13px Arial';
    ctx.fillText('ΣΤΟΙΧΕΙΑ ΠΕΛΑΤΗ', 30, y + 12);
    y += 40;

    const fields = [
      ['Όνομα:', `${customer.name} ${customer.surname}`],
      ['Email:', customer.email || '-'],
      ['Αριθμός Ταυτότητας:', customer.idNumber || '-'],
      ['Ημερομηνία Γέννησης:', customer.birthDate || '-'],
      ['Κινητό:', customer.phone || '-'],
      ['ΑΦΜ:', customer.afm || '-'],
      ['Πάροχος:', customer.provider || '-'],
    ];

    fields.forEach(([label, value]) => {
      ctx.fillStyle = '#64748b';
      ctx.font = '11px Arial';
      ctx.fillText(label, 30, y);
      ctx.fillStyle = '#1e293b';
      ctx.font = 'bold 11px Arial';
      ctx.fillText(value, 180, y);
      y += 22;
    });

    y += 15;

    // Section: ΔΙΕΥΘΥΝΣΕΙΣ
    ctx.fillStyle = '#f1f5f9';
    ctx.fillRect(20, y - 5, 555, 24);
    ctx.fillStyle = '#1e293b';
    ctx.font = 'bold 13px Arial';
    ctx.fillText('ΔΙΕΥΘΥΝΣΕΙΣ', 30, y + 12);
    y += 40;

    const addresses = [
      ['Εγκατάσταση:', customer.installationAddress || '-'],
      ['Λογαριασμός:', customer.billingAddress || '-'],
    ];

    addresses.forEach(([label, value]) => {
      ctx.fillStyle = '#64748b';
      ctx.font = '11px Arial';
      ctx.fillText(label, 30, y);
      ctx.fillStyle = '#1e293b';
      ctx.font = 'bold 11px Arial';
      // Wrap long text
      const maxW = 370;
      const words = value.split(' ');
      let line = '';
      let startY = y;
      words.forEach(word => {
        const testLine = line + word + ' ';
        if (ctx.measureText(testLine).width > maxW && line !== '') {
          ctx.fillText(line.trim(), 180, startY);
          startY += 16;
          line = word + ' ';
        } else {
          line = testLine;
        }
      });
      ctx.fillText(line.trim(), 180, startY);
      y = startY + 28;
    });

    y += 10;

    // Section: ΠΛΗΡΟΦΟΡΙΕΣ ΑΙΤΗΣΗΣ
    ctx.fillStyle = '#f1f5f9';
    ctx.fillRect(20, y - 5, 555, 24);
    ctx.fillStyle = '#1e293b';
    ctx.font = 'bold 13px Arial';
    ctx.fillText('ΠΛΗΡΟΦΟΡΙΕΣ ΑΙΤΗΣΗΣ', 30, y + 12);
    y += 40;

    const info = [
      ['Ημ. Υποβολής:', customer.submissionDate || '-'],
      ['Κατάσταση:', customer.status || '-'],
      ['Ημ. Ενεργοποίησης:', customer.activationDate || '-'],
      ['Agent:', customer.agentName || '-'],
    ];

    info.forEach(([label, value]) => {
      ctx.fillStyle = '#64748b';
      ctx.font = '11px Arial';
      ctx.fillText(label, 30, y);
      ctx.fillStyle = '#1e293b';
      ctx.font = 'bold 11px Arial';
      ctx.fillText(value, 200, y);
      y += 22;
    });

    // Status badge color
    if (customer.status) {
      y += 10;
      let badgeColor = '#e2e8f0';
      let textColor = '#475569';
      if (customer.status === 'ενεργό') { badgeColor = '#dcfce7'; textColor = '#166534'; }
      if (customer.status === 'εκκρεμότητα') { badgeColor = '#ffedd5'; textColor = '#9a3412'; }
      if (customer.status === 'σε αναμονή') { badgeColor = '#dbeafe'; textColor = '#1e40af'; }
      ctx.fillStyle = badgeColor;
      ctx.beginPath();
      ctx.roundRect(30, y - 14, 120, 26, 6);
      ctx.fill();
      ctx.fillStyle = textColor;
      ctx.font = 'bold 11px Arial';
      ctx.fillText(customer.status.toUpperCase(), 42, y + 5);
    }

    // Footer
    ctx.fillStyle = '#cbd5e1';
    ctx.fillRect(0, canvas.height - 40, canvas.width, 40);
    ctx.fillStyle = '#64748b';
    ctx.font = '10px Arial';
    ctx.fillText('Energy CRM - Αυτόματα Γενηθέν Έγγραφο', 30, canvas.height - 18);
    ctx.fillText(new Date().toLocaleString('el-GR'), canvas.width - 150, canvas.height - 18);

    // Convert canvas to PDF using a minimal PDF structure
    const imgData = canvas.toDataURL('image/jpeg', 0.95);
    
    // Build a minimal valid PDF with the image embedded
    const pdfW = 595;
    const pdfH = 842;

    // We'll fetch the base64 data and build raw PDF bytes
    const base64 = imgData.split(',')[1];
    const binaryString = atob(base64);
    const imgBytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      imgBytes[i] = binaryString.charCodeAt(i);
    }
    const imgLength = imgBytes.length;

    // Build PDF manually
    const objects = [];
    let offset = 0;
    const offsets = [];

    const header = '%PDF-1.4\n';
    offset += header.length;

    // Obj 1: Catalog
    offsets.push(offset);
    const obj1 = '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n';
    offset += obj1.length;

    // Obj 2: Pages
    offsets.push(offset);
    const obj2 = '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n';
    offset += obj2.length;

    // Obj 3: Page
    offsets.push(offset);
    const obj3 = `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pdfW} ${pdfH}] /Contents 4 0 R /Resources << /XObject << /Im1 5 0 R >> >> >>\nendobj\n`;
    offset += obj3.length;

    // Obj 4: Content stream (draw image full page)
    const streamContent = `q ${pdfW} 0 0 ${pdfH} 0 0 cm /Im1 Do Q`;
    offsets.push(offset);
    const obj4 = `4 0 obj\n<< /Length ${streamContent.length} >>\nstream\n${streamContent}\nendstream\nendobj\n`;
    offset += obj4.length;

    // Obj 5: Image XObject
    offsets.push(offset);
    const obj5Header = `5 0 obj\n<< /Type /XObject /Subtype /Image /Width ${canvas.width} /Height ${canvas.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${imgLength} >>\nstream\n`;
    offset += obj5Header.length + imgLength;
    const obj5Footer = '\nendstream\nendobj\n';
    offset += obj5Footer.length;

    // Xref
    const xrefOffset = offset;
    let xref = 'xref\n';
    xref += `0 ${offsets.length + 1}\n`;
    xref += '0000000000 65535 f \n';
    offsets.forEach(o => {
      xref += String(o).padStart(10, '0') + ' 00000 n \n';
    });

    const trailer = `trailer\n<< /Size ${offsets.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

    // Assemble as Uint8Array
    const textParts = [header, obj1, obj2, obj3, obj4, obj5Header];
    let totalLen = 0;
    textParts.forEach(p => totalLen += p.length);
    totalLen += imgBytes.length;
    totalLen += obj5Footer.length + xref.length + trailer.length;

    const pdfBytes = new Uint8Array(totalLen);
    let pos = 0;
    textParts.forEach(p => {
      for (let i = 0; i < p.length; i++) pdfBytes[pos++] = p.charCodeAt(i);
    });
    imgBytes.forEach(b => pdfBytes[pos++] = b);
    [obj5Footer, xref, trailer].forEach(p => {
      for (let i = 0; i < p.length; i++) pdfBytes[pos++] = p.charCodeAt(i);
    });

    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${customer.name}_${customer.surname}_${customer.afm}.pdf`;
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }, 200);
  };

  const handleContractUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setContractFile({
          name: file.name,
          data: reader.result
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSendContract = async (method = 'email') => {
    if (!contractFile && !customer.contract) {
      alert('Παρακαλώ ανεβάστε πρώτα τη σύμβαση');
      return;
    }

    if (!formData.email || !formData.email.includes('@')) {
      alert('Παρακαλώ συμπληρώστε ένα έγκυρο email πελάτη');
      return;
    }

    if (!customer.phone) {
      alert('Δεν υπάρχει κινητό τηλέφωνο για αποστολή SMS/Viber');
      return;
    }

    setSendingContract(true);
    
    const contractToSend = contractFile || customer.contract;
    const contractLinkToSend = customer.contractLink || `https://crm.energy.gr/contracts/${customer.id}/${Date.now()}`;
    
    if (method === 'email') {
      // Send via Email
      sendEmailNotification(
        formData.email,
        'Σύμβαση Ενεργειακού Προγράμματος',
        `Αγαπητέ/ή ${customer.name} ${customer.surname},\n\nΣας αποστέλλουμε τη σύμβασή σας.\n\nΜπορείτε να την κατεβάσετε από: ${contractLinkToSend}\n\nΜε εκτίμηση,\nEnergy CRM`
      );
    } else if (method === 'sms') {
      // Send via SMS
      console.log(`📱 SMS sent to ${customer.phone}`);
      console.log(`Message: Η σύμβασή σας είναι έτοιμη! Κατεβάστε την από: ${contractLinkToSend}`);
      // In production: integrate with SMS API (Twilio, Infobip, etc.)
    } else if (method === 'viber') {
      // Send via Viber
      console.log(`💬 Viber message sent to ${customer.phone}`);
      console.log(`Message: Γεια σας ${customer.name}! Η σύμβασή σας είναι έτοιμη. Κατεβάστε την: ${contractLinkToSend}`);
      // In production: integrate with Viber Business API
    }

    // Save contract and updated info
    await API.updateCustomer(customer.id, {
      ...formData,
      contract: contractToSend,
      contractLink: contractLinkToSend,
      contractSentDate: new Date().toISOString(),
      contractSentVia: method
    });

    setTimeout(() => {
      setSendingContract(false);
      const methodText = method === 'email' ? 'Email' : method === 'sms' ? 'SMS' : 'Viber';
      alert(`Η σύμβαση στάλθηκε επιτυχώς μέσω ${methodText}!`);
      onSave();
    }, 1000);
  };

  const handleDownloadContract = () => {
    if (customer.contract) {
      const link = document.createElement('a');
      link.href = customer.contract.data;
      link.download = customer.contract.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleCopyContractLink = () => {
    if (customer.contractLink) {
      navigator.clipboard.writeText(customer.contractLink).then(() => {
        alert('Το link αντιγράφηκε! Μπορείτε να το στείλετε όπου θέλετε.');
      }).catch(() => {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = customer.contractLink;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        alert('Το link αντιγράφηκε!');
      });
    }
  };

  const uploadedFiles = FILE_CATEGORIES.filter(cat => customer.files?.[cat.id]);

  return (
    <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-50">
      <div className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl shadow-2xl flex flex-col" style={{maxHeight: '90vh'}}>

        {/* Fixed Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 flex-shrink-0 bg-white rounded-t-2xl">
          <h2 className="text-base font-bold text-gray-900">✏️ Επεξεργασία Πελάτη</h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadPDF}
              className="flex items-center gap-1.5 bg-red-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-red-700 transition-all"
            >
              <Download size={13} />
              PDF
            </button>
            <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg">
              <X size={20} className="text-gray-500" />
            </button>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          <form onSubmit={handleSubmit} className="space-y-3">

            {/* Στοιχεία Πελάτη + PDF button */}
            <div className="bg-gray-50 rounded-xl border border-gray-200 overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2 bg-gray-100 border-b border-gray-200">
                <h3 className="text-sm font-bold text-gray-800">📋 Στοιχεία Αίτησης</h3>
                <button
                  type="button"
                  onClick={handleDownloadPDF}
                  className="flex items-center gap-1.5 bg-red-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-red-700 transition-all"
                >
                  <Download size={13} />
                  PDF
                </button>
              </div>
              <div className="p-3 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                <div><span className="text-gray-500 text-xs">Όνομα</span><br/><span className="font-medium text-gray-800">{customer.name} {customer.surname}</span></div>
                <div><span className="text-gray-500 text-xs">Κινητό</span><br/><span className="font-medium text-gray-800">{customer.phone}</span></div>
                <div><span className="text-gray-500 text-xs">ΑΦΜ</span><br/><span className="font-medium text-gray-800">{customer.afm}</span></div>
                <div><span className="text-gray-500 text-xs">Ταυτότητα</span><br/><span className="font-medium text-gray-800">{customer.idNumber || '-'}</span></div>
                <div><span className="text-gray-500 text-xs">Γέννηση</span><br/><span className="font-medium text-gray-800">{customer.birthDate || '-'}</span></div>
                <div><span className="text-gray-500 text-xs">Πάροχος</span><br/><span className="font-medium text-gray-800">{customer.provider}</span></div>
                <div className="col-span-2"><span className="text-gray-500 text-xs">Διεύθυνση Εγκατάστασης</span><br/><span className="font-medium text-gray-800">{customer.installationAddress}</span></div>
                <div className="col-span-2"><span className="text-gray-500 text-xs">Διεύθυνση Λογαριασμού</span><br/><span className="font-medium text-gray-800">{customer.billingAddress}</span></div>
                <div className="col-span-2"><span className="text-gray-500 text-xs">Agent</span><br/><span className="font-medium text-gray-800">{customer.agentName}</span></div>
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="block text-xs text-gray-500 mb-1 font-medium">Email Πελάτη *</label>
              <input
                type="email"
                value={formData.email || ''}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:border-blue-500 focus:outline-none text-sm"
                placeholder="example@email.com"
                required
              />
            </div>

            {/* Uploaded Files */}
            {uploadedFiles.length > 0 && (
              <div className="bg-blue-50 rounded-xl border border-blue-200 overflow-hidden">
                <div className="flex items-center gap-2 px-3 py-2 bg-blue-100 border-b border-blue-200">
                  <Download size={14} className="text-blue-600" />
                  <h3 className="text-xs font-bold text-blue-800">Ανεβασμένα Αρχεία</h3>
                </div>
                <div className="p-2 space-y-1.5">
                  {uploadedFiles.map(cat => (
                    <div key={cat.id} className="flex items-center justify-between bg-white px-3 py-2.5 rounded-lg border border-blue-200">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <svg className="w-4 h-4 text-blue-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-800">{cat.label}</p>
                          <p className="text-xs text-gray-400 truncate">{customer.files[cat.id].name}</p>
                        </div>
                      </div>
                      <button type="button" onClick={() => handleDownloadFile(cat.id)}
                        className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors flex-shrink-0">
                        <Download size={18} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Status */}
            <div>
              <label className="block text-xs text-gray-500 mb-1 font-medium">Κατάσταση Αίτησης *</label>
              <select value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:border-blue-500 focus:outline-none text-sm bg-white" required>
                <option value="σε αναμονή">Σε Αναμονή</option>
                <option value="εκκρεμότητα">Εκκρεμότητα</option>
                <option value="ενεργό">Ενεργό</option>
              </select>
            </div>

            {formData.activationDate && (
              <div className="bg-green-50 px-3 py-2 rounded-lg border border-green-200 flex items-center gap-2">
                <span className="text-green-600 text-sm">✓</span>
                <span className="text-xs text-green-700"><strong>Ενεργοποίηση:</strong> {formData.activationDate}</span>
              </div>
            )}

            {/* Contract Section */}
            <div className="bg-purple-50 rounded-xl border border-purple-200 overflow-hidden">
              <div className="flex items-center gap-2 px-3 py-2 bg-purple-100 border-b border-purple-200">
                <FileText size={14} className="text-purple-600" />
                <h3 className="text-xs font-bold text-purple-800">Σύμβαση Πελάτη</h3>
              </div>
              <div className="p-3 space-y-3">

                {/* Existing contract info */}
                {customer.contract && (
                  <div className="bg-white p-3 rounded-lg border border-purple-200">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-800 truncate">📄 {customer.contract.name}</p>
                        {customer.contractSentDate && (
                          <p className="text-xs text-green-600 mt-0.5">
                            ✓ Στάλθηκε {new Date(customer.contractSentDate).toLocaleDateString('el-GR')}
                            {customer.contractSentVia && ` (${customer.contractSentVia === 'email' ? 'Email' : customer.contractSentVia === 'sms' ? 'SMS' : 'Viber'})`}
                          </p>
                        )}
                      </div>
                      <button type="button" onClick={handleDownloadContract}
                        className="p-2 text-purple-600 hover:bg-purple-100 rounded-lg flex-shrink-0">
                        <Download size={18} />
                      </button>
                    </div>
                    {customer.contractLink && (
                      <div className="mt-2 flex gap-2">
                        <input type="text" value={customer.contractLink} readOnly
                          className="flex-1 text-xs px-2 py-1.5 bg-blue-50 border border-blue-200 rounded-lg min-w-0" />
                        <button type="button" onClick={handleCopyContractLink}
                          className="px-2.5 py-1.5 bg-blue-500 text-white rounded-lg text-xs font-bold hover:bg-blue-600 flex-shrink-0">
                          Copy
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Upload */}
                <label className="block cursor-pointer">
                  <div className="border-2 border-dashed border-purple-300 rounded-lg p-3 hover:border-purple-500 hover:bg-purple-100 transition-all text-center">
                    <input type="file" onChange={handleContractUpload} className="hidden" accept=".pdf,.doc,.docx" />
                    <p className="text-sm text-purple-700 font-medium">
                      {contractFile ? `✓ ${contractFile.name}` : customer.contract ? '↻ Νέα Σύμβαση' : '⬆ Ανέβασμα Σύμβασης'}
                    </p>
                  </div>
                </label>

                {/* Send buttons */}
                <div>
                  <p className="text-xs text-gray-500 mb-2 font-medium">ΑΠΟΣΤΟΛΗ:</p>
                  <div className="grid grid-cols-3 gap-2">
                    <button type="button" onClick={() => handleSendContract('email')} disabled={sendingContract}
                      className="bg-blue-600 text-white py-2.5 rounded-xl hover:bg-blue-700 transition-all disabled:opacity-50 flex flex-col items-center gap-0.5">
                      <span className="text-lg">📧</span>
                      <span className="text-xs font-semibold">Email</span>
                    </button>
                    <button type="button" onClick={() => handleSendContract('sms')} disabled={sendingContract}
                      className="bg-green-600 text-white py-2.5 rounded-xl hover:bg-green-700 transition-all disabled:opacity-50 flex flex-col items-center gap-0.5">
                      <span className="text-lg">📱</span>
                      <span className="text-xs font-semibold">SMS</span>
                    </button>
                    <button type="button" onClick={() => handleSendContract('viber')} disabled={sendingContract}
                      className="bg-purple-600 text-white py-2.5 rounded-xl hover:bg-purple-700 transition-all disabled:opacity-50 flex flex-col items-center gap-0.5">
                      <span className="text-lg">💬</span>
                      <span className="text-xs font-semibold">Viber</span>
                    </button>
                  </div>
                </div>

                {customer.phone && (
                  <p className="text-xs text-gray-400">📞 {customer.phone}</p>
                )}
              </div>
            </div>

          </form>
        </div>

        {/* Fixed Bottom Buttons */}
        <div className="flex-shrink-0 bg-white border-t border-gray-200 p-3 flex gap-3">
          <button type="button" onClick={onClose}
            className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-xl font-semibold text-sm hover:bg-gray-200 transition-all">
            Ακύρωση
          </button>
          <button type="button" onClick={(e) => { e.preventDefault(); handleSubmit({ preventDefault: () => {} }); }}
            className="flex-1 bg-slate-900 text-white py-3 rounded-xl font-bold text-sm hover:bg-slate-800 transition-all shadow-md">
            Αποθήκευση
          </button>
        </div>
      </div>
    </div>
  );
};

// User Management Component
const UserManagement = ({ currentUser }) => {
  const [users, setUsers] = useState([]);
  const [agents, setAgents] = useState([]);
  const [superUsers, setSuperUsers] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [newUser, setNewUser] = useState({
    email: '',
    password: '',
    name: '',
    role: (currentUser.role === 'director' || currentUser.role === 'back_office') ? 'super_user' : 'agent',
    superUserId: currentUser.role === 'super_user' ? currentUser.id : null
  });

  useEffect(() => {
    loadUsers();
    loadSuperUsers();
  }, []);

  const loadUsers = async () => {
    const allUsers = await API.getUsersByHierarchy(currentUser.id, currentUser.role);
    setUsers(allUsers);
    setAgents(allUsers.filter(u => u.role === 'agent'));
  };

  const loadSuperUsers = async () => {
    const allUsers = await API.getUsers();
    setSuperUsers(allUsers.filter(u => u.role === 'super_user'));
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    if (editingUser) {
      await API.updateUser(editingUser.id, newUser);
    } else {
      await API.createUser(newUser, currentUser.id, currentUser.role);
    }
    setNewUser({ 
      email: '', 
      password: '', 
      name: '', 
      role: (currentUser.role === 'director' || currentUser.role === 'back_office') ? 'super_user' : 'agent',
      superUserId: currentUser.role === 'super_user' ? currentUser.id : null
    });
    setShowForm(false);
    setEditingUser(null);
    loadUsers();
  };

  const handleDeleteUser = async (id) => {
    if (window.confirm('Είστε σίγουροι ότι θέλετε να διαγράψετε αυτόν τον χρήστη;')) {
      await API.deleteUser(id);
      loadUsers();
    }
  };

  const handleEditUser = (user) => {
    setNewUser({
      email: user.email,
      password: user.password,
      name: user.name,
      role: user.role,
      superUserId: user.superUserId || null
    });
    setEditingUser(user);
    setShowForm(true);
  };

  const getRoleBadge = (role) => {
    const styles = {
      director: 'bg-purple-100 text-purple-800 border-purple-300',
      super_user: 'bg-red-100 text-red-800 border-red-300',
      back_office: 'bg-blue-100 text-blue-800 border-blue-300',
      agent: 'bg-green-100 text-green-800 border-green-300'
    };
    const labels = {
      director: 'Director',
      super_user: 'Super User',
      back_office: 'Back Office',
      agent: 'Agent'
    };
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${styles[role]}`}>
        {labels[role]}
      </span>
    );
  };

  const getSuperUserName = (superUserId) => {
    const su = superUsers.find(u => u.id === superUserId);
    return su ? su.name : '-';
  };

  const getAvailableRoles = () => {
    if (currentUser.role === 'director' || currentUser.role === 'back_office') {
      return [
        { value: 'super_user', label: 'Super User' },
        { value: 'back_office', label: 'Back Office' },
        { value: 'agent', label: 'Agent' }
      ];
    } else if (currentUser.role === 'super_user') {
      return [
        { value: 'back_office', label: 'Back Office' },
        { value: 'agent', label: 'Agent' }
      ];
    }
    return [];
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">
            Διαχείριση Χρηστών
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            {currentUser.role === 'director' && 'Διαχείριση όλων των χρηστών του συστήματος'}
            {currentUser.role === 'back_office' && 'Διαχείριση όλων των χρηστών του συστήματος'}
            {currentUser.role === 'super_user' && 'Διαχείριση των agents και back office του δέντρου σας'}
          </p>
        </div>
        <button
          onClick={() => {
            setShowForm(!showForm);
            setEditingUser(null);
            setNewUser({ 
              email: '', 
              password: '', 
              name: '', 
              role: currentUser.role === 'director' ? 'super_user' : 'agent',
              superUserId: currentUser.role === 'super_user' ? currentUser.id : null
            });
          }}
          className="bg-slate-900 text-white px-5 py-2.5 rounded-xl font-semibold hover:bg-slate-800 transition-all flex items-center gap-2"
        >
          <Plus size={20} />
          Νέος Χρήστης
        </button>
      </div>

      {showForm && (
        <div className="mb-6 bg-blue-50 p-6 rounded-xl border-2 border-blue-200">
          <h3 className="font-bold text-lg mb-4 text-gray-900">
            {editingUser ? 'Επεξεργασία Χρήστη' : 'Δημιουργία Νέου Χρήστη'}
          </h3>
          <form onSubmit={handleCreateUser} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-gray-700 font-medium mb-2 text-sm">Όνομα</label>
                <input
                  type="text"
                  placeholder="Όνομα"
                  value={newUser.name}
                  onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                  className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-gray-700 font-medium mb-2 text-sm">Email</label>
                <input
                  type="email"
                  placeholder="Email"
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-gray-700 font-medium mb-2 text-sm">Κωδικός</label>
                <input
                  type="password"
                  placeholder="Κωδικός"
                  value={newUser.password}
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                  className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none"
                  required={!editingUser}
                />
              </div>
              <div>
                <label className="block text-gray-700 font-medium mb-2 text-sm">Ρόλος</label>
                <select
                  value={newUser.role}
                  onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                  className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none"
                >
                  {getAvailableRoles().map(role => (
                    <option key={role.value} value={role.value}>{role.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Show Super User selection for Director/Back Office creating agents/back office */}
            {(currentUser.role === 'director' || currentUser.role === 'back_office') && (newUser.role === 'agent' || newUser.role === 'back_office') && (
              <div className="bg-purple-50 p-4 rounded-xl border border-purple-200">
                <label className="block text-gray-700 font-medium mb-2 text-sm">
                  Ανήκει στον Super User *
                </label>
                <select
                  value={newUser.superUserId || ''}
                  onChange={(e) => setNewUser({ ...newUser, superUserId: parseInt(e.target.value) })}
                  className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none"
                  required
                >
                  <option value="">Επιλέξτε Super User</option>
                  {superUsers.map(su => (
                    <option key={su.id} value={su.id}>{su.name}</option>
                  ))}
                </select>
                <p className="text-xs text-gray-600 mt-2">
                  Ο χρήστης θα ανήκει στο δέντρο του επιλεγμένου Super User
                </p>
              </div>
            )}

            <div className="flex gap-3">
              <button
                type="submit"
                className="flex-1 bg-slate-900 text-white py-2.5 rounded-xl font-semibold hover:bg-slate-800 transition-all"
              >
                {editingUser ? 'Ενημέρωση' : 'Δημιουργία'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setEditingUser(null);
                  setNewUser({ 
                    email: '', 
                    password: '', 
                    name: '', 
                    role: currentUser.role === 'director' ? 'super_user' : 'agent',
                    superUserId: currentUser.role === 'super_user' ? currentUser.id : null
                  });
                }}
                className="flex-1 bg-gray-100 text-gray-700 py-2.5 rounded-xl font-semibold hover:bg-gray-200 transition-all"
              >
                Ακύρωση
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b-2 border-gray-200">
              <th className="text-left py-4 px-3 font-bold text-gray-700">Όνομα</th>
              <th className="text-left py-4 px-3 font-bold text-gray-700">Email</th>
              <th className="text-left py-4 px-3 font-bold text-gray-700">Ρόλος</th>
              {(currentUser.role === 'director' || currentUser.role === 'back_office') && (
                <th className="text-left py-4 px-3 font-bold text-gray-700">Ανήκει σε</th>
              )}
              <th className="text-left py-4 px-3 font-bold text-gray-700">Ενέργειες</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                <td className="py-4 px-3">{user.name}</td>
                <td className="py-4 px-3">{user.email}</td>
                <td className="py-4 px-3">{getRoleBadge(user.role)}</td>
                {(currentUser.role === 'director' || currentUser.role === 'back_office') && (
                  <td className="py-4 px-3 text-sm text-gray-600">
                    {user.role === 'super_user' ? 'Director' : getSuperUserName(user.superUserId)}
                  </td>
                )}
                <td className="py-4 px-3">
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEditUser(user)}
                      className="p-2 text-slate-700 hover:bg-slate-100 rounded-lg transition-all"
                      title="Επεξεργασία"
                    >
                      <Edit2 size={18} />
                    </button>
                    {user.id !== currentUser.id && (
                      <button
                        onClick={() => handleDeleteUser(user.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-all"
                        title="Διαγραφή"
                      >
                        <Trash2 size={18} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// Custom Fields Management
const CustomFieldsManagement = () => {
  const [fields, setFields] = useState([]);
  const [newField, setNewField] = useState('');

  useEffect(() => {
    loadFields();
  }, []);

  const loadFields = async () => {
    const allFields = await API.getCustomFields();
    setFields(allFields);
  };

  const handleAddField = async (e) => {
    e.preventDefault();
    if (newField.trim()) {
      await API.addCustomField({ label: newField });
      setNewField('');
      loadFields();
    }
  };

  const handleDeleteField = async (id) => {
    if (window.confirm('Είστε σίγουροι ότι θέλετε να διαγράψετε αυτό το πεδίο;')) {
      await API.deleteCustomField(id);
      loadFields();
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
      <h2 className="text-3xl font-bold mb-6 text-gray-900">
        Διαχείριση Πεδίων
      </h2>

      <form onSubmit={handleAddField} className="mb-6 flex gap-3">
        <input
          type="text"
          value={newField}
          onChange={(e) => setNewField(e.target.value)}
          placeholder="Όνομα νέου πεδίου..."
          className="flex-1 px-4 py-2.5 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none"
        />
        <button
          type="submit"
          className="bg-slate-900 text-white px-6 py-2.5 rounded-xl font-semibold hover:bg-slate-800 transition-all flex items-center gap-2"
        >
          <Plus size={20} />
          Προσθήκη Πεδίου
        </button>
      </form>

      <div className="space-y-3">
        {fields.map(field => (
          <div key={field.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-200">
            <span className="font-medium text-gray-900">{field.label}</span>
            <button
              onClick={() => handleDeleteField(field.id)}
              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-all"
            >
              <Trash2 size={18} />
            </button>
          </div>
        ))}
        {fields.length === 0 && (
          <div className="text-center py-8 text-gray-400">
            Δεν υπάρχουν προσαρμοσμένα πεδία
          </div>
        )}
      </div>
    </div>
  );
};

// Main Dashboard Component
const Dashboard = ({ user, onLogout, cloudStatus, onExportJSON }) => {
  const [view, setView] = useState('dashboard');
  const [customers, setCustomers] = useState([]);
  const [agents, setAgents] = useState([]);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [commentModalCustomer, setCommentModalCustomer] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    loadCustomers();
    loadAgents();
  }, [user]);

  const loadCustomers = async () => {
    const data = await API.getCustomers(user.id, user.role, user.assignedAgents || []);
    setCustomers(data);
  };

  const loadAgents = async () => {
    const allUsers = await API.getUsers();
    setAgents(allUsers.filter(u => u.role === 'agent'));
  };

  const handleSave = () => {
    loadCustomers();
    setView('dashboard');
    setEditingCustomer(null);
  };

  const handleEdit = (customer) => {
    setEditingCustomer(customer);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Είστε σίγουροι ότι θέλετε να διαγράψετε αυτόν τον πελάτη;')) {
      await API.deleteCustomer(id);
      loadCustomers();
    }
  };

  const handleAddComment = async (customerId, comment) => {
    await API.addComment(customerId, comment, user.name, user.role);
    loadCustomers();
    // Update the modal if it's open
    const updated = customers.find(c => c.id === customerId);
    if (updated && commentModalCustomer) {
      setCommentModalCustomer(updated);
    }
  };

  const getRoleLabel = (role) => {
    const labels = {
      director: 'Director',
      super_user: 'Super User',
      back_office: 'Back Office',
      agent: 'Agent'
    };
    return labels[role];
  };

  // Calculate dashboard stats
  const totalCustomers = customers.length;
  const activeAgents = user.role === 'agent' ? 1 : agents.filter(a => 
    customers.some(c => c.agentId === a.id)
  ).length;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sidebar */}
      <div className={`fixed left-0 top-0 h-screen bg-white border-r border-gray-200 p-6 flex flex-col transition-all duration-300 z-40 ${
        sidebarOpen ? 'w-64' : 'w-0 -translate-x-full'
      }`}>
        {/* Logo */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 bg-slate-900 rounded-xl flex items-center justify-center flex-shrink-0">
              <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
              </svg>
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-bold text-gray-900 truncate">Energy CRM</h1>
              <p className="text-xs text-gray-500">Hellas</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-2">
          <button
            onClick={() => setView('dashboard')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all ${
              view === 'dashboard'
                ? 'bg-slate-900 text-white'
                : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            <Grid size={20} />
            <span>Dashboard</span>
          </button>

          <button
            onClick={() => setView('customers')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all ${
              view === 'customers'
                ? 'bg-slate-900 text-white'
                : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            <Users size={20} />
            <span>Πελάτες</span>
          </button>

          {user.role === 'agent' && (
            <button
              onClick={() => setView('new')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all ${
                view === 'new'
                  ? 'bg-slate-900 text-white'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <Plus size={20} />
              <span>Νέος Πελάτης</span>
            </button>
          )}

          {(user.role === 'director' || user.role === 'super_user' || user.role === 'back_office') && (
            <>
              <button
                onClick={() => setView('users')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all ${
                  view === 'users'
                    ? 'bg-slate-900 text-white'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <User size={20} />
                <span>Χρήστες</span>
              </button>
            </>
          )}

          {(user.role === 'director' || user.role === 'super_user' || user.role === 'back_office') && (
            <button
              onClick={() => setView('fields')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all ${
                view === 'fields'
                  ? 'bg-slate-900 text-white'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <FileText size={20} />
              <span>Πεδία</span>
            </button>
          )}
        </nav>

        {/* User Profile */}
        <div className="border-t border-gray-200 pt-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-slate-900 rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0">
              {user.name.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-gray-900 truncate">{user.name}</p>
              <p className="text-xs text-gray-500">{getRoleLabel(user.role)}</p>
            </div>
          </div>
          <button
            onClick={onLogout}
            className="w-full bg-gray-100 text-gray-700 px-4 py-2 rounded-xl font-medium hover:bg-gray-200 transition-all text-sm"
          >
            Αποσύνδεση
          </button>
        </div>
      </div>

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/20 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main Content */}
      <div className={`transition-all duration-300 ${sidebarOpen ? 'lg:ml-64' : 'ml-0'}`}>
        {/* Top Bar with Menu Button */}
        <div className="sticky top-0 z-20 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label="Toggle Menu"
            >
              <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <div>
              <h1 className="text-lg font-bold text-gray-900">
                {view === 'dashboard' && 'Dashboard'}
                {view === 'customers' && 'Πελάτες'}
                {view === 'users' && 'Χρήστες'}
                {view === 'fields' && 'Πεδία'}
                {view === 'new' && 'Νέος Πελάτης'}
              </h1>
            </div>
          </div>

          {/* Cloud Status + Export/Import */}
          <div className="flex items-center gap-2">
            {/* Status pill */}
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
              cloudStatus ? 'bg-green-50 text-green-700' : 'bg-yellow-50 text-yellow-700'
            }`}>
              <span className={`w-2 h-2 rounded-full animate-pulse ${cloudStatus ? 'bg-green-500' : 'bg-yellow-500'}`}></span>
              {cloudStatus ? 'Sync ✓' : 'Local'}
            </div>

            {/* Export JSON */}
            <button
              onClick={onExportJSON}
              className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              title="Export backup JSON"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            </button>

            {/* Import JSON */}
            <label className="cursor-pointer">
              <input type="file" accept=".json" className="hidden" onChange={async (e) => {
                if (e.target.files[0]) {
                  try {
                    await importBackupJSON(e.target.files[0]);
                    alert('✓ Αποκατάσταση επιτυχώς!');
                    window.location.reload();
                  } catch { alert('✗ Σφάλμα αρχείου'); }
                }
              }} />
              <span className="p-1.5 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors inline-flex" title="Import backup JSON">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
              </span>
            </label>
          </div>
        </div>

        <div className="p-8">
        {/* Dashboard View */}
        {view === 'dashboard' && (
          <div className="space-y-6">
            {/* Welcome Header */}
            <div className="bg-gradient-to-r from-slate-900 to-slate-700 rounded-2xl p-8 text-white">
              <h2 className="text-3xl font-bold mb-2">Καλώς ήρθατε, {user.name}</h2>
              <p className="text-slate-200">{getRoleLabel(user.role)}</p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                    <Users className="text-blue-600" size={24} />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900">{totalCustomers}</p>
                    <p className="text-sm text-gray-600">Σύνολο Πελατών</p>
                    <p className="text-xs text-gray-400 mt-1">Όλοι οι πελάτες</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                    <Check className="text-green-600" size={24} />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900">
                      {customers.filter(c => c.status === 'ενεργό').length}
                    </p>
                    <p className="text-sm text-gray-600">Ενεργοί</p>
                    <p className="text-xs text-gray-400 mt-1">Ενεργοποιημένες αιτήσεις</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                    <Users className="text-purple-600" size={24} />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900">{activeAgents}</p>
                    <p className="text-sm text-gray-600">
                      {user.role === 'agent' ? 'Agent' : 'Σύνολο Agents'}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">Ενεργοί συνεργάτες</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Button */}
            {user.role === 'agent' && (
              <div className="flex justify-end">
                <button
                  onClick={() => setView('new')}
                  className="bg-slate-900 text-white px-6 py-3 rounded-xl font-semibold hover:bg-slate-800 transition-all flex items-center gap-2"
                >
                  <Plus size={20} />
                  Νέος Πελάτης
                </button>
              </div>
            )}

            {/* Quick Links */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow cursor-pointer"
                   onClick={() => setView('customers')}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-bold text-gray-900">Πελάτες</h3>
                  <Users className="text-blue-600" size={32} />
                </div>
                <p className="text-gray-600 mb-4">Διαχείριση και προβολή όλων των πελατών</p>
                <div className="flex items-center text-blue-600 font-medium">
                  <span>Προβολή όλων</span>
                  <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>

              {(user.role === 'director' || user.role === 'back_office') && (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow cursor-pointer"
                     onClick={() => setView('users')}>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-bold text-gray-900">Χρήστες</h3>
                    <User className="text-purple-600" size={32} />
                  </div>
                  <p className="text-gray-600 mb-4">Διαχείριση όλων των χρηστών</p>
                  <div className="flex items-center text-purple-600 font-medium">
                    <span>Διαχείριση</span>
                    <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Customers List View - Full Page */}
        {view === 'customers' && (
          <div className="space-y-6">
            {/* Page Header */}
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-3xl font-bold text-gray-900 mb-2">Διαχείριση Πελατών</h2>
                <p className="text-gray-600">Προβολή και διαχείριση όλων των πελατών</p>
              </div>
              {user.role === 'agent' && (
                <button
                  onClick={() => setView('new')}
                  className="bg-slate-900 text-white px-6 py-3 rounded-xl font-semibold hover:bg-slate-800 transition-all flex items-center gap-2"
                >
                  <Plus size={20} />
                  Νέος Πελάτης
                </button>
              )}
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-gray-600 text-sm font-medium">Σύνολο</h3>
                  <Users className="text-blue-500" size={20} />
                </div>
                <p className="text-3xl font-bold text-gray-900">{customers.length}</p>
                <p className="text-xs text-gray-500 mt-1">Όλοι οι πελάτες</p>
              </div>

              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-gray-600 text-sm font-medium">Ενεργοί</h3>
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                </div>
                <p className="text-3xl font-bold text-green-600">
                  {customers.filter(c => c.status === 'ενεργό').length}
                </p>
                <p className="text-xs text-gray-500 mt-1">Ενεργοποιημένοι</p>
              </div>

              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-gray-600 text-sm font-medium">Εκκρεμότητα</h3>
                  <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
                </div>
                <p className="text-3xl font-bold text-orange-600">
                  {customers.filter(c => c.status === 'εκκρεμότητα').length}
                </p>
                <p className="text-xs text-gray-500 mt-1">Σε εκκρεμότητα</p>
              </div>

              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-gray-600 text-sm font-medium">Αναμονή</h3>
                  <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                </div>
                <p className="text-3xl font-bold text-blue-600">
                  {customers.filter(c => c.status === 'σε αναμονή').length}
                </p>
                <p className="text-xs text-gray-500 mt-1">Σε αναμονή</p>
              </div>
            </div>

            {/* Customer List Component */}
            <CustomerList
              user={user}
              customers={customers}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onExport={() => {}}
              onViewComments={setCommentModalCustomer}
              agents={agents}
            />
          </div>
        )}

        {/* New Customer View */}
        {view === 'new' && (
          <CustomerForm
            user={user}
            onSave={handleSave}
            onCancel={() => setView('dashboard')}
          />
        )}

        {/* Users Management */}
        {view === 'users' && (user.role === 'director' || user.role === 'super_user' || user.role === 'back_office') && (
          <UserManagement currentUser={user} />
        )}

        {/* Custom Fields Management */}
        {view === 'fields' && (user.role === 'director' || user.role === 'super_user' || user.role === 'back_office') && (
          <CustomFieldsManagement />
        )}
        </div>
      </div>

      {/* Edit Modal */}
      {editingCustomer && (
        <BackOfficeEditModal
          customer={editingCustomer}
          onSave={() => {
            setEditingCustomer(null);
            loadCustomers();
          }}
          onClose={() => setEditingCustomer(null)}
        />
      )}

      {/* Comment History Modal */}
      {commentModalCustomer && (
        <CommentHistoryModal
          customer={commentModalCustomer}
          user={user}
          onClose={() => setCommentModalCustomer(null)}
          onAddComment={handleAddComment}
        />
      )}
    </div>
  );
};

// Main App Component
export default function EnergyCRM() {
  const [user, setUser] = useState(null);
  const [cloudStatus, setCloudStatus] = useState(cloudEnabled());

  useEffect(() => {
    initializeDemoData();
    // On first load: pull cloud → localStorage if cloud has data, else seed cloud from local
    if (cloudEnabled()) {
      syncDemoDataToCloud().then(() => setCloudStatus(true));
    }
  }, []);

  // Manual JSON export (safety net — always works, no dependency)
  const handleExportJSON = () => exportBackupJSON();

  if (!user) {
    return <LoginPage onLogin={setUser} />;
  }

  return <Dashboard user={user} onLogout={() => setUser(null)} cloudStatus={cloudStatus} onExportJSON={handleExportJSON} />;
}
