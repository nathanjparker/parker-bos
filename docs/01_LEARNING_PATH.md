# 01 - Learning Path Guide
## Your Week-by-Week Crash Course in Full-Stack Development

**Philosophy:** Learn by building, not by studying. Core concepts first, depth as needed.

**Timeline:** 12 weeks of foundational learning (2-4 hours/week), then learning continues as you build

**Your Style:** Progressive depth - understand the basics, then go deeper when you need to

---

## Overview: The Learning Journey

### Phase 1: Foundations (Weeks 1-4)
**Goal:** Comfortable with JavaScript, React, Next.js basics  
**Time:** 2-3 hours/week  
**Output:** Can create pages, components, and understand the code you're writing

### Phase 2: Database & Data (Weeks 5-8)
**Goal:** CRUD operations, Firestore queries, forms  
**Time:** 3-4 hours/week  
**Output:** Can build Companies, People, Jobs management

### Phase 3: Backend & Functions (Weeks 9-12)
**Goal:** Cloud Functions, automation, APIs  
**Time:** 3-4 hours/week  
**Output:** Can write backend logic, integrate services

### Phase 4: Advanced (Ongoing)
**Goal:** AI integration, optimization, mobile  
**Time:** As needed  
**Output:** Production-ready features

---

## Week 1-2: JavaScript & TypeScript Basics

### Core Concepts You MUST Know

#### 1. Variables & Data Types
```typescript
// Variables
let projectName = "Downtown Medical";  // Can change
const jobNumber = "12345";             // Cannot change
var oldWay;                            // Don't use this

// Types
let name: string = "Parker Services";
let jobCount: number = 42;
let isActive: boolean = true;
let address: string | null = null;  // Union type

// Arrays
let fixtures: string[] = ["WC-1", "LAV-2", "URN-1"];
let prices: number[] = [350, 175, 425];

// Objects
interface Job {
  jobNumber: string;
  jobName: string;
  contractValue: number;
  isActive: boolean;
}

const job: Job = {
  jobNumber: "12345",
  jobName: "Downtown Medical",
  contractValue: 125000,
  isActive: true
};
```

**Practice:**
- Create objects representing: Company, Person, ChangeOrder
- Use TypeScript types for everything

---

#### 2. Functions
```typescript
// Basic function
function calculateMargin(revenue: number, cost: number): number {
  return revenue - cost;
}

// Arrow function (preferred in React)
const calculateMarginPercent = (revenue: number, cost: number): number => {
  const margin = revenue - cost;
  return (margin / revenue) * 100;
};

// Function with default parameter
const formatCurrency = (amount: number, includeSign: boolean = true): string => {
  const formatted = amount.toFixed(2);
  return includeSign ? `$${formatted}` : formatted;
};

// Async function (for database calls)
const getJob = async (jobId: string): Promise<Job> => {
  // Simulated API call
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        jobNumber: "12345",
        jobName: "Test Job",
        contractValue: 100000,
        isActive: true
      });
    }, 1000);
  });
};
```

**Practice:**
- Write a function to calculate CO total (labor + materials + markup)
- Write an async function to simulate fetching companies

---

#### 3. Array Methods (You'll Use These CONSTANTLY)
```typescript
const fixtures = [
  { tag: "WC-1", status: "Ordered", cost: 350 },
  { tag: "LAV-2", status: "On-Site", cost: 175 },
  { tag: "URN-1", status: "Ordered", cost: 425 }
];

// Filter (get subset)
const orderedItems = fixtures.filter(item => item.status === "Ordered");
// Result: [{ tag: "WC-1", ... }, { tag: "URN-1", ... }]

// Map (transform each item)
const tags = fixtures.map(item => item.tag);
// Result: ["WC-1", "LAV-2", "URN-1"]

// Find (get first match)
const wc1 = fixtures.find(item => item.tag === "WC-1");
// Result: { tag: "WC-1", status: "Ordered", cost: 350 }

// Reduce (calculate total)
const totalCost = fixtures.reduce((sum, item) => sum + item.cost, 0);
// Result: 950

// Sort
const sortedByCost = [...fixtures].sort((a, b) => a.cost - b.cost);
```

**Practice:**
- Filter jobs by status
- Calculate total contract value
- Find company by name
- Sort POs by date

---

#### 4. Promises & Async/Await
```typescript
// The old way (callbacks - don't use)
getData(function(result) {
  processData(result, function(processed) {
    saveData(processed, function(saved) {
      console.log('Done!');
    });
  });
});

// The Promise way (better)
getData()
  .then(result => processData(result))
  .then(processed => saveData(processed))
  .then(() => console.log('Done!'))
  .catch(error => console.error(error));

// The async/await way (BEST - use this)
async function handleData() {
  try {
    const result = await getData();
    const processed = await processData(result);
    await saveData(processed);
    console.log('Done!');
  } catch (error) {
    console.error('Error:', error);
  }
}
```

**Why this matters:** ALL Firebase operations are async (database reads, writes, file uploads).

---

### Resources for Week 1-2

**Must Read:**
- JavaScript.info - "JavaScript Fundamentals" section (2 hours)
- TypeScript Handbook - "Basics" and "Everyday Types" (1 hour)

**Practice:**
- FreeCodeCamp: "JavaScript Algorithms" challenges (1-2 hours)
- Type your own business objects (Job, Company, CO) with TypeScript

**Checkpoint:**
- Can you write a function that takes an array of jobs and returns total contract value?
- Can you explain what `async/await` does?
- Can you use `.map()`, `.filter()`, and `.reduce()`?

---

## Week 3-4: React Fundamentals

### Core Concepts You MUST Know

#### 1. Components (The Building Blocks)
```typescript
// A component is just a function that returns JSX (HTML-like syntax)
export function JobCard() {
  return (
    <div className="border rounded-lg p-4">
      <h3 className="text-lg font-semibold">Downtown Medical</h3>
      <p className="text-gray-600">Job #12345</p>
    </div>
  );
}

// Component with props (data passed in)
interface JobCardProps {
  jobNumber: string;
  jobName: string;
  contractValue: number;
}

export function JobCard({ jobNumber, jobName, contractValue }: JobCardProps) {
  return (
    <div className="border rounded-lg p-4">
      <h3 className="text-lg font-semibold">{jobName}</h3>
      <p className="text-gray-600">Job #{jobNumber}</p>
      <p className="text-green-600">${contractValue.toLocaleString()}</p>
    </div>
  );
}

// Using the component
<JobCard 
  jobNumber="12345"
  jobName="Downtown Medical"
  contractValue={125000}
/>
```

**Key Insight:** Components are reusable. Write once, use everywhere.

---

#### 2. State (Data That Changes)
```typescript
'use client';
import { useState } from 'react';

export function ChangeOrderForm() {
  // State: [currentValue, functionToUpdateIt]
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState(0);

  const handleSubmit = () => {
    console.log('Creating CO:', { description, amount });
    // Clear form
    setDescription('');
    setAmount(0);
  };

  return (
    <div className="space-y-4">
      <input
        type="text"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Description"
        className="border rounded px-3 py-2 w-full"
      />
      
      <input
        type="number"
        value={amount}
        onChange={(e) => setAmount(Number(e.target.value))}
        placeholder="Amount"
        className="border rounded px-3 py-2 w-full"
      />
      
      <button 
        onClick={handleSubmit}
        className="bg-blue-600 text-white px-4 py-2 rounded"
      >
        Create Change Order
      </button>
    </div>
  );
}
```

**Key Insight:** When state changes, React re-renders the component automatically.

---

#### 3. Effects (Side Effects Like Data Fetching)
```typescript
'use client';
import { useState, useEffect } from 'react';

export function JobList() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

  // Effect runs when component mounts
  useEffect(() => {
    async function fetchJobs() {
      try {
        const response = await fetch('/api/jobs');
        const data = await response.json();
        setJobs(data);
      } catch (error) {
        console.error('Failed to fetch jobs:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchJobs();
  }, []); // Empty array = run once on mount

  if (loading) {
    return <div>Loading jobs...</div>;
  }

  return (
    <div className="space-y-4">
      {jobs.map(job => (
        <JobCard key={job.jobNumber} {...job} />
      ))}
    </div>
  );
}
```

**Key Insight:** `useEffect` is for things that happen AFTER render (API calls, subscriptions, timers).

---

#### 4. Conditional Rendering
```typescript
export function JobStatus({ status }: { status: string }) {
  // Option 1: Ternary operator
  return (
    <span className={status === 'Active' ? 'text-green-600' : 'text-gray-600'}>
      {status}
    </span>
  );

  // Option 2: && operator (only render if true)
  return (
    <>
      {status === 'Active' && (
        <span className="text-green-600">Active</span>
      )}
    </>
  );

  // Option 3: Switch/case for complex logic
  const getStatusColor = () => {
    switch(status) {
      case 'Active': return 'bg-green-100 text-green-800';
      case 'Bidding': return 'bg-blue-100 text-blue-800';
      case 'Closed': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-600';
    }
  };

  return (
    <span className={`px-2 py-1 rounded ${getStatusColor()}`}>
      {status}
    </span>
  );
}
```

---

### Resources for Week 3-4

**Must Read:**
- React.dev "Quick Start" (2 hours)
- React.dev "Thinking in React" (1 hour)

**Must Build:**
- Todo list app (add, delete, mark complete) - classic React exercise
- Job card component that displays your business data
- Form with multiple inputs that logs to console

**Checkpoint:**
- Can you create a component with props?
- Can you use `useState` to manage form inputs?
- Can you use `useEffect` to fetch data when component loads?
- Do you understand when components re-render?

---

## Week 5-6: Next.js & Routing

### Core Concepts You MUST Know

#### 1. File-Based Routing
```
src/app/
â”œâ”€â”€ page.tsx              â†’ / (home)
â”œâ”€â”€ about/
â”‚   â””â”€â”€ page.tsx          â†’ /about
â”œâ”€â”€ jobs/
â”‚   â”œâ”€â”€ page.tsx          â†’ /jobs (list)
â”‚   â”œâ”€â”€ [id]/
â”‚   â”‚   â””â”€â”€ page.tsx      â†’ /jobs/12345 (detail)
â”‚   â””â”€â”€ new/
â”‚       â””â”€â”€ page.tsx      â†’ /jobs/new (create form)
â””â”€â”€ dashboard/
    â””â”€â”€ page.tsx          â†’ /dashboard
```

**Key Insight:** Folders = routes. `[id]` = dynamic segment.

---

#### 2. Dynamic Routes
```typescript
// src/app/jobs/[id]/page.tsx

interface PageProps {
  params: {
    id: string;
  };
}

export default function JobDetailPage({ params }: PageProps) {
  const jobId = params.id;

  return (
    <div>
      <h1>Job Details</h1>
      <p>Showing job: {jobId}</p>
    </div>
  );
}
```

**URL:** `/jobs/12345` â†’ `params.id` = "12345"

---

#### 3. Layouts (Shared UI)
```typescript
// src/app/layout.tsx - Global layout for ALL pages

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <nav className="bg-blue-600 text-white p-4">
          <h1>Parker BOS</h1>
        </nav>
        <main>{children}</main>
      </body>
    </html>
  );
}

// src/app/dashboard/layout.tsx - Layout for /dashboard/* pages

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex">
      <aside className="w-64 bg-gray-100 p-4">
        <nav>
          <a href="/dashboard">Overview</a>
          <a href="/dashboard/jobs">Jobs</a>
          <a href="/dashboard/companies">Companies</a>
        </nav>
      </aside>
      <div className="flex-1">{children}</div>
    </div>
  );
}
```

---

#### 4. Navigation
```typescript
'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export function Navigation() {
  const router = useRouter();

  const handleCreateJob = () => {
    // Programmatic navigation
    router.push('/jobs/new');
  };

  return (
    <nav>
      {/* Link component - preferred for navigation */}
      <Link href="/jobs" className="text-blue-600">
        View Jobs
      </Link>

      {/* Button with programmatic navigation */}
      <button onClick={handleCreateJob}>
        Create New Job
      </button>
    </nav>
  );
}
```

---

### Resources for Week 5-6

**Must Read:**
- Next.js Docs - "Routing Fundamentals" (2 hours)
- Next.js Docs - "Layouts and Templates" (1 hour)

**Must Build:**
- Multi-page app with navbar and routes
- Jobs list page â†’ Job detail page (dynamic route)
- Shared layout with sidebar navigation

**Checkpoint:**
- Can you create nested routes?
- Can you pass data via URL params?
- Can you create a shared layout?
- Do you understand Server vs Client components? (Basic level - you'll learn more later)

---

## Week 7-8: Firebase Firestore

### Core Concepts You MUST Know

#### 1. Collections & Documents
```
Firestore Structure (like folders and files):

companies (collection)
â”œâ”€â”€ abc123 (document)
â”‚   â”œâ”€â”€ companyName: "ABC Construction"
â”‚   â”œâ”€â”€ category: "GC"
â”‚   â””â”€â”€ email: "info@abc.com"
â”œâ”€â”€ xyz789 (document)
â”‚   â”œâ”€â”€ companyName: "XYZ Supply"
â”‚   â”œâ”€â”€ category: "Vendor"
â”‚   â””â”€â”€ email: "sales@xyz.com"

jobs (collection)
â”œâ”€â”€ job001 (document)
â”‚   â”œâ”€â”€ jobNumber: "12345"
â”‚   â”œâ”€â”€ jobName: "Downtown Medical"
â”‚   â”œâ”€â”€ gcLink: "abc123"  â† References companies/abc123
â”‚   â””â”€â”€ contractValue: 125000
```

**Key Insight:** Collections contain documents. Documents contain data (and can have subcollections).

---

#### 2. Creating Data (Write)
```typescript
import { collection, addDoc, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';

// Option 1: Auto-generated ID
async function createCompany(data: CompanyFormData) {
  const docRef = await addDoc(collection(db, 'companies'), {
    companyName: data.companyName,
    category: data.category,
    email: data.email,
    createdAt: serverTimestamp(), // Use server time, not client
  });
  
  console.log('Created with ID:', docRef.id);
  return docRef.id;
}

// Option 2: Custom ID (like using job number)
async function createJob(jobNumber: string, data: JobFormData) {
  await setDoc(doc(db, 'jobs', jobNumber), {
    jobNumber,
    jobName: data.jobName,
    contractValue: data.contractValue,
    createdAt: serverTimestamp(),
  });
  
  return jobNumber;
}
```

---

#### 3. Reading Data (Queries)
```typescript
import { collection, getDocs, doc, getDoc, query, where, orderBy } from 'firebase/firestore';

// Get single document by ID
async function getCompany(companyId: string) {
  const docRef = doc(db, 'companies', companyId);
  const docSnap = await getDoc(docRef);
  
  if (docSnap.exists()) {
    return { id: docSnap.id, ...docSnap.data() };
  } else {
    return null;
  }
}

// Get all documents in collection
async function getAllCompanies() {
  const querySnapshot = await getDocs(collection(db, 'companies'));
  
  const companies = querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
  
  return companies;
}

// Query with filters
async function getActiveJobs() {
  const q = query(
    collection(db, 'jobs'),
    where('status', '==', 'Active'),
    orderBy('jobNumber', 'desc')
  );
  
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
}

// Query with multiple conditions
async function getVendors() {
  const q = query(
    collection(db, 'companies'),
    where('category', '==', 'Vendor'),
    orderBy('companyName')
  );
  
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
}
```

---

#### 4. Updating Data
```typescript
import { doc, updateDoc, increment } from 'firebase/firestore';

// Update specific fields
async function updateCompany(companyId: string, updates: Partial<Company>) {
  const docRef = doc(db, 'companies', companyId);
  await updateDoc(docRef, {
    ...updates,
    updatedAt: serverTimestamp(),
  });
}

// Increment a number (for contract values, etc.)
async function approveChangeOrder(jobId: string, coAmount: number) {
  const jobRef = doc(db, 'jobs', jobId);
  await updateDoc(jobRef, {
    currentContractValue: increment(coAmount),
    updatedAt: serverTimestamp(),
  });
}
```

---

#### 5. Deleting Data
```typescript
import { doc, deleteDoc } from 'firebase/firestore';

async function deleteCompany(companyId: string) {
  await deleteDoc(doc(db, 'companies', companyId));
}
```

---

#### 6. Real-Time Listeners (Live Updates)
```typescript
'use client';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';

export function LiveJobList() {
  const [jobs, setJobs] = useState<Job[]>([]);

  useEffect(() => {
    // Subscribe to real-time updates
    const q = query(collection(db, 'jobs'), where('status', '==', 'Active'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const updatedJobs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setJobs(updatedJobs);
    });

    // Cleanup subscription on unmount
    return () => unsubscribe();
  }, []);

  return (
    <div>
      {jobs.map(job => (
        <JobCard key={job.id} {...job} />
      ))}
    </div>
  );
}
```

**Key Insight:** `onSnapshot` gives you live updates. When data changes in Firestore, your component updates automatically!

---

### Resources for Week 7-8

**Must Read:**
- Firebase Firestore Docs - "Get Started" (2 hours)
- Firebase Firestore Docs - "Read Data" and "Write Data" (2 hours)

**Must Build:**
- Simple CRUD app (Create, Read, Update, Delete companies)
- Practice queries with filters
- Try real-time listener (see live updates in action)

**Checkpoint:**
- Can you add a document to Firestore?
- Can you query documents with `where` clause?
- Can you update a specific document?
- Do you understand the difference between `addDoc` and `setDoc`?

---

## Week 9-10: Forms & Validation

### Core Concepts You MUST Know

#### 1. React Hook Form (The Best Form Library)
```typescript
'use client';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

// Define validation schema with Zod
const companySchema = z.object({
  companyName: z.string().min(2, 'Company name must be at least 2 characters'),
  category: z.enum(['GC', 'Vendor', 'Jurisdiction']),
  email: z.string().email('Invalid email address'),
  phone: z.string().optional(),
});

type CompanyFormData = z.infer<typeof companySchema>;

export function CompanyForm() {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<CompanyFormData>({
    resolver: zodResolver(companySchema),
  });

  const onSubmit = async (data: CompanyFormData) => {
    try {
      await addDoc(collection(db, 'companies'), {
        ...data,
        createdAt: serverTimestamp(),
      });
      reset(); // Clear form
      alert('Company created!');
    } catch (error) {
      console.error('Error creating company:', error);
      alert('Failed to create company');
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1">
          Company Name
        </label>
        <input
          {...register('companyName')}
          className="border rounded px-3 py-2 w-full"
        />
        {errors.companyName && (
          <p className="text-red-600 text-sm mt-1">
            {errors.companyName.message}
          </p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">
          Category
        </label>
        <select
          {...register('category')}
          className="border rounded px-3 py-2 w-full"
        >
          <option value="">Select...</option>
          <option value="GC">General Contractor</option>
          <option value="Vendor">Vendor</option>
          <option value="Jurisdiction">Jurisdiction</option>
        </select>
        {errors.category && (
          <p className="text-red-600 text-sm mt-1">
            {errors.category.message}
          </p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">
          Email
        </label>
        <input
          type="email"
          {...register('email')}
          className="border rounded px-3 py-2 w-full"
        />
        {errors.email && (
          <p className="text-red-600 text-sm mt-1">
            {errors.email.message}
          </p>
        )}
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="bg-blue-600 text-white px-4 py-2 rounded disabled:bg-gray-400"
      >
        {isSubmitting ? 'Creating...' : 'Create Company'}
      </button>
    </form>
  );
}
```

**Why this is better than plain forms:**
- Automatic validation
- Type safety with Zod
- Easy error handling
- Prevents submission while processing
- Works great with TypeScript

---

### Resources for Week 9-10

**Must Read:**
- React Hook Form Docs - "Get Started" (1 hour)
- Zod Docs - "Basic Usage" (30 minutes)

**Must Build:**
- Company creation form with validation
- Job creation form with multiple fields
- Edit form (populate existing data)

**Checkpoint:**
- Can you create a form with React Hook Form?
- Can you validate fields with Zod?
- Can you display error messages?
- Can you handle form submission to Firestore?

---

## Week 11-12: Cloud Functions Basics

### Core Concepts You MUST Know

#### 1. What Are Cloud Functions?
**Think of them as:** Backend code that runs automatically when something happens.

**Examples:**
- When CO status changes to "Approved" â†’ Update job contract value
- When PO is marked "Received" â†’ Update inventory items to "On-Site"
- When file is uploaded â†’ Trigger AI extraction
- Every night at midnight â†’ Generate daily reports

---

#### 2. Setting Up Cloud Functions
```bash
# In your project root
firebase init functions

# Choose:
# - TypeScript
# - ESLint: Yes
# - Install dependencies: Yes

# This creates a `functions/` folder
```

---

#### 3. Firestore Trigger (Most Common)
```typescript
// functions/src/index.ts
import { onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

// Initialize Firebase Admin
import { initializeApp } from 'firebase-admin/app';
initializeApp();

// When a Change Order is updated
export const onCOStatusChange = onDocumentUpdated(
  'changeOrders/{coId}',
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    
    // Check if status changed to "Approved"
    if (before?.status !== 'Approved' && after?.status === 'Approved') {
      const db = getFirestore();
      const jobRef = db.collection('jobs').doc(after.jobLink);
      
      // Update job contract value
      await jobRef.update({
        currentContractValue: FieldValue.increment(after.amountApproved),
        updatedAt: FieldValue.serverTimestamp(),
      });
      
      console.log(`Updated job ${after.jobLink} with CO amount $${after.amountApproved}`);
    }
  }
);
```

---

#### 4. Deploy Cloud Functions
```bash
cd functions
npm run build

# Deploy all functions
firebase deploy --only functions

# Deploy specific function
firebase deploy --only functions:onCOStatusChange
```

---

### Resources for Week 11-12

**Must Read:**
- Firebase Functions Docs - "Get Started" (2 hours)
- Firebase Functions Docs - "Firestore Triggers" (1 hour)

**Must Build:**
- Simple trigger that logs when a document is created
- Trigger that updates related data (like CO â†’ Job)
- Scheduled function (runs daily)

**Checkpoint:**
- Can you create a Cloud Function?
- Can you trigger on document changes?
- Can you deploy functions?
- Do you understand the Firebase Admin SDK vs. Client SDK?

---

## Ongoing Learning: As You Build

### Month 3-4: Advanced React Patterns
- Custom hooks (reusable logic)
- Context API (global state)
- Error boundaries
- Performance optimization

### Month 5-6: AI Integration
- OpenAI API basics
- GPT-4 Vision for document processing
- Prompt engineering
- Streaming responses

### Month 7-8: Mobile & PWA
- Service Workers
- Offline support
- IndexedDB
- Push notifications

### Month 9-10: Performance & Scale
- Query optimization
- Image optimization
- Code splitting
- Caching strategies

### Month 11-12: Production Readiness
- Error monitoring (Sentry)
- Analytics
- Security audits
- Backup strategies

---

## Learning Resources (Curated)

### Documentation (Always Refer Back)
- **Next.js:** https://nextjs.org/docs
- **React:** https://react.dev/
- **Firebase:** https://firebase.google.com/docs
- **Tailwind CSS:** https://tailwindcss.com/docs
- **TypeScript:** https://www.typescriptlang.org/docs/

### Video Courses (If You Prefer Video)
- **Next.js 14 Full Course** - YouTube (3 hours)
- **Firebase Full Course** - Fireship (1 hour)
- **TypeScript for Beginners** - Net Ninja (2 hours)

### Practice Platforms
- **Frontend Mentor** - Build real projects
- **JavaScript30** - 30 JS projects in 30 days
- **FreeCodeCamp** - Structured learning path

---

## Tips for Success

### 1. Learn Just-In-Time (Not Just-In-Case)
**Don't:** Read entire React docs before starting
**Do:** Learn React basics, then look up specifics when needed

### 2. Build Real Features (Not Tutorials)
**Don't:** Build another todo app
**Do:** Build your Company form, then add companies

### 3. Use AI Coding Assistants
- Cursor AI can explain code
- ChatGPT for "How do I...?" questions
- GitHub Copilot for code completion

### 4. Embrace Errors (They Teach You)
- Read error messages carefully
- Google the error (Stack Overflow)
- Use console.log() liberally
- Ask AI to explain the error

### 5. Take Breaks (You'll Learn While You Sleep)
Your brain processes and consolidates learning during downtime. Don't force marathon sessions.

---

## Weekly Time Commitment

### Realistic Schedule (For Part-Time Learning)

**Weeks 1-4 (Foundations):**
- Monday: 1 hour (reading/watching)
- Wednesday: 1 hour (practice exercises)
- Saturday: 2 hours (build small project)
- **Total: 4 hours/week**

**Weeks 5-12 (Building Real Features):**
- Monday: 1 hour (reading docs)
- Wednesday: 2 hours (coding)
- Saturday: 3 hours (building Parker BOS)
- **Total: 6 hours/week**

**Months 4+ (Production Development):**
- Tuesday/Thursday: 2 hours each (coding sessions)
- Saturday: 4 hours (major features)
- **Total: 8 hours/week**

**At this pace:** Foundation complete in 3 months, basic system in 6 months, production-ready in 12 months.

---

## Checkpoint: Are You Ready to Move On?

After each phase, ask yourself:

### After Week 2:
- [ ] Can I write TypeScript functions?
- [ ] Do I understand arrays and objects?
- [ ] Can I use `.map()`, `.filter()`, `.reduce()`?

### After Week 4:
- [ ] Can I create React components?
- [ ] Do I understand `useState`?
- [ ] Can I handle form inputs?

### After Week 6:
- [ ] Can I create pages in Next.js?
- [ ] Do I understand file-based routing?
- [ ] Can I navigate between pages?

### After Week 8:
- [ ] Can I read/write to Firestore?
- [ ] Can I query data with filters?
- [ ] Do I understand real-time listeners?

### After Week 12:
- [ ] Can I create Cloud Functions?
- [ ] Can I trigger on document changes?
- [ ] Can I deploy to Firebase?

**If you answered "Yes" to most questions in a phase, you're ready to move forward!**

**If you answered "No" to many:** Spend another week in that phase. That's okay!

---

## What's Next?

You've completed the foundational learning path. Now it's time to **build real features**.

**Next steps:**
1. Read `02_DATA_ENTRY_SYSTEM.md` - Build Companies, People, Jobs
2. Start coding with the examples from each module
3. Reference this guide when you need to refresh concepts

**Remember:** You don't need to master everything. You need to understand enough to build, then learn deeper as you go.

---

**You've got this!** ðŸ’ª Every developer started exactly where you are now.

---

## Quick Reference: Must-Know Syntax

```typescript
// Variables
const name: string = "Parker";
let count: number = 0;

// Functions
const add = (a: number, b: number): number => a + b;

// Async/Await
const data = await fetchData();

// Array methods
items.map(item => item.name)
items.filter(item => item.active)
items.reduce((sum, item) => sum + item.cost, 0)

// React
useState, useEffect, useRouter

// Firestore
addDoc, getDoc, getDocs, updateDoc, deleteDoc

// Next.js routing
src/app/page.tsx â†’ /
src/app/jobs/[id]/page.tsx â†’ /jobs/:id
```

Keep this handy! ðŸ“‹
