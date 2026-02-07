# ⚡ Energy CRM - Quick Deployment Reference

## 🎯 Τα Βήματα με Μια Ματιά

### 1️⃣ GitHub (5 λεπτά)
```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/energy-crm.git
git push -u origin main
```

### 2️⃣ Netlify (3 λεπτά)
1. netlify.com → Sign up με GitHub
2. New site → Import from GitHub → επίλεξε `energy-crm`
3. Deploy! → Περίμενε 2 λεπτά
4. 🎉 URL: `https://xyz.netlify.app`

### 3️⃣ Supabase (5 λεπτά)
1. supabase.com → New Project → `energy-crm`
2. SQL Editor → New query → Paste `supabase_setup.sql` → Run
3. Settings → API → Copy:
   - Project URL
   - anon key

### 4️⃣ Connect (2 λεπτά)
1. Edit `src/App.jsx`:
```javascript
const SUPABASE_URL = 'https://xyz.supabase.co';
const SUPABASE_KEY = 'eyJhbGc...';
```
2. Git push → Netlify auto-deploys
3. ✅ Done!

---

## 📋 Checklist

- [ ] GitHub repo created
- [ ] Code pushed
- [ ] Netlify site deployed
- [ ] Supabase project created
- [ ] SQL tables created (3 tables: users, customers, custom_fields)
- [ ] Credentials added to `src/App.jsx`
- [ ] Code pushed again (with credentials)
- [ ] Site shows "🟢 Sync ✓"
- [ ] Login works
- [ ] Data syncs to Supabase

---

## 🔑 Demo Credentials

```
Director:  director@crm.com  / dir123
Agent:     agent@crm.com     / agent123
```

---

## 🆘 Αν Κάτι Πάει Στραβά

| Problem | Fix |
|---------|-----|
| Build failed στο Netlify | Check deploy logs, run `npm install && npm run build` locally |
| "🟡 Local" instead of "🟢 Sync" | Check credentials στο App.jsx |
| Can't login | Check Supabase Table Editor → users table has data |
| No data in Supabase | Refresh page, check browser console (F12) |

---

## 📦 Project Structure

```
energy-crm/
├── src/
│   ├── App.jsx          ← Main app + Supabase config
│   ├── main.jsx         ← Entry point
│   └── index.css        ← Tailwind styles
├── public/              ← Static assets
├── index.html           ← HTML template
├── package.json         ← Dependencies
├── vite.config.js       ← Build config
├── netlify.toml         ← Netlify config
└── supabase_setup.sql   ← Database schema

```

---

## 🔄 Update Workflow

```bash
# Make changes
vim src/App.jsx

# Test local
npm run dev

# Commit & push
git add .
git commit -m "Added feature X"
git push

# Netlify auto-deploys in ~2 minutes!
```

---

## 🌐 URLs You'll Need

- **Your GitHub repo**: `https://github.com/YOUR_USERNAME/energy-crm`
- **Netlify site**: `https://YOUR_SITE.netlify.app`
- **Supabase dashboard**: `https://supabase.com/dashboard/project/YOUR_PROJECT`

---

## 💡 Pro Tips

1. **Custom domain**: Netlify → Domain settings → Add domain
2. **Environment variables**: Use `.env` files instead of hardcoded credentials
3. **Branch deploys**: Push to different branches → Netlify creates preview URLs
4. **Rollback**: Netlify → Deploys → Click old deploy → Publish

---

## ✅ Success Indicators

When everything works:
- ✅ Login screen loads
- ✅ Top right shows "🟢 Sync ✓"
- ✅ Dashboard displays
- ✅ Supabase Table Editor shows users
- ✅ Works on mobile
- ✅ Same data across devices

---

**⏱️ Total Time: ~15 minutes**

**💰 Total Cost: $0** (all free tiers)
