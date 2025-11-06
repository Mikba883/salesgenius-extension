# ✅ TESTING CHECKLIST - SalesGenius v2.0

## 🚀 INSTALLATION (2 min)

- [ ] Open Chrome
- [ ] Go to `chrome://extensions/`
- [ ] Enable "Developer mode"
- [ ] Click "Load unpacked"
- [ ] Select `salesgenius-extension-v2` folder
- [ ] Extension appears in list
- [ ] Version shows: 2.0.0 ✅
- [ ] Icon visible in Chrome toolbar

**Status:** ⬜ Not Started | ⏳ In Progress | ✅ Completed

---

## 🎯 BASIC FUNCTIONALITY (5 min)

### Widget Appearance:
- [ ] Go to https://meet.google.com/new
- [ ] Widget appears automatically (bottom-right)
- [ ] Widget is minimized by default
- [ ] Logo icon visible (28px)
- [ ] "SalesGenius" text readable

### Drag & Drop:
- [ ] Click and hold widget header
- [ ] Drag to different position
- [ ] Movement is smooth (no lag)
- [ ] Widget stays within screen bounds
- [ ] Position saves after refresh

### Expand/Minimize:
- [ ] Click ▲ button to expand
- [ ] Widget shows full UI
- [ ] Click ▼ button to minimize
- [ ] Returns to small size

### Theme Toggle:
- [ ] Click 🌙 button (light theme)
- [ ] Colors change to dark theme
- [ ] All text remains readable
- [ ] Click ☀️ button (dark theme)
- [ ] Colors return to light theme
- [ ] Preference saved after refresh

### Close/Reopen:
- [ ] Click × button
- [ ] Widget disappears completely
- [ ] Click extension icon in toolbar
- [ ] Widget reappears (minimized)

**Status:** ⬜ Not Started | ⏳ In Progress | ✅ Completed

---

## 🔐 AUTHENTICATION (3 min)

### Login Flow:
- [ ] Expand widget
- [ ] See "Checking authentication..."
- [ ] If not logged in, see "Please login" message
- [ ] Click login link
- [ ] Redirects to getsalesgenius.com/login
- [ ] Login with Supabase credentials
- [ ] Return to Meet tab
- [ ] Refresh extension or page

### Premium Check:
- [ ] After login, widget shows "✅ Premium Active"
- [ ] OR shows "Premium required" if not premium
- [ ] No false "Premium required" if you are premium ✅
- [ ] If premium, "Start Recording" button enabled

**Status:** ⬜ Not Started | ⏳ In Progress | ✅ Completed

---

## 🎤 AUDIO CAPTURE (10 min)

### Console Setup:
- [ ] Open Chrome DevTools (F12)
- [ ] Go to Console tab
- [ ] Open second console: `chrome://extensions/` → SalesGenius → "Inspect views: service worker"

### Start Recording:
- [ ] Click "Start Recording" button
- [ ] Button changes to "Stop" (red) ✅
- [ ] Widget icon changes to recording (red dot) ✅
- [ ] Chrome toolbar icon changes ✅
- [ ] Timer starts: 00:00 → 00:01... ✅
- [ ] Stats section appears ✅

### Console Background (Service Worker):
```
Check for these logs:
```
- [ ] `🎤 Starting audio capture...`
- [ ] `🔌 Connecting to WebSocket...`
- [ ] `✅ WebSocket connected`
- [ ] `✅ Audio stream captured successfully` ← KEY!
- [ ] `✅ Audio processing started`
- [ ] NO `❌ tabCapture error` (was 403 in v1.1) ✅
- [ ] NO `❌ Error starting audio capture` ✅

### Console Content (Meet Tab):
```
Check for these logs:
```
- [ ] `✅ Recording started`
- [ ] `✅ User authenticated and premium`
- [ ] Timer updating every second

### Network Tab:
- [ ] F12 → Network → WS (WebSocket filter)
- [ ] See connection to `salesgenius-backend.onrender.com`
- [ ] Status: 101 Switching Protocols ✅
- [ ] Messages tab shows audio frames being sent
- [ ] Green indicators (connected)

**Status:** ⬜ Not Started | ⏳ In Progress | ✅ Completed

---

## 💡 SUGGESTIONS (15 min)

### Speak & Wait:
- [ ] With recording active, speak into microphone
- [ ] Talk for at least 10-15 seconds
- [ ] Wait patiently (processing takes time)

### Backend Console Logs:
```
In background console, look for:
```
- [ ] `💡 New suggestion starting: [category]`
- [ ] `✅ Suggestion complete: [text]`

### Widget UI:
- [ ] "Live Tips" section appears
- [ ] First suggestion shows up
- [ ] Has category badge (e.g., "CONVERSATIONAL")
- [ ] Has suggestion text
- [ ] Has timestamp (e.g., "3:45 PM")
- [ ] Tips counter increments: 0 → 1 → 2...
- [ ] New tips animate in (slide from right)
- [ ] List shows max 10 tips
- [ ] Scrollable if > 10 tips

### Suggestion Categories (test all 4):
- [ ] 🎧 Conversational & Discovery (questions)
- [ ] 💎 Value & Objection Handling (benefits)
- [ ] ✅ Closing & Next Steps (actions)
- [ ] 🌐 Market & Context Intelligence (data)

**Status:** ⬜ Not Started | ⏳ In Progress | ✅ Completed

---

## 🛑 STOP RECORDING (2 min)

### Stop Flow:
- [ ] Click "Stop" button
- [ ] Icon returns to normal (no red dot) ✅
- [ ] Timer stops
- [ ] Stats remain visible
- [ ] "Start Recording" button reappears
- [ ] Success message shows with session stats
- [ ] Message auto-hides after 5s

### Console:
- [ ] Background: `🛑 Stopping audio capture...`
- [ ] Background: `✅ Audio capture stopped`
- [ ] Content: `✅ Recording stopped`
- [ ] WebSocket closes (Network tab)

**Status:** ⬜ Not Started | ⏳ In Progress | ✅ Completed

---

## 🎨 UI/UX VERIFICATION (5 min)

### Visual Checks (Light Theme):
- [ ] All icons clearly visible
- [ ] Text is dark enough (#0f172a)
- [ ] Timer emoji is 32px (large) ✅
- [ ] Stats icons are 32px (large) ✅
- [ ] Widget icon is 28px (visible) ✅
- [ ] All fonts readable
- [ ] Buttons large enough (38px)
- [ ] No clipped text
- [ ] Proper spacing/padding

### Visual Checks (Dark Theme):
- [ ] Background very dark (#0f172a) ✅
- [ ] Text very light (#f8fafc) ✅
- [ ] Stats icons glowing/visible ✅
- [ ] Good contrast throughout
- [ ] No invisible elements

### Interactions:
- [ ] Hover effects work (buttons lift)
- [ ] Animations smooth (60fps)
- [ ] No lag when dragging
- [ ] Transitions feel natural
- [ ] Icons pulse during recording ✅

**Status:** ⬜ Not Started | ⏳ In Progress | ✅ Completed

---

## 🌐 MULTI-PLATFORM (20 min)

### Test on each platform:

#### Google Meet:
- [ ] https://meet.google.com/new
- [ ] Widget appears ✅
- [ ] Recording works ✅
- [ ] Suggestions appear ✅

#### Zoom (web):
- [ ] https://zoom.us/test
- [ ] Widget appears
- [ ] Recording works
- [ ] Suggestions appear

#### Microsoft Teams (web):
- [ ] https://teams.microsoft.com
- [ ] Widget appears
- [ ] Recording works
- [ ] Suggestions appear

**Status:** ⬜ Not Started | ⏳ In Progress | ✅ Completed

---

## 🐛 BUG VERIFICATION (v1.1 → v2.0)

### Critical Fixes:

#### ✅ Fix #1: Error 403
- [ ] NO `403` errors in console ✅
- [ ] Audio capture succeeds
- [ ] Background log: `✅ Audio stream captured successfully`

#### ✅ Fix #2: Widget Draggable
- [ ] Widget moves smoothly when dragged ✅
- [ ] No lag or stuttering
- [ ] 60fps movement

#### ✅ Fix #3: Icon Changes
- [ ] Normal: Shows regular logo ✅
- [ ] Recording: Shows red dot icon ✅
- [ ] Toolbar icon also changes ✅

#### ✅ Fix #4: Version Display
- [ ] manifest.json: 2.0.0 ✅
- [ ] Popup: "v2.0" ✅
- [ ] Console: "v2.0" ✅

#### ✅ Fix #5: Premium Alert
- [ ] If premium, NO false alert ✅
- [ ] Can start recording immediately
- [ ] Auth check works correctly

#### ✅ Fix #6: UI Improvements
- [ ] Icons bigger (28-32px) ✅
- [ ] Text more readable ✅
- [ ] Dark mode much darker ✅
- [ ] Contrast excellent ✅

**Status:** ⬜ Not Started | ⏳ In Progress | ✅ Completed

---

## 📊 PERFORMANCE CHECK (5 min)

### Metrics to Verify:

#### CPU Usage:
- [ ] Idle: <2%
- [ ] Recording: ~5%
- [ ] No CPU spikes

#### Memory Usage:
- [ ] Extension: ~10MB
- [ ] No memory leaks
- [ ] Stable over time

#### Network:
- [ ] WebSocket bandwidth: ~32 kbps
- [ ] No excessive traffic
- [ ] Connection stable

#### UI Performance:
- [ ] Drag: 60fps smooth
- [ ] Animations: No jank
- [ ] Render time: <16ms

**Status:** ⬜ Not Started | ⏳ In Progress | ✅ Completed

---

## 🎯 FINAL CHECKLIST

### Before Going to Production:

#### Code:
- [ ] No console errors
- [ ] All features working
- [ ] All bugs fixed from v1.1
- [ ] Performance acceptable

#### Documentation:
- [ ] README.md reviewed
- [ ] QUICKSTART.md tested
- [ ] Italian instructions correct

#### Assets:
- [ ] All 6 icons present
- [ ] Icons correct size
- [ ] No missing resources

#### Backend:
- [ ] Backend running
- [ ] WebSocket responding
- [ ] Deepgram working
- [ ] GPT responding

#### Privacy:
- [ ] Privacy policy published
- [ ] Terms of service ready
- [ ] GDPR compliant

#### Store:
- [ ] Screenshots prepared (1280x800)
- [ ] Description written
- [ ] Keywords selected
- [ ] Promo tile created (440x280)

**Status:** ⬜ Not Started | ⏳ In Progress | ✅ Completed

---

## 📝 NOTES & ISSUES

Use this space to note any issues found:

```
Date: _______________
Issue: _______________________________________________________________
Expected: ____________________________________________________________
Actual: ______________________________________________________________
Console logs: ________________________________________________________
Fix applied: _________________________________________________________





```

---

## ✅ SIGN-OFF

### Tested by: ____________________
### Date: ____________________
### Version tested: 2.0.0
### Result: ⬜ PASS | ⬜ FAIL | ⬜ NEEDS FIXES

### Notes:
```




```

---

**ALL TESTS PASS? → READY FOR PRODUCTION! 🚀**
