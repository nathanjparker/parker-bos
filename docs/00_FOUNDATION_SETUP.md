# 00 - Foundation Setup Guide
## Get Your First Next.js + Firebase App Deployed in 2-3 Hours

**Goal:** By the end of this guide, you'll have a working Next.js app deployed to Vercel with Firebase authentication.

**Time Estimate:** 2-3 hours (including reading, setup, and troubleshooting)

**Prerequisites:** 
- Windows computer with Cursor IDE
- Gmail account (for Firebase)
- GitHub account (for deployment)
- Willingness to learn!

---

## Part 1: Install Required Tools (30 minutes)

### Step 1: Install Node.js

**What is Node.js?** The JavaScript runtime that lets you run JavaScript on your computer (not just in browsers).

1. Go to https://nodejs.org/
2. Download the **LTS version** (Long Term Support - currently v20.x)
3. Run the installer (accept all defaults)
4. Verify installation:
   ```bash
   # Open Command Prompt (Windows Key + R, type "cmd", Enter)
   node --version
   # Should show: v20.x.x
   
   npm --version
   # Should show: 10.x.x
   ```

**Troubleshooting:**
- If commands not found: Restart Command Prompt
- Still not working: Restart computer (adds Node to PATH)

---

### Step 2: Install pnpm (Package Manager)

**Why pnpm?** It's faster than npm and saves disk space. You'll use it to install packages.

```bash
npm install -g pnpm

# Verify
pnpm --version
# Should show: 8.x.x or higher
```

---

### Step 3: Install Git

**What is Git?** Version control - tracks changes to your code and syncs with GitHub.

1. Go to https://git-scm.com/
2. Download Windows installer
3. Run installer (accept defaults, but choose "Cursor" as default editor if asked)
4. Verify:
   ```bash
   git --version
   # Should show: git version 2.x.x
   ```

**Configure Git:**
```bash
git config --global user.name "Your Name"
git config --global user.email "your.email@gmail.com"
```

---

### Step 4: Install Firebase CLI

**What is Firebase CLI?** Command-line tools to manage Firebase projects from your computer.

```bash
npm install -g firebase-tools

# Verify
firebase --version
# Should show: 13.x.x or higher
```

---

## Part 2: Create Your First Next.js App (45 minutes)

### Step 1: Create the Project

Open Command Prompt and navigate to where you want your project:

```bash
# Example: Create in Documents folder
cd Documents

# Create Next.js app
npx create-next-app@latest parker-bos
```

**You'll be asked several questions - choose these:**

```
âœ” Would you like to use TypeScript? â€¦ Yes
âœ” Would you like to use ESLint? â€¦ Yes
âœ” Would you like to use Tailwind CSS? â€¦ Yes
âœ” Would you like to use `src/` directory? â€¦ Yes
âœ” Would you like to use App Router? â€¦ Yes
âœ” Would you like to customize the default import alias? â€¦ No
```

**What just happened?**
- Created a `parker-bos` folder
- Installed Next.js, React, Tailwind CSS, TypeScript
- Set up project structure

---

### Step 2: Open in Cursor

```bash
cd parker-bos
cursor .
```

This opens Cursor IDE with your project loaded.

---

### Step 3: Run Development Server

In Cursor's terminal (or Command Prompt):

```bash
pnpm dev
```

**Open your browser:** http://localhost:3000

You should see the default Next.js welcome page! ðŸŽ‰

**Understanding the output:**
```
â–² Next.js 14.x.x
- Local:        http://localhost:3000
- Network:      http://192.168.x.x:3000
```

**Troubleshooting:**
- Port 3000 already in use: Stop other servers or use `pnpm dev -p 3001`
- Can't connect: Check firewall, try http://127.0.0.1:3000

---

### Step 4: Understanding the Project Structure

```
parker-bos/
â”œâ”€â”€ src/
â”‚   â””â”€â”€ app/                 # Your pages go here
â”‚       â”œâ”€â”€ page.tsx         # Home page (what you see at /)
â”‚       â”œâ”€â”€ layout.tsx       # Wrapper for all pages
â”‚       â””â”€â”€ globals.css      # Global styles
â”œâ”€â”€ public/                  # Static files (images, etc.)
â”œâ”€â”€ node_modules/            # Installed packages (don't edit!)
â”œâ”€â”€ package.json             # Project dependencies
â”œâ”€â”€ tsconfig.json            # TypeScript config
â”œâ”€â”€ tailwind.config.ts       # Tailwind CSS config
â””â”€â”€ next.config.js           # Next.js config
```

**Key Concepts:**
- **`src/app/page.tsx`** - Each `page.tsx` file is a route
- **`layout.tsx`** - Shared UI (navbar, footer) for nested pages
- **TypeScript (`.ts`/`.tsx`)** - JavaScript with types (catches errors early)

---

### Step 5: Make Your First Edit

Open `src/app/page.tsx` and replace everything with:

```typescript
export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-blue-600 mb-4">
          Parker BOS
        </h1>
        <p className="text-gray-600">
          Your business operating system is coming soon...
        </p>
      </div>
    </div>
  );
}
```

**Save the file** and look at your browser - it updates automatically! This is called "hot reload."

**What you just learned:**
- React component syntax
- Tailwind CSS classes (`text-4xl`, `font-bold`, etc.)
- Next.js auto-refreshes when you save

---

## Part 3: Set Up Firebase (30 minutes)

### Step 1: Create Firebase Project

1. Go to https://console.firebase.google.com/
2. Click "Add project"
3. Project name: **"parker-bos"**
4. Click Continue
5. Disable Google Analytics (you can enable later)
6. Click "Create project"
7. Wait ~30 seconds, then click "Continue"

**You're now in the Firebase Console!**

---

### Step 2: Add Web App to Firebase

1. Click the **"</>" icon** (Web platform)
2. App nickname: **"Parker BOS Web"**
3. **Don't check** "Firebase Hosting" yet
4. Click "Register app"
5. You'll see Firebase SDK configuration - **COPY THIS**, we need it next

**It looks like this:**
```javascript
const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "parker-bos.firebaseapp.com",
  projectId: "parker-bos",
  storageBucket: "parker-bos.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123"
};
```

---

### Step 3: Install Firebase in Your Project

Back in Cursor terminal:

```bash
pnpm add firebase
```

---

### Step 4: Create Firebase Configuration File

Create a new file: `src/lib/firebase.ts`

```typescript
// src/lib/firebase.ts
import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// Your Firebase configuration (paste what you copied earlier)
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Initialize Firebase (only once)
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

// Initialize services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

export default app;
```

---

### Step 5: Create Environment Variables File

Create a new file in the root: `.env.local`

```bash
# Firebase Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSy...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=parker-bos.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=parker-bos
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=parker-bos.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abc123
```

**Replace with YOUR values from Firebase Console!**

**Why `.env.local`?**
- Keeps secrets out of your code
- Not committed to Git (stays on your computer)
- `NEXT_PUBLIC_` prefix makes variables available in browser

---

### Step 6: Test Firebase Connection

Update `src/app/page.tsx`:

```typescript
'use client';

import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import { collection, getDocs } from 'firebase/firestore';

export default function Home() {
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    // Try to read from Firestore (will work even if empty)
    getDocs(collection(db, 'test'))
      .then(() => setConnected(true))
      .catch((error) => console.error('Firebase error:', error));
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-blue-600 mb-4">
          Parker BOS
        </h1>
        <p className="text-gray-600 mb-2">
          Your business operating system is coming soon...
        </p>
        <div className={`inline-block px-4 py-2 rounded ${
          connected ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
        }`}>
          {connected ? 'âœ“ Firebase Connected' : 'â³ Connecting to Firebase...'}
        </div>
      </div>
    </div>
  );
}
```

**Restart your dev server** (Ctrl+C, then `pnpm dev` again)

You should see "âœ“ Firebase Connected"! ðŸŽ‰

**Troubleshooting:**
- Still says "Connecting": Check `.env.local` values
- Console errors: Make sure you're in the `parker-bos` folder when running `pnpm dev`

---

## Part 4: Deploy to Vercel (30 minutes)

### Step 1: Create GitHub Repository

1. Go to https://github.com/
2. Click "New repository" (green button)
3. Repository name: **parker-bos**
4. Make it **Private** (your business code)
5. **Don't** initialize with README (you already have files)
6. Click "Create repository"

---

### Step 2: Push Your Code to GitHub

In Cursor terminal:

```bash
# Initialize Git (if not already done)
git init

# Add all files
git add .

# Commit
git commit -m "Initial commit - Parker BOS setup"

# Connect to GitHub (replace YOUR_USERNAME)
git remote add origin https://github.com/YOUR_USERNAME/parker-bos.git

# Push to GitHub
git branch -M main
git push -u origin main
```

**Troubleshooting:**
- Authentication error: GitHub now requires personal access tokens
- Go to GitHub Settings â†’ Developer settings â†’ Personal access tokens â†’ Tokens (classic)
- Generate new token, check "repo" scope, copy it
- Use token as password when Git asks for authentication

---

### Step 3: Deploy to Vercel

1. Go to https://vercel.com/
2. Sign up with GitHub (authorizes Vercel to access your repos)
3. Click "Add New..." â†’ "Project"
4. Find **parker-bos** repository, click "Import"
5. **Framework Preset:** Next.js (should auto-detect)
6. Click **"Environment Variables"**
7. Add each variable from your `.env.local`:
   ```
   NEXT_PUBLIC_FIREBASE_API_KEY = AIzaSy...
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN = parker-bos.firebaseapp.com
   ... (add all 6 variables)
   ```
8. Click **"Deploy"**

**Wait 2-3 minutes...** â˜•

You'll see "ðŸŽ‰ Congratulations!"

---

### Step 4: Visit Your Live Site!

Vercel gives you a URL like: **https://parker-bos.vercel.app**

Click it - you should see your app, live on the internet! ðŸš€

**What just happened?**
- Vercel built your Next.js app
- Deployed it to their global CDN
- Gave you a free HTTPS domain
- Set up automatic deployments (push to GitHub = auto-deploy)

---

## Part 5: Set Up Authentication (45 minutes)

### Step 1: Enable Google Sign-In in Firebase

1. Go to Firebase Console: https://console.firebase.google.com/
2. Select your project
3. Click "Authentication" in left sidebar
4. Click "Get started"
5. Click "Google" provider
6. Toggle **Enable**
7. Project public-facing name: **Parker BOS**
8. Support email: **your email**
9. Click "Save"

---

### Step 2: Create Login Page

Create `src/app/login/page.tsx`:

```typescript
'use client';

import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState('');

  const handleGoogleSignIn = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      router.push('/dashboard');
    } catch (err) {
      console.error('Login error:', err);
      setError('Failed to sign in. Please try again.');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
        <h1 className="text-3xl font-bold text-center mb-8">
          Parker BOS
        </h1>
        
        <button
          onClick={handleGoogleSignIn}
          className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Sign in with Google
        </button>

        {error && (
          <p className="mt-4 text-red-600 text-sm text-center">{error}</p>
        )}
      </div>
    </div>
  );
}
```

---

### Step 3: Create Protected Dashboard

Create `src/app/dashboard/page.tsx`:

```typescript
'use client';

import { useEffect, useState } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useRouter } from 'next/navigation';

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUser(user);
        setLoading(false);
      } else {
        router.push('/login');
      }
    });

    return () => unsubscribe();
  }, [router]);

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      router.push('/login');
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-blue-600">Parker BOS</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">{user?.email}</span>
            <button
              onClick={handleSignOut}
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4">
            Welcome, {user?.displayName || 'User'}! ðŸ‘‹
          </h2>
          <p className="text-gray-600 mb-4">
            Your Parker BOS dashboard is under construction. Here's what's coming:
          </p>
          <ul className="space-y-2 text-gray-700">
            <li className="flex items-start gap-2">
              <span className="text-green-600">âœ“</span>
              Authentication working (you're logged in!)
            </li>
            <li className="flex items-start gap-2">
              <span className="text-yellow-600">â³</span>
              Companies, People, Jobs (coming in Phase 2)
            </li>
            <li className="flex items-start gap-2">
              <span className="text-yellow-600">â³</span>
              File uploads (coming in Phase 3)
            </li>
            <li className="flex items-start gap-2">
              <span className="text-yellow-600">â³</span>
              Change Orders, POs, Billing (coming in Phase 4)
            </li>
            <li className="flex items-start gap-2">
              <span className="text-yellow-600">â³</span>
              AI Document Processing (coming in Phase 5)
            </li>
          </ul>
        </div>
      </main>
    </div>
  );
}
```

---

### Step 4: Update Home Page to Redirect

Update `src/app/page.tsx`:

```typescript
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        router.push('/dashboard');
      } else {
        router.push('/login');
      }
    });

    return () => unsubscribe();
  }, [router]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-gray-600">Loading...</div>
    </div>
  );
}
```

---

### Step 5: Test Authentication

1. Restart dev server: `pnpm dev`
2. Visit http://localhost:3000
3. Should redirect to `/login`
4. Click "Sign in with Google"
5. Choose your Google account
6. Should redirect to `/dashboard`
7. You see your email and can sign out!

**You now have working authentication!** ðŸŽ‰

---

### Step 6: Deploy Authentication Update

```bash
git add .
git commit -m "Add authentication with Google Sign-In"
git push
```

Wait 1-2 minutes, then visit your Vercel URL - authentication works live too!

**Important:** You need to add your Vercel domain to Firebase:
1. Firebase Console â†’ Authentication â†’ Settings â†’ Authorized domains
2. Click "Add domain"
3. Add your Vercel domain: `parker-bos.vercel.app`

---

## Part 6: Understanding What You Built

### The Architecture

```
Your Computer (Development)
    â†“
    pnpm dev (runs Next.js locally)
    â†“
    http://localhost:3000 (test in browser)

GitHub (Version Control)
    â†“
    git push (saves your code)
    â†“
    Triggers Vercel deployment

Vercel (Hosting)
    â†“
    Builds and deploys automatically
    â†“
    https://parker-bos.vercel.app (live site)

Firebase (Backend Services)
    â”œâ”€â”€ Authentication (Google Sign-In)
    â”œâ”€â”€ Firestore (database - coming soon)
    â””â”€â”€ Storage (files - coming soon)
```

### Key Concepts You Learned

1. **Next.js** - React framework for building web apps
2. **TypeScript** - JavaScript with type safety
3. **Tailwind CSS** - Utility-first CSS framework
4. **Firebase** - Backend as a Service (auth, database, storage)
5. **Vercel** - Deployment platform (push to deploy)
6. **Git/GitHub** - Version control and code hosting

### The Development Flow

```
1. Write code in Cursor
2. Test locally: pnpm dev
3. Commit changes: git add . && git commit -m "..."
4. Push to GitHub: git push
5. Vercel auto-deploys (live in 2 minutes)
```

---

## Common Issues & Solutions

### Issue: Firebase not connecting
**Solution:** Check `.env.local` values match Firebase Console exactly

### Issue: Vercel build fails
**Solution:** Check Vercel dashboard logs, usually a missing environment variable

### Issue: Google Sign-In doesn't work on Vercel
**Solution:** Add Vercel domain to Firebase Authorized domains

### Issue: Hot reload not working
**Solution:** Restart dev server (Ctrl+C, then `pnpm dev`)

### Issue: TypeScript errors
**Solution:** Read the error carefully, usually a typo in types

### Issue: Can't push to GitHub
**Solution:** Create Personal Access Token (see Step 4 Part 2 troubleshooting)

---

## Next Steps

You've completed Foundation Setup! ðŸŽ‰

**What you accomplished:**
- âœ… Installed development tools
- âœ… Created Next.js project
- âœ… Connected to Firebase
- âœ… Deployed to Vercel
- âœ… Implemented authentication
- âœ… Understand the development flow

**Next up:**
1. Read `01_LEARNING_PATH.md` - Week-by-week curriculum
2. Start `02_DATA_ENTRY_SYSTEM.md` - Build your first CRUD operations

**Take a break!** You just set up a professional full-stack development environment. That's a huge accomplishment.

---

## Quick Reference Commands

```bash
# Start development server
pnpm dev

# Build for production
pnpm build

# Run production build locally
pnpm start

# Install new package
pnpm add package-name

# Git workflow
git add .
git commit -m "Your message"
git push

# Firebase commands
firebase login
firebase init
firebase deploy
```

---

## Resources

- **Next.js Docs:** https://nextjs.org/docs
- **Firebase Docs:** https://firebase.google.com/docs
- **Tailwind CSS:** https://tailwindcss.com/docs
- **TypeScript:** https://www.typescriptlang.org/docs/
- **React:** https://react.dev/

---

**Ready for Phase 2?** Move on to `01_LEARNING_PATH.md` to start your week-by-week learning journey! ðŸš€
