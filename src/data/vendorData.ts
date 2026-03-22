// Vendor Management Data Types and Initial Data

// ============ VENDOR NOTES LOG ============
export interface VendorNote {
  id: string;
  text: string;
  author: string;
  timestamp: string; // ISO 8601 string
}

/**
 * Parse the vendor.notes field into a VendorNote[] array.
 * Handles:
 *   - JSON array of VendorNote objects (new format)
 *   - Plain text string (legacy format — converted to a single note entry)
 *   - Empty/null/undefined (returns empty array)
 */
export const parseVendorNotes = (notesField: string | null | undefined): VendorNote[] => {
  if (!notesField || notesField.trim() === '') return [];
  try {
    const parsed = JSON.parse(notesField);
    if (Array.isArray(parsed)) {
      // Validate each entry has the required fields
      return parsed.filter(
        (n: any) => n && typeof n.id === 'string' && typeof n.text === 'string'
      );
    }
    // If it parsed but isn't an array, treat as legacy text
    return [{
      id: `legacy-${Date.now()}`,
      text: notesField,
      author: 'System (migrated)',
      timestamp: new Date().toISOString()
    }];
  } catch {
    // Not valid JSON — treat as legacy plain text
    return [{
      id: `legacy-${Date.now()}`,
      text: notesField,
      author: 'System (migrated)',
      timestamp: new Date().toISOString()
    }];
  }
};

/**
 * Serialize a VendorNote[] array back to a JSON string for storage.
 */
export const serializeVendorNotes = (notes: VendorNote[]): string => {
  if (!notes || notes.length === 0) return '';
  return JSON.stringify(notes);
};


export interface Vendor {
  id: string;
  name: string;
  code: string;
  contactName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  website: string;
  category: string;
  paymentTerms: string;
  discountPercent: number;
  leadTimeDays: number;
  minimumOrder: number;
  shippingMethod: string;
  notes: string;
  rating: number;
  isActive: boolean;
  createdDate: string;
}

export interface PurchaseOrder {
  id: string;
  vendorId: string;
  vendorName: string;
  status: 'Draft' | 'Submitted' | 'Confirmed' | 'Shipped' | 'Received' | 'Cancelled';
  createdDate: string;
  submittedDate?: string;
  expectedDelivery?: string;
  receivedDate?: string;
  items: PurchaseOrderItem[];
  subtotal: number;
  discount: number;
  shipping: number;
  tax: number;
  total: number;
  notes: string;
  createdBy: string;
}

export interface PurchaseOrderItem {
  partId?: string;
  partNumber: string;
  description: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
}

export interface VendorPerformance {
  vendorId: string;
  totalOrders: number;
  onTimeDeliveries: number;
  lateDeliveries: number;
  qualityIssues: number;
  totalSpent: number;
  averageLeadTime: number;
  lastOrderDate: string;
}

export const vendors: Vendor[] = [];

export const purchaseOrders: PurchaseOrder[] = [];

export const vendorPerformance: VendorPerformance[] = [];

// Helper functions
export const getVendorById = (id: string) => vendors.find(v => v.id === id);

export const getVendorsByCategory = (category: string) => 
  vendors.filter(v => v.category === category && v.isActive);

export const getVendorPerformance = (vendorId: string) => 
  vendorPerformance.find(p => p.vendorId === vendorId);

export const getPurchaseOrdersByVendor = (vendorId: string) =>
  purchaseOrders.filter(po => po.vendorId === vendorId);

export const getPurchaseOrdersByStatus = (status: PurchaseOrder['status']) =>
  purchaseOrders.filter(po => po.status === status);


export const getActiveVendors = () => vendors.filter(v => v.isActive);

export const getVendorCategories = () => [...new Set(vendors.map(v => v.category))];

// Fixed vendor categories list for dropdown
export const VENDOR_CATEGORIES = [
  'Parts Supplier',
  'Engine Builder',
  'Machine Shop',
  'Safety Equipment',
  'Fuel Supplier',
  'Wheels and Tires',
  'Electronics',
  'Tools',
  'Apparel',
  'Oil Supplier',
  'Engine Parts',
  'Drivetrain Parts',
  'Transmission Parts',
  'Torque Converter Parts',
  'Body Parts',
  'Power Adder Parts',
  'Chassis Parts',
  'Suspension Parts',
  'Other'
];

