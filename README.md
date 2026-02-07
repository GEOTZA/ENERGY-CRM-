# 🔋 Energy CRM

Modern Customer Relationship Management system for energy providers, built with React + Supabase.

## ✨ Features

- 🔐 Multi-role authentication (Director, Super User, Back Office, Agent)
- 👥 Customer management with file uploads
- 📊 Dashboard with real-time stats
- ☁️ Cloud sync with Supabase
- 📱 Mobile-optimized UI
- 📄 PDF & Excel exports
- 💬 Comment history system
- 📧 Email notifications
- 🔄 Multi-device sync

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- npm or yarn
- Supabase account (free)

### Local Development

```bash
# Install dependencies
npm install

# Start dev server
npm run dev
```

Open http://localhost:5173

### Demo Credentials

| Role | Email | Password |
|------|-------|----------|
| Director | director@crm.com | dir123 |
| Agent | agent@crm.com | agent123 |

## 📦 Deployment

See [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) for complete step-by-step instructions.

### Quick Deploy to Netlify

1. Fork this repo
2. Connect to Netlify
3. Deploy!

### Supabase Setup

1. Create project on supabase.com
2. Run `supabase_setup.sql` in SQL Editor
3. Add credentials to `src/App.jsx`

## 🏗️ Tech Stack

- **Frontend**: React 18, Tailwind CSS
- **Build**: Vite
- **Backend**: Supabase (PostgreSQL)
- **Hosting**: Netlify
- **Storage**: localStorage + Supabase sync

## 📖 Documentation

- [Deployment Guide](DEPLOYMENT_GUIDE.md) - Step-by-step deployment
- [Supabase Setup](supabase_setup.sql) - Database schema

## 🔧 Configuration

Edit `src/App.jsx`:

```javascript
const SUPABASE_URL = 'your-project-url';
const SUPABASE_KEY = 'your-anon-key';
```

## 📝 License

MIT

## 🤝 Contributing

PRs welcome! Please test locally before submitting.

## 📞 Support

Open an issue for bugs or feature requests.

---

Built with ❤️ for energy professionals
