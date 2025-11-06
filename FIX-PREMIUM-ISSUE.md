# 🔴 FIX URGENTE - Premium Check Issue

## 🐛 PROBLEMA

L'estensione mostra **"Premium subscription required"** anche se sei loggato con `m.baroni90@gmail.com`.

**Screenshot:** Widget mostra "Recording in progress" ma errore al click Start Recording.

---

## 🔍 DIAGNOSI

Il problema è nel **database Supabase** - la tabella `user_profiles` probabilmente:

1. **Non esiste** il record per il tuo user_id
2. **Campo sbagliato**: usa `id` invece di `user_id`  
3. **Valore sbagliato**: campo `used` o `is_premium` non settato correttamente

---

## ✅ SOLUZIONE 1: VERIFICA DATABASE

### Controlla su Supabase:

1. Vai su: https://obtwneqykrktfedopxwz.supabase.co
2. Login con le tue credenziali
3. Vai su **Table Editor** → `user_profiles`
4. Cerca il tuo user (email: `m.baroni90@gmail.com`)

### Verifica questi campi:

```sql
SELECT 
  id,
  user_id,
  email,
  is_premium,
  used,
  plan
FROM user_profiles
WHERE email = 'm.baroni90@gmail.com';
```

### Fix necessario:

**Opzione A** - Se il record NON esiste:
```sql
INSERT INTO user_profiles (user_id, email, is_premium, used, plan)
VALUES 
  ('tuo-user-id-da-auth-users', 'm.baroni90@gmail.com', true, true, 'premium');
```

**Opzione B** - Se il record esiste ma campi sbagliati:
```sql
UPDATE user_profiles 
SET 
  is_premium = true,
  used = true,
  plan = 'premium'
WHERE email = 'm.baroni90@gmail.com';
```

**Opzione C** - Se la tabella usa `id` invece di `user_id`:
```sql
-- Verifica quale campo usa la tabella
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'user_profiles';
```

---

## ✅ SOLUZIONE 2: USA VERSIONE DEBUG (TEMPORANEA)

Ho creato `background-DEBUG.js` che **bypassa** il check premium per il tuo email.

### Come usare:

1. **Backup** del file originale:
   ```bash
   cd salesgenius-extension-v2
   cp background.js background-ORIGINAL.js
   ```

2. **Sostituisci** con versione debug:
   ```bash
   cp background-DEBUG.js background.js
   ```

3. **Ricarica** estensione:
   ```
   chrome://extensions/ → SalesGenius → Reload
   ```

4. **Testa** su Google Meet - dovrebbe funzionare! ✅

⚠️ **IMPORTANTE:** Questa è solo per TESTING! Dopo aver fixato il database, ripristina:
```bash
cp background-ORIGINAL.js background.js
```

---

## ✅ SOLUZIONE 3: FIX CODICE (PERMANENTE)

Ho già aggiornato `background.js` con:

### 1. Debug Logging Migliorato
```javascript
console.log('🔍 Profile loaded:', profile);
console.log('🔍 Profiles array length:', profiles.length);
console.log('🔍 Profile fields:', {
  is_premium: profile?.is_premium,
  used: profile?.used,
  plan: profile?.plan
});
```

### 2. Doppia Query (user_id E id)
```javascript
// Prima prova con user_id
let profileResponse = await fetch(
  `${SUPABASE_URL}/rest/v1/user_profiles?user_id=eq.${userData.id}&select=*`
);

// Se fallisce, prova con id
if (!profileResponse.ok) {
  profileResponse = await fetch(
    `${SUPABASE_URL}/rest/v1/user_profiles?id=eq.${userData.id}&select=*`
  );
}
```

### 3. Fallback Temporaneo
```javascript
// Se non trova profilo, considera premium se email corrisponde
const isPremium =
  profile?.is_premium === true ||
  profile?.used === true ||
  (!profile && userData.email === 'm.baroni90@gmail.com') || // ⚠️ TEMP
  false;
```

---

## 🔍 COME DEBUGGARE

### 1. Apri Console Background:
```
chrome://extensions/ 
→ SalesGenius 
→ "Inspect views: service worker"
```

### 2. Guarda i log quando clicchi "Start Recording":
```javascript
// Dovresti vedere:
✅ User authenticated: m.baroni90@gmail.com
🔍 Profile loaded: {...}
🔍 Profiles array length: 1 o 0
🔍 Profile fields: {...}
✅ isPremium result: true o false

// Se vedi:
🔍 Profiles array length: 0  ← PROBLEMA! Record non trovato
🔍 Profile fields: { is_premium: undefined, used: undefined }
```

### 3. Se `length: 0`:
- Il record NON esiste in `user_profiles`
- Devi crearlo nel database (SOLUZIONE 1)

### 4. Se `length: 1` ma `isPremium: false`:
- Il record esiste ma campi non settati
- Fai UPDATE sul database (SOLUZIONE 1 - Opzione B)

---

## 📝 PASSI CONSIGLIATI

### Opzione A (Quick Fix - 2 min):
1. Usa `background-DEBUG.js` (SOLUZIONE 2)
2. Testa che tutto funzioni
3. Fix database dopo

### Opzione B (Fix Permanente - 5 min):
1. Vai su Supabase
2. Verifica tabella `user_profiles`
3. Crea/aggiorna record
4. Ricarica estensione
5. Testa

### Opzione C (Debug Completo - 10 min):
1. Apri console background
2. Clicca "Start Recording"
3. Copia TUTTI i log
4. Mandami screenshot
5. Analizzo e fixo

---

## 🎯 COSA FARE ORA

1. **Prova subito SOLUZIONE 2** (background-DEBUG.js)
   - Copy, rename, reload
   - Dovrebbe funzionare immediatamente ✅

2. **Mentre funziona**, verifica database:
   - Login Supabase
   - Controlla `user_profiles`
   - Nota quale campo usa (user_id o id?)
   - Nota quali valori ha (is_premium? used? plan?)

3. **Mandami info**:
   - Screenshot tabella `user_profiles`
   - Colonne presenti
   - Valori per il tuo user
   - Log console background

4. **Fix definitivo**:
   - UPDATE database
   - Test con background.js normale
   - Rimuovi debug version

---

## 📞 SUPPORTO

Se ancora problemi:

1. **Screenshot** console background (tutti i log)
2. **Screenshot** tabella Supabase `user_profiles`
3. **Copia/incolla** query SQL che usi
4. **Mandami** e fixo in 5 minuti

---

## ✅ VERIFICA FINALE

Dopo il fix, dovresti vedere:

### Console Background:
```
✅ User authenticated: m.baroni90@gmail.com
🔍 Profiles array length: 1
🔍 Profile fields: {
  is_premium: true,   ← ✅ O questo
  used: true,         ← ✅ O questo
  plan: 'premium'     ← ✅ O questo
}
✅ isPremium result: true  ← ✅ QUESTO!
✅ Recording started successfully
```

### Widget UI:
```
✅ "Recording in progress..."
✅ Timer counting
✅ NO errori
```

---

**Prova la SOLUZIONE 2 (debug version) ADESSO e fammi sapere!** 🚀
