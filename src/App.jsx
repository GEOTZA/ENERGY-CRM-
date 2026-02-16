import React, { useState, useEffect, useRef } from 'react';
import { Download, Plus, Trash2, Copy, Check, MessageSquare, X, Edit2, Filter, User, Users, Grid, FileText, Settings } from 'lucide-react';
import * as XLSX from 'xlsx';

// ============================================================
// SUPABASE CONFIG
// ============================================================
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://svrwybfxtcibqwijltwh.supabase.co';
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN2cnd5YmZ4dGNpYnF3aWpsdHdoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA0NzUzNDcsImV4cCI6MjA4NjA1MTM0N30.gYO5vyfV0KKUc3qWbUx5_eGW7q7BB5T7NtkOBs3LQWc';

const cloudEnabled = () => !!(SUPABASE_URL && SUPABASE_KEY);

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
    if (!res.ok) {
      const errText = await res.text();
      console.warn('Supabase error', res.status, errText);
      throw new Error(`Supabase REST error ${res.status}: ${errText}`);
    }
    const text = await res.text();
    return text ? JSON.parse(text) : [];
  } catch (e) { console.warn('Supabase fetch failed:', e); return null; }
};

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

const exportToExcel = (customers, users, customFields) => {
  const data = customers.map(c => {
    const agent = users?.find?.(u => u.id === c.agentId);
    const row = {
      'ID': c.id,
      'Όνομα': c.name || '',
      'Επώνυμο': c.surname || '',
      'ΑΦΜ': c.afm || '',
      'Τηλέφωνο': c.phone || '',
      'Email': c.email || '',
      'Πάροχος': c.provider || '',
      'Agent': agent ? agent.name : c.agentName || '',
      'Διεύθυνση Εγκατάστασης': c.installationAddress || '',
      'Διεύθυνση Τιμολόγησης': c.billingAddress || '',
      'Ημ/νία Υποβολής': c.submissionDate || '',
      'Κατάσταση': c.status || '',
      'Ημ/νία Ενεργοποίησης': c.activationDate || '',
      'Αρ. Ταυτότητας': c.idNumber || '',
      'Ημ/νία Γέννησης': c.birthDate || ''
    };
    
    if (customFields && customFields.length > 0) {
      customFields.forEach(field => {
        if (c.customFields && c.customFields[field.id]) {
          row[field.label] = c.customFields[field.id];
        }
      });
    }
    
    return row;
  });

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(data);
  
  const colWidths = [
    { wch: 8 }, { wch: 15 }, { wch: 15 }, { wch: 12 }, { wch: 15 }, 
    { wch: 25 }, { wch: 15 }, { wch: 15 }, { wch: 30 }, { wch: 30 }, 
    { wch: 12 }, { wch: 15 }, { wch: 12 }, { wch: 15 }, { wch: 12 }
  ];
  ws['!cols'] = colWidths;
  
  XLSX.utils.book_append_sheet(wb, ws, 'Πελάτες');
  
  const date = new Date().toISOString().slice(0, 10);
  const filename = `energy_crm_customers_${date}.xlsx`;
  
  XLSX.writeFile(wb, filename);
};

const PROVIDERS = [
  'ΔΕΗ', 'Protergia', 'Enerwave', 'NRG', 'Heron', 'Volton', 'ZeniΘ',
  'Φυσικό Αέριο Ελλάδος', 'We Energy', 'Eunice Energy', 'Ελινόιλ Ρεύμα',
  'Blue Power Energy', 'Volterra', 'EFA Energy'
];

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

const sendEmailNotification = (to, subject, message) => {
  console.log(`📧 Email sent to ${to}`);
  console.log(`Subject: ${subject}`);
  console.log(`Message: ${message}`);
};

const downloadSignature = (signatureDataUrl, customerName) => {
  const link = document.createElement('a');
  link.href = signatureDataUrl;
  link.download = `signature_${customerName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.png`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

const API = {
  async login(email, password) {
    return new Promise(async (resolve) => {
      setTimeout(async () => {
        let users = null;
        if (cloudEnabled()) {
          users = await sb(`users?email=eq.${encodeURIComponent(email)}`);
        }
        if (!users || users.length === 0) {
          users = JSON.parse(localStorage.getItem('crm_users') || '[]').filter(u => u.email === email);
        }
        const user = (users || []).find(u => u.password === password && u.status !== 'suspended' && u.status !== 'deleted');
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

  async getCustomers(userId, userRole) {
    let customers;
    if (cloudEnabled()) {
      const result = await sb('customers');
      if (result && result.length >= 0) {
        customers = result;
        localStorage.setItem('crm_customers', JSON.stringify(customers));
      } else {
        customers = JSON.parse(localStorage.getItem('crm_customers') || '[]');
      }
    } else {
      customers = JSON.parse(localStorage.getItem('crm_customers') || '[]');
    }

    const users = JSON.parse(localStorage.getItem('crm_users') || '[]');
    if (userRole === 'agent') return customers.filter(c => c.agentId === userId);
    
    if (userRole === 'partner') {
      const agentIds = users.filter(u => u.role === 'agent' && u.superUserId === userId).map(u => u.id);
      return customers.filter(c => c.agentId === userId || agentIds.includes(c.agentId));
    }
    
    if (userRole === 'supervisor') {
      const directAgentIds = users.filter(u => u.role === 'agent' && u.superUserId === userId).map(u => u.id);
      const partnerIds = users.filter(u => u.role === 'partner' && u.superUserId === userId).map(u => u.id);
      const agentsUnderPartners = users.filter(u => u.role === 'agent' && partnerIds.includes(u.superUserId)).map(u => u.id);
      const allAgentIds = [...directAgentIds, ...partnerIds, ...agentsUnderPartners];
      return customers.filter(c => allAgentIds.includes(c.agentId));
    }
    
    return customers;
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

    if (cloudEnabled()) { await sb('customers', 'POST', newCustomer); }

    const customers = JSON.parse(localStorage.getItem('crm_customers') || '[]');
    customers.push(newCustomer);
    localStorage.setItem('crm_customers', JSON.stringify(customers));

    const users = JSON.parse(localStorage.getItem('crm_users') || '[]');
    users.filter(u => u.role === 'supervisor').forEach(su => {
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

    if (cloudEnabled()) { await sb(`customers?id=eq.${id}`, 'PATCH', customers[index]); }
    localStorage.setItem('crm_customers', JSON.stringify(customers));

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
    if (userRole === 'admin' || userRole === 'director' || userRole === 'back_office') return users;
    
    if (userRole === 'supervisor') {
      const directReports = users.filter(u => u.superUserId === userId);
      const partnerIds = directReports.filter(u => u.role === 'partner').map(u => u.id);
      const agentsUnderPartners = users.filter(u => u.role === 'agent' && partnerIds.includes(u.superUserId));
      return [users.find(u => u.id === userId), ...directReports, ...agentsUnderPartners].filter(Boolean);
    }
    
    if (userRole === 'partner') {
      return users.filter(u => u.id === userId || (u.role === 'agent' && u.superUserId === userId));
    }
    
    return [];
  },

  async createUser(user, creatorId, creatorRole) {
    const users = JSON.parse(localStorage.getItem('crm_users') || '[]');
    const newUser = { ...user, id: Date.now(), assignedAgents: [], createdBy: creatorId, status: 'active' };

    if (user.role === 'back_office') {
      newUser.superUserId = null;
    } else if (user.role === 'supervisor' || user.role === 'partner') {
      newUser.superUserId = null;
    } else if (user.role === 'partner') {
      if (creatorRole === 'director') {
        newUser.superUserId = user.superUserId || null;
      } else if (creatorRole === 'supervisor') {
        newUser.superUserId = creatorId;
      }
    } else if (user.role === 'agent') {
      if (creatorRole === 'director') {
        newUser.superUserId = user.superUserId || null;
      } else if (creatorRole === 'supervisor' || creatorRole === 'partner') {
        newUser.superUserId = creatorId;
      }
    }

    if (cloudEnabled()) { await sb('users', 'POST', newUser); }
    users.push(newUser);
    localStorage.setItem('crm_users', JSON.stringify(users));
    return newUser;
  },

  async deleteUser(id) {
    return this.updateUser(id, { status: 'deleted' });
  },

  async suspendUser(id) {
    return this.updateUser(id, { status: 'suspended' });
  },

  async activateUser(id) {
    return this.updateUser(id, { status: 'active' });
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

  async updateCustomField(id, updates) {
    const fields = JSON.parse(localStorage.getItem('crm_custom_fields') || '[]');
    const index = fields.findIndex(f => f.id === id);
    if (index === -1) return null;
    fields[index] = { ...fields[index], ...updates };
    if (cloudEnabled()) { await sb(`custom_fields?id=eq.${id}`, 'PATCH', fields[index]); }
    localStorage.setItem('crm_custom_fields', JSON.stringify(fields));
    return fields[index];
  },

  async deleteCustomField(id) {
    if (cloudEnabled()) { await sb(`custom_fields?id=eq.${id}`, 'DELETE'); }
    const fields = JSON.parse(localStorage.getItem('crm_custom_fields') || '[]').filter(f => f.id !== id);
    localStorage.setItem('crm_custom_fields', JSON.stringify(fields));
    return true;
  }
};

const syncDemoDataToCloud = async () => {
  if (!cloudEnabled()) return;
  const existing = await sb('users');
  if (existing && existing.length > 0) {
    localStorage.setItem('crm_users', JSON.stringify(existing));
    const customers = await sb('customers');
    if (customers) localStorage.setItem('crm_customers', JSON.stringify(customers));
    const fields = await sb('custom_fields');
    if (fields) localStorage.setItem('crm_custom_fields', JSON.stringify(fields));
  } else {
    const users = JSON.parse(localStorage.getItem('crm_users') || '[]');
    for (const u of users) { await sb('users', 'POST', u); }
    const customers = JSON.parse(localStorage.getItem('crm_customers') || '[]');
    for (const c of customers) { await sb('customers', 'POST', c); }
    const fields = JSON.parse(localStorage.getItem('crm_custom_fields') || '[]');
    for (const f of fields) { await sb('custom_fields', 'POST', f); }
  }
};

const initializeDemoData = () => {
  if (!localStorage.getItem('crm_users')) {
    const demoUsers = [
      { id: 0, email: 'admin@crm.com', password: 'admin123!', name: 'System Admin', role: 'admin', status: 'active', createdBy: null },
      { id: 1, email: 'director@crm.com', password: 'dir123', name: 'Director Admin', role: 'director', status: 'active', createdBy: 0 },
      { id: 2, email: 'supervisor@crm.com', password: 'super123', name: 'George Tzagarakis', role: 'supervisor', status: 'active', createdBy: 1, assignedAgents: [] },
      { id: 3, email: 'backoffice@crm.com', password: 'back123', name: 'Back Office User', role: 'back_office', status: 'active', createdBy: 1, superUserId: null },
      { id: 4, email: 'partner@crm.com', password: 'partner123', name: 'Partner Demo', role: 'partner', status: 'active', createdBy: 2, superUserId: 2, assignedAgents: [] },
      { id: 5, email: 'agent@crm.com', password: 'agent123', name: 'Agent Demo', role: 'agent', status: 'active', createdBy: 4, superUserId: 4 }
    ];
    localStorage.setItem('crm_users', JSON.stringify(demoUsers));
  }
  if (!localStorage.getItem('crm_customers')) localStorage.setItem('crm_customers', JSON.stringify([]));
  if (!localStorage.getItem('crm_custom_fields')) localStorage.setItem('crm_custom_fields', JSON.stringify([]));
};
// ═══════════════════════════════════════════════════════════════
// PART 2 - UI COMPONENTS (Login, Forms, Modals)
// Append this AFTER Part 1 (API section)
// ═══════════════════════════════════════════════════════════════

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
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-slate-900 rounded-2xl mb-4">
            <svg className="w-10 h-10 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
            </svg>
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Energy CRM</h1>
          <p className="text-gray-500">Διαχείριση πελατών ενέργειας</p>
        </div>

        <div className="bg-white rounded-3xl shadow-sm border border-gray-200 p-8">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Σύνδεση</h2>
            <p className="text-gray-500 text-sm">Συνδεθείτε με email ή Google</p>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6 text-xs">
            <strong className="text-blue-900">Demo Credentials:</strong><br/>
            <span className="text-blue-800">
              <strong>Admin: admin@crm.com / admin123!</strong><br/>
              Director: director@crm.com / dir123<br/>
              Supervisor: supervisor@crm.com / super123<br/>
              Back Office: backoffice@crm.com / back123<br/>
              Partner: partner@crm.com / partner123<br/>
              Agent: agent@crm.com / agent123
            </span>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4 text-red-700 text-sm">
              {error}
            </div>
          )}

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

// Continue to Part 3...
// ═══════════════════════════════════════════════════════════════
// PART 3 - ADVANCED COMPONENTS (CustomerForm, Modals, Lists)
// Append this AFTER Part 2
// ═══════════════════════════════════════════════════════════════

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

        <FileUploadSection
          files={formData.files}
          onFilesChange={(files) => setFormData({ ...formData, files })}
        />

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
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setIsSignatureModalOpen(true)}
                    className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                  >
                    Επανάληψη
                  </button>
                  {(user.role === 'director' || user.role === 'back_office' || user.role === 'admin') && (
                    <button
                      type="button"
                      onClick={() => downloadSignature(formData.signature, `${formData.name}_${formData.surname}`)}
                      className="flex items-center gap-1 text-green-600 hover:text-green-700 text-sm font-medium"
                    >
                      <Download size={16} />
                      Λήψη PNG
                    </button>
                  )}
                </div>
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

      {isSignatureModalOpen && (
        <SignatureModal
          onSave={(signatureData) => setFormData({ ...formData, signature: signatureData })}
          onClose={() => setIsSignatureModalOpen(false)}
        />
      )}
    </div>
  );
};

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

// Due to file size limits, I'll provide download links for the remaining massive components
// Continue to Part 4 in next file...
// ═══════════════════════════════════════════════════════════════
// PART 3B - Συνέχεια Advanced Components
// Append this AFTER Part 3
// ═══════════════════════════════════════════════════════════════

const ExportFilterModal = ({ customers, users, customFields, onClose }) => {
  const [filters, setFilters] = useState({
    status: 'all',
    provider: 'all',
    dateFrom: '',
    dateTo: '',
    agent: 'all'
  });

  const handleExport = () => {
    let filtered = [...customers];

    if (filters.status !== 'all') {
      filtered = filtered.filter(c => c.status === filters.status);
    }
    if (filters.provider !== 'all') {
      filtered = filtered.filter(c => c.provider === filters.provider);
    }
    if (filters.dateFrom) {
      filtered = filtered.filter(c => c.submissionDate >= filters.dateFrom);
    }
    if (filters.dateTo) {
      filtered = filtered.filter(c => c.submissionDate <= filters.dateTo);
    }
    if (filters.agent !== 'all') {
      filtered = filtered.filter(c => c.agentId === parseInt(filters.agent));
    }

    exportToExcel(filtered, users, customFields);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Φίλτρα Εξαγωγής</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <X size={24} className="text-gray-500" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-gray-700 font-medium mb-2 text-sm">Κατάσταση</label>
            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none"
            >
              <option value="all">Όλες</option>
              <option value="σε αναμονή">Σε αναμονή</option>
              <option value="σε επεξεργασία">Σε επεξεργασία</option>
              <option value="ενεργό">Ενεργό</option>
              <option value="ακυρώθηκε">Ακυρώθηκε</option>
            </select>
          </div>

          <div>
            <label className="block text-gray-700 font-medium mb-2 text-sm">Πάροχος</label>
            <select
              value={filters.provider}
              onChange={(e) => setFilters({ ...filters, provider: e.target.value })}
              className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none"
            >
              <option value="all">Όλοι</option>
              {PROVIDERS.map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-gray-700 font-medium mb-2 text-sm">Από</label>
              <input
                type="date"
                value={filters.dateFrom}
                onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
                className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-gray-700 font-medium mb-2 text-sm">Έως</label>
              <input
                type="date"
                value={filters.dateTo}
                onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
                className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-gray-700 font-medium mb-2 text-sm">Agent</label>
            <select
              value={filters.agent}
              onChange={(e) => setFilters({ ...filters, agent: e.target.value })}
              className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none"
            >
              <option value="all">Όλοι</option>
              {users.filter(u => u.role === 'agent').map(u => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={handleExport}
            className="flex-1 bg-green-600 text-white py-3 rounded-xl font-semibold hover:bg-green-700 transition-all flex items-center justify-center gap-2"
          >
            <Download size={20} />
            Εξαγωγή Excel
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

const CustomerList = ({ user, customers, users, onEdit, onDelete, onAddComment, customFields }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showExportModal, setShowExportModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);

  const getStatusColor = (status) => {
    const colors = {
      'σε αναμονή': 'bg-yellow-100 text-yellow-800 border-yellow-200',
      'σε επεξεργασία': 'bg-blue-100 text-blue-800 border-blue-200',
      'ενεργό': 'bg-green-100 text-green-800 border-green-200',
      'ακυρώθηκε': 'bg-red-100 text-red-800 border-red-200'
    };
    return colors[status] || 'bg-gray-100 text-gray-800 border-gray-200';
  };

  const filteredCustomers = customers.filter(customer => {
    const matchesSearch = (
      customer.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.surname?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.afm?.includes(searchTerm) ||
      customer.phone?.includes(searchTerm)
    );
    const matchesStatus = statusFilter === 'all' || customer.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Αναζήτηση (όνομα, ΑΦΜ, τηλέφωνο...)"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none transition-all"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2.5 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none transition-all"
          >
            <option value="all">Όλες οι καταστάσεις</option>
            <option value="σε αναμονή">Σε αναμονή</option>
            <option value="σε επεξεργασία">Σε επεξεργασία</option>
            <option value="ενεργό">Ενεργό</option>
            <option value="ακυρώθηκε">Ακυρώθηκε</option>
          </select>
          {(user.role === 'director' || user.role === 'supervisor' || user.role === 'admin') && (
            <button
              onClick={() => setShowExportModal(true)}
              className="bg-green-600 text-white px-6 py-2.5 rounded-xl font-semibold hover:bg-green-700 transition-all flex items-center gap-2"
            >
              <Download size={20} />
              Εξαγωγή Excel
            </button>
          )}
        </div>

        <div className="text-sm text-gray-500 mb-4">
          Εμφάνιση {filteredCustomers.length} από {customers.length} πελάτες
        </div>

        <div className="space-y-3">
          {filteredCustomers.map(customer => (
            <div
              key={customer.id}
              className="border-2 border-gray-200 rounded-xl p-5 hover:border-blue-300 transition-all bg-white"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-gray-900">
                    {customer.name} {customer.surname}
                  </h3>
                  <p className="text-sm text-gray-500">
                    ΑΦΜ: {customer.afm} • {customer.phone} • {customer.email}
                  </p>
                </div>
                <span className={`text-xs px-3 py-1 rounded-full border-2 font-semibold ${getStatusColor(customer.status)}`}>
                  {customer.status}
                </span>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4 text-sm">
                <div>
                  <span className="text-gray-500">Πάροχος:</span>
                  <p className="font-medium text-gray-900">{customer.provider}</p>
                </div>
                <div>
                  <span className="text-gray-500">Υποβολή:</span>
                  <p className="font-medium text-gray-900">{customer.submissionDate}</p>
                </div>
                {customer.activationDate && (
                  <div>
                    <span className="text-gray-500">Ενεργοποίηση:</span>
                    <p className="font-medium text-gray-900">{customer.activationDate}</p>
                  </div>
                )}
                <div>
                  <span className="text-gray-500">Agent:</span>
                  <p className="font-medium text-gray-900">{customer.agentName}</p>
                </div>
              </div>

              <div className="flex gap-2">
                {user.role === 'agent' && (
                  <button
                    onClick={() => onEdit(customer)}
                    className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-all text-sm font-semibold flex items-center justify-center gap-2"
                  >
                    <Edit2 size={16} />
                    Επεξεργασία
                  </button>
                )}
                <button
                  onClick={() => setSelectedCustomer(customer)}
                  className="flex-1 bg-purple-600 text-white py-2 rounded-lg hover:bg-purple-700 transition-all text-sm font-semibold flex items-center justify-center gap-2"
                >
                  <MessageSquare size={16} />
                  Σχόλια ({customer.commentHistory?.length || 0})
                </button>
                {user.role === 'agent' && (
                  <button
                    onClick={() => {
                      if (window.confirm('Είστε σίγουρος ότι θέλετε να διαγράψετε αυτόν τον πελάτη;')) {
                        onDelete(customer.id);
                      }
                    }}
                    className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-all text-sm font-semibold"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            </div>
          ))}

          {filteredCustomers.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              Δεν βρέθηκαν πελάτες
            </div>
          )}
        </div>
      </div>

      {selectedCustomer && (
        <CommentHistoryModal
          customer={selectedCustomer}
          user={user}
          onClose={() => setSelectedCustomer(null)}
          onAddComment={onAddComment}
        />
      )}

      {showExportModal && (
        <ExportFilterModal
          customers={customers}
          users={users}
          customFields={customFields}
          onClose={() => setShowExportModal(false)}
        />
      )}
    </div>
  );
};

const BackOfficeEditModal = ({ customer, onClose, onUpdate }) => {
  const [status, setStatus] = useState(customer.status);
  const [comments, setComments] = useState(customer.comments || '');
  const [contract, setContract] = useState(customer.contract || null);

  const handleSave = async () => {
    await onUpdate(customer.id, { status, comments, contract });
    onClose();
  };

  const handleDownload = (categoryId) => {
    const file = customer.files[categoryId];
    if (file) {
      const link = document.createElement('a');
      link.href = file.data;
      link.download = file.name;
      link.click();
    }
  };

  const handleContractUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setContract({
          name: file.name,
          data: reader.result,
          uploadedAt: new Date().toISOString()
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDownloadContract = () => {
    if (contract) {
      const link = document.createElement('a');
      link.href = contract.data;
      link.download = contract.name;
      link.click();
    }
  };

  const handleSendEmail = () => {
    alert(`Email sent to ${customer.email} with contract`);
  };

  const handleSendViber = () => {
    alert(`Viber message sent to ${customer.phone}`);
  };

  const handleSendWhatsApp = () => {
    alert(`WhatsApp message sent to ${customer.phone}`);
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl my-8">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              {customer.name} {customer.surname}
            </h2>
            <p className="text-sm text-gray-500 mt-1">ΑΦΜ: {customer.afm}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <X size={24} className="text-gray-500" />
          </button>
        </div>

        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-blue-50 rounded-xl border border-blue-200 p-4">
              <h3 className="text-sm font-bold text-blue-800 mb-3">Στοιχεία Επικοινωνίας</h3>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-blue-600">Email:</span>
                  <p className="font-medium text-gray-900">{customer.email}</p>
                </div>
                <div>
                  <span className="text-blue-600">Τηλέφωνο:</span>
                  <p className="font-medium text-gray-900">{customer.phone}</p>
                </div>
                <div>
                  <span className="text-blue-600">Αρ. Ταυτότητας:</span>
                  <p className="font-medium text-gray-900">{customer.idNumber}</p>
                </div>
                <div>
                  <span className="text-blue-600">Ημ. Γέννησης:</span>
                  <p className="font-medium text-gray-900">{customer.birthDate}</p>
                </div>
              </div>
            </div>

            <div className="bg-green-50 rounded-xl border border-green-200 p-4">
              <h3 className="text-sm font-bold text-green-800 mb-3">Στοιχεία Σύμβασης</h3>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-green-600">Πάροχος:</span>
                  <p className="font-medium text-gray-900">{customer.provider}</p>
                </div>
                <div>
                  <span className="text-green-600">Ημ. Υποβολής:</span>
                  <p className="font-medium text-gray-900">{customer.submissionDate}</p>
                </div>
                {customer.activationDate && (
                  <div>
                    <span className="text-green-600">Ημ. Ενεργοποίησης:</span>
                    <p className="font-medium text-gray-900">{customer.activationDate}</p>
                  </div>
                )}
                <div>
                  <span className="text-green-600">Agent:</span>
                  <p className="font-medium text-gray-900">{customer.agentName}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-orange-50 rounded-xl border border-orange-200 p-4">
            <h3 className="text-sm font-bold text-orange-800 mb-3">Διευθύνσεις</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-orange-600">Εγκατάστασης:</span>
                <p className="font-medium text-gray-900">{customer.installationAddress}</p>
              </div>
              <div>
                <span className="text-orange-600">Τιμολόγησης:</span>
                <p className="font-medium text-gray-900">{customer.billingAddress}</p>
              </div>
            </div>
          </div>

          <div className="bg-gray-50 rounded-xl border border-gray-200 p-4">
            <h3 className="text-sm font-bold text-gray-800 mb-3">Ανεβασμένα Αρχεία</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {customer.files && Object.keys(customer.files).length > 0 ? (
                Object.entries(customer.files).map(([categoryId, file]) => {
                  const category = FILE_CATEGORIES.find(c => c.id === categoryId);
                  return (
                    <button
                      key={categoryId}
                      onClick={() => handleDownload(categoryId)}
                      className="flex items-center gap-2 bg-white border-2 border-gray-200 rounded-lg p-3 hover:border-blue-400 hover:bg-blue-50 transition-all text-left"
                    >
                      <Download size={16} className="text-blue-600 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-gray-900">{category?.label || categoryId}</p>
                        <p className="text-xs text-gray-500 truncate">{file.name}</p>
                      </div>
                    </button>
                  );
                })
              ) : (
                <p className="text-sm text-gray-500 col-span-full">Δεν υπάρχουν αρχεία</p>
              )}
            </div>
          </div>

          {customer.signature && (
            <div className="bg-purple-50 rounded-xl border border-purple-200 overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 bg-purple-100 border-b border-purple-200">
                <Edit2 size={16} className="text-purple-600" />
                <h3 className="text-sm font-bold text-purple-800">Ψηφιακή Υπογραφή</h3>
              </div>
              <div className="p-4">
                <img 
                  src={customer.signature} 
                  alt="Signature" 
                  className="border-2 border-gray-300 rounded-lg max-h-32 mb-3 w-full object-contain bg-white" 
                />
                <button
                  type="button"
                  onClick={() => downloadSignature(customer.signature, `${customer.name}_${customer.surname}`)}
                  className="w-full bg-green-600 text-white py-2.5 rounded-lg hover:bg-green-700 transition-all text-sm font-semibold flex items-center justify-center gap-2"
                >
                  <Download size={18} />
                  Λήψη PNG Υπογραφής
                </button>
              </div>
            </div>
          )}

          <div className="bg-indigo-50 rounded-xl border border-indigo-200 p-4">
            <h3 className="text-sm font-bold text-indigo-800 mb-3">Συμβόλαιο & Αποστολή</h3>
            
            {contract ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 bg-white border-2 border-green-200 rounded-lg p-3">
                  <svg className="w-5 h-5 text-green-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-sm text-gray-700 flex-1">{contract.name}</span>
                  <button onClick={handleDownloadContract} className="p-1 text-blue-600 hover:bg-blue-100 rounded transition-colors">
                    <Download size={16} />
                  </button>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={handleSendEmail}
                    className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-all text-sm font-semibold flex items-center justify-center gap-2"
                  >
                    <MessageSquare size={16} />
                    Email
                  </button>
                  <button
                    onClick={handleSendViber}
                    className="flex-1 bg-purple-600 text-white py-2 rounded-lg hover:bg-purple-700 transition-all text-sm font-semibold flex items-center justify-center gap-2"
                  >
                    <MessageSquare size={16} />
                    Viber
                  </button>
                  <button
                    onClick={handleSendWhatsApp}
                    className="flex-1 bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 transition-all text-sm font-semibold flex items-center justify-center gap-2"
                  >
                    <MessageSquare size={16} />
                    WhatsApp
                  </button>
                </div>

                <label className="block">
                  <span className="text-xs text-indigo-700 font-medium">Αντικατάσταση συμβολαίου:</span>
                  <input
                    type="file"
                    onChange={handleContractUpload}
                    className="block w-full text-sm text-gray-500 mt-1 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-indigo-100 file:text-indigo-700 hover:file:bg-indigo-200 file:cursor-pointer"
                    accept=".pdf,.doc,.docx"
                  />
                </label>
              </div>
            ) : (
              <label className="flex items-center justify-center gap-2 border-2 border-dashed border-indigo-300 rounded-lg p-6 cursor-pointer hover:border-indigo-500 hover:bg-indigo-100 transition-all">
                <Plus size={20} className="text-indigo-600" />
                <span className="text-sm text-indigo-600 font-medium">Ανέβασμα Συμβολαίου (PDF)</span>
                <input type="file" onChange={handleContractUpload} className="hidden" accept=".pdf,.doc,.docx" />
              </label>
            )}
          </div>

          <div>
            <label className="block text-gray-700 font-bold mb-2">Κατάσταση</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none transition-all"
            >
              <option value="σε αναμονή">Σε αναμονή</option>
              <option value="σε επεξεργασία">Σε επεξεργασία</option>
              <option value="ενεργό">Ενεργό</option>
              <option value="ακυρώθηκε">Ακυρώθηκε</option>
            </select>
          </div>

          <div>
            <label className="block text-gray-700 font-bold mb-2">Σχόλια Back Office</label>
            <textarea
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              rows="4"
              className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none transition-all resize-none"
              placeholder="Προσθέστε σχόλια για τον agent..."
            />
          </div>
        </div>

        <div className="flex gap-3 p-6 border-t border-gray-200">
          <button
            onClick={handleSave}
            className="flex-1 bg-slate-900 text-white py-3 rounded-xl font-semibold hover:bg-slate-800 transition-all"
          >
            Αποθήκευση
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

// Continue to Part 4...
// ═══════════════════════════════════════════════════════════════
// PART 4 - MANAGEMENT COMPONENTS (Admin + Users + Field Builder)
// Append this AFTER Part 3B
// ═══════════════════════════════════════════════════════════════

const AdminPanel = ({ users, onUpdateUser }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [roleFilter, setRoleFilter] = useState('all');

  const getRoleBadgeColor = (role) => {
    const colors = {
      'admin': 'bg-red-100 text-red-800 border-red-200',
      'director': 'bg-purple-100 text-purple-800 border-purple-200',
      'supervisor': 'bg-blue-100 text-blue-800 border-blue-200',
      'partner': 'bg-green-100 text-green-800 border-green-200',
      'agent': 'bg-yellow-100 text-yellow-800 border-yellow-200',
      'back_office': 'bg-orange-100 text-orange-800 border-orange-200'
    };
    return colors[role] || 'bg-gray-100 text-gray-800 border-gray-200';
  };

  const getStatusBadgeColor = (status) => {
    const colors = {
      'active': 'bg-green-100 text-green-800',
      'suspended': 'bg-orange-100 text-orange-800',
      'deleted': 'bg-red-100 text-red-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getRoleLabel = (role) => {
    const labels = {
      'admin': 'Admin',
      'director': 'Director',
      'supervisor': 'Supervisor',
      'partner': 'Partner',
      'agent': 'Agent',
      'back_office': 'Back Office'
    };
    return labels[role] || role;
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = (
      user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchTerm.toLowerCase())
    );
    const matchesStatus = statusFilter === 'all' || user.status === statusFilter;
    const matchesRole = roleFilter === 'all' || user.role === roleFilter;
    return matchesSearch && matchesStatus && matchesRole;
  });

  const handleSuspend = async (userId) => {
    if (window.confirm('Είστε σίγουρος ότι θέλετε να αναστείλετε αυτόν τον χρήστη;')) {
      await API.suspendUser(userId);
      window.location.reload();
    }
  };

  const handleActivate = async (userId) => {
    await API.activateUser(userId);
    window.location.reload();
  };

  const handleDelete = async (userId) => {
    if (window.confirm('Είστε σίγουρος ότι θέλετε να διαγράψετε αυτόν τον χρήστη; (Soft delete)')) {
      await API.deleteUser(userId);
      window.location.reload();
    }
  };

  const stats = {
    total: users.length,
    active: users.filter(u => u.status === 'active').length,
    suspended: users.filter(u => u.status === 'suspended').length,
    deleted: users.filter(u => u.status === 'deleted').length
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4">
          <div className="text-blue-600 text-sm font-semibold mb-1">Σύνολο</div>
          <div className="text-3xl font-bold text-blue-900">{stats.total}</div>
        </div>
        <div className="bg-green-50 border-2 border-green-200 rounded-xl p-4">
          <div className="text-green-600 text-sm font-semibold mb-1">Ενεργοί</div>
          <div className="text-3xl font-bold text-green-900">{stats.active}</div>
        </div>
        <div className="bg-orange-50 border-2 border-orange-200 rounded-xl p-4">
          <div className="text-orange-600 text-sm font-semibold mb-1">Αναστολή</div>
          <div className="text-3xl font-bold text-orange-900">{stats.suspended}</div>
        </div>
        <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4">
          <div className="text-red-600 text-sm font-semibold mb-1">Διαγραμμένοι</div>
          <div className="text-3xl font-bold text-red-900">{stats.deleted}</div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Διαχείριση Χρηστών</h2>

        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <input
            type="text"
            placeholder="Αναζήτηση χρηστών..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 px-4 py-2.5 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none"
          />
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-4 py-2.5 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none"
          >
            <option value="all">Όλοι οι ρόλοι</option>
            <option value="admin">Admin</option>
            <option value="director">Director</option>
            <option value="supervisor">Supervisor</option>
            <option value="partner">Partner</option>
            <option value="agent">Agent</option>
            <option value="back_office">Back Office</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2.5 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none"
          >
            <option value="all">Όλες οι καταστάσεις</option>
            <option value="active">Ενεργοί</option>
            <option value="suspended">Αναστολή</option>
            <option value="deleted">Διαγραμμένοι</option>
          </select>
        </div>

        <div className="space-y-3">
          {filteredUsers.map(user => (
            <div
              key={user.id}
              className="border-2 border-gray-200 rounded-xl p-4 hover:border-blue-300 transition-all"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-bold text-gray-900">{user.name}</h3>
                    <span className={`text-xs px-3 py-1 rounded-full border-2 font-semibold ${getRoleBadgeColor(user.role)}`}>
                      {getRoleLabel(user.role)}
                    </span>
                    <span className={`text-xs px-3 py-1 rounded-full font-semibold ${getStatusBadgeColor(user.status)}`}>
                      {user.status === 'active' ? 'Ενεργός' : user.status === 'suspended' ? 'Αναστολή' : 'Διαγραμμένος'}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600">{user.email}</p>
                </div>

                {user.role !== 'admin' && (
                  <div className="flex gap-2">
                    {user.status === 'active' && (
                      <button
                        onClick={() => handleSuspend(user.id)}
                        className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-all text-sm font-semibold"
                      >
                        Αναστολή
                      </button>
                    )}
                    {user.status === 'suspended' && (
                      <button
                        onClick={() => handleActivate(user.id)}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all text-sm font-semibold"
                      >
                        Ενεργοποίηση
                      </button>
                    )}
                    {user.status !== 'deleted' && (
                      <button
                        onClick={() => handleDelete(user.id)}
                        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all text-sm font-semibold"
                      >
                        Διαγραφή
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}

          {filteredUsers.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              Δεν βρέθηκαν χρήστες
            </div>
          )}
        </div>
      </div>
    </div>
  );
};


const UserManagement = ({ user, users, onCreateUser }) => {
  const [isCreating, setIsCreating] = useState(false);
  const [newUser, setNewUser] = useState({
    name: '',
    email: '',
    password: '',
    role: 'agent',
    superUserId: null
  });

  const myUsers = users.filter(u => {
    if (user.role === 'admin' || user.role === 'director') return true;
    if (user.role === 'supervisor') {
      if (u.superUserId === user.id) return true;
      const partners = users.filter(p => p.role === 'partner' && p.superUserId === user.id);
      const partnerIds = partners.map(p => p.id);
      if (partnerIds.includes(u.superUserId)) return true;
    }
    if (user.role === 'partner') {
      return u.role === 'agent' && u.superUserId === user.id;
    }
    return false;
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    await onCreateUser(newUser);
    setNewUser({ name: '', email: '', password: '', role: 'agent', superUserId: null });
    setIsCreating(false);
    window.location.reload();
  };

  const getRoleOptions = () => {
    if (user.role === 'admin' || user.role === 'director') {
      return [
        { value: 'supervisor', label: 'Supervisor' },
        { value: 'partner', label: 'Partner' },
        { value: 'agent', label: 'Agent' },
        { value: 'back_office', label: 'Back Office' }
      ];
    }
    if (user.role === 'supervisor') {
      return [
        { value: 'partner', label: 'Partner' },
        { value: 'agent', label: 'Agent' }
      ];
    }
    if (user.role === 'partner') {
      return [{ value: 'agent', label: 'Agent' }];
    }
    return [];
  };

  const getSuperUserOptions = () => {
    if (user.role === 'admin' || user.role === 'director') {
      if (newUser.role === 'agent') {
        return users.filter(u => u.role === 'supervisor' || u.role === 'partner');
      } else if (newUser.role === 'partner') {
        return users.filter(u => u.role === 'supervisor');
      }
      return [];
    }
    
    if (user.role === 'supervisor') {
      return [user];
    }
    
    if (user.role === 'partner') {
      return [user];
    }
    
    return [];
  };

  const superUserOptions = getSuperUserOptions();
  const showSuperUserDropdown = superUserOptions.length > 0 && 
    (newUser.role === 'agent' || newUser.role === 'partner');

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-3xl font-bold text-gray-900">Διαχείριση Χρηστών</h2>
          <button
            onClick={() => setIsCreating(!isCreating)}
            className="bg-slate-900 text-white px-6 py-3 rounded-xl font-semibold hover:bg-slate-800 transition-all flex items-center gap-2"
          >
            <Plus size={20} />
            Νέος Χρήστης
          </button>
        </div>

        {isCreating && (
          <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-6 mb-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Δημιουργία Νέου Χρήστη</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-700 font-medium mb-2 text-sm">Όνομα *</label>
                  <input
                    type="text"
                    value={newUser.name}
                    onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                    className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-gray-700 font-medium mb-2 text-sm">Email *</label>
                  <input
                    type="email"
                    value={newUser.email}
                    onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                    className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-gray-700 font-medium mb-2 text-sm">Κωδικός *</label>
                  <input
                    type="password"
                    value={newUser.password}
                    onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                    className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-gray-700 font-medium mb-2 text-sm">Ρόλος *</label>
                  <select
                    value={newUser.role}
                    onChange={(e) => setNewUser({ ...newUser, role: e.target.value, superUserId: null })}
                    className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none"
                    required
                  >
                    {getRoleOptions().map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>

                {showSuperUserDropdown && (
                  <div className="md:col-span-2">
                    <label className="block text-gray-700 font-medium mb-2 text-sm">
                      Ανάθεση σε {newUser.role === 'agent' ? 'Supervisor/Partner' : 'Supervisor'} *
                    </label>
                    <select
                      value={newUser.superUserId || ''}
                      onChange={(e) => setNewUser({ ...newUser, superUserId: parseInt(e.target.value) || null })}
                      className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none"
                      required
                    >
                      <option value="">-- Επιλέξτε {newUser.role === 'agent' ? 'Supervisor/Partner' : 'Supervisor'} --</option>
                      {superUserOptions.map(u => (
                        <option key={u.id} value={u.id}>
                          {u.name} ({u.role})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div className="flex gap-3">
                <button
                  type="submit"
                  className="flex-1 bg-green-600 text-white py-3 rounded-xl font-semibold hover:bg-green-700 transition-all"
                >
                  Δημιουργία
                </button>
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-xl font-semibold hover:bg-gray-300 transition-all"
                >
                  Ακύρωση
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="space-y-3">
          <h3 className="text-lg font-bold text-gray-800 mb-3">
            {user.role === 'admin' || user.role === 'director' ? 'Όλοι οι Χρήστες' : 'Οι Χρήστες μου'}
          </h3>
          {myUsers.map(u => (
            <div
              key={u.id}
              className="border-2 border-gray-200 rounded-xl p-4 hover:border-blue-300 transition-all"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">{u.name}</h3>
                  <p className="text-sm text-gray-600">{u.email}</p>
                  {u.superUserId && (
                    <p className="text-xs text-gray-500 mt-1">
                      Reports to: {users.find(su => su.id === u.superUserId)?.name || 'Unknown'}
                    </p>
                  )}
                </div>
                <span className="text-xs px-3 py-1 rounded-full bg-blue-100 text-blue-800 border-2 border-blue-200 font-semibold">
                  {u.role}
                </span>
              </div>
            </div>
          ))}

          {myUsers.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              Δεν έχετε χρήστες ακόμα
            </div>
          )}
        </div>
      </div>
    </div>
  );
};


        <div className="space-y-3">
          <h3 className="text-lg font-bold text-gray-800 mb-3">
            {user.role === 'admin' || user.role === 'director' ? 'Όλοι οι Χρήστες' : 'Οι Χρήστες μου'}
          </h3>
          {myUsers.map(u => (
            <div
              key={u.id}
              className="border-2 border-gray-200 rounded-xl p-4 hover:border-blue-300 transition-all"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">{u.name}</h3>
                  <p className="text-sm text-gray-600">{u.email}</p>
                  {u.superUserId && (
                    <p className="text-xs text-gray-500 mt-1">
                      Reports to: {users.find(su => su.id === u.superUserId)?.name || 'Unknown'}
                    </p>
                  )}
                </div>
                <span className="text-xs px-3 py-1 rounded-full bg-blue-100 text-blue-800 border-2 border-blue-200 font-semibold">
                  {u.role}
                </span>
              </div>
            </div>
          ))}

          {myUsers.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              Δεν έχετε χρήστες ακόμα
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
const CustomFieldsManagement = () => {
  const [fields, setFields] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingField, setEditingField] = useState(null);
  const [formData, setFormData] = useState({
    label: '',
    type: 'text',
    section: '',
    position: 1,
    required: false,
    validation: {},
    options: [],
    defaultValue: ''
  });

  useEffect(() => {
    loadFields();
  }, []);

  const loadFields = async () => {
    const data = await API.getCustomFields();
    setFields(data || []);
  };

  const handleOpenModal = (field = null) => {
    if (field) {
      setEditingField(field);
      setFormData({
        label: field.label || '',
        type: field.type || 'text',
        section: field.section || '',
        position: field.position || 1,
        required: field.required || false,
        validation: field.validation || {},
        options: field.options || [],
        defaultValue: field.defaultValue || ''
      });
    } else {
      setEditingField(null);
      setFormData({
        label: '',
        type: 'text',
        section: '',
        position: fields.length + 1,
        required: false,
        validation: {},
        options: [],
        defaultValue: ''
      });
    }
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (editingField) {
      await API.updateCustomField(editingField.id, formData);
    } else {
      await API.addCustomField(formData);
    }
    await loadFields();
    setIsModalOpen(false);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Είστε σίγουρος ότι θέλετε να διαγράψετε αυτό το πεδίο;')) {
      await API.deleteCustomField(id);
      await loadFields();
    }
  };

  const addOption = () => {
    setFormData({
      ...formData,
      options: [...formData.options, { value: '', label: '' }]
    });
  };

  const updateOption = (index, field, value) => {
    const newOptions = [...formData.options];
    newOptions[index][field] = value;
    setFormData({ ...formData, options: newOptions });
  };

  const removeOption = (index) => {
    setFormData({
      ...formData,
      options: formData.options.filter((_, i) => i !== index)
    });
  };

  const groupedFields = fields.reduce((acc, field) => {
    const section = field.section || 'Χωρίς Ενότητα';
    if (!acc[section]) acc[section] = [];
    acc[section].push(field);
    return acc;
  }, {});

  Object.keys(groupedFields).forEach(section => {
    groupedFields[section].sort((a, b) => (a.position || 0) - (b.position || 0));
  });

  const getFieldTypeBadge = (type) => {
    const badges = {
      text: 'bg-blue-100 text-blue-800',
      number: 'bg-green-100 text-green-800',
      date: 'bg-purple-100 text-purple-800',
      dropdown: 'bg-orange-100 text-orange-800',
      multiselect: 'bg-pink-100 text-pink-800',
      checkbox: 'bg-yellow-100 text-yellow-800'
    };
    return badges[type] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-3xl font-bold text-gray-900">Field Builder</h2>
          <button
            onClick={() => handleOpenModal()}
            className="bg-slate-900 text-white px-6 py-3 rounded-xl font-semibold hover:bg-slate-800 transition-all flex items-center gap-2"
          >
            <Plus size={20} />
            Νέο Πεδίο
          </button>
        </div>

        {Object.keys(groupedFields).length > 0 ? (
          Object.entries(groupedFields).map(([section, sectionFields]) => (
            <div key={section} className="mb-6">
              <h3 className="text-lg font-bold text-gray-800 mb-3 pb-2 border-b-2 border-gray-200">
                {section}
              </h3>
              <div className="space-y-2">
                {sectionFields.map(field => (
                  <div
                    key={field.id}
                    className="border-2 border-gray-200 rounded-xl p-4 hover:border-blue-300 transition-all flex items-center justify-between"
                  >
                    <div className="flex items-center gap-4 flex-1">
                      <span className="text-gray-500 font-bold text-sm">#{field.position}</span>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-bold text-gray-900">{field.label}</h4>
                          <span className={`text-xs px-2 py-1 rounded-full font-semibold ${getFieldTypeBadge(field.type)}`}>
                            {field.type}
                          </span>
                          {field.required && (
                            <span className="text-xs px-2 py-1 rounded-full bg-red-100 text-red-800 font-semibold">
                              Required
                            </span>
                          )}
                        </div>
                        {(field.type === 'dropdown' || field.type === 'multiselect') && field.options && (
                          <p className="text-xs text-gray-500">
                            {field.options.length} επιλογές
                          </p>
                        )}
                        {field.validation && Object.keys(field.validation).length > 0 && (
                          <p className="text-xs text-gray-500">
                            Validation: {JSON.stringify(field.validation)}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleOpenModal(field)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      >
                        <Edit2 size={18} />
                      </button>
                      <button
                        onClick={() => handleDelete(field.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-12 text-gray-400">
            Δεν υπάρχουν custom fields. Δημιουργήστε το πρώτο!
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl my-8">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-2xl font-bold text-gray-900">
                {editingField ? 'Επεξεργασία Πεδίου' : 'Νέο Πεδίο'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X size={24} className="text-gray-500" />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <div>
                <label className="block text-gray-700 font-medium mb-2 text-sm">Όνομα Πεδίου *</label>
                <input
                  type="text"
                  value={formData.label}
                  onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                  className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-700 font-medium mb-2 text-sm">Τύπος *</label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value, validation: {}, options: [] })}
                    className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none"
                  >
                    <option value="text">Text</option>
                    <option value="number">Number</option>
                    <option value="date">Date</option>
                    <option value="dropdown">Dropdown</option>
                    <option value="multiselect">Multi-select</option>
                    <option value="checkbox">Checkbox</option>
                  </select>
                </div>

                <div>
                  <label className="block text-gray-700 font-medium mb-2 text-sm">Θέση</label>
                  <input
                    type="number"
                    value={formData.position}
                    onChange={(e) => setFormData({ ...formData, position: parseInt(e.target.value) })}
                    className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none"
                    min="1"
                  />
                </div>
              </div>

              <div>
                <label className="block text-gray-700 font-medium mb-2 text-sm">Ενότητα</label>
                <input
                  type="text"
                  value={formData.section}
                  onChange={(e) => setFormData({ ...formData, section: e.target.value })}
                  className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none"
                  placeholder="π.χ. Τεχνικά Στοιχεία"
                  list="sections"
                />
                <datalist id="sections">
                  {[...new Set(fields.map(f => f.section).filter(Boolean))].map(s => (
                    <option key={s} value={s} />
                  ))}
                </datalist>
              </div>

           // ═══════════════════════════════════════════════════════════════
// FIX #2: DASHBOARD NAVIGATION
// ═══════════════════════════════════════════════════════════════
// ΟΔΗΓΙΕΣ:
// 1. Άνοιξε το App.jsx
// 2. Μέσα στο Dashboard component, βρες το <nav> section
// 3. Μέσα στο <nav>, βρες το: <div className="flex items-center gap-2">
// 4. ΑΝΤΙΚΑΤΕΣΤΗΣΕ από το <div> μέχρι το κλείσιμό του </div>
//    με το παρακάτω code:
// ═══════════════════════════════════════════════════════════════

<div className="flex items-center gap-2">
  {user.role === 'agent' && (
    <>
      <button
        onClick={() => { setView('list'); setEditingCustomer(null); }}
        className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2 ${
          view === 'list'
            ? 'bg-slate-900 text-white'
            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
        }`}
      >
        <Grid size={18} />
        Πελάτες
      </button>
      <button
        onClick={() => { setView('new'); setEditingCustomer(null); }}
        className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2 ${
          view === 'new'
            ? 'bg-slate-900 text-white'
            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
        }`}
      >
        <Plus size={18} />
        Νέος
      </button>
    </>
  )}

  {(user.role === 'supervisor' || user.role === 'partner') && (
    <>
      <button
        onClick={() => setView('list')}
        className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2 ${
          view === 'list'
            ? 'bg-slate-900 text-white'
            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
        }`}
      >
        <Grid size={18} />
        Πελάτες
      </button>
      <button
        onClick={() => setView('users')}
        className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2 ${
          view === 'users'
            ? 'bg-slate-900 text-white'
            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
        }`}
      >
        <Users size={18} />
        Χρήστες
      </button>
    </>
  )}

  {user.role === 'director' && (
    <>
      <button
        onClick={() => setView('list')}
        className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2 ${
          view === 'list'
            ? 'bg-slate-900 text-white'
            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
        }`}
      >
        <Grid size={18} />
        Πελάτες
      </button>
      <button
        onClick={() => setView('users')}
        className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2 ${
          view === 'users'
            ? 'bg-slate-900 text-white'
            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
        }`}
      >
        <Users size={18} />
        Χρήστες
      </button>
      <button
        onClick={() => setView('fields')}
        className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2 ${
          view === 'fields'
            ? 'bg-slate-900 text-white'
            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
        }`}
      >
        <Settings size={18} />
        Πεδία
      </button>
    </>
  )}

  {user.role === 'back_office' && (
    <button
      onClick={() => setView('list')}
      className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2 ${
        view === 'list'
          ? 'bg-slate-900 text-white'
          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
      }`}
    >
      <FileText size={18} />
      Αιτήσεις
    </button>
  )}

  {user.role === 'admin' && (
    <>
      <button
        onClick={() => setView('admin')}
        className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2 ${
          view === 'admin'
            ? 'bg-slate-900 text-white'
            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
        }`}
      >
        <User size={18} />
        Admin Panel
      </button>
      <button
        onClick={() => setView('users')}
        className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2 ${
          view === 'users'
            ? 'bg-slate-900 text-white'
            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
        }`}
      >
        <Users size={18} />
        Δημιουργία Χρηστών
      </button>
      <button
        onClick={() => setView('fields')}
        className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2 ${
          view === 'fields'
            ? 'bg-slate-900 text-white'
            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
        }`}
      >
        <Settings size={18} />
        Πεδία
      </button>
    </>
  )}

  <button
    onClick={() => {
      if (window.confirm('Είστε σίγουρος ότι θέλετε να αποσυνδεθείτε;')) {
        window.location.reload();
      }
    }}
    className="ml-2 px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-all"
  >
    Έξοδος
  </button>
</div>

// ═══════════════════════════════════════════════════════════════
// ΑΠΟΤΕΛΕΣΜΑ:
// ✅ Admin: Βλέπει "Admin Panel" + "Δημιουργία Χρηστών" + "Πεδία" (1 φορά!)
// ✅ Director: Βλέπει "Πελάτες" + "Χρήστες" + "Πεδία" (1 φορά!)
// ✅ Όλοι: Καθαρό UI χωρίς duplicates
// ═══════════════════════════════════════════════════════════════


              {formData.type === 'text' && (
                <div className="bg-blue-50 rounded-xl border border-blue-200 p-4">
                  <h4 className="font-bold text-blue-900 mb-3">Validation για Text</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-blue-800 font-medium mb-2 text-sm">Min Length</label>
                      <input
                        type="number"
                        value={formData.validation.minLength || ''}
                        onChange={(e) => setFormData({
                          ...formData,
                          validation: { ...formData.validation, minLength: parseInt(e.target.value) || undefined }
                        })}
                        className="w-full px-4 py-2 border-2 border-blue-200 rounded-lg focus:border-blue-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-blue-800 font-medium mb-2 text-sm">Max Length</label>
                      <input
                        type="number"
                        value={formData.validation.maxLength || ''}
                        onChange={(e) => setFormData({
                          ...formData,
                          validation: { ...formData.validation, maxLength: parseInt(e.target.value) || undefined }
                        })}
                        className="w-full px-4 py-2 border-2 border-blue-200 rounded-lg focus:border-blue-500 focus:outline-none"
                      />
                    </div>
                  </div>
                  <div className="mt-3">
                    <label className="block text-blue-800 font-medium mb-2 text-sm">Regex Pattern</label>
                    <input
                      type="text"
                      value={formData.validation.pattern || ''}
                      onChange={(e) => setFormData({
                        ...formData,
                        validation: { ...formData.validation, pattern: e.target.value || undefined }
                      })}
                      className="w-full px-4 py-2 border-2 border-blue-200 rounded-lg focus:border-blue-500 focus:outline-none"
                      placeholder="π.χ. ^[0-9]{8,12}$"
                    />
                  </div>
                </div>
              )}

              {formData.type === 'number' && (
                <div className="bg-green-50 rounded-xl border border-green-200 p-4">
                  <h4 className="font-bold text-green-900 mb-3">Validation για Number</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-green-800 font-medium mb-2 text-sm">Min Value</label>
                      <input
                        type="number"
                        value={formData.validation.min || ''}
                        onChange={(e) => setFormData({
                          ...formData,
                          validation: { ...formData.validation, min: parseFloat(e.target.value) || undefined }
                        })}
                        className="w-full px-4 py-2 border-2 border-green-200 rounded-lg focus:border-green-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-green-800 font-medium mb-2 text-sm">Max Value</label>
                      <input
                        type="number"
                        value={formData.validation.max || ''}
                        onChange={(e) => setFormData({
                          ...formData,
                          validation: { ...formData.validation, max: parseFloat(e.target.value) || undefined }
                        })}
                        className="w-full px-4 py-2 border-2 border-green-200 rounded-lg focus:border-green-500 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}

              {(formData.type === 'dropdown' || formData.type === 'multiselect') && (
                <div className="bg-orange-50 rounded-xl border border-orange-200 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-bold text-orange-900">Επιλογές</h4>
                    <button
                      type="button"
                      onClick={addOption}
                      className="bg-orange-600 text-white px-3 py-1 rounded-lg hover:bg-orange-700 transition-all text-sm font-semibold"
                    >
                      + Προσθήκη
                    </button>
                  </div>
                  <div className="space-y-2">
                    {formData.options.map((opt, idx) => (
                      <div key={idx} className="flex gap-2">
                        <input
                          type="text"
                          value={opt.value}
                          onChange={(e) => updateOption(idx, 'value', e.target.value)}
                          placeholder="Value"
                          className="flex-1 px-3 py-2 border-2 border-orange-200 rounded-lg focus:border-orange-500 focus:outline-none"
                        />
                        <input
                          type="text"
                          value={opt.label}
                          onChange={(e) => updateOption(idx, 'label', e.target.value)}
                          placeholder="Label"
                          className="flex-1 px-3 py-2 border-2 border-orange-200 rounded-lg focus:border-orange-500 focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => removeOption(idx)}
                          className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-3 p-6 border-t border-gray-200">
              <button
                onClick={handleSave}
                className="flex-1 bg-slate-900 text-white py-3 rounded-xl font-semibold hover:bg-slate-800 transition-all"
              >
                {editingField ? 'Ενημέρωση' : 'Δημιουργία'}
              </button>
              <button
                onClick={() => setIsModalOpen(false)}
                className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-xl font-semibold hover:bg-gray-200 transition-all"
              >
                Ακύρωση
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Continue to Part 5 (Dashboard + Main App)...
// ═══════════════════════════════════════════════════════════════
// PART 5 - FINAL (Dashboard + Main App Component + Export)
// Append this AFTER Part 4
// ═══════════════════════════════════════════════════════════════

const Dashboard = ({ user }) => {
  const [customers, setCustomers] = useState([]);
  const [users, setUsers] = useState([]);
  const [customFields, setCustomFields] = useState([]);
  const [view, setView] = useState('list');
  const [editingCustomer, setEditingCustomer] = useState(null);
const [selectedBackOfficeCustomer, setSelectedBackOfficeCustomer] = useState(null);
  useEffect(() => {
    loadData();
  }, [user]);

  const loadData = async () => {
    const customerData = await API.getCustomers(user.id, user.role);
    const userData = await API.getUsersByHierarchy(user.id, user.role);
    const fieldsData = await API.getCustomFields();
    setCustomers(customerData);
    setUsers(userData);
    setCustomFields(fieldsData);
  };

  const handleSaveCustomer = async () => {
    await loadData();
    setView('list');
    setEditingCustomer(null);
  };

  const handleDeleteCustomer = async (id) => {
    await API.deleteCustomer(id);
    await loadData();
  };

  const handleAddComment = async (customerId, comment) => {
    await API.addComment(customerId, comment, user.name, user.role);
    await loadData();
  };

  const handleUpdateCustomer = async (id, updates) => {
    await API.updateCustomer(id, updates);
    await loadData();
  };

  const handleCreateUser = async (newUser) => {
    await API.createUser(newUser, user.id, user.role);
    await loadData();
  };

  const stats = {
    total: customers.length,
    pending: customers.filter(c => c.status === 'σε αναμονή').length,
    processing: customers.filter(c => c.status === 'σε επεξεργασία').length,
    active: customers.filter(c => c.status === 'ενεργό').length
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b-2 border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Energy CRM</h1>
                <p className="text-xs text-gray-500">{user.name} • {user.role}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {user.role === 'agent' && (
                <>
                  <button
                    onClick={() => { setView('list'); setEditingCustomer(null); }}
                    className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2 ${
                      view === 'list'
                        ? 'bg-slate-900 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    <Grid size={18} />
                    Πελάτες
                  </button>
                  <button
                    onClick={() => { setView('new'); setEditingCustomer(null); }}
                    className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2 ${
                      view === 'new'
                        ? 'bg-slate-900 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    <Plus size={18} />
                    Νέος
                  </button>
                </>
              )}

              {(user.role === 'supervisor' || user.role === 'partner' || user.role === 'director') && (
                <>
                  <button
                    onClick={() => setView('list')}
                    className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2 ${
                      view === 'list'
                        ? 'bg-slate-900 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    <Grid size={18} />
                    Πελάτες
                  </button>
                  <button
                    onClick={() => setView('users')}
                    className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2 ${
                      view === 'users'
                        ? 'bg-slate-900 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    <Users size={18} />
                    Χρήστες
                  </button>
                  {user.role === 'director' && (
                    <button
                      onClick={() => setView('fields')}
                      className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2 ${
                        view === 'fields'
                          ? 'bg-slate-900 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      <Settings size={18} />
                      Πεδία
                    </button>
                  )}
                </>
              )}

              {user.role === 'back_office' && (
                <button
                  onClick={() => setView('list')}
                  className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2 ${
                    view === 'list'
                      ? 'bg-slate-900 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <FileText size={18} />
                  Αιτήσεις
                </button>
              )}

              {user.role === 'admin' && (
                <>
                  <button
                    onClick={() => setView('admin')}
                    className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2 ${
                      view === 'admin'
                        ? 'bg-slate-900 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    <User size={18} />
                    Admin
                  <button
                    onClick={() => setView('users')}
                    className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2 ${
                      view === 'users'
                        ? 'bg-slate-900 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    <Users size={18} />
                    Δημιουργία Χρηστών
                  </button>
                  </button>
                  <button
                    onClick={() => setView('fields')}
                    className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2 ${
                      view === 'fields'
                        ? 'bg-slate-900 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    <Settings size={18} />
                    Πεδία
                  </button>
                </>
              )}


              <button
                onClick={() => {
                  if (window.confirm('Είστε σίγουρος ότι θέλετε να αποσυνδεθείτε;')) {
                    window.location.reload();
                  }
                }}
                className="ml-2 px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-all"
              >
                Έξοδος
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {user.role === 'agent' && view === 'list' && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
              <div className="bg-white rounded-2xl border-2 border-gray-200 p-6">
                <div className="text-gray-500 text-sm font-semibold mb-2">Σύνολο</div>
                <div className="text-4xl font-bold text-gray-900">{stats.total}</div>
              </div>
              <div className="bg-yellow-50 rounded-2xl border-2 border-yellow-200 p-6">
                <div className="text-yellow-700 text-sm font-semibold mb-2">Σε Αναμονή</div>
                <div className="text-4xl font-bold text-yellow-900">{stats.pending}</div>
              </div>
              <div className="bg-blue-50 rounded-2xl border-2 border-blue-200 p-6">
                <div className="text-blue-700 text-sm font-semibold mb-2">Επεξεργασία</div>
                <div className="text-4xl font-bold text-blue-900">{stats.processing}</div>
              </div>
              <div className="bg-green-50 rounded-2xl border-2 border-green-200 p-6">
                <div className="text-green-700 text-sm font-semibold mb-2">Ενεργά</div>
                <div className="text-4xl font-bold text-green-900">{stats.active}</div>
              </div>
            </div>

            <CustomerList
              user={user}
              customers={customers}
              users={users}
              onEdit={(customer) => {
                setEditingCustomer(customer);
                setView('new');
              }}
              onDelete={handleDeleteCustomer}
              onAddComment={handleAddComment}
              customFields={customFields}
            />
          </>
        )}

        {user.role === 'agent' && view === 'new' && (
          <CustomerForm
            user={user}
            onSave={handleSaveCustomer}
            onCancel={() => {
              setView('list');
              setEditingCustomer(null);
            }}
            editingCustomer={editingCustomer}
          />
        )}

        {(user.role === 'supervisor' || user.role === 'partner' || user.role === 'director') && view === 'list' && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
              <div className="bg-white rounded-2xl border-2 border-gray-200 p-6">
                <div className="text-gray-500 text-sm font-semibold mb-2">Σύνολο</div>
                <div className="text-4xl font-bold text-gray-900">{stats.total}</div>
              </div>
              <div className="bg-yellow-50 rounded-2xl border-2 border-yellow-200 p-6">
                <div className="text-yellow-700 text-sm font-semibold mb-2">Σε Αναμονή</div>
                <div className="text-4xl font-bold text-yellow-900">{stats.pending}</div>
              </div>
              <div className="bg-blue-50 rounded-2xl border-2 border-blue-200 p-6">
                <div className="text-blue-700 text-sm font-semibold mb-2">Επεξεργασία</div>
                <div className="text-4xl font-bold text-blue-900">{stats.processing}</div>
              </div>
              <div className="bg-green-50 rounded-2xl border-2 border-green-200 p-6">
                <div className="text-green-700 text-sm font-semibold mb-2">Ενεργά</div>
                <div className="text-4xl font-bold text-green-900">{stats.active}</div>
              </div>
            </div>

            <CustomerList
              user={user}
              customers={customers}
              users={users}
              onEdit={() => {}}
              onDelete={() => {}}
              onAddComment={handleAddComment}
              customFields={customFields}
            />
          </>
        )}

        {(user.role === 'supervisor' || user.role === 'partner' || user.role === 'director') && view === 'users' && (
          <UserManagement
            user={user}
            users={users}
            onCreateUser={handleCreateUser}
          />
        )}

 {user.role === 'back_office' && view === 'list' && (
  <>
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
      <div className="bg-white rounded-2xl border-2 border-gray-200 p-6">
        <div className="text-gray-500 text-sm font-semibold mb-2">Σύνολο</div>
        <div className="text-4xl font-bold text-gray-900">{stats.total}</div>
      </div>
      <div className="bg-yellow-50 rounded-2xl border-2 border-yellow-200 p-6">
        <div className="text-yellow-700 text-sm font-semibold mb-2">Σε Αναμονή</div>
        <div className="text-4xl font-bold text-yellow-900">{stats.pending}</div>
      </div>
      <div className="bg-blue-50 rounded-2xl border-2 border-blue-200 p-6">
        <div className="text-blue-700 text-sm font-semibold mb-2">Επεξεργασία</div>
        <div className="text-4xl font-bold text-blue-900">{stats.processing}</div>
      </div>
      <div className="bg-green-50 rounded-2xl border-2 border-green-200 p-6">
        <div className="text-green-700 text-sm font-semibold mb-2">Ενεργά</div>
        <div className="text-4xl font-bold text-green-900">{stats.active}</div>
      </div>
    </div>

    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Αιτήσεις Πελατών</h2>
      <div className="space-y-3">
        {customers.map(customer => (
          <div
            key={customer.id}
            className="border-2 border-gray-200 rounded-xl p-5 hover:border-blue-300 transition-all cursor-pointer"
            onClick={() => setSelectedBackOfficeCustomer(customer)}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <h3 className="text-lg font-bold text-gray-900">
                  {customer.name} {customer.surname}
                </h3>
                <p className="text-sm text-gray-500">
                  ΑΦΜ: {customer.afm} • {customer.phone}
                </p>
              </div>
              <span className={`text-xs px-3 py-1 rounded-full border-2 font-semibold ${
                customer.status === 'σε αναμονή' ? 'bg-yellow-100 text-yellow-800 border-yellow-200' :
                customer.status === 'σε επεξεργασία' ? 'bg-blue-100 text-blue-800 border-blue-200' :
                customer.status === 'ενεργό' ? 'bg-green-100 text-green-800 border-green-200' :
                'bg-red-100 text-red-800 border-red-200'
              }`}>
                {customer.status}
              </span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
              <div>
                <span className="text-gray-500">Πάροχος:</span>
                <p className="font-medium text-gray-900">{customer.provider}</p>
              </div>
              <div>
                <span className="text-gray-500">Agent:</span>
                <p className="font-medium text-gray-900">{customer.agentName}</p>
              </div>
              <div>
                <span className="text-gray-500">Υποβολή:</span>
                <p className="font-medium text-gray-900">{customer.submissionDate}</p>
              </div>
            </div>
          </div>
        ))}

        {customers.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            Δεν υπάρχουν αιτήσεις
          </div>
        )}
      </div>
    </div>

    {selectedBackOfficeCustomer && (
      <BackOfficeEditModal
        customer={selectedBackOfficeCustomer}
        onClose={() => setSelectedBackOfficeCustomer(null)}
        onUpdate={handleUpdateCustomer}
      />
    )}
  </>
)}


        {user.role === 'admin' && view === 'users' && (
  <UserManagement
    user={user}
    users={users}
    onCreateUser={handleCreateUser}
  />
)}

        {(user.role === 'admin' || user.role === 'director') && view === 'fields' && (
          <CustomFieldsManagement />
        )}
      </div>
    </div>
  );
};

function App() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    // Demo seed & sync only in development
    if (import.meta.env.DEV) {
      initializeDemoData();
      syncDemoDataToCloud();
    }
  }, []);

  if (!user) {
    return <LoginPage onLogin={setUser} />;
  }

  return <Dashboard user={user} />;
}

export default App;
