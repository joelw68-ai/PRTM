import React, { useEffect, useState } from 'react';
import {
  loadCustomCategories,
  getCategoryColor,
  CustomCategory,
} from '@/data/maintenanceCategories';

// ============================================================
// Shared category color helpers
// ============================================================
// Both the Maintenance page and the Parts screens color-code their
// Category columns/filters using the SAME user-defined maintenance
// category colors. This hook loads the user's custom categories (from
// the DB / local cache) once, and <CategoryDot> / <CategoryBadge>
// render the matching color so the whole app stays visually consistent.

/** Load the user's custom maintenance categories (with colors). */
export const useCustomCategories = (): CustomCategory[] => {
  const [cats, setCats] = useState<CustomCategory[]>([]);
  useEffect(() => {
    let mounted = true;
    loadCustomCategories().then((c) => {
      if (mounted) setCats(c);
    });
    return () => {
      mounted = false;
    };
  }, []);
  return cats;
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
