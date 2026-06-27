import { describe, expect, it } from 'vitest';
import { CATEGORY_TYPES } from '../../constants/categoryOptions';
import {
  buildCategoryPathLabel,
  buildCategorySelectOptions,
  buildCategoryTree,
  resolveCategoryLabel,
} from './categoryHelpers';

const categories = [
  {
    id: 1,
    name: 'Bouquet',
    type: CATEGORY_TYPES.PRODUCT_FORM,
    parentId: null,
    sortOrder: 1,
    status: 'active',
  },
  {
    id: 2,
    name: 'Bouquet Mini',
    type: CATEGORY_TYPES.PRODUCT_FORM,
    parentId: 1,
    sortOrder: 2,
    status: 'active',
  },
  {
    id: 3,
    name: 'Bunga Tangkai',
    type: CATEGORY_TYPES.PRODUCT_FORM,
    parentId: null,
    sortOrder: 0,
    status: 'active',
  },
  {
    id: 4,
    name: 'Lama',
    type: CATEGORY_TYPES.PRODUCT_FORM,
    parentId: null,
    sortOrder: 3,
    status: 'inactive',
  },
  {
    id: 5,
    name: 'Mawar',
    type: CATEGORY_TYPES.FLOWER_TYPE,
    parentId: null,
    status: 'active',
  },
];

describe('categoryHelpers', () => {
  it('membangun tree per scope dan urutan kategori', () => {
    const tree = buildCategoryTree(categories, CATEGORY_TYPES.PRODUCT_FORM);

    expect(tree.map((item) => item.name)).toEqual(['Bunga Tangkai', 'Bouquet', 'Lama']);
    expect(tree.find((item) => item.id === 1)?.children.map((item) => item.name))
      .toEqual(['Bouquet Mini']);
  });

  it('menampilkan path parent dan child secara konsisten', () => {
    expect(buildCategoryPathLabel(categories[1], categories)).toBe('Bouquet / Bouquet Mini');
    expect(resolveCategoryLabel({ categoryId: 2, categories })).toBe('Bouquet / Bouquet Mini');
  });

  it('menggunakan snapshot legacy lalu fallback jika master tidak ditemukan', () => {
    expect(resolveCategoryLabel({
      categoryId: 'missing',
      categories,
      fallback: 'Kategori Lama',
    })).toBe('Kategori Lama');
    expect(resolveCategoryLabel({ categoryId: '', categories })).toBe('Belum Dikategorikan');
  });

  it('memisahkan scope dan menonaktifkan parent yang memiliki child pada pilihan item', () => {
    const options = buildCategorySelectOptions(categories, CATEGORY_TYPES.PRODUCT_FORM);

    expect(options.map((item) => item.label)).toEqual([
      'Bunga Tangkai',
      'Bouquet',
      'Bouquet / Bouquet Mini',
    ]);
    expect(options.find((item) => item.value === 1)?.disabled).toBe(true);
    expect(options.some((item) => item.label === 'Mawar')).toBe(false);
  });
});
