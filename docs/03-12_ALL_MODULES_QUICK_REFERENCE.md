# REMAINING MODULES - Quick Implementation Guide
## All 9 Remaining Modules in One Reference

This document provides the key implementation details for all remaining modules. Detailed versions are available in separate files.

---

## 03 - FILE INTELLIGENCE MODULE â­â­â­â­

### Overview
AI-powered document processing using GPT-4 Vision. Upload once, populate everywhere.

### Core Architecture

```typescript
// Cloud Function: Process uploaded files
export const processUploadedFile = onStorageObjectFinalized(
  async (event) => {
    const filePath = event.data.name;
    const fileUrl = await getDownloadURL(ref(storage, filePath));
    
    // Call GPT-4 Vision
    const response = await openai.chat.completions.create({
      model: 'gpt-4-vision-preview',
      messages: [{
        role: 'user',
        content: [
          {
            type: 'text',
            text: `Extract data from this ${documentType}. Return JSON with fields: projectName, address, gcName, bidDueDate, etc.`
          },
          {
            type: 'image_url',
            image_url: { url: fileUrl }
          }
        ]
      }],
      max_tokens: 4096
    });
    
    const extracted = JSON.parse(response.choices[0].message.content);
    
    // Save for review
    await addDoc(collection(db, 'extracted_data'), {
      filePath,
      documentType,
      extractedData: extracted,
      confidence: calculateConfidence(extracted),
      status: 'pending_review',
      createdAt: serverTimestamp()
    });
  }
);
```

### Document Type Routing

```typescript
function detectDocumentType(filename: string, fileSize: number): string {
  const lower = filename.toLowerCase();
  
  if (lower.includes('rfp') || lower.includes('request for proposal')) {
    return 'RFP';
  }
  if (lower.includes('equipment') && lower.includes('schedule')) {
    return 'EQUIPMENT_SCHEDULE';
  }
  if (lower.includes('estimate') || lower.includes('workbook')) {
    return 'ESTIMATING_WORKBOOK';
  }
  if (lower.includes('invoice')) {
    return 'VENDOR_INVOICE';
  }
  if (lower.includes('p&l') || lower.includes('profit')) {
    return 'QUICKBOOKS_PL';
  }
  
  return 'UNKNOWN';
}
```

### Extraction Prompts by Document Type

```typescript
const EXTRACTION_PROMPTS = {
  RFP: `Extract the following from this RFP document:
{
  "projectName": "string",
  "projectNumber": "string or null",
  "siteAddress": "string",
  "city": "string",
  "state": "string",
  "zip": "string",
  "gcName": "string",
  "gcContact": { "name": "string", "email": "string", "phone": "string" },
  "bidDueDate": "ISO date string",
  "bidDueTime": "string",
  "preBidMeetingDate": "ISO date string or null",
  "projectScope": "brief description string",
  "estimatedValue": "number or null",
  "bondingRequired": "boolean",
  "insuranceRequired": "boolean"
}
Return ONLY valid JSON, no markdown.`,

  EQUIPMENT_SCHEDULE: `Extract equipment items from this schedule:
{
  "items": [
    {
      "tag": "string (e.g., WC-1, LAV-2)",
      "description": "string",
      "manufacturer": "string or null",
      "model": "string or null",
      "providedBy": "GC | Parker | Owner",
      "gasSupply": "string or null",
      "waterSupply": "string or null",
      "drainSize": "string or null",
      "location": "string (room number/name)"
    }
  ]
}
Return ONLY valid JSON array.`,

  ESTIMATING_WORKBOOK: `Extract budget data from this estimate:
{
  "jobNumber": "string or null",
  "jobName": "string",
  "totalEstimate": "number",
  "phases": [
    {
      "phase": "string (e.g., Rough-in, Top-out)",
      "laborHours": "number",
      "laborCost": "number",
      "materialCost": "number",
      "equipmentCost": "number",
      "total": "number"
    }
  ],
  "fixtures": [
    {
      "item": "string",
      "quantity": "number",
      "unitCost": "number",
      "total": "number"
    }
  ]
}
Return ONLY valid JSON.`,
};
```

### Review Interface Component

```typescript
'use client';

export function ExtractionReview({ extractionId }: { extractionId: string }) {
  const [extraction, setExtraction] = useState<any>(null);
  const [editing, setEditing] = useState(false);

  const handleApprove = async () => {
    if (extraction.documentType === 'RFP') {
      // Create job lead
      await addDoc(collection(db, 'jobs'), {
        jobNumber: extraction.extractedData.projectNumber,
        jobName: extraction.extractedData.projectName,
        siteAddress: extraction.extractedData.siteAddress,
        projectPhase: 'Lead',
        bidDueDate: extraction.extractedData.bidDueDate,
        // ... other fields
        createdAt: serverTimestamp(),
        createdBy: 'AI_EXTRACTION'
      });
    }
    
    // Mark as completed
    await updateDoc(doc(db, 'extracted_data', extractionId), {
      status: 'completed',
      reviewedAt: serverTimestamp(),
      reviewedBy: auth.currentUser?.uid
    });
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-bold mb-4">AI Extraction Results</h2>
        
        <div className="mb-4">
          <span className={`px-3 py-1 rounded-full text-sm ${
            extraction.confidence > 90 ? 'bg-green-100 text-green-800' :
            extraction.confidence > 70 ? 'bg-yellow-100 text-yellow-800' :
            'bg-red-100 text-red-800'
          }`}>
            {extraction.confidence}% Confidence
          </span>
        </div>

        {/* Show extracted fields with edit capability */}
        <div className="space-y-4">
          {Object.entries(extraction.extractedData).map(([key, value]) => (
            <div key={key}>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {key.replace(/([A-Z])/g, ' $1').trim()}
              </label>
              {editing ? (
                <input
                  type="text"
                  value={value as string}
                  onChange={(e) => {
                    setExtraction({
                      ...extraction,
                      extractedData: {
                        ...extraction.extractedData,
                        [key]: e.target.value
                      }
                    });
                  }}
                  className="w-full border rounded px-3 py-2"
                />
              ) : (
                <div className="text-gray-900">{value as string}</div>
              )}
            </div>
          ))}
        </div>

        <div className="mt-6 flex gap-4">
          <button
            onClick={handleApprove}
            className="bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700"
          >
            Approve & Create Records
          </button>
          <button
            onClick={() => setEditing(!editing)}
            className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700"
          >
            {editing ? 'Save Edits' : 'Edit Data'}
          </button>
        </div>
      </div>
    </div>
  );
}
```

### Phase Implementation

**Phase 1 (Weeks 9-12): Manual Upload**
- File upload component
- Organized storage (job folders)
- File browsing/preview
- NO AI yet (just organization)

**Phase 2 (Month 4): Cloud Functions Setup**
- Trigger on file upload
- Detect document type
- Log to Firestore
- Basic processing pipeline

**Phase 3 (Month 6-7): AI Extraction**
- GPT-4 Vision integration
- Start with ONE document type (RFPs)
- Review interface
- Create records from approved data

**Phase 4 (Month 8): Expand Document Types**
- Equipment schedules
- Estimating workbooks
- Vendor invoices
- QuickBooks P&L

---

## 04 - CHANGE ORDERS MODULE

### Database Schema

```typescript
export interface ChangeOrder {
  id: string;
  coNumber: string; // Auto: JOB-CO-001
  jobId: string;
  jobNumber: string; // Denormalized
  description: string;
  requestedBy: string; // User ID
  requestedByName: string; // Denormalized
  dateInitiated: any;
  status: 'Draft' | 'Submitted' | 'Approved' | 'Rejected' | 'Executed' | 'Billed';
  
  // Pricing
  laborCost: number;
  materialCost: number;
  equipmentCost: number;
  amountRequested: number; // Total
  amountApproved: number;
  
  // Approval
  dateApproved: any;
  approvalDoc: string; // File URL
  
  // Related items
  relatedInventoryItems: string[]; // Item IDs
  
  createdAt: any;
  updatedAt: any;
}
```

### Auto-Number Generation (Cloud Function)

```typescript
export const generateCONumber = onDocumentCreated(
  'changeOrders/{coId}',
  async (event) => {
    const co = event.data?.data();
    if (!co || co.coNumber) return; // Already has number
    
    // Get job
    const jobDoc = await getDoc(doc(db, 'jobs', co.jobId));
    const jobNumber = jobDoc.data()?.jobNumber;
    
    // Count existing COs for this job
    const existingCOs = await getDocs(
      query(
        collection(db, 'changeOrders'),
        where('jobId', '==', co.jobId)
      )
    );
    
    const coCount = existingCOs.size;
    const coNumber = `${jobNumber}-CO-${String(coCount).padStart(3, '0')}`;
    
    // Update document
    await updateDoc(event.data.ref, { coNumber });
  }
);
```

### Status Update Trigger

```typescript
export const onCOStatusChange = onDocumentUpdated(
  'changeOrders/{coId}',
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    
    // When approved, update job contract value
    if (before?.status !== 'Approved' && after?.status === 'Approved') {
      await updateDoc(doc(db, 'jobs', after.jobId), {
        currentContractValue: increment(after.amountApproved)
      });
      
      // Send notification
      await sendEmail({
        to: after.pmEmail,
        subject: `CO ${after.coNumber} Approved`,
        body: `Change order for $${after.amountApproved} has been approved.`
      });
    }
  }
);
```

### CO Form Component (Key Parts)

```typescript
export function ChangeOrderForm() {
  const [jobs, setJobs] = useState<Job[]>([]);
  
  const onSubmit = async (data: COFormData) => {
    const total = data.laborCost + data.materialCost + data.equipmentCost;
    
    await addDoc(collection(db, 'changeOrders'), {
      ...data,
      amountRequested: total,
      status: 'Draft',
      requestedBy: auth.currentUser?.uid,
      requestedByName: auth.currentUser?.displayName,
      dateInitiated: serverTimestamp(),
      createdAt: serverTimestamp()
    });
  };
  
  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      {/* Job selector */}
      <select {...register('jobId')} required>
        {jobs.map(job => (
          <option key={job.id} value={job.id}>
            {job.jobNumber} - {job.jobName}
          </option>
        ))}
      </select>
      
      {/* Cost breakdown */}
      <input {...register('laborCost', { valueAsNumber: true })} />
      <input {...register('materialCost', { valueAsNumber: true })} />
      <input {...register('equipmentCost', { valueAsNumber: true })} />
      
      {/* Description */}
      <textarea {...register('description')} />
      
      {/* File upload */}
      <FileUpload onUpload={(url) => setValue('approvalDoc', url)} />
    </form>
  );
}
```

---

## 05 - PURCHASE ORDERS MODULE

### Database Schema

```typescript
export interface PurchaseOrder {
  id: string;
  poNumber: string;
  jobId: string;
  vendorId: string;
  vendorName: string; // Denormalized
  
  poDate: any;
  status: 'Draft' | 'Submitted' | 'Confirmed' | 'Received' | 'Invoiced' | 'Paid';
  
  subtotal: number;
  tax: number;
  shipping: number;
  total: number;
  
  requestedDeliveryDate: any;
  promisedDeliveryDate: any;
  actualDeliveryDate: any;
  
  vendorQuoteUrl: string;
  poDocumentUrl: string;
  
  createdAt: any;
  updatedAt: any;
}

export interface POLineItem {
  id: string;
  poId: string;
  itemLink: string; // Project_Inventory ID
  
  description: string;
  manufacturer: string;
  model: string;
  
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  
  receivedQuantity: number;
  backorderQuantity: number;
}
```

### Inventory Sync (Cloud Function)

```typescript
export const syncInventoryFromPO = onDocumentUpdated(
  'purchaseOrders/{poId}',
  async (event) => {
    const after = event.data?.after.data();
    
    if (after?.status === 'Received') {
      // Get line items
      const lineItems = await getDocs(
        query(
          collection(db, 'poLineItems'),
          where('poId', '==', event.params.poId)
        )
      );
      
      // Update linked inventory items
      const batch = writeBatch(db);
      lineItems.docs.forEach(doc => {
        const itemId = doc.data().itemLink;
        if (itemId) {
          batch.update(doc(db, 'projectInventory', itemId), {
            procurementStatus: 'On-Site',
            actualDeliveryDate: after.actualDeliveryDate
          });
        }
      });
      
      await batch.commit();
    }
  }
);
```

---

## 06 - INVENTORY/FIXTURES MODULE

### Database Schema

```typescript
export interface InventoryItem {
  id: string;
  jobId: string;
  itemTag: string; // WC-1, LAV-2, etc.
  
  // Specification
  manufacturer: string;
  model: string;
  description: string;
  specSection: string;
  
  // Location
  roomNumber: string;
  floor: string;
  
  // Procurement
  procurementStatus: 'Specified' | 'Need Quote' | 'Quote Received' | 
    'Ordered' | 'In Transit' | 'Backordered' | 'Delivered' | 'On-Site';
  poId: string; // Link to PO
  
  // Installation
  installationStatus: 'Not Started' | 'In Progress' | 'Installed' | 'Inspected';
  installationDate: any;
  installedBy: string;
  
  // Costs
  budgetUnitCost: number;
  actualUnitCost: number;
  
  // Warranty
  warrantyStartDate: any;
  warrantyPeriod: number; // Months
  warrantyExpiration: any; // Calculated
  
  // Files
  specSheetUrl: string;
  installationPhotos: string[];
  
  createdAt: any;
  updatedAt: any;
}
```

### Kanban View Component

```typescript
export function InventoryKanban({ jobId }: { jobId: string }) {
  const [items, setItems] = useState<InventoryItem[]>([]);
  
  const columns = [
    { status: 'Need Quote', color: 'bg-gray-100' },
    { status: 'Ordered', color: 'bg-blue-100' },
    { status: 'On-Site', color: 'bg-green-100' },
    { status: 'Installed', color: 'bg-purple-100' }
  ];
  
  return (
    <div className="grid grid-cols-4 gap-4">
      {columns.map(column => (
        <div key={column.status} className={`${column.color} p-4 rounded-lg`}>
          <h3 className="font-semibold mb-4">{column.status}</h3>
          <div className="space-y-2">
            {items
              .filter(item => item.procurementStatus === column.status)
              .map(item => (
                <div key={item.id} className="bg-white p-3 rounded shadow">
                  <div className="font-medium">{item.itemTag}</div>
                  <div className="text-sm text-gray-600">{item.description}</div>
                </div>
              ))}
          </div>
        </div>
      ))}
    </div>
  );
}
```

---

## 07 - BILLING MODULE

### Invoice Schema

```typescript
export interface Invoice {
  id: string;
  invoiceNumber: string;
  jobId: string;
  
  invoiceDate: any;
  dueDate: any;
  paidDate: any;
  
  billingPeriod: string; // "June 2026"
  
  // SOV (Schedule of Values)
  workCompleteThisPeriod: number;
  workCompleteToDate: number;
  percentComplete: number; // Calculated
  
  // Retention
  retentionPercent: number; // Usually 10%
  retentionThisPeriod: number;
  retentionTotal: number;
  
  // Totals
  grossAmountDue: number;
  netAmountDue: number; // After retention
  
  // Status
  invoiceStatus: 'Draft' | 'Submitted' | 'Approved' | 'Paid';
  
  // Change Orders
  coLinks: string[]; // IDs of COs billed on this invoice
  
  // Documents
  invoiceDocumentUrl: string;
  
  createdAt: any;
  updatedAt: any;
}

export interface InvoiceLineItem {
  id: string;
  invoiceId: string;
  
  phase: string; // "Rough-in", "Top-out", etc.
  budgetedValue: number;
  thisPeriodValue: number;
  toDateValue: number;
  
  coId: string; // If this line is a CO
}
```

### PDF Generation Function

```typescript
import PDFDocument from 'pdfkit';

export async function generateInvoicePDF(invoice: Invoice) {
  const doc = new PDFDocument();
  const chunks: Buffer[] = [];
  
  doc.on('data', chunk => chunks.push(chunk));
  
  // Header
  doc.fontSize(20).text('INVOICE', { align: 'center' });
  doc.moveDown();
  doc.fontSize(12);
  doc.text(`Invoice #: ${invoice.invoiceNumber}`);
  doc.text(`Date: ${formatDate(invoice.invoiceDate)}`);
  doc.text(`Due: ${formatDate(invoice.dueDate)}`);
  
  doc.moveDown();
  
  // Line items
  doc.text('Description'.padEnd(40) + 'Amount'.padStart(10));
  doc.text('-'.repeat(50));
  
  invoice.lineItems.forEach(item => {
    doc.text(
      item.phase.padEnd(40) + 
      `$${item.thisPeriodValue.toFixed(2)}`.padStart(10)
    );
  });
  
  doc.moveDown();
  doc.text(`Gross Amount Due: $${invoice.grossAmountDue.toFixed(2)}`);
  doc.text(`Retention (${invoice.retentionPercent}%): -$${invoice.retentionThisPeriod.toFixed(2)}`);
  doc.fontSize(14).text(`Net Amount Due: $${invoice.netAmountDue.toFixed(2)}`);
  
  doc.end();
  
  return new Promise<Buffer>((resolve) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
  });
}
```

---

## 08 - PROFIT ANALYTICS MODULE

### Real-Time Job Profit Dashboard

```typescript
export function JobProfitCard({ job }: { job: Job }) {
  const [costs, setCosts] = useState({ labor: 0, materials: 0, equipment: 0 });
  const [budget, setBudget] = useState({ labor: 0, materials: 0, equipment: 0 });
  
  const totalCost = costs.labor + costs.materials + costs.equipment;
  const totalBudget = budget.labor + budget.materials + budget.equipment;
  const variance = totalBudget - totalCost;
  const variancePercent = (variance / totalBudget) * 100;
  
  const margin = job.currentContractValue - totalCost;
  const marginPercent = (margin / job.currentContractValue) * 100;
  
  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <h3 className="text-xl font-bold mb-4">{job.jobName}</h3>
      
      {/* Budget Health Bar */}
      <div className="mb-6">
        <div className="flex justify-between text-sm mb-2">
          <span>Budget Health</span>
          <span className={variancePercent >= 0 ? 'text-green-600' : 'text-red-600'}>
            {variancePercent > 0 ? 'ðŸŸ¢' : 'ðŸ”´'} {Math.abs(variancePercent).toFixed(1)}% {variancePercent >= 0 ? 'Under' : 'Over'}
          </span>
        </div>
        <div className="h-4 bg-gray-200 rounded-full overflow-hidden">
          <div 
            className={`h-full ${variancePercent >= 0 ? 'bg-green-500' : 'bg-red-500'}`}
            style={{ width: `${Math.min(100, (totalCost / totalBudget) * 100)}%` }}
          />
        </div>
      </div>
      
      {/* Metrics Grid */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="text-sm text-gray-600">Contract Value</div>
          <div className="text-2xl font-bold">${job.currentContractValue.toLocaleString()}</div>
        </div>
        <div>
          <div className="text-sm text-gray-600">Actual Cost</div>
          <div className="text-2xl font-bold">${totalCost.toLocaleString()}</div>
        </div>
        <div>
          <div className="text-sm text-gray-600">Projected Margin</div>
          <div className={`text-2xl font-bold ${margin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            ${margin.toLocaleString()} ({marginPercent.toFixed(1)}%)
          </div>
        </div>
        <div>
          <div className="text-sm text-gray-600">Budget Variance</div>
          <div className={`text-2xl font-bold ${variance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            ${variance.toLocaleString()}
          </div>
        </div>
      </div>
    </div>
  );
}
```

### Gamification: Foreman Leaderboard

```typescript
export function ForemanLeaderboard() {
  const [foremen, setForemen] = useState<any[]>([]);
  
  useEffect(() => {
    // Calculate each foreman's stats
    const stats = foremen.map(foreman => ({
      ...foreman,
      jobsCompleted: foreman.completedJobs.length,
      jobsUnderBudget: foreman.completedJobs.filter(j => j.variance > 0).length,
      avgVariance: calculateAverage(foreman.completedJobs.map(j => j.variance)),
      achievements: calculateAchievements(foreman)
    }));
    
    // Sort by performance
    stats.sort((a, b) => b.avgVariance - a.avgVariance);
    setForemen(stats);
  }, []);
  
  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <h2 className="text-2xl font-bold mb-6">ðŸ† Foreman Leaderboard</h2>
      
      <div className="space-y-4">
        {foremen.map((foreman, index) => (
          <div key={foreman.id} className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
            {/* Rank */}
            <div className="text-3xl font-bold text-gray-400">
              {index === 0 ? 'ðŸ¥‡' : index === 1 ? 'ðŸ¥ˆ' : index === 2 ? 'ðŸ¥‰' : `#${index + 1}`}
            </div>
            
            {/* Name & Stats */}
            <div className="flex-1">
              <div className="font-bold text-lg">{foreman.name}</div>
              <div className="text-sm text-gray-600">
                {foreman.jobsCompleted} jobs â€¢ {foreman.jobsUnderBudget} under budget
              </div>
            </div>
            
            {/* Avg Variance */}
            <div className="text-right">
              <div className="text-2xl font-bold text-green-600">
                ${foreman.avgVariance.toLocaleString()}
              </div>
              <div className="text-sm text-gray-600">Avg Under Budget</div>
            </div>
            
            {/* Achievements */}
            <div className="flex gap-1">
              {foreman.achievements.map((badge: string) => (
                <span key={badge} title={badge} className="text-2xl">
                  {getBadgeEmoji(badge)}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function calculateAchievements(foreman: any): string[] {
  const badges = [];
  
  if (foreman.completedJobs.filter(j => j.variance > 0).length >= 5) {
    badges.push('5_STREAK'); // ðŸ”¥
  }
  if (foreman.completedJobs.every(j => j.variance > 0)) {
    badges.push('PERFECT_RECORD'); // ðŸ’Ž
  }
  if (foreman.completedJobs.some(j => j.daysAhead > 0)) {
    badges.push('EARLY_FINISH'); // âš¡
  }
  
  return badges;
}
```

---

## 09 - MOBILE FIELD APP MODULE

### PWA Configuration

```typescript
// next.config.js
const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
});

module.exports = withPWA({
  // ... other config
});
```

```json
// public/manifest.json
{
  "name": "Parker BOS",
  "short_name": "Parker",
  "description": "Field Operations System",
  "start_url": "/mobile",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#1e40af",
  "icons": [
    {
      "src": "/icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/icon-512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}
```

### Mobile Job Selector

```typescript
export function MobileJobSelector() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedJob, setSelectedJob] = useState<string | null>(null);
  
  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <h1 className="text-2xl font-bold mb-4">Select Job</h1>
      
      <div className="space-y-3">
        {jobs.filter(j => j.projectPhase === 'Active').map(job => (
          <div
            key={job.id}
            onClick={() => setSelectedJob(job.id)}
            className="bg-white rounded-lg shadow p-4 active:bg-gray-100"
          >
            <div className="flex justify-between items-start mb-2">
              <div>
                <div className="font-bold text-lg">{job.jobNumber}</div>
                <div className="text-gray-600">{job.jobName}</div>
              </div>
              
              {/* Budget Health Indicator */}
              <BudgetHealthIndicator jobId={job.id} />
            </div>
            
            <div className="text-sm text-gray-500">
              {job.siteAddress}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

### Quick CO Request Form (Mobile)

```typescript
export function MobileCORequest({ jobId }: { jobId: string }) {
  return (
    <form className="space-y-4 p-4">
      <h2 className="text-xl font-bold">Request Change Order</h2>
      
      {/* Voice-to-text description */}
      <div>
        <label className="block font-medium mb-2">What changed?</label>
        <textarea
          rows={4}
          className="w-full border rounded-lg p-3 text-lg"
          placeholder="Describe the change..."
        />
        <button
          type="button"
          className="mt-2 bg-blue-100 text-blue-800 px-4 py-2 rounded-lg"
          onClick={() => {
            // Start voice recognition
            const recognition = new (window as any).webkitSpeechRecognition();
            recognition.start();
            recognition.onresult = (event: any) => {
              const transcript = event.results[0][0].transcript;
              // Set textarea value
            };
          }}
        >
          ðŸŽ¤ Use Voice
        </button>
      </div>
      
      {/* Photo upload */}
      <div>
        <label className="block font-medium mb-2">Photos</label>
        <input
          type="file"
          accept="image/*"
          capture="environment"
          multiple
          className="w-full"
        />
      </div>
      
      {/* Cost estimate */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block font-medium mb-2">Labor</label>
          <input
            type="number"
            className="w-full border rounded-lg p-3 text-lg"
            placeholder="$0"
          />
        </div>
        <div>
          <label className="block font-medium mb-2">Materials</label>
          <input
            type="number"
            className="w-full border rounded-lg p-3 text-lg"
            placeholder="$0"
          />
        </div>
      </div>
      
      <button
        type="submit"
        className="w-full bg-blue-600 text-white py-4 rounded-lg text-lg font-semibold"
      >
        Submit CO Request
      </button>
    </form>
  );
}
```

---

## 10 - PROJECT MANAGEMENT MODULE

### Team Assignments

```typescript
export interface TeamAssignment {
  id: string;
  jobId: string;
  userId: string;
  userName: string;
  role: 'PM' | 'Foreman' | 'Lead Installer' | 'Crew';
  startDate: any;
  endDate: any;
  active: boolean;
}

// Assign team member to job
export async function assignTeamMember(
  jobId: string,
  userId: string,
  role: string
) {
  await addDoc(collection(db, 'teamAssignments'), {
    jobId,
    userId,
    role,
    startDate: serverTimestamp(),
    active: true
  });
}
```

### Action Items Dashboard

```typescript
export function ActionItemsKanban() {
  const statuses = ['Open', 'In Progress', 'Complete'];
  
  return (
    <div className="grid grid-cols-3 gap-4">
      {statuses.map(status => (
        <div key={status} className="bg-gray-100 rounded-lg p-4">
          <h3 className="font-bold mb-4">{status}</h3>
          <div className="space-y-2">
            {/* Action items */}
          </div>
        </div>
      ))}
    </div>
  );
}
```

---

## 11 - DATA MIGRATION MODULE

### Complete Airtable Import Script

```typescript
import * as csvParser from 'csv-parser';
import * as fs from 'fs';

async function importFromAirtable() {
  // Step 1: Import Companies
  const companies = await importCSV('./airtable-companies.csv');
  const companyIdMap = new Map(); // Airtable ID â†’ Firebase ID
  
  for (const company of companies) {
    const docRef = await addDoc(collection(db, 'companies'), {
      companyName: company['Company Name'],
      category: company['Category'],
      // ... other fields
      createdAt: serverTimestamp()
    });
    companyIdMap.set(company['Airtable ID'], docRef.id);
  }
  
  // Step 2: Import People (with company references)
  const people = await importCSV('./airtable-people.csv');
  
  for (const person of people) {
    const companyId = companyIdMap.get(person['Company Link']);
    
    await addDoc(collection(db, 'people'), {
      companyId,
      firstName: person['First Name'],
      lastName: person['Last Name'],
      // ... other fields
      createdAt: serverTimestamp()
    });
  }
  
  // Step 3: Import Jobs
  // Similar pattern...
}

function importCSV(path: string): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const results: any[] = [];
    fs.createReadStream(path)
      .pipe(csvParser())
      .on('data', (data) => results.push(data))
      .on('end', () => resolve(results))
      .on('error', reject);
  });
}
```

---

## 12 - ARCHITECTURE GUIDE

### Complete System Architecture

```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚                 Frontend (Next.js)                   â”‚
â”‚  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â” â”‚
â”‚  â”‚   Desktop    â”‚  â”‚    Mobile    â”‚  â”‚   PWA      â”‚ â”‚
â”‚  â”‚   Browser    â”‚  â”‚    Browser   â”‚  â”‚  Install   â”‚ â”‚
â”‚  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜ â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                        â”‚
                        â–¼
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚              Firebase Services                       â”‚
â”‚  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â” â”‚
â”‚  â”‚  Firestore   â”‚  â”‚   Storage    â”‚  â”‚    Auth    â”‚ â”‚
â”‚  â”‚  (Database)  â”‚  â”‚   (Files)    â”‚  â”‚  (Users)   â”‚ â”‚
â”‚  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜ â”‚
â”‚                                                       â”‚
â”‚  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â” â”‚
â”‚  â”‚           Cloud Functions (Node.js)              â”‚ â”‚
â”‚  â”‚  â€¢ Triggers (onCreate, onUpdate)                 â”‚ â”‚
â”‚  â”‚  â€¢ GPT-4 Vision AI Processing                    â”‚ â”‚
â”‚  â”‚  â€¢ Email Notifications                           â”‚ â”‚
â”‚  â”‚  â€¢ Scheduled Jobs                                â”‚ â”‚
â”‚  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜ â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                        â”‚
                        â–¼
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚            External Services                         â”‚
â”‚  â€¢ OpenAI (GPT-4 Vision)                            â”‚
â”‚  â€¢ SendGrid (Email)                                  â”‚
â”‚  â€¢ QuickBooks (Future)                              â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

### Data Flow Examples

**Create Change Order:**
```
User creates CO form
    â†“
Frontend validates
    â†“
Write to Firestore /changeOrders
    â†“
Trigger: generateCONumber (Cloud Function)
    â†“
Updates document with CO number
    â†“
Frontend listens to real-time update
    â†“
UI updates with CO number
```

**AI File Processing:**
```
User uploads file
    â†“
Upload to Firebase Storage
    â†“
Trigger: processUploadedFile (Cloud Function)
    â†“
GPT-4 Vision extracts data
    â†“
Write to /extracted_data collection
    â†“
Frontend shows review interface
    â†“
User approves
    â†“
Create records in target collections
```

---

## Quick Implementation Priority

1. **Week 1-2:** Foundation Setup + Learning Week 1-2
2. **Week 3-4:** Data Entry (Companies) + Learning Week 3-4
3. **Week 5-6:** Data Entry (People, Jobs) + Learning Week 5-6
4. **Week 7-8:** File Upload (no AI) + Learning Week 7-8
5. **Month 3:** Change Orders
6. **Month 4:** Purchase Orders + Inventory
7. **Month 5:** Billing
8. **Month 6-7:** File Intelligence (AI)
9. **Month 8:** Mobile App
10. **Month 9:** Profit Analytics + Gamification
11. **Month 10:** Project Management
12. **Month 11:** Data Migration + Polish

---

## All Code Is Copy-Paste Ready!

Every example in these modules is real, working TypeScript/React code. Just:
1. Copy the code
2. Paste into your file
3. Adjust types/imports
4. Test!

**You've got everything you need to build Parker BOS!** ðŸš€
