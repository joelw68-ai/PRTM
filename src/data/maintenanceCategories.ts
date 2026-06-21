// ============================================================
// Maintenance Categories — single source of truth
// ============================================================
// Built-in (default) categories ship with the app and cannot be
// deleted. Users can additionally create, rename, delete, and color
// their own custom categories. Custom categories are persisted to a
// per-user Supabase table (`maintenance_categories`) so they sync
// across devices and survive a cache clear. localStorage is kept as
// an offline cache / fallback when there is no authenticated session.

import { supabase } from '@/lib/supabase';

export const DEFAULT_GENERAL_CATEGORIES: string[] = [
  'Drivetrain',
  'Engine',
  'Fuel System',
  'Electronics',
  'Suspension',
  'Brakes',
  'Wheels and Tires',
  'Fluids',
  'Safety',
  'Body',
];

export const DEFAULT_DRIVETRAIN_CATEGORIES: string[] = [
  'Transmission',
  'Torque Converter',
  '3rd Member',
  'Ring and Pinion',
  'Transmission Drive',
  'Ty-Drive',
  'Quick Drive',
];

// Flat list of every built-in category (used to prevent duplicate
// custom categories that shadow a default one).
export const DEFAULT_CATEGORIES: string[] = [
  ...DEFAULT_GENERAL_CATEGORIES,
  ...DEFAULT_DRIVETRAIN_CATEGORIES,
];

// A user-created category now carries a color so it can be visually
// scanned in tables and filter chips.
export interface CustomCategory {
  name: string;
  color: string;
}

// Default color assigned to brand-new custom categories.
export const DEFAULT_CATEGORY_COLOR = '#22d3ee'; // cyan-400

// Curated palette offered in the color picker.
export const CATEGORY_COLOR_PALETTE: string[] = [
  '#22d3ee', // cyan
  '#f97316', // orange
  '#22c55e', // green
  '#eab308', // yellow
  '#ef4444', // red
  '#a855f7', // purple
  '#3b82f6', // blue
  '#ec4899', // pink
  '#14b8a6', // teal
  '#f59e0b', // amber
  '#84cc16', // lime
  '#64748b', // slate
];

const STORAGE_KEY = 'maintenance_custom_categories_v2';
const LEGACY_STORAGE_KEY = 'maintenance_custom_categories';

// ---- deterministic color for built-in categories ----------------
// Built-in categories don't live in the DB; give each a stable color
// derived from its name so the dots are consistent across reloads.
const hashString = (s: string): number => {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
};

export const defaultColorForCategory = (name: string): string => {
  const idx = hashString((name || '').toLowerCase()) % CATEGORY_COLOR_PALETTE.length;
  return CATEGORY_COLOR_PALETTE[idx];
};

// Resolve the display color for ANY category (built-in or custom).
export const getCategoryColor = (
  name: string,
  customCategories: CustomCategory[]
): string => {
  const key = (name || '').trim().toLowerCase();
  const match = customCategories.find((c) => c.name.toLowerCase() === key);
  if (match) return match.color;
  return defaultColorForCategory(name || '');
};

// ---- localStorage cache helpers ---------------------------------

const readLocal = (): CustomCategory[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed
          .filter((c) => c && typeof c.name === 'string' && c.name.trim())
          .map((c) => ({
            name: c.name.trim(),
            color: typeof c.color === 'string' && c.color ? c.color : DEFAULT_CATEGORY_COLOR,
          }));
      }
    }
    // Migrate legacy string-only list (no colors) if present.
    const legacyRaw = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacyRaw) {
      const legacy = JSON.parse(legacyRaw);
      if (Array.isArray(legacy)) {
        return legacy
          .filter((c) => typeof c === 'string' && c.trim())
          .map((name: string) => ({ name: name.trim(), color: defaultColorForCategory(name) }));
      }
    }
  } catch {
    /* ignore */
  }
  return [];
};

const writeLocal = (cats: CustomCategory[]): void => {
  try {
    const seen = new Set<string>();
    const cleaned: CustomCategory[] = [];
    for (const c of cats) {
      const name = (c.name || '').trim();
      if (!name) continue;
      const key = name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      cleaned.push({ name, color: c.color || DEFAULT_CATEGORY_COLOR });
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cleaned));
  } catch {
    /* ignore */
  }
};

// ---- auth helper ------------------------------------------------

const getUserId = async (): Promise<string | null> => {
  try {
    const { data } = await supabase.auth.getUser();
    return data?.user?.id ?? null;
  } catch {
    return null;
  }
};

// ---- public DB-backed API ---------------------------------------

// Returns true if `name` collides with a default OR one of the
// provided custom categories (case-insensitive).
export const categoryExists = (name: string, customCategories: CustomCategory[]): boolean => {
  const key = (name || '').trim().toLowerCase();
  if (!key) return false;
  if (DEFAULT_CATEGORIES.some((c) => c.toLowerCase() === key)) return true;
  return customCategories.some((c) => c.name.toLowerCase() === key);
};

// Load custom categories. Tries the DB first (when authenticated),
// falling back to (and re-seeding) the localStorage cache otherwise.
// Categories are returned in the user's preferred order (sort_order),
// then by created_at as a stable tiebreaker.
export const loadCustomCategories = async (): Promise<CustomCategory[]> => {
  const userId = await getUserId();
  if (!userId) {
    return readLocal();
  }
  try {
    const { data, error } = await supabase
      .from('maintenance_categories')
      .select('name,color,sort_order,created_at')
      .eq('user_id', userId)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });
    if (error) throw error;
    const cats: CustomCategory[] = (data || []).map((r: { name: string; color: string }) => ({
      name: r.name,
      color: r.color || DEFAULT_CATEGORY_COLOR,
    }));

    // One-time migration: if the DB is empty but the local cache has
    // categories from before DB-backing, push them up so nothing is lost.
    if (cats.length === 0) {
      const local = readLocal();
      if (local.length > 0) {
        await supabase.from('maintenance_categories').upsert(
          local.map((c, i) => ({ user_id: userId, name: c.name, color: c.color, sort_order: i })),
          { onConflict: 'user_id,name' }
        );
        writeLocal(local);
        return local;
      }
    }

    writeLocal(cats);
    return cats;
  } catch (err) {
    console.warn('Falling back to local custom categories:', err);
    return readLocal();
  }
};

// Add a new custom category with a color. Returns the updated list.
// The new category is appended to the end of the user's order.
export const addCustomCategory = async (
  name: string,
  color: string,
  current: CustomCategory[]
): Promise<CustomCategory[]> => {
  const trimmed = (name || '').trim();
  if (!trimmed || categoryExists(trimmed, current)) return current;
  const next = [...current, { name: trimmed, color: color || DEFAULT_CATEGORY_COLOR }];
  writeLocal(next);

  const userId = await getUserId();
  if (userId) {
    try {
      await supabase
        .from('maintenance_categories')
        .upsert({
          user_id: userId,
          name: trimmed,
          color: color || DEFAULT_CATEGORY_COLOR,
          sort_order: current.length,
        }, {
          onConflict: 'user_id,name',
        });
    } catch (err) {
      console.warn('Failed to persist category to DB:', err);
    }
  }
  return next;
};

// Persist a new ordering of the user's custom categories. The provided
// array is taken as the canonical order; each row's sort_order is set to
// its index. Returns the (re-ordered) list.
export const reorderCustomCategories = async (
  ordered: CustomCategory[]
): Promise<CustomCategory[]> => {
  writeLocal(ordered);

  const userId = await getUserId();
  if (userId) {
    try {
      // Update each row's sort_order to match its new index.
      await Promise.all(
        ordered.map((c, i) =>
          supabase
            .from('maintenance_categories')
            .update({ sort_order: i })
            .eq('user_id', userId)
            .eq('name', c.name)
        )
      );
    } catch (err) {
      console.warn('Failed to persist category order to DB:', err);
    }
  }
  return ordered;
};


// Update just the color of an existing custom category.
export const setCustomCategoryColor = async (
  name: string,
  color: string,
  current: CustomCategory[]
): Promise<CustomCategory[]> => {
  const key = (name || '').trim().toLowerCase();
  const next = current.map((c) =>
    c.name.toLowerCase() === key ? { ...c, color } : c
  );
  writeLocal(next);

  const userId = await getUserId();
  if (userId) {
    try {
      await supabase
        .from('maintenance_categories')
        .update({ color })
        .eq('user_id', userId)
        .eq('name', current.find((c) => c.name.toLowerCase() === key)?.name ?? name);
    } catch (err) {
      console.warn('Failed to update category color in DB:', err);
    }
  }
  return next;
};

// Remove a custom category by name. Returns the updated list.
export const removeCustomCategory = async (
  name: string,
  current: CustomCategory[]
): Promise<CustomCategory[]> => {
  const key = (name || '').trim().toLowerCase();
  const target = current.find((c) => c.name.toLowerCase() === key)?.name;
  const next = current.filter((c) => c.name.toLowerCase() !== key);
  writeLocal(next);

  const userId = await getUserId();
  if (userId && target) {
    try {
      await supabase
        .from('maintenance_categories')
        .delete()
        .eq('user_id', userId)
        .eq('name', target);
    } catch (err) {
      console.warn('Failed to delete category from DB:', err);
    }
  }
  return next;
};

// Rename a custom category. Returns the updated list. No-op if the new
// name collides with another existing category. Note: callers are
// responsible for migrating any maintenance items that referenced the
// old name (see renameCategoryEverywhere in the component layer).
export const renameCustomCategory = async (
  oldName: string,
  newName: string,
  current: CustomCategory[]
): Promise<CustomCategory[]> => {
  const trimmed = (newName || '').trim();
  const oldKey = (oldName || '').trim().toLowerCase();
  if (!trimmed) return current;
  // Allow same name different casing; block real duplicates.
  const collides = current.some(
    (c) => c.name.toLowerCase() === trimmed.toLowerCase() && c.name.toLowerCase() !== oldKey
  );
  if (collides || DEFAULT_CATEGORIES.some((c) => c.toLowerCase() === trimmed.toLowerCase())) {
    return current;
  }
  const target = current.find((c) => c.name.toLowerCase() === oldKey)?.name;
  const next = current.map((c) =>
    c.name.toLowerCase() === oldKey ? { ...c, name: trimmed } : c
  );
  writeLocal(next);

  const userId = await getUserId();
  if (userId && target) {
    try {
      await supabase
        .from('maintenance_categories')
        .update({ name: trimmed })
        .eq('user_id', userId)
        .eq('name', target);
    } catch (err) {
      console.warn('Failed to rename category in DB:', err);
    }
  }
  return next;
};
