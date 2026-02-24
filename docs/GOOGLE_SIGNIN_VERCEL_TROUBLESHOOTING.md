# Fix "The requested action is invalid" — Google Sign-In from Vercel

When you open the app at **https://parker-bos.vercel.app** and click "Continue with Google", the popup can show "The requested action is invalid" **immediately** (before the Google account picker). That usually means either:

1. **API key HTTP referrer restrictions** (most common) — the Firebase **API key** is restricted to certain sites and is blocking requests from Vercel.
2. **OAuth client** — the Web client's Authorized JavaScript origins or redirect URIs don't include the right values.

Use this checklist in the **Parker-BOS** Google Cloud project.

---

## 1. Fix API key HTTP referrer restrictions (do this first)

If the popup fails **immediately** without showing the Google account picker, the Firebase **API key** is likely restricted to certain HTTP referrers and is blocking requests from `parker-bos.vercel.app`.

1. Go to [Google Cloud Console](https://console.cloud.google.com) → select project **Parker-BOS**.
2. **APIs & Services** → **Credentials**.
3. Under **API keys**, find the key that your app uses (the one in your Firebase config; it may be named "Browser key" or show as used by Firebase). Click to edit it.
4. Under **Application restrictions**:
   - If it is set to **"None"**, skip this section.
   - If it is set to **"HTTP referrers (web sites)"**, the list must include every domain where the app runs. Add these if missing:
     - `https://parker-bos.vercel.app/*`
     - `https://parker-bos.firebaseapp.com/*`
     - `http://localhost:3000/*`
     - `http://localhost/*`
   Use the exact format (with `/*`). No trailing slash before the asterisk.
5. **Save**. Wait a few minutes, then try "Continue with Google" again from https://parker-bos.vercel.app (in a new incognito window).

---

## 2. Find the correct OAuth client

Firebase creates a "Web client (auto created by Google Service)" in the same GCP project. You can find it in either place:

- **Google Auth Platform** → **Clients** → click the **Web client** row, or  
- **APIs & Services** → **Credentials** → under "OAuth 2.0 Client IDs", open the **Web client** whose name mentions "Google Service" or "Firebase".

If you have multiple Web clients, use the one whose **Client ID** starts with `169065297829-` (your Firebase Web app's messaging sender ID). That is the client used by the Parker BOS Firebase Web app.

---

## 3. Authorized JavaScript origins

The app runs on Vercel, so that origin must be allowed. In the Web client:

- Open **Authorized JavaScript origins**.
- Ensure this exact URI is in the list **once** (no path, no trailing slash):
  - **`https://parker-bos.vercel.app`**
- If it is missing, click **+ Add URI**, paste it, then add/save.
- If you see a red "Duplicate origin URIs are not allowed" warning, remove the duplicate so `https://parker-bos.vercel.app` appears only once, then Save.

---

## 4. Authorized redirect URIs

The auth handler uses a **double underscore**. In the Web client:

- Open **Authorized redirect URIs**.
- Ensure this exact URI is in the list (two underscores: `__`):
  - **`https://parker-bos.firebaseapp.com/__/auth/handler`**
- If you only have `.../_/auth/handler` (single underscore), **edit it** to use **`__`** (double underscore), or add the double-underscore URI and remove the single-underscore one.
- Click **Save** at the bottom of the page.

---

## 5. Firebase Authorized domains (optional double-check)

- [Firebase Console](https://console.firebase.google.com) → **parker-bos** → **Authentication** → **Settings** → **Authorized domains**.
- Confirm **`parker-bos.vercel.app`** is in the list. If not, add it.

---

## 6. Retry sign-in

- Wait **5–10 minutes** after saving the OAuth client (changes can take a few minutes to apply).
- Close all tabs for the app, open a **new incognito/private** window.
- Go to **https://parker-bos.vercel.app/login** and click **Continue with Google** again.

---

## Summary

| Where | What to add / check |
|-------|----------------------|
| **API key** → HTTP referrers (if restricted) | `https://parker-bos.vercel.app/*`, `https://parker-bos.firebaseapp.com/*`, `http://localhost:3000/*` |
| OAuth client → Authorized JavaScript origins | `https://parker-bos.vercel.app` |
| OAuth client → Authorized redirect URIs | `https://parker-bos.firebaseapp.com/__/auth/handler` (double `__`) |
| Firebase → Authorized domains | `parker-bos.vercel.app` |

If the popup fails **before** the Google account picker, the API key referrer list is the most likely cause.

If it still fails after 10+ minutes, confirm you edited the **same** Web client that your Firebase Web app uses (project **parker-bos**, one Web client created by Google Service). Trying from a different browser or device can also help rule out cache or extensions.
