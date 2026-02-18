# 04 - Change Orders Module
## Streamline CO Workflow from Request to Billing

**Goal:** Digital change order management with auto-numbering, approval workflow, and contract value updates

**Time Estimate:** 2-3 weeks

**Prerequisites:**
- Completed Data Entry System (need jobs)
- Basic Cloud Functions knowledge

**What You'll Build:**
- CO creation form with cost breakdown
- Auto-generated CO numbers (JOB-CO-001)
- Approval workflow with status tracking
- Automatic contract value updates
- File attachment support
- CO history and reporting

---

## Database Schema

```typescript
// src/types/changeOrders.ts

export interface ChangeOrder {
  id: string;
  coNumber: string; // Auto-generated: 12345-CO-001
  
  // Job Association
  jobId: string;
  jobNumber: string; // Denormalized
  jobName: string; // Denormalized
  
  // Description
  description: string;
  category: 'Owner Change' | 'Field Condition' | 'Design Error' | 'Code Requirement' | 'Other';
  
  // Costs
  laborCost: number;
  materialCost: number;
  equipmentCost: number;
  subcontractorCost: number;
  otherCost: number;
  amountRequested: number; // Total of above
  markup: number; // Percentage
  amountApproved: number; // After markup
  
  // Workflow
  status: 'Draft' | 'Submitted' | 'Under Review' | 'Approved' | 'Rejected' | 'Executed' | 'Billed';
  dateInitiated: any; // Timestamp
  dateSubmitted?: any;
  dateApproved?: any;
  dateRejected?: any;
  
  // People
  requestedBy: string; // User ID
  requestedByName: string; // Denormalized
  approvedBy?: string;
  approvedByName?: string;
  
  // Documentation
  approvalDocUrl?: string; // Signed approval
  supportingDocs: string[]; // Array of file URLs
  
  // Notes
  internalNotes?: string;
  clientNotes?: string;
  rejectionReason?: string;
  
  // Linked Records
  relatedInventoryItems?: string[]; // If CO adds fixtures
  billedOnInvoiceId?: string; // When billed
  
  createdAt: any;
  updatedAt: any;
}
```

---

## Part 1: CO Creation Form

Create `src/components/ChangeOrderForm.tsx`:

```typescript
'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { collection, addDoc, serverTimestamp, getDocs, query, where } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { useRouter } from 'next/navigation';

const coSchema = z.object({
  jobId: z.string().min(1, 'Job required'),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  category: z.enum(['Owner Change', 'Field Condition', 'Design Error', 'Code Requirement', 'Other']),
  
  laborCost: z.number().min(0),
  materialCost: z.number().min(0),
  equipmentCost: z.number().min(0),
  subcontractorCost: z.number().min(0),
  otherCost: z.number().min(0),
  markup: z.number().min(0).max(100), // Percentage
  
  internalNotes: z.string().optional(),
});

type COFormData = z.infer<typeof coSchema>;

interface Job {
  id: string;
  jobNumber: string;
  jobName: string;
}

export function ChangeOrderForm() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const router = useRouter();

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<COFormData>({
    resolver: zodResolver(coSchema),
    defaultValues: {
      laborCost: 0,
      materialCost: 0,
      equipmentCost: 0,
      subcontractorCost: 0,
      otherCost: 0,
      markup: 15, // Default 15% markup
    },
  });

  useEffect(() => {
    loadJobs();
  }, []);

  const loadJobs = async () => {
    try {
      const q = query(
        collection(db, 'jobs'),
        where('projectPhase', 'in', ['Bidding', 'Active'])
      );
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as Job[];
      setJobs(data);
    } catch (error) {
      console.error('Error loading jobs:', error);
    }
  };

  // Watch cost fields for live calculation
  const laborCost = watch('laborCost') || 0;
  const materialCost = watch('materialCost') || 0;
  const equipmentCost = watch('equipmentCost') || 0;
  const subcontractorCost = watch('subcontractorCost') || 0;
  const otherCost = watch('otherCost') || 0;
  const markup = watch('markup') || 0;
  const jobId = watch('jobId');

  // Calculate totals
  const subtotal = laborCost + materialCost + equipmentCost + subcontractorCost + otherCost;
  const markupAmount = subtotal * (markup / 100);
  const total = subtotal + markupAmount;

  // Update selected job when jobId changes
  useEffect(() => {
    if (jobId) {
      const job = jobs.find(j => j.id === jobId);
      setSelectedJob(job || null);
    }
  }, [jobId, jobs]);

  const onSubmit = async (data: COFormData) => {
    try {
      const job = jobs.find(j => j.id === data.jobId);
      if (!job) {
        alert('Job not found');
        return;
      }

      await addDoc(collection(db, 'changeOrders'), {
        ...data,
        jobNumber: job.jobNumber,
        jobName: job.jobName,
        amountRequested: subtotal,
        amountApproved: total,
        status: 'Draft',
        dateInitiated: serverTimestamp(),
        requestedBy: auth.currentUser?.uid,
        requestedByName: auth.currentUser?.displayName,
        supportingDocs: [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      alert('Change Order created!');
      router.push('/change-orders');
    } catch (error) {
      console.error('Error creating CO:', error);
      alert('Failed to create CO');
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Job Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Job *
        </label>
        <select
          {...register('jobId')}
          className="w-full border border-gray-300 rounded-lg px-4 py-2"
        >
          <option value="">Select job...</option>
          {jobs.map(job => (
            <option key={job.id} value={job.id}>
              {job.jobNumber} - {job.jobName}
            </option>
          ))}
        </select>
        {errors.jobId && (
          <p className="text-red-600 text-sm mt-1">{errors.jobId.message}</p>
        )}
      </div>

      {/* Category */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Category *
        </label>
        <select
          {...register('category')}
          className="w-full border border-gray-300 rounded-lg px-4 py-2"
        >
          <option value="">Select category...</option>
          <option value="Owner Change">Owner Change</option>
          <option value="Field Condition">Field Condition</option>
          <option value="Design Error">Design Error</option>
          <option value="Code Requirement">Code Requirement</option>
          <option value="Other">Other</option>
        </select>
        {errors.category && (
          <p className="text-red-600 text-sm mt-1">{errors.category.message}</p>
        )}
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Description *
        </label>
        <textarea
          {...register('description')}
          rows={4}
          className="w-full border border-gray-300 rounded-lg px-4 py-2"
          placeholder="Describe the change in detail..."
        />
        {errors.description && (
          <p className="text-red-600 text-sm mt-1">{errors.description.message}</p>
        )}
      </div>

      {/* Cost Breakdown */}
      <div className="bg-gray-50 rounded-lg p-6 space-y-4">
        <h3 className="text-lg font-semibold">Cost Breakdown</h3>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Labor Cost
            </label>
            <input
              type="number"
              step="0.01"
              {...register('laborCost', { valueAsNumber: true })}
              className="w-full border border-gray-300 rounded-lg px-4 py-2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Material Cost
            </label>
            <input
              type="number"
              step="0.01"
              {...register('materialCost', { valueAsNumber: true })}
              className="w-full border border-gray-300 rounded-lg px-4 py-2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Equipment Cost
            </label>
            <input
              type="number"
              step="0.01"
              {...register('equipmentCost', { valueAsNumber: true })}
              className="w-full border border-gray-300 rounded-lg px-4 py-2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Subcontractor Cost
            </label>
            <input
              type="number"
              step="0.01"
              {...register('subcontractorCost', { valueAsNumber: true })}
              className="w-full border border-gray-300 rounded-lg px-4 py-2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Other Cost
            </label>
            <input
              type="number"
              step="0.01"
              {...register('otherCost', { valueAsNumber: true })}
              className="w-full border border-gray-300 rounded-lg px-4 py-2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Markup (%)
            </label>
            <input
              type="number"
              step="0.1"
              {...register('markup', { valueAsNumber: true })}
              className="w-full border border-gray-300 rounded-lg px-4 py-2"
            />
          </div>
        </div>

        {/* Totals */}
        <div className="border-t pt-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Subtotal:</span>
            <span className="font-medium">${subtotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Markup ({markup}%):</span>
            <span className="font-medium">${markupAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
          </div>
          <div className="flex justify-between text-lg font-bold border-t pt-2">
            <span>Total:</span>
            <span className="text-blue-600">${total.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
          </div>
        </div>
      </div>

      {/* Internal Notes */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Internal Notes
        </label>
        <textarea
          {...register('internalNotes')}
          rows={3}
          className="w-full border border-gray-300 rounded-lg px-4 py-2"
          placeholder="Notes for internal use only..."
        />
      </div>

      {/* Submit */}
      <div className="flex gap-4">
        <button
          type="submit"
          disabled={isSubmitting}
          className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
        >
          {isSubmitting ? 'Creating...' : 'Create Change Order'}
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

## Part 2: Auto-Number Generation (Cloud Function)

Create `functions/src/changeOrders.ts`:

```typescript
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { getFirestore } from 'firebase-admin/firestore';

const db = getFirestore();

export const generateCONumber = onDocumentCreated(
  'changeOrders/{coId}',
  async (event) => {
    const co = event.data?.data();
    const coId = event.params.coId;

    // Skip if already has a CO number
    if (!co || co.coNumber) {
      return;
    }

    try {
      const jobNumber = co.jobNumber;

      // Count existing COs for this job
      const existingCOs = await db
        .collection('changeOrders')
        .where('jobNumber', '==', jobNumber)
        .get();

      // Generate CO number: JOB-CO-###
      const coCount = existingCOs.size;
      const coNumber = `${jobNumber}-CO-${String(coCount).padStart(3, '0')}`;

      // Update the document
      await event.data.ref.update({
        coNumber,
        updatedAt: new Date(),
      });

      console.log(`Generated CO number: ${coNumber}`);
    } catch (error) {
      console.error('Error generating CO number:', error);
    }
  }
);
```

Export in `functions/src/index.ts`:

```typescript
export { generateCONumber } from './changeOrders';
```

---

## Part 3: Status Update Workflow (Cloud Function)

Add to `functions/src/changeOrders.ts`:

```typescript
import { onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { FieldValue } from 'firebase-admin/firestore';

export const onCOStatusChange = onDocumentUpdated(
  'changeOrders/{coId}',
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();

    if (!before || !after) return;

    // When approved, update job contract value
    if (before.status !== 'Approved' && after.status === 'Approved') {
      try {
        const jobRef = db.collection('jobs').doc(after.jobId);

        await jobRef.update({
          currentContractValue: FieldValue.increment(after.amountApproved),
          updatedAt: new Date(),
        });

        console.log(`Updated job ${after.jobId} contract value by $${after.amountApproved}`);

        // TODO: Send email notification to PM
      } catch (error) {
        console.error('Error updating contract value:', error);
      }
    }

    // When billed, update billing reference
    if (before.status !== 'Billed' && after.status === 'Billed') {
      console.log(`CO ${after.coNumber} marked as billed`);
    }
  }
);
```

---

## Part 4: CO List Page

Create `src/app/change-orders/page.tsx`:

```typescript
'use client';

import { useEffect, useState } from 'react';
import { collection, query, orderBy, getDocs, updateDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import Link from 'next/link';

interface ChangeOrder {
  id: string;
  coNumber: string;
  jobNumber: string;
  jobName: string;
  description: string;
  amountApproved: number;
  status: string;
  dateInitiated: any;
}

export default function ChangeOrdersPage() {
  const [cos, setCos] = useState<ChangeOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    loadCOs();
  }, []);

  const loadCOs = async () => {
    try {
      const q = query(collection(db, 'changeOrders'), orderBy('dateInitiated', 'desc'));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as ChangeOrder[];
      setCos(data);
    } catch (error) {
      console.error('Error loading COs:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (coId: string, newStatus: string) => {
    if (!confirm(`Change status to ${newStatus}?`)) return;

    try {
      await updateDoc(doc(db, 'changeOrders', coId), {
        status: newStatus,
        ...(newStatus === 'Approved' && { dateApproved: new Date() }),
        ...(newStatus === 'Rejected' && { dateRejected: new Date() }),
      });

      // Reload
      loadCOs();
    } catch (error) {
      console.error('Error updating status:', error);
      alert('Failed to update status');
    }
  };

  const filteredCOs = statusFilter
    ? cos.filter(co => co.status === statusFilter)
    : cos;

  const totalAmount = filteredCOs.reduce((sum, co) => sum + co.amountApproved, 0);

  if (loading) {
    return <div className="p-8 text-center">Loading change orders...</div>;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Change Orders</h1>
        <Link
          href="/change-orders/new"
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          + Create CO
        </Link>
      </div>

      {/* Filters */}
      <div className="mb-6">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="border border-gray-300 rounded-lg px-4 py-2"
        >
          <option value="">All Statuses</option>
          <option value="Draft">Draft</option>
          <option value="Submitted">Submitted</option>
          <option value="Under Review">Under Review</option>
          <option value="Approved">Approved</option>
          <option value="Rejected">Rejected</option>
          <option value="Executed">Executed</option>
          <option value="Billed">Billed</option>
        </select>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-sm text-gray-600">Total COs</div>
          <div className="text-2xl font-bold">{filteredCOs.length}</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-sm text-gray-600">Total Amount</div>
          <div className="text-2xl font-bold text-green-600">
            ${totalAmount.toLocaleString()}
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-sm text-gray-600">Pending Approval</div>
          <div className="text-2xl font-bold text-yellow-600">
            {cos.filter(co => co.status === 'Submitted' || co.status === 'Under Review').length}
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-sm text-gray-600">Approved</div>
          <div className="text-2xl font-bold text-blue-600">
            {cos.filter(co => co.status === 'Approved').length}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                CO Number
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Job
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Description
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Amount
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Status
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filteredCOs.map((co) => (
              <tr key={co.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <Link
                    href={`/change-orders/${co.id}`}
                    className="text-blue-600 hover:text-blue-800 font-medium"
                  >
                    {co.coNumber}
                  </Link>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  {co.jobNumber} - {co.jobName}
                </td>
                <td className="px-6 py-4 text-sm text-gray-600">
                  {co.description.substring(0, 60)}...
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-green-600">
                  ${co.amountApproved.toLocaleString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 py-1 text-xs rounded-full ${
                    co.status === 'Approved' ? 'bg-green-100 text-green-800' :
                    co.status === 'Rejected' ? 'bg-red-100 text-red-800' :
                    co.status === 'Submitted' || co.status === 'Under Review' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {co.status}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                  {(co.status === 'Submitted' || co.status === 'Under Review') && (
                    <>
                      <button
                        onClick={() => handleStatusChange(co.id, 'Approved')}
                        className="text-green-600 hover:text-green-800 mr-3"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => handleStatusChange(co.id, 'Rejected')}
                        className="text-red-600 hover:text-red-800"
                      >
                        Reject
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

**âœ… Complete!** You now have a working Change Order system with auto-numbering and approval workflow!

---

## Summary

**What you built:**
- CO creation form with live cost calculation
- Auto-generated CO numbers via Cloud Function
- Approval workflow with status tracking  
- Automatic contract value updates
- CO list with filtering and quick actions

**Next steps:**
- Add file attachments
- Email notifications on status changes
- Mobile-friendly CO request form
- CO reporting and analytics

This eliminates paper COs and manual contract value tracking! ðŸŽ‰
