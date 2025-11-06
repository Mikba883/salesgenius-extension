# 🚀 QUICKSTART - SalesGenius v2.0

## Install in 5 Minutes

### Step 1: Download
Hai già la cartella `salesgenius-extension-v2/` ✅

### Step 2: Load in Chrome
```bash
1. Open Chrome
2. Go to: chrome://extensions/
3. Turn ON "Developer mode" (top-right toggle)
4. Click "Load unpacked"
5. Select folder: salesgenius-extension-v2
6. Done! ✅
```

### Step 3: Verify Installation
Look for:
- ✅ "SalesGenius Real-time AI Sales Coach" in extensions list
- ✅ Version: 2.0.0
- ✅ Status: Enabled (blue toggle)
- ✅ Icon in Chrome toolbar (top-right)

### Step 4: First Test
```bash
1. Go to: https://meet.google.com/new
2. Widget appears bottom-right automatically ✅
3. Click to expand
4. You should see "Checking authentication..."
```

---

## 🎯 Test Recording Flow

### 1. Login (if needed)
- Click "login" link in widget
- Vai su getsalesgenius.com/login
- Inserisci credenziali Supabase

### 2. Start Recording
1. Expand widget (click minimized button)
2. Click "Start Recording"
3. Watch for:
   - Icon changes to recording (red dot)
   - Timer starts: 00:00 → 00:01...
   - WebSocket connects (check console)

### 3. Speak & Test
1. Talk into microphone
2. Wait 5-10 seconds
3. Tips should appear in "Live Tips" section

### 4. Stop Recording
1. Click "Stop" button
2. Icon returns to normal
3. See session summary

---

## 🔍 Debug Checklist

### Console Background (Service Worker)
```bash
chrome://extensions/ 
→ SalesGenius 
→ "Inspect views: service worker"
```

**Look for:**
```
✅ WebSocket connected
✅ Audio stream captured successfully  
✅ Audio processing started
💡 New suggestion starting
```

### Console Content (Meet Tab)
```bash
Open Meet tab → F12 → Console
```

**Look for:**
```
✅ SalesGenius content script loaded v1.1
✅ Detected platform: Google Meet
✅ Widget DOM created
✅ Recording started
```

### Network Tab
```bash
F12 → Network → WS (WebSocket)
```

**Look for:**
- Connection to: `salesgenius-backend.onrender.com`
- Status: 101 Switching Protocols ✅
- Messages flowing (audio frames)

---

## ⚠️ Common Issues

### ❌ Widget non appare
**Solution:**
1. Refresh page (F5)
2. Check URL matches: zoom.us, meet.google.com, etc.
3. Check console for errors

### ❌ "Not signed in"
**Solution:**
1. Click "login" link
2. Login on getsalesgenius.com
3. Refresh extension (chrome://extensions → reload)

### ❌ "Premium required"
**Solution:**
1. Verifica account premium su Supabase
2. Controlla campo `used = true` o `is_premium = true`
3. Logout/login again

### ❌ Recording non parte
**Solution:**
1. Check console background per errori
2. Verify microphone permissions
3. Check backend running: https://salesgenius-backend.onrender.com/health

### ❌ Nessun suggerimento
**Solution:**
1. Speak clearly and wait 10+ seconds
2. Check console background: "Backend message: suggestion.start"
3. Verify backend logs for Deepgram/GPT responses

---

## 📊 Expected Behavior

### Normal Flow:
```
1. Open Meet/Zoom → Widget appears (minimized)
2. Click expand → See UI with "Start Recording"
3. Click Start → Icon changes, timer starts
4. Speak → Audio sent to backend
5. Wait 10s → First suggestion appears
6. Continue → More tips every 30-60s
7. Click Stop → Recording ends, see stats
```

### Expected Console Logs:
```javascript
// Background
✅ Audio stream captured successfully
✅ WebSocket connected
✅ Audio processing started
💡 New suggestion starting: [conversational]

// Content
✅ Widget DOM created
✅ Recording started
💡 New suggestion added: { category: 'conversational', text: '...' }
```

---

## 🎨 Features to Test

### Widget:
- [x] Drag to move
- [x] Minimize/Expand
- [x] Close (X) and reopen (click icon)
- [x] Theme toggle (light/dark)
- [x] Position saved

### Recording:
- [x] Start/Stop button
- [x] Timer counting
- [x] Tips counter incrementing
- [x] Icon changes to recording

### Suggestions:
- [x] Appear in real-time
- [x] Show category badge
- [x] Show timestamp
- [x] List scrollable (max 10)

---

## 🔧 Advanced Settings

### Backend URL
```javascript
// background.js line 4
const BACKEND_URL = 'wss://salesgenius-backend.onrender.com/stream-audio';
```

### Supabase
```javascript
// utils/supabase.js lines 4-5
const SUPABASE_URL = 'https://obtwneqykrktfedopxwz.supabase.co';
const SUPABASE_ANON_KEY = 'your_key';
```

### Audio Settings
```javascript
// background.js line 414
audioContext = new AudioContext({ sampleRate: 16000 });
const bufferSize = 4096; // ~250ms chunks
```

---

## 📞 Need Help?

### Check Documentation:
- README.md - Full documentation
- CHANGELOG.md - What changed in v2.0
- GitHub Issues - Report bugs

### Contact:
- Email: support@getsalesgenius.com
- Website: https://getsalesgenius.com

---

## ✅ You're Ready!

Your extension is now:
- ✅ Installed correctly
- ✅ All bugs fixed from v1.1
- ✅ Ready to use in production

**Happy selling! 🎯**
