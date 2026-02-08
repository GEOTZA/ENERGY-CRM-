# 🚀 Energy CRM - Οδηγός Deployment (Βήμα-βήμα)

## 📋 Προαπαιτούμενα

Χρειάζεσαι λογαριασμούς (όλα free):
- ✅ GitHub account (έχεις ήδη - repo: energy-crm)
- ⬜ Netlify account
- ⬜ Supabase account

---

## ΒΗΜΑ 1: Ανέβασμα στο GitHub

### Option A: Μέσω Terminal (Recommended)

```bash
# 1. Πήγαινε στον φάκελο του project
cd /path/to/energy-crm-github

# 2. Initialize Git
git init

# 3. Add files
git add .

# 4. First commit
git commit -m "Initial commit - Energy CRM"

# 5. Σύνδεση με το remote repo
git remote add origin https://github.com/YOUR_USERNAME/energy-crm.git

# 6. Push
git branch -M main
git push -u origin main
```

### Option B: Μέσω GitHub Web

1. Πήγαινε στο https://github.com/YOUR_USERNAME/energy-crm
2. Click "uploading an existing file"
3. Drag & drop ΟΛΑ τα files από το folder
4. Commit → "Initial commit"

---

## ΒΗΜΑ 2: Deploy στο Netlify

### 2.1 Σύνδεση

1. Πήγαινε στο https://netlify.com
2. **Sign up** με GitHub account (recommended)
3. Authorize Netlify να διαβάσει τα repos σου

### 2.2 Δημιουργία Site

1. Dashboard → **Add new site** → **Import an existing project**
2. Choose **Deploy with GitHub**
3. Authorize (αν χρειάζεται)
4. Επίλεξε το repo: **energy-crm**

### 2.3 Build Settings

Το Netlify διαβάζει αυτόματα το `netlify.toml`, αλλά confirm:

```
Build command: npm run build
Publish directory: dist
```

### 2.4 Deploy!

1. Click **Deploy energy-crm**
2. Περίμενε ~2-3 λεπτά (βλέπεις progress)
3. ✅ Success! Σου δίνει URL: `https://random-name-12345.netlify.app`

### 2.5 Test (Local Mode)

1. Άνοιξε το Netlify URL
2. Θα δεις login screen
3. Πάνω δεξιά: **🟡 Local** (γιατί δεν έχεις Supabase ακόμα)
4. Login: `director@crm.com` / `dir123`
5. Βλέπεις dashboard → ✅ Working!

---

## ΒΗΜΑ 3: Supabase Setup

### 3.1 Δημιουργία Project

1. Πήγαινε στο https://supabase.com
2. **Sign up** (με GitHub - recommended)
3. **New Project**

Συμπλήρωσε:
- **Name**: `energy-crm`
- **Database Password**: (βάλε κάτι ισχυρό, π.χ. `MySecure123Pass!`)
  - ⚠️ **ΚΡΑΤΑ** το password αυτό!
- **Region**: Europe West (Ireland)
- **Pricing Plan**: Free

4. **Create new project**
5. Περίμενε ~30 seconds (loading bar)

### 3.2 Δημιουργία Tables

1. Αριστερό sidebar → **SQL Editor**
2. Click **+ New query**
3. Άνοιξε το `supabase_setup.sql` από το project
4. **Copy-paste** ολόκληρο το περιεχόμενο
5. Click **Run** (► button στο κάτω δεξιά)
6. Βλέπεις ✅ "Success. No rows returned" → Perfect!

### 3.3 Verify Tables

1. Αριστερό sidebar → **Table Editor**
2. Βλέπεις 3 tables:
   - ✅ `users`
   - ✅ `customers`
   - ✅ `custom_fields`

### 3.4 Πάρε Credentials

1. Αριστερό sidebar → **Settings** (⚙️ κάτω)
2. Click **API**
3. Θα δεις:

**Project URL:**
```
https://abcdefghijklmno.supabase.co
```
→ Copy αυτό

**Project API keys:**
```
anon public: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3...
```
→ Copy το **anon** key (όχι το service_role!)

---

## ΒΗΜΑ 4: Σύνδεση App με Supabase

### 4.1 Update Code

1. Άνοιξε το `src/App.jsx`
2. Βρες τις γραμμές στην κορυφή (γύρω στη γραμμή 12):

```javascript
const SUPABASE_URL = '';   // ← ΑΛΛΑΞΕ ΕΔΩ
const SUPABASE_KEY = '';   // ← ΑΛΛΑΞΕ ΕΔΩ
```

3. Βάλε τα credentials σου:

```javascript
const SUPABASE_URL = 'https://abcdefghijklmno.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';
```

⚠️ **Προσοχή**: Βάλε τα ΔΙΚΑ σου values!

### 4.2 Commit & Push

```bash
git add src/App.jsx
git commit -m "Add Supabase credentials"
git push
```

### 4.3 Αυτόματο Re-deploy

- Το Netlify βλέπει το push
- Ξεκινάει αυτόματα rebuild
- Περίμενε ~2 λεπτά
- Refresh το Netlify URL

---

## ΒΗΜΑ 5: Verification!

### 5.1 Check το Site

1. Άνοιξε το Netlify URL
2. Πάνω δεξιά τώρα λέει: **🟢 Sync ✓**
3. Login: `director@crm.com` / `dir123`

### 5.2 Check Supabase

1. Supabase Dashboard → **Table Editor**
2. Click στο `users` table
3. Βλέπεις 2-4 rows (director, agent, κλπ.)? → ✅ Sync works!

### 5.3 Multi-Device Test

1. Άνοιξε το URL από κινητό
2. Login με agent: `agent@crm.com` / `agent123`
3. Βλέπεις τα ίδια users? → ✅ Cloud sync working!

---

## 🎉 SUCCESS!

Τώρα έχεις:
- ✅ App deployed στο Netlify
- ✅ Database στο Supabase
- ✅ Auto-deploy όταν κάνεις push
- ✅ Multi-device sync

---

## 📊 Πώς Λειτουργεί

```
User κάνει κάτι (π.χ. add customer)
         ↓
localStorage (instant save)
         ↓
Supabase Cloud (async sync)
         ↓
Κάθε device που ανοίγει το app
pulls fresh data from Supabase
```

---

## 🔄 Workflow Από Εδώ και Πέρα

### Για νέες αλλαγές:

1. Κάνε αλλαγές στο code
2. Test local: `npm run dev`
3. Commit & push:
```bash
git add .
git commit -m "Description of changes"
git push
```
4. Netlify auto-deploys
5. Site updated σε ~2 λεπτά!

### Για database changes:

1. Supabase Dashboard → SQL Editor
2. Run SQL queries
3. Changes instant, no deploy needed

---

## ⚠️ Σημαντικές Σημειώσεις

### Security (Development Mode)
- ✅ Το anon key είναι safe να το βάλεις στο code
- ⚠️ Tables έχουν open access (anyone can read/write)
- 👍 OK for internal/private use
- 🔐 Για production: Enable Row Level Security (RLS) later

### Free Tier Limits
**Netlify:**
- 100GB bandwidth/month
- Unlimited builds
- Auto-deploy

**Supabase:**
- 500MB database storage
- 2GB bandwidth/month
- 50,000 monthly active users

→ Αρκετά για εκατοντάδες πελάτες!

---

## 🐛 Troubleshooting

### "Build failed" στο Netlify
```bash
# Check locally first:
npm install
npm run build
```
→ Αν δουλεύει local, θα δουλέψει και στο Netlify

### "🟡 Local" αντί για "🟢 Sync"
- Check `src/App.jsx` για τα credentials
- Check Supabase Dashboard → Project Settings → API
- Copy-paste ξανά (προσοχή σε κενά/line breaks)

### "Can't connect to database"
- Supabase project running? (Dashboard → Project)
- Tables created? (Table Editor → 3 tables)
- Credentials correct? (API page)

### Netlify deploy stuck
- Check deploy logs: Site → Deploys → Click on deploy
- Usually it's a dependency issue

---

## 📞 Επόμενα Βήματα

Τώρα που το basic setup δουλεύει, μπορούμε να:

1. **Προσθέσουμε features** (ένα-ένα):
   - Customer form με file uploads
   - Customer list με filters
   - PDF export
   - User management
   - Comments system

2. **Custom domain** (optional):
   - Netlify → Domain settings
   - Add custom domain (π.χ. energycrm.gr)

3. **Production hardening**:
   - Enable RLS στο Supabase
   - Add proper authentication
   - Environment variables

Πάμε βήμα-βήμα!
