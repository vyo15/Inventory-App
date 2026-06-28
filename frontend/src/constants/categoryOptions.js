import categoryContract from "../../../shared/categoryContract.json";

export const CATEGORY_TYPES = Object.freeze({ ...categoryContract.types });

export const CATEGORY_TYPE_OPTIONS = [
  {
    value: CATEGORY_TYPES.PRODUCT_FORM,
    label: 'Bentuk Produk',
    singularLabel: 'Bentuk Produk',
    itemLabel: 'produk',
    description: 'Kelompok bentuk barang jadi, seperti Bouquet atau Bunga Tangkai.',
    createLabel: 'Tambah Bentuk Produk',
    examples: 'Bouquet, Bunga Tangkai, Hampers',
  },
  {
    value: CATEGORY_TYPES.FLOWER_TYPE,
    label: 'Jenis Bunga',
    singularLabel: 'Jenis Bunga',
    itemLabel: 'penggunaan',
    description: 'Jenis bunga yang dipakai pada produk dan komponen produksi.',
    createLabel: 'Tambah Jenis Bunga',
    examples: 'Mawar, Tulip, Melati',
  },
  {
    value: CATEGORY_TYPES.RAW_MATERIAL_GROUP,
    label: 'Kelompok Bahan',
    singularLabel: 'Kelompok Bahan',
    itemLabel: 'bahan',
    description: 'Kelompok bahan baku, bukan satuan pembelian atau varian warna.',
    createLabel: 'Tambah Kelompok Bahan',
    examples: 'Kain Flanel, Kawat, Perekat, Kemasan',
  },
  {
    value: CATEGORY_TYPES.SEMI_FINISHED_GROUP,
    label: 'Kelompok Komponen',
    singularLabel: 'Kelompok Komponen',
    itemLabel: 'komponen',
    description: 'Pengelompokan komponen produksi tanpa mengganti Jenis Komponen pada logic produksi.',
    createLabel: 'Tambah Kelompok Komponen',
    examples: 'Bagian Bunga, Tangkai & Daun, Bunga Rakitan',
  },
];

export const CATEGORY_TYPE_MAP = CATEGORY_TYPE_OPTIONS.reduce((result, option) => {
  result[option.value] = option;
  return result;
}, {});
