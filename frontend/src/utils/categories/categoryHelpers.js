import {
  CATEGORY_TYPES,
  CATEGORY_TYPE_MAP,
  CATEGORY_TYPE_OPTIONS,
} from '../../constants/categoryOptions';

const CATEGORY_TYPE_ALIASES = {
  general: CATEGORY_TYPES.PRODUCT_FORM,
  product: CATEGORY_TYPES.PRODUCT_FORM,
  raw_material: CATEGORY_TYPES.RAW_MATERIAL_GROUP,
  semi_finished: CATEGORY_TYPES.SEMI_FINISHED_GROUP,
};

export const normalizeCategoryType = (value = '') => {
  const normalized = String(value || '').trim().toLowerCase();
  return CATEGORY_TYPE_ALIASES[normalized] || normalized || CATEGORY_TYPES.PRODUCT_FORM;
};

export const getCategoryTypeMeta = (type = '') => (
  CATEGORY_TYPE_MAP[normalizeCategoryType(type)] || CATEGORY_TYPE_OPTIONS[0]
);

export const getCategoryById = (categories = [], categoryId = '') => (
  (categories || []).find((item) => String(item.id) === String(categoryId)) || null
);

export const filterCategoriesByType = (
  categories = [],
  type = '',
  { activeOnly = false, rootsOnly = false } = {},
) => (categories || []).filter((item) => {
  const matchesType = normalizeCategoryType(item.type) === normalizeCategoryType(type);
  const matchesStatus = !activeOnly || item.status !== 'inactive';
  const matchesParent = !rootsOnly || !item.parentId;
  return matchesType && matchesStatus && matchesParent;
});

export const buildCategoryPathLabel = (category = {}, categories = []) => {
  if (!category) return '';
  const parent = category.parentId ? getCategoryById(categories, category.parentId) : null;
  return parent ? `${parent.name} / ${category.name}` : String(category.name || '');
};

export const resolveCategoryLabel = ({
  categoryId = '',
  categories = [],
  fallback = '',
  emptyLabel = 'Belum Dikategorikan',
} = {}) => {
  const category = getCategoryById(categories, categoryId);
  return buildCategoryPathLabel(category, categories) || String(fallback || '').trim() || emptyLabel;
};

export const buildCategoryTree = (categories = [], type = '', { includeInactive = true } = {}) => {
  const scoped = filterCategoriesByType(categories, type, { activeOnly: !includeInactive });
  const roots = scoped.filter((item) => !item.parentId);
  const childrenByParent = scoped.reduce((result, item) => {
    if (!item.parentId) return result;
    const key = String(item.parentId);
    if (!result[key]) result[key] = [];
    result[key].push(item);
    return result;
  }, {});
  const sortRecords = (left, right) => (
    Number(left.sortOrder || 0) - Number(right.sortOrder || 0)
    || String(left.name || '').localeCompare(String(right.name || ''))
  );

  return roots.sort(sortRecords).map((root) => ({
    ...root,
    children: (childrenByParent[String(root.id)] || []).sort(sortRecords),
  }));
};

export const buildCategorySelectOptions = (
  categories = [],
  type = '',
  { activeOnly = true, disableParentsWithChildren = true } = {},
) => {
  const tree = buildCategoryTree(categories, type, { includeInactive: !activeOnly });
  return tree.flatMap((root) => {
    const activeChildren = (root.children || []).filter((item) => !activeOnly || item.status !== 'inactive');
    const rootOption = {
      value: root.id,
      label: root.name,
      disabled: disableParentsWithChildren && activeChildren.length > 0,
      isParent: activeChildren.length > 0,
    };
    const childOptions = activeChildren.map((child) => ({
      value: child.id,
      label: `${root.name} / ${child.name}`,
      parentId: root.id,
    }));
    return [rootOption, ...childOptions];
  }).filter((option) => !activeOnly || getCategoryById(categories, option.value)?.status !== 'inactive');
};

export const getCategorySummaryByType = (categories = []) => CATEGORY_TYPE_OPTIONS.map((option) => ({
  ...option,
  count: filterCategoriesByType(categories, option.value, { activeOnly: true }).length,
}));
