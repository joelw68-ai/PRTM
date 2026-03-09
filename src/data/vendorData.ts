// Vendor Management Data Types and Initial Data

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
  'Tires',
  'Electronics',
  'Tools',
  'Apparel',
  'Other'
];
