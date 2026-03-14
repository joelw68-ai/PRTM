import React, { useState, useMemo, useEffect, useRef } from 'react';
import { getLocalDateString } from '@/lib/utils';
import { useApp } from '@/contexts/AppContext';
import { useCar } from '@/contexts/CarContext';
import CarDropdown from '@/components/race/CarDropdown';
import { MaintenanceItem } from '@/data/proModData';
import { toast } from 'sonner';
import {
  Wrench,
  Plus,
  Edit2,
  Trash2,
  X,
  Copy,
  Download,
  Upload,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Search,
  Package,
  BookOpen,
  FileText,
  Layers,
  Check,
  AlertTriangle,
  Clock,
  Shield,
  Zap,
  Settings,
  RotateCcw,
  FolderOpen,
  Star,
  StarOff,
  Play,
  Eye,
  EyeOff,
} from 'lucide-react';

// ============ TYPES ============

interface TemplatePartItem {
  partNumber: string;
  description: string;
  quantity: number;
}

interface TemplateMaintenanceItem {
  id: string;
  component: string;
  category: string;
  passInterval: number;
  priority: 'Low' | 'Medium' | 'High' | 'Critical';
  notes: string;
  typicalParts: TemplatePartItem[];
}

interface MaintenanceTemplate {
  id: string;
  name: string;
  description: string;
  type: 'Pre-Race' | 'Post-Race' | 'Seasonal' | 'Weekly' | 'Monthly' | 'Custom';
  items: TemplateMaintenanceItem[];
  createdAt: string;
  updatedAt: string;
  isBuiltIn: boolean;
  isFavorite: boolean;
  tags: string[];
  version: number;
}

// ============ LOCALSTORAGE ============

const TEMPLATES_KEY = 'raceLogbook_maintenanceTemplates';
const TEMPLATES_INITIALIZED_KEY = 'raceLogbook_maintenanceTemplatesInitialized';

function loadTemplates(): MaintenanceTemplate[] {
  try {
    const raw = localStorage.getItem(TEMPLATES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveTemplates(templates: MaintenanceTemplate[]) {
  try {
    localStorage.setItem(TEMPLATES_KEY, JSON.stringify(templates));
  } catch (e) {
    console.warn('Failed to save templates:', e);
  }
}

// ============ BUILT-IN TEMPLATES ============

const builtInTemplates: MaintenanceTemplate[] = [
  {
    id: 'builtin-pre-race',
    name: 'Pre-Race Inspection',
    description: 'Complete pre-race inspection checklist covering all critical systems before competition. Ensures safety compliance and mechanical readiness.',
    type: 'Pre-Race',
    items: [
      { id: 'pri-1', component: 'Engine Oil & Filter Check', category: 'Engine', passInterval: 1, priority: 'High', notes: 'Verify oil level, check for leaks, inspect filter condition', typicalParts: [{ partNumber: 'OIL-5W30', description: 'Engine Oil 5W-30 (qt)', quantity: 1 }, { partNumber: 'FLT-OIL-01', description: 'Oil Filter', quantity: 1 }] },
      { id: 'pri-2', component: 'Transmission Fluid Level', category: 'Drivetrain', passInterval: 1, priority: 'High', notes: 'Check fluid level and color, look for leaks at seals', typicalParts: [{ partNumber: 'ATF-PRO', description: 'Transmission Fluid (qt)', quantity: 1 }] },
      { id: 'pri-3', component: 'Brake System Inspection', category: 'Brakes', passInterval: 1, priority: 'Critical', notes: 'Check pad thickness, rotor condition, fluid level, line integrity', typicalParts: [{ partNumber: 'BRK-FLD-01', description: 'Brake Fluid DOT 4', quantity: 1 }] },
      { id: 'pri-4', component: 'Tire Pressure & Condition', category: 'Wheels', passInterval: 1, priority: 'Critical', notes: 'Set pressures per setup sheet, inspect for cuts, bubbles, wear', typicalParts: [] },
      { id: 'pri-5', component: 'Wheelie Bar Adjustment', category: 'Suspension', passInterval: 1, priority: 'High', notes: 'Verify wheelie bar height and wheel condition', typicalParts: [] },
      { id: 'pri-6', component: 'Parachute Pack & Lines', category: 'Safety', passInterval: 1, priority: 'Critical', notes: 'Inspect chute pack, verify lines are untangled, check release mechanism', typicalParts: [{ partNumber: 'CHUTE-PIN', description: 'Parachute Release Pin', quantity: 2 }] },
      { id: 'pri-7', component: 'Fuel System Pressure Test', category: 'Fuel System', passInterval: 1, priority: 'High', notes: 'Verify fuel pressure, check all fittings and lines for leaks', typicalParts: [] },
      { id: 'pri-8', component: 'Electrical Connections', category: 'Electronics', passInterval: 1, priority: 'Medium', notes: 'Check battery terminals, MSD wiring, data logger connections', typicalParts: [] },
      { id: 'pri-9', component: 'Supercharger Belt Tension', category: 'Engine', passInterval: 1, priority: 'High', notes: 'Check belt tension and alignment, inspect for wear or glazing', typicalParts: [{ partNumber: 'BELT-SC-8', description: 'Supercharger Drive Belt 8mm', quantity: 1 }] },
    ],
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
    isBuiltIn: true,
    isFavorite: true,
    tags: ['safety', 'pre-race', 'inspection'],
    version: 1,
  },
  {
    id: 'builtin-post-race',
    name: 'Post-Race Teardown',
    description: 'Thorough post-race teardown and inspection to identify wear, damage, and items needing service before the next event.',
    type: 'Post-Race',
    items: [
      { id: 'prt-1', component: 'Engine Teardown & Inspection', category: 'Engine', passInterval: 10, priority: 'High', notes: 'Full teardown: inspect bearings, rings, pistons, cylinder walls', typicalParts: [{ partNumber: 'GSKT-ENG-SET', description: 'Engine Gasket Set', quantity: 1 }] },
      { id: 'prt-2', component: 'Cylinder Head Inspection', category: 'Engine', passInterval: 10, priority: 'High', notes: 'Check valve seats, springs, retainers, guides. Measure valve lash', typicalParts: [{ partNumber: 'GSKT-HEAD', description: 'Head Gasket (pair)', quantity: 2 }] },
      { id: 'prt-3', component: 'Transmission Service', category: 'Drivetrain', passInterval: 10, priority: 'High', notes: 'Drain and inspect fluid, check clutch packs, inspect bands', typicalParts: [{ partNumber: 'ATF-PRO', description: 'Transmission Fluid (qt)', quantity: 12 }, { partNumber: 'FLT-TRANS', description: 'Transmission Filter', quantity: 1 }] },
      { id: 'prt-4', component: 'Torque Converter Inspection', category: 'Torque Converter', passInterval: 15, priority: 'Medium', notes: 'Check for cracks, inspect stator, verify stall speed', typicalParts: [] },
      { id: 'prt-5', component: 'Rear End Service', category: '3rd Member', passInterval: 10, priority: 'High', notes: 'Inspect ring & pinion, check bearings, replace gear oil', typicalParts: [{ partNumber: 'GEAR-OIL-75', description: 'Gear Oil 75W-140 (qt)', quantity: 3 }] },
      { id: 'prt-6', component: 'Driveshaft Inspection', category: 'Drivetrain', passInterval: 10, priority: 'Medium', notes: 'Check U-joints, inspect for cracks, verify balance', typicalParts: [{ partNumber: 'UJNT-1350', description: 'U-Joint 1350 Series', quantity: 2 }] },
      { id: 'prt-7', component: 'Chassis & Frame Inspection', category: 'Body', passInterval: 10, priority: 'Critical', notes: 'Check all welds, inspect for cracks, verify cage integrity', typicalParts: [] },
      { id: 'prt-8', component: 'Suspension Bushings & Bearings', category: 'Suspension', passInterval: 15, priority: 'Medium', notes: 'Inspect all bushings, check rod ends, verify alignment', typicalParts: [] },
    ],
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
    isBuiltIn: true,
    isFavorite: false,
    tags: ['teardown', 'post-race', 'inspection'],
    version: 1,
  },
  {
    id: 'builtin-seasonal',
    name: 'Seasonal Overhaul',
    description: 'Complete off-season overhaul covering all major systems. Ideal for winter maintenance to prepare for the upcoming season.',
    type: 'Seasonal',
    items: [
      { id: 'so-1', component: 'Complete Engine Rebuild', category: 'Engine', passInterval: 100, priority: 'Critical', notes: 'Full rebuild: new bearings, rings, hone cylinders, check crank', typicalParts: [{ partNumber: 'KIT-ENG-REB', description: 'Engine Rebuild Kit', quantity: 1 }, { partNumber: 'BRG-MAIN-SET', description: 'Main Bearing Set', quantity: 1 }, { partNumber: 'BRG-ROD-SET', description: 'Rod Bearing Set', quantity: 1 }, { partNumber: 'RING-SET', description: 'Piston Ring Set', quantity: 1 }] },
      { id: 'so-2', component: 'Supercharger Rebuild', category: 'Engine', passInterval: 100, priority: 'High', notes: 'New rotors, bearings, seals, snout rebuild', typicalParts: [{ partNumber: 'KIT-SC-REB', description: 'Supercharger Rebuild Kit', quantity: 1 }] },
      { id: 'so-3', component: 'Transmission Rebuild', category: 'Drivetrain', passInterval: 100, priority: 'High', notes: 'Full rebuild with new clutches, bands, seals, and bushings', typicalParts: [{ partNumber: 'KIT-TRANS-REB', description: 'Transmission Rebuild Kit', quantity: 1 }] },
      { id: 'so-4', component: 'Torque Converter Rebuild', category: 'Torque Converter', passInterval: 100, priority: 'High', notes: 'Send out for rebuild — new bearings, stator, and rebalance', typicalParts: [] },
      { id: 'so-5', component: 'Rear End Rebuild', category: '3rd Member', passInterval: 100, priority: 'High', notes: 'New ring & pinion, bearings, seals. Set backlash and pattern', typicalParts: [{ partNumber: 'KIT-REAR-REB', description: 'Rear End Rebuild Kit', quantity: 1 }] },
      { id: 'so-6', component: 'All Fluid Replacement', category: 'Fluids', passInterval: 100, priority: 'Medium', notes: 'Replace all fluids: engine oil, trans fluid, gear oil, brake fluid, coolant', typicalParts: [{ partNumber: 'OIL-5W30', description: 'Engine Oil 5W-30 (qt)', quantity: 12 }, { partNumber: 'ATF-PRO', description: 'Transmission Fluid (qt)', quantity: 14 }, { partNumber: 'GEAR-OIL-75', description: 'Gear Oil 75W-140 (qt)', quantity: 4 }, { partNumber: 'BRK-FLD-01', description: 'Brake Fluid DOT 4', quantity: 2 }] },
      { id: 'so-7', component: 'Safety Equipment Recertification', category: 'Safety', passInterval: 100, priority: 'Critical', notes: 'Check all SFI dates, replace expired items, re-certify as needed', typicalParts: [] },
      { id: 'so-8', component: 'Wiring Harness Inspection', category: 'Electronics', passInterval: 100, priority: 'Medium', notes: 'Full wiring inspection, replace damaged connectors, re-wrap harness', typicalParts: [] },
      { id: 'so-9', component: 'Chassis Recertification', category: 'Safety', passInterval: 100, priority: 'Critical', notes: 'Full chassis inspection by certified inspector, update cert sticker', typicalParts: [] },
      { id: 'so-10', component: 'Paint & Body Refresh', category: 'Body', passInterval: 100, priority: 'Low', notes: 'Touch up paint, replace damaged body panels, clean and polish', typicalParts: [] },
    ],
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
    isBuiltIn: true,
    isFavorite: false,
    tags: ['seasonal', 'overhaul', 'off-season', 'rebuild'],
    version: 1,
  },
  {
    id: 'builtin-engine-refresh',
    name: 'Engine Refresh',
    description: 'Mid-season engine refresh focusing on high-wear items without a full rebuild. Extends engine life between complete overhauls.',
    type: 'Monthly',
    items: [
      { id: 'er-1', component: 'Rod Bearings Replacement', category: 'Engine', passInterval: 30, priority: 'Critical', notes: 'Replace all rod bearings, check clearances with Plastigage', typicalParts: [{ partNumber: 'BRG-ROD-SET', description: 'Rod Bearing Set', quantity: 1 }] },
      { id: 'er-2', component: 'Main Bearings Inspection', category: 'Engine', passInterval: 30, priority: 'High', notes: 'Inspect main bearings, replace if worn beyond spec', typicalParts: [{ partNumber: 'BRG-MAIN-SET', description: 'Main Bearing Set', quantity: 1 }] },
      { id: 'er-3', component: 'Piston Ring Replacement', category: 'Engine', passInterval: 50, priority: 'High', notes: 'Replace rings, check ring gaps, hone cylinders if needed', typicalParts: [{ partNumber: 'RING-SET', description: 'Piston Ring Set', quantity: 1 }] },
      { id: 'er-4', component: 'Valve Spring Check', category: 'Engine', passInterval: 25, priority: 'High', notes: 'Test spring pressure, replace any that are below spec', typicalParts: [{ partNumber: 'VSPRG-SET', description: 'Valve Spring Set', quantity: 1 }] },
      { id: 'er-5', component: 'Cam Bearing Inspection', category: 'Engine', passInterval: 50, priority: 'Medium', notes: 'Check cam bearing clearances, replace if needed', typicalParts: [{ partNumber: 'BRG-CAM-SET', description: 'Cam Bearing Set', quantity: 1 }] },
      { id: 'er-6', component: 'Oil Pump Inspection', category: 'Engine', passInterval: 30, priority: 'High', notes: 'Check oil pump pressure and volume, inspect gears', typicalParts: [] },
    ],
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
    isBuiltIn: true,
    isFavorite: false,
    tags: ['engine', 'refresh', 'mid-season'],
    version: 1,
  },
  {
    id: 'builtin-drivetrain-service',
    name: 'Drivetrain Service',
    description: 'Focused drivetrain service covering transmission, converter, driveshaft, and rear end. Essential for high-horsepower applications.',
    type: 'Monthly',
    items: [
      { id: 'ds-1', component: 'Transmission Fluid & Filter', category: 'Drivetrain', passInterval: 15, priority: 'High', notes: 'Drain fluid, replace filter, refill with fresh ATF', typicalParts: [{ partNumber: 'ATF-PRO', description: 'Transmission Fluid (qt)', quantity: 14 }, { partNumber: 'FLT-TRANS', description: 'Transmission Filter', quantity: 1 }] },
      { id: 'ds-2', component: 'U-Joint Inspection & Replacement', category: 'Drivetrain', passInterval: 20, priority: 'High', notes: 'Check all U-joints for play, replace as needed', typicalParts: [{ partNumber: 'UJNT-1350', description: 'U-Joint 1350 Series', quantity: 2 }] },
      { id: 'ds-3', component: 'Rear End Gear Oil Change', category: '3rd Member', passInterval: 15, priority: 'Medium', notes: 'Drain and replace gear oil, check for metal in old fluid', typicalParts: [{ partNumber: 'GEAR-OIL-75', description: 'Gear Oil 75W-140 (qt)', quantity: 3 }] },
      { id: 'ds-4', component: 'Axle Bearing Check', category: '3rd Member', passInterval: 25, priority: 'Medium', notes: 'Check axle bearings for play and noise', typicalParts: [] },
      { id: 'ds-5', component: 'Driveshaft Balance Check', category: 'Drivetrain', passInterval: 30, priority: 'Medium', notes: 'Inspect driveshaft for damage, verify balance', typicalParts: [] },
    ],
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
    isBuiltIn: true,
    isFavorite: false,
    tags: ['drivetrain', 'transmission', 'rear-end'],
    version: 1,
  },
  {
    id: 'builtin-safety-check',
    name: 'Safety Equipment Check',
    description: 'Comprehensive safety equipment inspection covering all SFI-rated items, fire systems, restraints, and protective gear.',
    type: 'Weekly',
    items: [
      { id: 'sc-1', component: 'Fire Suppression System Test', category: 'Safety', passInterval: 5, priority: 'Critical', notes: 'Verify pressure gauge, check nozzle alignment, test activation', typicalParts: [] },
      { id: 'sc-2', component: 'Seat Belt / Harness Inspection', category: 'Safety', passInterval: 5, priority: 'Critical', notes: 'Check webbing for wear, verify SFI date, test latches', typicalParts: [] },
      { id: 'sc-3', component: 'Helmet & HANS Device', category: 'Safety', passInterval: 5, priority: 'Critical', notes: 'Inspect helmet shell, check HANS tethers, verify SFI certification', typicalParts: [] },
      { id: 'sc-4', component: 'Parachute System', category: 'Safety', passInterval: 3, priority: 'Critical', notes: 'Repack chute, inspect shroud lines, test release mechanism', typicalParts: [{ partNumber: 'CHUTE-PIN', description: 'Parachute Release Pin', quantity: 2 }] },
      { id: 'sc-5', component: 'Roll Cage Inspection', category: 'Safety', passInterval: 20, priority: 'Critical', notes: 'Visual inspection of all welds, check for cracks or deformation', typicalParts: [] },
      { id: 'sc-6', component: 'Window Net & Arm Restraints', category: 'Safety', passInterval: 5, priority: 'High', notes: 'Check net mounting, verify quick-release, inspect arm restraints', typicalParts: [] },
    ],
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
    isBuiltIn: true,
    isFavorite: false,
    tags: ['safety', 'sfi', 'inspection'],
    version: 1,
  },
];

// ============ COMPONENT ============

interface MaintenanceTemplatesProps {
  onApplyTemplate?: () => void;
}

const MaintenanceTemplates: React.FC<MaintenanceTemplatesProps> = ({ onApplyTemplate }) => {
  const { addMaintenanceItem, maintenanceItems, partsInventory } = useApp();
  const { selectedCarId } = useCar();

  const [templates, setTemplates] = useState<MaintenanceTemplate[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [expandedTemplate, setExpandedTemplate] = useState<string | null>(null);

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<MaintenanceTemplate | null>(null);
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [applyingTemplate, setApplyingTemplate] = useState<MaintenanceTemplate | null>(null);
  const [applyCarId, setApplyCarId] = useState<string>(selectedCarId || '');
  const [applySelectedItems, setApplySelectedItems] = useState<Set<string>>(new Set());
  const [isApplying, setIsApplying] = useState(false);

  // Create/Edit form state
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formType, setFormType] = useState<MaintenanceTemplate['type']>('Custom');
  const [formTags, setFormTags] = useState('');
  const [formItems, setFormItems] = useState<TemplateMaintenanceItem[]>([]);
  const [showAddItemForm, setShowAddItemForm] = useState(false);

  // New item form
  const [newItemComponent, setNewItemComponent] = useState('');
  const [newItemCategory, setNewItemCategory] = useState('Engine');
  const [newItemInterval, setNewItemInterval] = useState(10);
  const [newItemPriority, setNewItemPriority] = useState<'Low' | 'Medium' | 'High' | 'Critical'>('Medium');
  const [newItemNotes, setNewItemNotes] = useState('');
  const [newItemParts, setNewItemParts] = useState<TemplatePartItem[]>([]);

  // Import ref
  const importRef = useRef<HTMLInputElement>(null);

  // Load templates on mount, seed built-ins if first time
  useEffect(() => {
    const initialized = localStorage.getItem(TEMPLATES_INITIALIZED_KEY);
    let loaded = loadTemplates();

    if (!initialized) {
      // Merge built-in templates (don't duplicate)
      const existingIds = new Set(loaded.map(t => t.id));
      const newBuiltIns = builtInTemplates.filter(t => !existingIds.has(t.id));
      loaded = [...newBuiltIns, ...loaded];
      saveTemplates(loaded);
      localStorage.setItem(TEMPLATES_INITIALIZED_KEY, 'true');
    }

    setTemplates(loaded);
  }, []);

  // Persist templates on change
  const updateAndSave = (newTemplates: MaintenanceTemplate[]) => {
    setTemplates(newTemplates);
    saveTemplates(newTemplates);
  };

  // ============ FILTERING ============

  const filteredTemplates = useMemo(() => {
    let result = templates;

    if (showFavoritesOnly) {
      result = result.filter(t => t.isFavorite);
    }

    if (filterType !== 'all') {
      result = result.filter(t => t.type === filterType);
    }

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      result = result.filter(t =>
        t.name.toLowerCase().includes(term) ||
        t.description.toLowerCase().includes(term) ||
        t.tags.some(tag => tag.toLowerCase().includes(term)) ||
        t.items.some(item => item.component.toLowerCase().includes(term))
      );
    }

    // Sort: favorites first, then by name
    return result.sort((a, b) => {
      if (a.isFavorite && !b.isFavorite) return -1;
      if (!a.isFavorite && b.isFavorite) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [templates, searchTerm, filterType, showFavoritesOnly]);

  const templateTypes = ['Pre-Race', 'Post-Race', 'Seasonal', 'Weekly', 'Monthly', 'Custom'];

  // ============ TEMPLATE CRUD ============

  const toggleFavorite = (id: string) => {
    updateAndSave(templates.map(t => t.id === id ? { ...t, isFavorite: !t.isFavorite } : t));
  };

  const deleteTemplate = (id: string) => {
    const template = templates.find(t => t.id === id);
    if (!template) return;
    if (template.isBuiltIn) {
      toast.error('Cannot delete built-in templates. You can hide them by removing from favorites.');
      return;
    }
    if (!confirm(`Delete template "${template.name}"? This cannot be undone.`)) return;
    updateAndSave(templates.filter(t => t.id !== id));
    toast.success(`Template "${template.name}" deleted`);
  };

  const duplicateTemplate = (template: MaintenanceTemplate) => {
    const newTemplate: MaintenanceTemplate = {
      ...template,
      id: `tmpl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: `${template.name} (Copy)`,
      isBuiltIn: false,
      isFavorite: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      items: template.items.map(item => ({
        ...item,
        id: `ti-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      })),
    };
    updateAndSave([newTemplate, ...templates]);
    toast.success(`Template duplicated as "${newTemplate.name}"`);
  };

  // ============ CREATE / EDIT ============

  const openCreateModal = () => {
    setEditingTemplate(null);
    setFormName('');
    setFormDescription('');
    setFormType('Custom');
    setFormTags('');
    setFormItems([]);
    setShowAddItemForm(false);
    setShowCreateModal(true);
  };

  const openEditModal = (template: MaintenanceTemplate) => {
    if (template.isBuiltIn) {
      toast.info('Built-in templates cannot be edited. Duplicate it first to customize.');
      return;
    }
    setEditingTemplate(template);
    setFormName(template.name);
    setFormDescription(template.description);
    setFormType(template.type);
    setFormTags(template.tags.join(', '));
    setFormItems([...template.items]);
    setShowAddItemForm(false);
    setShowCreateModal(true);
  };

  const resetNewItemForm = () => {
    setNewItemComponent('');
    setNewItemCategory('Engine');
    setNewItemInterval(10);
    setNewItemPriority('Medium');
    setNewItemNotes('');
    setNewItemParts([]);
  };

  const addItemToForm = () => {
    if (!newItemComponent.trim()) {
      toast.error('Component name is required');
      return;
    }
    const newItem: TemplateMaintenanceItem = {
      id: `ti-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      component: newItemComponent.trim(),
      category: newItemCategory,
      passInterval: newItemInterval,
      priority: newItemPriority,
      notes: newItemNotes,
      typicalParts: [...newItemParts],
    };
    setFormItems(prev => [...prev, newItem]);
    resetNewItemForm();
    setShowAddItemForm(false);
  };

  const removeItemFromForm = (itemId: string) => {
    setFormItems(prev => prev.filter(i => i.id !== itemId));
  };

  const addPartToNewItem = () => {
    setNewItemParts(prev => [...prev, { partNumber: '', description: '', quantity: 1 }]);
  };

  const updateNewItemPart = (index: number, field: keyof TemplatePartItem, value: string | number) => {
    setNewItemParts(prev => prev.map((p, i) => i === index ? { ...p, [field]: value } : p));
  };

  const removeNewItemPart = (index: number) => {
    setNewItemParts(prev => prev.filter((_, i) => i !== index));
  };

  const handleSaveTemplate = () => {
    if (!formName.trim()) {
      toast.error('Template name is required');
      return;
    }
    if (formItems.length === 0) {
      toast.error('Add at least one maintenance item to the template');
      return;
    }

    const now = new Date().toISOString();
    const tags = formTags.split(',').map(t => t.trim()).filter(Boolean);

    if (editingTemplate) {
      updateAndSave(templates.map(t =>
        t.id === editingTemplate.id
          ? { ...t, name: formName.trim(), description: formDescription.trim(), type: formType, tags, items: formItems, updatedAt: now, version: t.version + 1 }
          : t
      ));
      toast.success(`Template "${formName}" updated`);
    } else {
      const newTemplate: MaintenanceTemplate = {
        id: `tmpl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name: formName.trim(),
        description: formDescription.trim(),
        type: formType,
        items: formItems,
        createdAt: now,
        updatedAt: now,
        isBuiltIn: false,
        isFavorite: false,
        tags,
        version: 1,
      };
      updateAndSave([newTemplate, ...templates]);
      toast.success(`Template "${formName}" created with ${formItems.length} items`);
    }

    setShowCreateModal(false);
    setEditingTemplate(null);
  };

  // ============ APPLY TEMPLATE ============

  const openApplyModal = (template: MaintenanceTemplate) => {
    setApplyingTemplate(template);
    setApplyCarId(selectedCarId || '');
    setApplySelectedItems(new Set(template.items.map(i => i.id)));
    setShowApplyModal(true);
  };

  const toggleApplyItem = (itemId: string) => {
    setApplySelectedItems(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  };

  const selectAllApplyItems = () => {
    if (!applyingTemplate) return;
    setApplySelectedItems(new Set(applyingTemplate.items.map(i => i.id)));
  };

  const deselectAllApplyItems = () => {
    setApplySelectedItems(new Set());
  };

  const handleApplyTemplate = async () => {
    if (!applyingTemplate) return;
    if (applySelectedItems.size === 0) {
      toast.error('Select at least one item to apply');
      return;
    }

    setIsApplying(true);
    let addedCount = 0;
    let skippedCount = 0;

    try {
      const selectedItems = applyingTemplate.items.filter(i => applySelectedItems.has(i.id));

      for (const templateItem of selectedItems) {
        // Check if a similar maintenance item already exists for this car
        const existing = maintenanceItems.find(m =>
          m.component.toLowerCase() === templateItem.component.toLowerCase() &&
          m.category === templateItem.category &&
          (applyCarId ? m.car_id === applyCarId : true)
        );

        if (existing) {
          skippedCount++;
          continue;
        }

        const newItem: MaintenanceItem = {
          id: `MT-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          component: templateItem.component,
          category: templateItem.category,
          passInterval: templateItem.passInterval,
          currentPasses: 0,
          lastService: getLocalDateString(),
          nextServicePasses: templateItem.passInterval,
          status: 'Good',
          priority: templateItem.priority,
          notes: templateItem.notes,
          car_id: applyCarId || undefined,
        };

        await addMaintenanceItem(newItem);
        addedCount++;
      }

      setShowApplyModal(false);
      setApplyingTemplate(null);

      const msgs: string[] = [];
      if (addedCount > 0) msgs.push(`${addedCount} maintenance item${addedCount > 1 ? 's' : ''} added`);
      if (skippedCount > 0) msgs.push(`${skippedCount} skipped (already exist)`);

      toast.success(`Template "${applyingTemplate.name}" applied`, {
        description: msgs.join('. '),
        duration: 5000,
      });

      if (onApplyTemplate) onApplyTemplate();
    } catch (error) {
      console.error('Error applying template:', error);
      toast.error('Failed to apply template. Please try again.');
    } finally {
      setIsApplying(false);
    }
  };

  // ============ IMPORT / EXPORT ============

  const exportTemplate = (template: MaintenanceTemplate) => {
    const exportData = {
      ...template,
      isBuiltIn: false,
      exportedAt: new Date().toISOString(),
      exportVersion: '1.0',
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `template-${template.name.toLowerCase().replace(/\s+/g, '-')}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Template "${template.name}" exported`);
  };

  const exportAllTemplates = () => {
    const exportData = {
      templates: templates.map(t => ({ ...t, isBuiltIn: false })),
      exportedAt: new Date().toISOString(),
      exportVersion: '1.0',
      count: templates.length,
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `maintenance-templates-all-${getLocalDateString()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`All ${templates.length} templates exported`);
  };

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);

        // Handle single template or array
        let importedTemplates: MaintenanceTemplate[] = [];

        if (data.templates && Array.isArray(data.templates)) {
          importedTemplates = data.templates;
        } else if (data.name && data.items) {
          importedTemplates = [data];
        } else {
          toast.error('Invalid template file format');
          return;
        }

        let importedCount = 0;
        let skippedCount = 0;
        const existingNames = new Set(templates.map(t => t.name.toLowerCase()));

        const newTemplates = [...templates];

        for (const tmpl of importedTemplates) {
          if (existingNames.has(tmpl.name.toLowerCase())) {
            skippedCount++;
            continue;
          }

          const imported: MaintenanceTemplate = {
            ...tmpl,
            id: `tmpl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            isBuiltIn: false,
            isFavorite: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            items: (tmpl.items || []).map((item: TemplateMaintenanceItem) => ({
              ...item,
              id: `ti-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            })),
          };
          newTemplates.unshift(imported);
          importedCount++;
        }

        updateAndSave(newTemplates);

        const msgs: string[] = [];
        if (importedCount > 0) msgs.push(`${importedCount} template${importedCount > 1 ? 's' : ''} imported`);
        if (skippedCount > 0) msgs.push(`${skippedCount} skipped (name already exists)`);
        toast.success('Import complete', { description: msgs.join('. ') });
      } catch (err) {
        console.error('Import error:', err);
        toast.error('Failed to parse template file. Ensure it is valid JSON.');
      }
    };
    reader.readAsText(file);

    // Reset input
    if (importRef.current) importRef.current.value = '';
  };

  // ============ HELPERS ============

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'Pre-Race': return <Play className="w-4 h-4" />;
      case 'Post-Race': return <RotateCcw className="w-4 h-4" />;
      case 'Seasonal': return <Clock className="w-4 h-4" />;
      case 'Weekly': return <Clock className="w-4 h-4" />;
      case 'Monthly': return <Clock className="w-4 h-4" />;
      case 'Custom': return <Settings className="w-4 h-4" />;
      default: return <FileText className="w-4 h-4" />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'Pre-Race': return 'bg-green-500/20 text-green-400 border-green-500/50';
      case 'Post-Race': return 'bg-blue-500/20 text-blue-400 border-blue-500/50';
      case 'Seasonal': return 'bg-purple-500/20 text-purple-400 border-purple-500/50';
      case 'Weekly': return 'bg-cyan-500/20 text-cyan-400 border-cyan-500/50';
      case 'Monthly': return 'bg-orange-500/20 text-orange-400 border-orange-500/50';
      case 'Custom': return 'bg-slate-500/20 text-slate-400 border-slate-500/50';
      default: return 'bg-slate-500/20 text-slate-400 border-slate-500/50';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'Critical': return 'text-red-400';
      case 'High': return 'text-orange-400';
      case 'Medium': return 'text-yellow-400';
      case 'Low': return 'text-green-400';
      default: return 'text-slate-400';
    }
  };

  const getCategoryStats = (items: TemplateMaintenanceItem[]) => {
    const cats: Record<string, number> = {};
    items.forEach(i => { cats[i.category] = (cats[i.category] || 0) + 1; });
    return Object.entries(cats).sort((a, b) => b[1] - a[1]);
  };

  // ============ RENDER ============

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-orange-400" />
            Maintenance Schedule Templates
          </h3>
          <p className="text-sm text-slate-400 mt-1">
            Create reusable templates to quickly populate maintenance schedules across cars
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => importRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-700 text-slate-300 rounded-lg text-sm hover:bg-slate-600 transition-colors"
          >
            <Upload className="w-4 h-4" />
            Import
          </button>
          <input
            ref={importRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={handleImport}
          />
          <button
            onClick={exportAllTemplates}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-700 text-slate-300 rounded-lg text-sm hover:bg-slate-600 transition-colors"
          >
            <Download className="w-4 h-4" />
            Export All
          </button>
          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create Template
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 text-sm"
            placeholder="Search templates by name, description, or tag..."
          />
        </div>
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <button
            onClick={() => setFilterType('all')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              filterType === 'all' ? 'bg-orange-500/20 text-orange-400' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            All
          </button>
          {templateTypes.map(type => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                filterType === type ? 'bg-orange-500/20 text-orange-400' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {type}
            </button>
          ))}
          <button
            onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              showFavoritesOnly ? 'bg-yellow-500/20 text-yellow-400' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <Star className="w-3.5 h-3.5" />
            Favorites
          </button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
          <div className="flex items-center gap-2 text-slate-400 mb-1">
            <Layers className="w-4 h-4" />
            <span className="text-sm">Total Templates</span>
          </div>
          <p className="text-2xl font-bold text-white">{templates.length}</p>
        </div>
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
          <div className="flex items-center gap-2 text-orange-400 mb-1">
            <Settings className="w-4 h-4" />
            <span className="text-sm">Custom</span>
          </div>
          <p className="text-2xl font-bold text-orange-400">{templates.filter(t => !t.isBuiltIn).length}</p>
        </div>
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
          <div className="flex items-center gap-2 text-yellow-400 mb-1">
            <Star className="w-4 h-4" />
            <span className="text-sm">Favorites</span>
          </div>
          <p className="text-2xl font-bold text-yellow-400">{templates.filter(t => t.isFavorite).length}</p>
        </div>
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
          <div className="flex items-center gap-2 text-cyan-400 mb-1">
            <Wrench className="w-4 h-4" />
            <span className="text-sm">Total Items</span>
          </div>
          <p className="text-2xl font-bold text-cyan-400">{templates.reduce((s, t) => s + t.items.length, 0)}</p>
        </div>
      </div>

      {/* Template Cards */}
      {filteredTemplates.length === 0 ? (
        <div className="text-center py-16 bg-slate-800/30 rounded-xl border border-slate-700/50">
          <BookOpen className="w-16 h-16 mx-auto text-slate-600 mb-4" />
          <h3 className="text-lg font-semibold text-slate-400 mb-2">No Templates Found</h3>
          <p className="text-slate-500 mb-6">
            {searchTerm || filterType !== 'all' || showFavoritesOnly
              ? 'Try adjusting your filters or search term.'
              : 'Create your first maintenance template to get started.'}
          </p>
          <button
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600"
          >
            <Plus className="w-4 h-4" />
            Create Template
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredTemplates.map(template => {
            const isExpanded = expandedTemplate === template.id;
            const categoryStats = getCategoryStats(template.items);
            const totalParts = template.items.reduce((s, i) => s + i.typicalParts.length, 0);
            const criticalCount = template.items.filter(i => i.priority === 'Critical').length;

            return (
              <div
                key={template.id}
                className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden hover:border-slate-600/50 transition-colors"
              >
                {/* Card Header */}
                <div className="p-4">
                  <div className="flex items-start gap-4">
                    {/* Type Icon */}
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${getTypeColor(template.type).split(' ').slice(0, 1).join(' ')}`}>
                      {getTypeIcon(template.type)}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="text-white font-semibold truncate">{template.name}</h4>
                        {template.isBuiltIn && (
                          <span className="px-1.5 py-0.5 bg-blue-500/20 text-blue-400 text-[10px] font-medium rounded border border-blue-500/30">
                            BUILT-IN
                          </span>
                        )}
                        <span className={`px-2 py-0.5 rounded text-xs font-medium border ${getTypeColor(template.type)}`}>
                          {template.type}
                        </span>
                      </div>
                      <p className="text-sm text-slate-400 line-clamp-2">{template.description}</p>

                      {/* Stats Row */}
                      <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                        <span className="flex items-center gap-1">
                          <Wrench className="w-3 h-3" />
                          {template.items.length} items
                        </span>
                        {totalParts > 0 && (
                          <span className="flex items-center gap-1">
                            <Package className="w-3 h-3" />
                            {totalParts} parts
                          </span>
                        )}
                        {criticalCount > 0 && (
                          <span className="flex items-center gap-1 text-red-400">
                            <AlertTriangle className="w-3 h-3" />
                            {criticalCount} critical
                          </span>
                        )}
                        <span>v{template.version}</span>
                      </div>

                      {/* Tags */}
                      {template.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {template.tags.map(tag => (
                            <span key={tag} className="px-1.5 py-0.5 bg-slate-700/50 text-slate-400 text-[10px] rounded">
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => toggleFavorite(template.id)}
                        className={`p-1.5 rounded transition-colors ${template.isFavorite ? 'text-yellow-400 hover:text-yellow-300' : 'text-slate-500 hover:text-yellow-400'}`}
                        title={template.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                      >
                        {template.isFavorite ? <Star className="w-4 h-4 fill-current" /> : <StarOff className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() => openApplyModal(template)}
                        className="flex items-center gap-1 px-2.5 py-1.5 bg-green-500/20 text-green-400 rounded-lg text-xs font-medium hover:bg-green-500/30 transition-colors"
                        title="Apply template"
                      >
                        <Zap className="w-3.5 h-3.5" />
                        Apply
                      </button>
                      <button
                        onClick={() => duplicateTemplate(template)}
                        className="p-1.5 text-slate-400 hover:text-blue-400 rounded transition-colors"
                        title="Duplicate"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => exportTemplate(template)}
                        className="p-1.5 text-slate-400 hover:text-cyan-400 rounded transition-colors"
                        title="Export"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                      {!template.isBuiltIn && (
                        <button
                          onClick={() => openEditModal(template)}
                          className="p-1.5 text-slate-400 hover:text-orange-400 rounded transition-colors"
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      )}
                      {!template.isBuiltIn && (
                        <button
                          onClick={() => deleteTemplate(template.id)}
                          className="p-1.5 text-slate-400 hover:text-red-400 rounded transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => setExpandedTemplate(isExpanded ? null : template.id)}
                        className="p-1.5 text-slate-400 hover:text-white rounded transition-colors"
                        title={isExpanded ? 'Collapse' : 'Expand'}
                      >
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="border-t border-slate-700/50 bg-slate-900/30">
                    {/* Category breakdown */}
                    <div className="px-4 pt-4 pb-2">
                      <p className="text-xs font-medium text-slate-400 mb-2">Categories</p>
                      <div className="flex flex-wrap gap-2">
                        {categoryStats.map(([cat, count]) => (
                          <span key={cat} className="px-2 py-1 bg-slate-800 text-slate-300 text-xs rounded-lg border border-slate-700/50">
                            {cat} <span className="text-slate-500">({count})</span>
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Items table */}
                    <div className="px-4 pb-4">
                      <p className="text-xs font-medium text-slate-400 mb-2 mt-2">Maintenance Items</p>
                      <div className="space-y-2">
                        {template.items.map((item, idx) => (
                          <div key={item.id} className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/30">
                            <div className="flex items-start justify-between">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-slate-500 text-xs font-mono w-5">{idx + 1}.</span>
                                  <span className="text-white text-sm font-medium">{item.component}</span>
                                  <span className={`text-xs font-medium ${getPriorityColor(item.priority)}`}>
                                    {item.priority}
                                  </span>
                                </div>
                                <div className="flex items-center gap-3 mt-1 ml-7 text-xs text-slate-500">
                                  <span>{item.category}</span>
                                  <span>Every {item.passInterval} passes</span>
                                  {item.typicalParts.length > 0 && (
                                    <span className="text-orange-400/70">{item.typicalParts.length} part{item.typicalParts.length > 1 ? 's' : ''}</span>
                                  )}
                                </div>
                                {item.notes && (
                                  <p className="text-xs text-slate-500 mt-1 ml-7 italic">{item.notes}</p>
                                )}
                                {item.typicalParts.length > 0 && (
                                  <div className="ml-7 mt-2 space-y-1">
                                    {item.typicalParts.map((part, pIdx) => (
                                      <div key={pIdx} className="flex items-center gap-2 text-xs">
                                        <Package className="w-3 h-3 text-orange-400/60" />
                                        <span className="text-slate-400 font-mono">{part.partNumber}</span>
                                        <span className="text-slate-500">{part.description}</span>
                                        <span className="text-slate-600">x{part.quantity}</span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ============ CREATE / EDIT MODAL ============ */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-xl max-w-3xl w-full p-6 border border-slate-700 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-orange-400" />
                {editingTemplate ? 'Edit Template' : 'Create New Template'}
              </h3>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Template Info */}
            <div className="space-y-4 mb-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Template Name *</label>
                  <input
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                    placeholder="e.g., Pre-Race Inspection"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Type</label>
                  <select
                    value={formType}
                    onChange={(e) => setFormType(e.target.value as MaintenanceTemplate['type'])}
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                  >
                    {templateTypes.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Description</label>
                <textarea
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  rows={2}
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white placeholder-slate-500"
                  placeholder="Describe what this template covers..."
                />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Tags <span className="text-slate-600">(comma-separated)</span></label>
                <input
                  type="text"
                  value={formTags}
                  onChange={(e) => setFormTags(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white placeholder-slate-500"
                  placeholder="e.g., safety, pre-race, inspection"
                />
              </div>
            </div>

            {/* Template Items */}
            <div className="border-t border-slate-700 pt-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                  <Wrench className="w-4 h-4 text-orange-400" />
                  Maintenance Items ({formItems.length})
                </h4>
                <button
                  onClick={() => { resetNewItemForm(); setShowAddItemForm(true); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-500/20 text-orange-400 rounded-lg text-xs font-medium hover:bg-orange-500/30"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Item
                </button>
              </div>

              {/* Existing items */}
              {formItems.length > 0 && (
                <div className="space-y-2 mb-4">
                  {formItems.map((item, idx) => (
                    <div key={item.id} className="flex items-center gap-3 bg-slate-900/50 rounded-lg px-3 py-2.5 border border-slate-700/50">
                      <span className="text-slate-500 text-xs font-mono w-5">{idx + 1}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-white text-sm font-medium truncate">{item.component}</span>
                          <span className={`text-[10px] font-medium ${getPriorityColor(item.priority)}`}>{item.priority}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                          <span>{item.category}</span>
                          <span>Every {item.passInterval} passes</span>
                          {item.typicalParts.length > 0 && <span className="text-orange-400/70">{item.typicalParts.length} parts</span>}
                        </div>
                      </div>
                      <button
                        onClick={() => removeItemFromForm(item.id)}
                        className="p-1 text-red-400 hover:text-red-300 flex-shrink-0"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {formItems.length === 0 && !showAddItemForm && (
                <div className="text-center py-8 bg-slate-900/30 rounded-lg border border-dashed border-slate-700 mb-4">
                  <Wrench className="w-8 h-8 mx-auto text-slate-600 mb-2" />
                  <p className="text-slate-500 text-sm">No items yet. Add maintenance items to this template.</p>
                </div>
              )}

              {/* Add Item Form */}
              {showAddItemForm && (
                <div className="bg-slate-900/50 rounded-lg p-4 border border-orange-500/30 mb-4">
                  <h5 className="text-sm font-medium text-orange-400 mb-3">New Maintenance Item</h5>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Component Name *</label>
                      <input
                        type="text"
                        value={newItemComponent}
                        onChange={(e) => setNewItemComponent(e.target.value)}
                        className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm"
                        placeholder="e.g., Engine Oil & Filter Check"
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">Category</label>
                        <select
                          value={newItemCategory}
                          onChange={(e) => setNewItemCategory(e.target.value)}
                          className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm"
                        >
                          <option value="Engine">Engine</option>
                          <option value="Drivetrain">Drivetrain</option>
                          <option value="Fuel System">Fuel System</option>
                          <option value="Electronics">Electronics</option>
                          <option value="Suspension">Suspension</option>
                          <option value="Brakes">Brakes</option>
                          <option value="Wheels">Wheels</option>
                          <option value="Fluids">Fluids</option>
                          <option value="Safety">Safety</option>
                          <option value="Body">Body</option>
                          <option value="Torque Converter">Torque Converter</option>
                          <option value="3rd Member">3rd Member</option>
                          <option value="Transmission">Transmission</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">Pass Interval</label>
                        <input
                          type="number"
                          min="1"
                          value={newItemInterval}
                          onChange={(e) => setNewItemInterval(parseInt(e.target.value) || 1)}
                          className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">Priority</label>
                        <select
                          value={newItemPriority}
                          onChange={(e) => setNewItemPriority(e.target.value as any)}
                          className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm"
                        >
                          <option value="Low">Low</option>
                          <option value="Medium">Medium</option>
                          <option value="High">High</option>
                          <option value="Critical">Critical</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Notes</label>
                      <textarea
                        value={newItemNotes}
                        onChange={(e) => setNewItemNotes(e.target.value)}
                        rows={2}
                        className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm placeholder-slate-500"
                        placeholder="Maintenance notes and instructions..."
                      />
                    </div>

                    {/* Typical Parts */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-xs text-slate-400">Typical Parts Used</label>
                        <button
                          onClick={addPartToNewItem}
                          className="flex items-center gap-1 px-2 py-1 bg-slate-700 text-slate-300 rounded text-xs hover:bg-slate-600"
                        >
                          <Plus className="w-3 h-3" />
                          Add Part
                        </button>
                      </div>
                      {newItemParts.map((part, pIdx) => (
                        <div key={pIdx} className="flex items-center gap-2 mb-2">
                          <input
                            type="text"
                            value={part.partNumber}
                            onChange={(e) => updateNewItemPart(pIdx, 'partNumber', e.target.value)}
                            className="w-32 bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-white text-xs font-mono"
                            placeholder="Part #"
                          />
                          <input
                            type="text"
                            value={part.description}
                            onChange={(e) => updateNewItemPart(pIdx, 'description', e.target.value)}
                            className="flex-1 bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-white text-xs"
                            placeholder="Description"
                          />
                          <input
                            type="number"
                            min="1"
                            value={part.quantity}
                            onChange={(e) => updateNewItemPart(pIdx, 'quantity', parseInt(e.target.value) || 1)}
                            className="w-16 bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-white text-xs text-center"
                            placeholder="Qty"
                          />
                          <button onClick={() => removeNewItemPart(pIdx)} className="p-1 text-red-400 hover:text-red-300">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>

                    <div className="flex gap-2 pt-2">
                      <button
                        onClick={() => setShowAddItemForm(false)}
                        className="px-3 py-1.5 bg-slate-700 text-white rounded-lg text-sm hover:bg-slate-600"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={addItemToForm}
                        disabled={!newItemComponent.trim()}
                        className="px-3 py-1.5 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Add to Template
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Save */}
            <div className="flex gap-3 mt-6 pt-4 border-t border-slate-700">
              <button
                onClick={() => setShowCreateModal(false)}
                className="flex-1 px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveTemplate}
                disabled={!formName.trim() || formItems.length === 0}
                className="flex-1 px-4 py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <Check className="w-4 h-4" />
                {editingTemplate ? 'Save Changes' : 'Create Template'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============ APPLY TEMPLATE MODAL ============ */}
      {showApplyModal && applyingTemplate && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-xl max-w-2xl w-full p-6 border border-slate-700 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  <Zap className="w-5 h-5 text-green-400" />
                  Apply Template
                </h3>
                <p className="text-sm text-slate-400 mt-1">"{applyingTemplate.name}"</p>
              </div>
              <button onClick={() => setShowApplyModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Car Selection */}
            <div className="mb-5">
              <CarDropdown
                value={applyCarId}
                onChange={setApplyCarId}
                label="Apply to Car"
              />
              <p className="text-xs text-slate-500 mt-1">
                All selected maintenance items will be assigned to this car. Leave blank for no car assignment.
              </p>
            </div>

            {/* Item Selection */}
            <div className="mb-5">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-semibold text-white">
                  Select Items to Apply ({applySelectedItems.size} of {applyingTemplate.items.length})
                </h4>
                <div className="flex items-center gap-2">
                  <button
                    onClick={selectAllApplyItems}
                    className="text-xs text-orange-400 hover:text-orange-300"
                  >
                    Select All
                  </button>
                  <span className="text-slate-600">|</span>
                  <button
                    onClick={deselectAllApplyItems}
                    className="text-xs text-slate-400 hover:text-slate-300"
                  >
                    Deselect All
                  </button>
                </div>
              </div>

              <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-1">
                {applyingTemplate.items.map(item => {
                  const isSelected = applySelectedItems.has(item.id);
                  // Check if similar item already exists
                  const alreadyExists = maintenanceItems.some(m =>
                    m.component.toLowerCase() === item.component.toLowerCase() &&
                    m.category === item.category &&
                    (applyCarId ? m.car_id === applyCarId : true)
                  );

                  return (
                    <div
                      key={item.id}
                      onClick={() => toggleApplyItem(item.id)}
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-green-500/10 border-green-500/30'
                          : 'bg-slate-900/50 border-slate-700/50 hover:border-slate-600/50'
                      }`}
                    >
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                        isSelected ? 'bg-green-500 border-green-500' : 'border-slate-600'
                      }`}>
                        {isSelected && <Check className="w-3 h-3 text-white" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-white text-sm font-medium">{item.component}</span>
                          <span className={`text-[10px] font-medium ${getPriorityColor(item.priority)}`}>{item.priority}</span>
                          {alreadyExists && (
                            <span className="px-1.5 py-0.5 bg-yellow-500/20 text-yellow-400 text-[10px] rounded border border-yellow-500/30">
                              EXISTS — WILL SKIP
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                          <span>{item.category}</span>
                          <span>Every {item.passInterval} passes</span>
                          {item.typicalParts.length > 0 && <span className="text-orange-400/70">{item.typicalParts.length} parts</span>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Summary */}
            <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg text-sm mb-5">
              <p className="text-green-400 font-medium mb-1">On apply, this will:</p>
              <ul className="text-green-300/80 space-y-1 ml-4 list-disc">
                <li>Create {applySelectedItems.size} new maintenance schedule item{applySelectedItems.size !== 1 ? 's' : ''}</li>
                <li>Set all items to "Good" status with 0 current passes</li>
                <li>Items matching existing entries will be automatically skipped</li>
                {applyCarId && <li>Assign all items to the selected car</li>}
              </ul>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowApplyModal(false)}
                className="flex-1 px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600"
              >
                Cancel
              </button>
              <button
                onClick={handleApplyTemplate}
                disabled={applySelectedItems.size === 0 || isApplying}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isApplying ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Applying...
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4" />
                    Apply {applySelectedItems.size} Item{applySelectedItems.size !== 1 ? 's' : ''}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MaintenanceTemplates;
