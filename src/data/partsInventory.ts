// Pro Mod Drag Racing Parts Inventory

export interface PartInventoryItem {
  id: string;
  partNumber: string;
  description: string;
  category: string;
  subcategory: string;
  onHand: number;
  minQuantity: number;
  maxQuantity: number;
  vendor: string;
  vendorPartNumber: string;
  unitCost: number;
  totalValue: number;
  lastOrdered: string;
  lastUsed: string;
  location: string;
  notes: string;
  status: 'In Stock' | 'Low Stock' | 'Out of Stock' | 'On Order';
  reorderStatus: 'OK' | 'Reorder' | 'Critical' | 'On Order';
  relatedDrivetrainComponentId?: string;
  // Multi-car support
  car_id?: string;
  // Part name alias (used by some components)
  name?: string;
}



export const partsInventory: PartInventoryItem[] = [];

// Helper functions
export const getPartsByCategory = (category: string) => 
  partsInventory.filter(p => p.category === category);

export const getLowStockParts = () => 
  partsInventory.filter(p => p.onHand <= p.minQuantity);

export const getOutOfStockParts = () => 
  partsInventory.filter(p => p.onHand === 0);

export const getPartsOnOrder = () => 
  partsInventory.filter(p => p.reorderStatus === 'On Order');

export const getTotalInventoryValue = () => 
  partsInventory.reduce((sum, p) => sum + p.totalValue, 0);

export const getPartCategories = () => 
  [...new Set(partsInventory.map(p => p.category))];

export const searchParts = (query: string) => 
  partsInventory.filter(p => 
    p.partNumber.toLowerCase().includes(query.toLowerCase()) ||
    p.description.toLowerCase().includes(query.toLowerCase()) ||
    p.vendor.toLowerCase().includes(query.toLowerCase())
  );
