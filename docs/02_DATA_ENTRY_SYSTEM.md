# 02 - Data Entry System
## Build Your First Real Feature: Companies, People, Jobs

**Goal:** Create CRUD (Create, Read, Update, Delete) interfaces for your core business data

**Time Estimate:** 1-2 weeks (building while learning)

**Prerequisites:** 
- Completed `00_FOUNDATION_SETUP.md`
- Read Week 7-8 of `01_LEARNING_PATH.md` (Firestore basics)
- Basic React understanding

**What You'll Build:**
- Companies management (your rolodex)
- People management (contacts at companies)
- Jobs management (projects)
- Airtable import scripts

---

## Part 1: Firestore Database Schema

### Collections Structure

```typescript
// src/types/index.ts

export interface Company {
  id: string;
  companyName: string;
  category: 'GC' | 'Vendor' | 'Jurisdiction' | 'Other';
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  phone?: string;
  email?: string;
  website?: string;
  portalLink?: string;
  notes?: string;
  createdAt: any; // Firestore Timestamp
  updatedAt: any;
  createdBy: string; // User ID
}

export interface Person {
  id: string;
  companyId: string; // Reference to Company
  companyName: string; // Denormalized for easy display
  firstName: string;
  lastName: string;
  fullName: string; // Computed: firstName + lastName
  jobTitle?: string;
  email?: string;
  phone?: string;
  mobile?: string;
  notes?: string;
  createdAt: any;
  updatedAt: any;
  createdBy: string;
}

export interface Job {
  id: string;
  jobNumber: string; // Unique identifier
  jobName: string;
  gcId: string; // Reference to Company (GC)
  gcName: string; // Denormalized
  siteAddress?: string;
  siteCity?: string;
  siteState?: string;
  siteZip?: string;
  projectPhase: 'Lead' | 'Bidding' | 'Active' | 'Warranty' | 'Closed';
  bidDueDate?: any;
  startDate?: any;
  completionDate?: any;
  originalContractValue?: number;
  currentContractValue?: number;
  notes?: string;
  createdAt: any;
  updatedAt: any;
  createdBy: string;
}
```

**Why denormalize (copy) company names?**
- Faster queries (don't need to join)
- Better UI performance (display immediately)
- Acceptable tradeoff in Firestore

---

## Part 2: Companies Management

### Step 1: Create Company Form Component

Create `src/components/CompanyForm.tsx`:

```typescript
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { addDoc, collection, serverTimestamp, updateDoc, doc } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { useRouter } from 'next/navigation';
import { Company } from '@/types';

const companySchema = z.object({
  companyName: z.string().min(2, 'Company name required'),
  category: z.enum(['GC', 'Vendor', 'Jurisdiction', 'Other']),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zip: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  website: z.string().url('Invalid URL').optional().or(z.literal('')),
  portalLink: z.string().url('Invalid URL').optional().or(z.literal('')),
  notes: z.string().optional(),
});

type CompanyFormData = z.infer<typeof companySchema>;

interface CompanyFormProps {
  company?: Company; // If editing
  onSuccess?: () => void;
}

export function CompanyForm({ company, onSuccess }: CompanyFormProps) {
  const router = useRouter();
  const isEditing = !!company;

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CompanyFormData>({
    resolver: zodResolver(companySchema),
    defaultValues: company ? {
      companyName: company.companyName,
      category: company.category,
      address: company.address || '',
      city: company.city || '',
      state: company.state || '',
      zip: company.zip || '',
      phone: company.phone || '',
      email: company.email || '',
      website: company.website || '',
      portalLink: company.portalLink || '',
      notes: company.notes || '',
    } : undefined,
  });

  const onSubmit = async (data: CompanyFormData) => {
    try {
      if (isEditing && company) {
        // Update existing
        await updateDoc(doc(db, 'companies', company.id), {
          ...data,
          updatedAt: serverTimestamp(),
        });
        alert('Company updated!');
      } else {
        // Create new
        await addDoc(collection(db, 'companies'), {
          ...data,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          createdBy: auth.currentUser?.uid,
        });
        alert('Company created!');
      }

      if (onSuccess) {
        onSuccess();
      } else {
        router.push('/companies');
      }
    } catch (error) {
      console.error('Error saving company:', error);
      alert('Failed to save company');
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Company Name */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Company Name *
        </label>
        <input
          {...register('companyName')}
          className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="ABC Construction"
        />
        {errors.companyName && (
          <p className="text-red-600 text-sm mt-1">{errors.companyName.message}</p>
        )}
      </div>

      {/* Category */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Category *
        </label>
        <select
          {...register('category')}
          className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="">Select category...</option>
          <option value="GC">General Contractor</option>
          <option value="Vendor">Vendor/Supplier</option>
          <option value="Jurisdiction">Jurisdiction</option>
          <option value="Other">Other</option>
        </select>
        {errors.category && (
          <p className="text-red-600 text-sm mt-1">{errors.category.message}</p>
        )}
      </div>

      {/* Address Fields */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Address
          </label>
          <input
            {...register('address')}
            className="w-full border border-gray-300 rounded-lg px-4 py-2"
            placeholder="123 Main St"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            City
          </label>
          <input
            {...register('city')}
            className="w-full border border-gray-300 rounded-lg px-4 py-2"
            placeholder="San Francisco"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            State
          </label>
          <input
            {...register('state')}
            className="w-full border border-gray-300 rounded-lg px-4 py-2"
            placeholder="CA"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            ZIP
          </label>
          <input
            {...register('zip')}
            className="w-full border border-gray-300 rounded-lg px-4 py-2"
            placeholder="94102"
          />
        </div>
      </div>

      {/* Contact Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Phone
          </label>
          <input
            {...register('phone')}
            type="tel"
            className="w-full border border-gray-300 rounded-lg px-4 py-2"
            placeholder="(555) 123-4567"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Email
          </label>
          <input
            {...register('email')}
            type="email"
            className="w-full border border-gray-300 rounded-lg px-4 py-2"
            placeholder="info@company.com"
          />
          {errors.email && (
            <p className="text-red-600 text-sm mt-1">{errors.email.message}</p>
          )}
        </div>
      </div>

      {/* URLs */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Website
          </label>
          <input
            {...register('website')}
            type="url"
            className="w-full border border-gray-300 rounded-lg px-4 py-2"
            placeholder="https://company.com"
          />
          {errors.website && (
            <p className="text-red-600 text-sm mt-1">{errors.website.message}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Portal Link
          </label>
          <input
            {...register('portalLink')}
            type="url"
            className="w-full border border-gray-300 rounded-lg px-4 py-2"
            placeholder="https://portal.company.com"
          />
          {errors.portalLink && (
            <p className="text-red-600 text-sm mt-1">{errors.portalLink.message}</p>
          )}
        </div>
      </div>

      {/* Notes */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Notes
        </label>
        <textarea
          {...register('notes')}
          rows={4}
          className="w-full border border-gray-300 rounded-lg px-4 py-2"
          placeholder="Additional notes..."
        />
      </div>

      {/* Submit Button */}
      <div className="flex gap-4">
        <button
          type="submit"
          disabled={isSubmitting}
          className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {isSubmitting ? 'Saving...' : isEditing ? 'Update Company' : 'Create Company'}
        </button>

        <button
          type="button"
          onClick={() => router.back()}
          className="bg-gray-200 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-300"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
```

---

### Step 2: Create Companies List Page

Create `src/app/companies/page.tsx`:

```typescript
'use client';

import { useEffect, useState } from 'react';
import { collection, getDocs, deleteDoc, doc, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Company } from '@/types';
import Link from 'next/link';

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');

  useEffect(() => {
    loadCompanies();
  }, []);

  const loadCompanies = async () => {
    try {
      const q = query(collection(db, 'companies'), orderBy('companyName'));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as Company[];
      setCompanies(data);
    } catch (error) {
      console.error('Error loading companies:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete ${name}? This cannot be undone.`)) return;

    try {
      await deleteDoc(doc(db, 'companies', id));
      setCompanies(companies.filter(c => c.id !== id));
      alert('Company deleted');
    } catch (error) {
      console.error('Error deleting company:', error);
      alert('Failed to delete company');
    }
  };

  const filteredCompanies = companies.filter(company => {
    const matchesSearch = company.companyName.toLowerCase().includes(filter.toLowerCase());
    const matchesCategory = !categoryFilter || company.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-600">Loading companies...</div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Companies</h1>
        <Link
          href="/companies/new"
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          + Add Company
        </Link>
      </div>

      {/* Filters */}
      <div className="mb-6 flex gap-4">
        <input
          type="text"
          placeholder="Search companies..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="flex-1 border border-gray-300 rounded-lg px-4 py-2"
        />
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="border border-gray-300 rounded-lg px-4 py-2"
        >
          <option value="">All Categories</option>
          <option value="GC">General Contractors</option>
          <option value="Vendor">Vendors</option>
          <option value="Jurisdiction">Jurisdictions</option>
          <option value="Other">Other</option>
        </select>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-gray-600 text-sm">Total Companies</div>
          <div className="text-2xl font-bold">{companies.length}</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-gray-600 text-sm">GCs</div>
          <div className="text-2xl font-bold">
            {companies.filter(c => c.category === 'GC').length}
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-gray-600 text-sm">Vendors</div>
          <div className="text-2xl font-bold">
            {companies.filter(c => c.category === 'Vendor').length}
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-gray-600 text-sm">Showing</div>
          <div className="text-2xl font-bold">{filteredCompanies.length}</div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Company Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Category
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Contact
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Location
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredCompanies.map((company) => (
              <tr key={company.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <Link
                    href={`/companies/${company.id}`}
                    className="text-blue-600 hover:text-blue-800 font-medium"
                  >
                    {company.companyName}
                  </Link>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 py-1 text-xs rounded-full ${
                    company.category === 'GC' ? 'bg-blue-100 text-blue-800' :
                    company.category === 'Vendor' ? 'bg-green-100 text-green-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {company.category}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                  {company.email || company.phone || 'â€”'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                  {company.city && company.state ? `${company.city}, ${company.state}` : 'â€”'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                  <Link
                    href={`/companies/${company.id}/edit`}
                    className="text-blue-600 hover:text-blue-800 mr-4"
                  >
                    Edit
                  </Link>
                  <button
                    onClick={() => handleDelete(company.id, company.companyName)}
                    className="text-red-600 hover:text-red-800"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filteredCompanies.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            No companies found. {filter && 'Try adjusting your search.'}
          </div>
        )}
      </div>
    </div>
  );
}
```

---

### Step 3: Create New Company Page

Create `src/app/companies/new/page.tsx`:

```typescript
import { CompanyForm } from '@/components/CompanyForm';

export default function NewCompanyPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Add New Company</h1>
      <div className="bg-white rounded-lg shadow-md p-6">
        <CompanyForm />
      </div>
    </div>
  );
}
```

---

### Step 4: Create Company Detail Page

Create `src/app/companies/[id]/page.tsx`:

```typescript
'use client';

import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Company } from '@/types';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface PageProps {
  params: {
    id: string;
  };
}

export default function CompanyDetailPage({ params }: PageProps) {
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    loadCompany();
  }, [params.id]);

  const loadCompany = async () => {
    try {
      const docRef = doc(db, 'companies', params.id);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        setCompany({ id: docSnap.id, ...docSnap.data() } as Company);
      } else {
        alert('Company not found');
        router.push('/companies');
      }
    } catch (error) {
      console.error('Error loading company:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  if (!company) return null;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex justify-between items-start mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {company.companyName}
          </h1>
          <span className={`px-3 py-1 text-sm rounded-full ${
            company.category === 'GC' ? 'bg-blue-100 text-blue-800' :
            company.category === 'Vendor' ? 'bg-green-100 text-green-800' :
            'bg-gray-100 text-gray-800'
          }`}>
            {company.category}
          </span>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/companies/${company.id}/edit`}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            Edit
          </Link>
          <Link
            href="/companies"
            className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-300"
          >
            Back
          </Link>
        </div>
      </div>

      {/* Details */}
      <div className="bg-white rounded-lg shadow-md p-6 space-y-6">
        {/* Address */}
        {(company.address || company.city) && (
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Address</h2>
            <div className="text-gray-700">
              {company.address && <div>{company.address}</div>}
              {company.city && (
                <div>
                  {company.city}
                  {company.state && `, ${company.state}`}
                  {company.zip && ` ${company.zip}`}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Contact Info */}
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Contact Information</h2>
          <div className="space-y-2">
            {company.phone && (
              <div className="flex items-center gap-2">
                <span className="text-gray-600">Phone:</span>
                <a href={`tel:${company.phone}`} className="text-blue-600 hover:underline">
                  {company.phone}
                </a>
              </div>
            )}
            {company.email && (
              <div className="flex items-center gap-2">
                <span className="text-gray-600">Email:</span>
                <a href={`mailto:${company.email}`} className="text-blue-600 hover:underline">
                  {company.email}
                </a>
              </div>
            )}
            {company.website && (
              <div className="flex items-center gap-2">
                <span className="text-gray-600">Website:</span>
                <a
                  href={company.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  {company.website}
                </a>
              </div>
            )}
            {company.portalLink && (
              <div className="flex items-center gap-2">
                <span className="text-gray-600">Portal:</span>
                <a
                  href={company.portalLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  {company.portalLink}
                </a>
              </div>
            )}
          </div>
        </div>

        {/* Notes */}
        {company.notes && (
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Notes</h2>
            <p className="text-gray-700 whitespace-pre-wrap">{company.notes}</p>
          </div>
        )}
      </div>
    </div>
  );
}
```

---

### Step 5: Create Edit Company Page

Create `src/app/companies/[id]/edit/page.tsx`:

```typescript
'use client';

import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Company } from '@/types';
import { CompanyForm } from '@/components/CompanyForm';
import { useRouter } from 'next/navigation';

interface PageProps {
  params: {
    id: string;
  };
}

export default function EditCompanyPage({ params }: PageProps) {
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    loadCompany();
  }, [params.id]);

  const loadCompany = async () => {
    try {
      const docRef = doc(db, 'companies', params.id);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        setCompany({ id: docSnap.id, ...docSnap.data() } as Company);
      } else {
        alert('Company not found');
        router.push('/companies');
      }
    } catch (error) {
      console.error('Error loading company:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  if (!company) return null;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">
        Edit {company.companyName}
      </h1>
      <div className="bg-white rounded-lg shadow-md p-6">
        <CompanyForm company={company} />
      </div>
    </div>
  );
}
```

---

## Part 3: People Management

I'll continue with People and Jobs in the next files to keep each manageable. The pattern is the same for People and Jobs - you now have the complete Companies CRUD system!

### Quick Implementation Guide for People & Jobs

**People** follows the same pattern:
1. Create `PersonForm` component
2. Create people list page
3. Create person detail/edit pages
4. Add company picker (dropdown of companies)

**Jobs** follows the same pattern:
1. Create `JobForm` component
2. Create jobs list page
3. Create job detail/edit pages
4. Add GC picker, project phase selector

---

## Part 4: Airtable Import Script

Create `scripts/import-airtable.ts`:

```typescript
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import * as fs from 'fs';
import * as csv from 'csv-parser';

// Your Firebase config
const firebaseConfig = {
  // ... your config
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function importCompanies(csvPath: string) {
  const companies: any[] = [];

  return new Promise((resolve, reject) => {
    fs.createReadStream(csvPath)
      .pipe(csv())
      .on('data', (row) => {
        companies.push({
          companyName: row['Company Name'],
          category: row['Category'],
          email: row['Email'] || null,
          phone: row['Phone'] || null,
          address: row['Address'] || null,
          city: row['City'] || null,
          state: row['State'] || null,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      })
      .on('end', async () => {
        console.log(`Importing ${companies.length} companies...`);

        for (const company of companies) {
          try {
            await addDoc(collection(db, 'companies'), company);
            console.log(`Imported: ${company.companyName}`);
          } catch (error) {
            console.error(`Failed to import ${company.companyName}:`, error);
          }
        }

        resolve(true);
      })
      .on('error', reject);
  });
}

// Run import
importCompanies('./airtable-export-companies.csv')
  .then(() => console.log('Import complete!'))
  .catch((error) => console.error('Import failed:', error));
```

**To use:**
```bash
# Export from Airtable as CSV
# Place CSV in project root
# Run import
npx ts-node scripts/import-airtable.ts
```

---

## Testing Your Work

### Manual Testing Checklist

**Companies:**
- [ ] Can create a new company
- [ ] Can edit existing company
- [ ] Can delete company (with confirmation)
- [ ] Can search companies
- [ ] Can filter by category
- [ ] All fields save correctly
- [ ] Email/URL validation works

**After building People:**
- [ ] Can create person linked to company
- [ ] Company dropdown shows all companies
- [ ] Can't create person without company

**After building Jobs:**
- [ ] Can create job linked to GC
- [ ] Contract values calculate correctly
- [ ] Job numbers are unique

---

## Next Steps

You now have a complete Companies management system!

**This week:**
1. Build this Companies system
2. Test thoroughly
3. Deploy to Vercel

**Next week:**
1. Build People management (same pattern)
2. Build Jobs management (same pattern)
3. Add navigation between related records

**Ready for Phase 3?** After you complete Data Entry, move on to File Management!

---

## Common Issues & Solutions

**Issue:** Form doesn't submit
**Solution:** Check browser console for errors, verify Firebase config

**Issue:** Data doesn't appear in list
**Solution:** Check Firestore console, verify collection name matches

**Issue:** TypeScript errors
**Solution:** Install types: `pnpm add -D @types/node`

**Issue:** Can't delete company
**Solution:** Check Firestore security rules allow deletes

---

**Congratulations!** You've built your first full CRUD system. This is the foundation for everything else! ðŸŽ‰
