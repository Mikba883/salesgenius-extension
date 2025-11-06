# 🔴 ERRORE: chrome.tabCapture.capture is not a function

## 🐛 IL PROBLEMA

**Console Output:**
```
✅ User authenticated and premium
✅ Widget expanded  
🎬 Starting recording...
❌ Error: chrome.tabCapture.capture is not a function
```

**Causa:** `chrome.tabCapture.capture()` non è disponibile nel contesto corrente.

---

## 🔍 DIAGNOSI

### Possibili Cause:

#### 1. **Manifest V3 Restrictions** ⚠️ PIÙ PROBABILE
Chrome Manifest V3 ha cambiato come funziona `tabCapture`:
- `chrome.tabCapture.capture()` è **deprecated** in alcuni contesti
- Serve usare `chrome.tabCapture.getMediaStreamId()` invece

#### 2. **Permission Non Attivata**
Il permission `tabCapture` nel manifest.json non è riconosciuto

#### 3. **Service Worker Context**
Il Service Worker (background.js) non ha accesso diretto all'API

---

## ✅ SOLUZIONE 1: VERIFICA PERMESSI

### Step 1: Controlla Extension Details

```
chrome://extensions/
→ SalesGenius
→ Details
→ Scroll down to "Permissions"
```

**Dovresti vedere:**
- ✅ "Capture your screen"
- ✅ "Communicate with cooperating websites"  
- ✅ "Display notifications"

**Se NON vedi "Capture your screen":**
Il permission `tabCapture` NON è attivo!

### Step 2: Verifica manifest.json

Il file deve avere:
```json
{
  "permissions": [
    "tabCapture",  // ← QUESTO!
    "storage",
    "tabs",
    "activeTab",
    "notifications"
  ]
}
```

---

## ✅ SOLUZIONE 2: USA API ALTERNATIVA (Manifest V3)

Ho creato `audio-capture-v3-alternative.js` che usa l'API corretta per Manifest V3.

### Differenze:

**OLD (non funziona in MV3):**
```javascript
chrome.tabCapture.capture({ audio: true }, (stream) => {
  // ...
});
```

**NEW (funziona in MV3):**
```javascript
chrome.tabCapture.getMediaStreamId({ targetTabId }, (streamId) => {
  // Passa streamId al content script
  chrome.tabs.sendMessage(tabId, { streamId }, () => {
    // Content script usa navigator.mediaDevices.getUserMedia()
  });
});
```

### Come Implementare:

1. **Modifica background.js:**
   - Replace `startAudioCapture()` with `startAudioCaptureV3()`
   - Usa `getMediaStreamId` invece di `capture`

2. **Modifica content.js:**
   - Aggiungi listener per messaggio `start_audio_capture`
   - Usa `navigator.mediaDevices.getUserMedia()` con streamId

---

## ✅ SOLUZIONE 3: DEBUG COMPLETO

### Verifica API Disponibilità:

Apri console del Service Worker:
```
chrome://extensions/ → SalesGenius → "Inspect views: service worker"
```

Esegui questi comandi:
```javascript
// Check 1: API esiste?
console.log('tabCapture:', chrome.tabCapture);

// Check 2: Metodi disponibili?
console.log('Methods:', Object.keys(chrome.tabCapture || {}));

// Check 3: capture() esiste?
console.log('capture function:', typeof chrome.tabCapture?.capture);

// Check 4: getMediaStreamId() esiste?
console.log('getMediaStreamId:', typeof chrome.tabCapture?.getMediaStreamId);
```

**Risultati Attesi:**

#### Se Manifest V2 style (OLD):
```javascript
Methods: ['capture', 'getCapturedTabs']
capture function: 'function'  ✅
```

#### Se Manifest V3 (NEW):
```javascript
Methods: ['getMediaStreamId', 'getCapturedTabs']
capture function: 'undefined'  ❌
getMediaStreamId: 'function'   ✅
```

---

## ✅ SOLUZIONE 4: DOWNGRADE A MANIFEST V2 (Temp)

Se vuoi un quick fix, puoi temporaneamente usare Manifest V2:

### manifest.json:
```json
{
  "manifest_version": 2,  // ← Cambia da 3 a 2
  "background": {
    "scripts": ["background.js"],  // ← Invece di service_worker
    "persistent": false
  },
  // ... rest stays same
}
```

⚠️ **NOTA:** Manifest V2 sarà deprecato a Giugno 2024, quindi non è una soluzione permanente!

---

## 🎯 SOLUZIONE CONSIGLIATA

### Quick Test (5 min):

1. **Verifica quale API hai:**
   ```javascript
   // Console service worker
   console.log(chrome.tabCapture);
   ```

2. **Se vedi `getMediaStreamId`:**
   - Usa SOLUZIONE 2 (API alternativa)
   - Ho già il codice pronto!

3. **Se vedi `capture`:**
   - Il problema è altrove
   - Controlla permissions

### Implementazione Corretta:

Posso creare una **NUOVA versione** del background.js che usa l'API corretta per Manifest V3.

Vuoi che:
- [ ] Creo versione completa con `getMediaStreamId`?
- [ ] Downgrade temporaneo a Manifest V2?
- [ ] Ti mando codice da copiare manualmente?

---

## 📊 CONFRONTO SOLUZIONI

| Soluzione | Tempo | Permanente | Difficulty |
|-----------|-------|------------|------------|
| Fix Permissions | 2 min | ✅ | Easy |
| API V3 (getMediaStreamId) | 10 min | ✅ | Medium |
| Downgrade to MV2 | 5 min | ❌ | Easy |
| Debug completo | 15 min | ✅ | Hard |

---

## 🚀 PROSSIMI PASSI

1. **Esegui debug commands** nella console service worker
2. **Copia output** qui
3. **Dimmi quale API vedi** (capture o getMediaStreamId)
4. **Creo fix specifico** per il tuo caso

---

**Esegui i debug commands e mandami screenshot! Così creo il fix esatto! 🔍**
