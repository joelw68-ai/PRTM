import { supabase } from '@/lib/supabase';

/**
 * Saved filter presets ("Saved Views").
 *
 * A single shared module backing the Parts Inventory, Invoices, and Expenses
 * pages. Each preset stores an arbitrary JSON `filters` blob (the active
 * filter combination for that page) under a user-supplied `name`, scoped by
 * `page`. This is the SINGLE source of truth for reading/writing presets so
 * the three pages stay consistent.
 */

export type FilterPresetPage = 'parts' | 'invoices' | 'expenses';

export interface FilterPreset {
  id: string;
  user_id: string | null;
  page: FilterPresetPage;
  name: string;
  filters: Record<string, any>;
  created_at: string;
  updated_at: string;
}

const getCurrentUserId = async (): Promise<string | null> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    return user?.id || null;
  } catch {
    return null;
  }
};

/** Fetch all saved presets for a given page, newest first. */
export const fetchFilterPresets = async (page: FilterPresetPage): Promise<FilterPreset[]> => {
  const { data, error } = await supabase
    .from('filter_presets')
    .select('*')
    .eq('page', page)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[filterPresets] fetch error:', error.message);
    return [];
  }
  return (data || []) as FilterPreset[];
};

/** Create a new saved preset. Returns the inserted row, or null on error. */
export const saveFilterPreset = async (
  page: FilterPresetPage,
  name: string,
  filters: Record<string, any>
): Promise<FilterPreset | null> => {
  const userId = await getCurrentUserId();
  const payload: Record<string, any> = {
    page,
    name: name.trim(),
    filters,
    updated_at: new Date().toISOString(),
  };
  if (userId) payload.user_id = userId;

  const { data, error } = await supabase
    .from('filter_presets')
    .insert(payload)
    .select()
    .single();

  if (error) {
    console.error('[filterPresets] save error:', error.message);
    return null;
  }
  return data as FilterPreset;
};

/** Delete a saved preset by id. Returns true on success. */
export const deleteFilterPreset = async (id: string): Promise<boolean> => {
  const { error } = await supabase
    .from('filter_presets')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('[filterPresets] delete error:', error.message);
    return false;
  }
  return true;
};
