import React, { useEffect, useState } from 'react';
import {
  loadEffectiveCategoryList,
  loadCustomCategories,
  loadDefaultOverrides,
  getEffectiveDefaults,
  getCategoryColor,
  CustomCategory,
} from '@/data/maintenanceCategories';

// ============================================================
// Shared category color helpers
// ============================================================
// Both the Maintenance page and the Parts screens color-code their
// Category columns/filters using the SAME user-defined maintenance
// category colors. This hook loads the user's effective categories
// (built-in defaults WITH any rename/recolor overrides applied, PLUS
// custom categories) once, and <CategoryDot> / <CategoryBadge> render
// the matching color so the whole app stays visually consistent.

/**
 * Load the user's effective maintenance categories (with colors).
 * Includes built-in default categories (with overrides applied) and any
 * custom categories, so edits to default category colors/names are
 * reflected everywhere they're used.
 */
export const useCustomCategories = (): CustomCategory[] => {
  const [cats, setCats] = useState<CustomCategory[]>([]);
  useEffect(() => {
    let mounted = true;
    loadEffectiveCategoryList().then((c) => {
      if (mounted) setCats(c);
    });
    return () => {
      mounted = false;
    };
  }, []);
  return cats;
};

/**
 * The user's category lists split into the same groups the picker uses,
 * each already in the user's preferred order (with renames/colors applied
 * and hidden built-ins removed):
 *   - general    -> built-in General categories (ordered)
 *   - drivetrain -> built-in Drivetrain categories (ordered)
 *   - customs    -> custom categories (ordered by sort_order)
 *
 * Use this anywhere category <select> dropdowns are rendered so the option
 * ordering is consistent app-wide (Maintenance, Parts Inventory, etc.).
 */
export interface CategoryGroups {
  general: CustomCategory[];
  drivetrain: CustomCategory[];
  customs: CustomCategory[];
}

export const useCategoryGroups = (): CategoryGroups => {
  const [groups, setGroups] = useState<CategoryGroups>({
    general: [],
    drivetrain: [],
    customs: [],
  });
  useEffect(() => {
    let mounted = true;
    Promise.all([loadCustomCategories(), loadDefaultOverrides()]).then(
      ([customs, overrides]) => {
        if (!mounted) return;
        const eff = getEffectiveDefaults(overrides);
        setGroups({ general: eff.general, drivetrain: eff.drivetrain, customs });
      }
    );
    return () => {
      mounted = false;
    };
  }, []);
  return groups;
};



interface CategoryDotProps {
  category: string;
  customCategories: CustomCategory[];
  size?: number;
  className?: string;
}

/** A small colored dot for a category. */
export const CategoryDot: React.FC<CategoryDotProps> = ({
  category,
  customCategories,
  size = 10,
  className = '',
}) => (
  <span
    className={`inline-block rounded-full flex-shrink-0 ${className}`}
    style={{
      width: size,
      height: size,
      backgroundColor: getCategoryColor(category || '', customCategories),
    }}
    title={category}
  />
);

interface CategoryBadgeProps {
  category: string;
  customCategories: CustomCategory[];
  className?: string;
}

/** A pill badge (tinted with the category color) showing the name + dot. */
export const CategoryBadge: React.FC<CategoryBadgeProps> = ({
  category,
  customCategories,
  className = '',
}) => {
  if (!category) {
    return <span className="text-slate-500 text-sm">—</span>;
  }
  const color = getCategoryColor(category, customCategories);
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border ${className}`}
      style={{
        backgroundColor: `${color}22`,
        borderColor: `${color}55`,
        color,
      }}
    >
      <span
        className="w-2 h-2 rounded-full flex-shrink-0"
        style={{ backgroundColor: color }}
      />
      {category}
    </span>
  );
};

export default CategoryBadge;
