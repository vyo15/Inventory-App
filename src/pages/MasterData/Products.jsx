import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Col,
  Descriptions,
  Divider,
  Drawer,
  Form,
  Input,
  InputNumber,
  message,
  Popconfirm,
  Row,
  Select,
  Space,
  Statistic,
  Switch,
  Table,
  Tag,
  Typography,
} from 'antd';
import {
  EditOutlined,
  EyeOutlined,
  PlusOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase';
import { formatNumberID } from '../../utils/formatters/numberId';
import { formatCurrencyId } from '../../utils/formatters/currencyId';
import { formatDateId } from '../../utils/formatters/dateId';
import {
  COLOR_VARIANT_MAP,
  COLOR_VARIANT_OPTIONS,
  DEFAULT_COLOR_VARIANT,
  ensureAtLeastOneVariant,
} from '../../utils/variants/variantHelpers';
import {
  createProduct,
  listenProducts,
  PRODUCT_DEFAULT_FORM,
  toggleProductActive,
  updateProduct,
} from '../../services/MasterData/productsService';

const { Text } = Typography;
const { TextArea } = Input;

const PRICING_MODE_TAGS = {
  manual: <Tag color="orange">Manual</Tag>,
  rule: <Tag color="green">Rule</Tag>,
};

const buildFormValues = (record = {}) => ({
  ...PRODUCT_DEFAULT_FORM,
  ...record,
  variants: ensureAtLeastOneVariant(record.variants || []),
});

const Products = () => {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [pricingRules, setPricingRules] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [detailVisible, setDetailVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [form] = Form.useForm();

  const pricingModeValue = Form.useWatch('pricingMode', form);
  const watchedVariants = Form.useWatch('variants', form) || [];

  useEffect(() => {
    setLoading(true);

    const unsubProducts = listenProducts(
      (data) => {
        setProducts(data);
        setLoading(false);
      },
      (error) => {
        console.error(error);
        message.error('Gagal memuat produk.');
        setLoading(false);
      },
    );

    const unsubCategories = onSnapshot(
      collection(db, 'categories'),
      (snapshot) => {
        setCategories(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
      },
      (error) => {
        console.error(error);
        message.error('Gagal memuat kategori.');
      },
    );

    const unsubPricingRules = onSnapshot(
      collection(db, 'pricing_rules'),
      (snapshot) => {
        setPricingRules(
          snapshot.docs
            .map((item) => ({ id: item.id, ...item.data() }))
            .filter((item) => item?.targetType === 'products'),
        );
      },
      (error) => {
        console.error(error);
        message.error('Gagal memuat pricing rules.');
      },
    );

    return () => {
      unsubProducts();
      unsubCategories();
      unsubPricingRules();
    };
  }, []);

  const pricingRuleMap = useMemo(() => {
    return pricingRules.reduce((acc, item) => {
      acc[item.id] = item.name;
      return acc;
    }, {});
  }, [pricingRules]);

  const summary = useMemo(() => {
    return {
      total: products.length,
      active: products.filter((item) => item.isActive !== false).length,
      inactive: products.filter((item) => item.isActive === false).length,
      totalVariants: products.reduce((sum, item) => sum + Number(item.variantCount || 0), 0),
    };
  }, [products]);

  const openCreateModal = () => {
    setEditingProduct(null);
    form.setFieldsValue(buildFormValues(PRODUCT_DEFAULT_FORM));
    setModalVisible(true);
  };

  const closeModal = () => {
    setModalVisible(false);
    setSubmitting(false);
    setEditingProduct(null);
    form.resetFields();
  };

  const handleEdit = (record) => {
    setEditingProduct(record);
    form.setFieldsValue(buildFormValues(record));
    setModalVisible(true);
  };

  const handleViewDetail = (record) => {
    setSelectedProduct(record);
    setDetailVisible(true);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);

      if (editingProduct?.id) {
        await updateProduct(editingProduct.id, values, categories);
        message.success('Produk berhasil diupdate.');
      } else {
        await createProduct(values, categories);
        message.success('Produk berhasil ditambahkan.');
      }

      closeModal();
    } catch (error) {
      if (error?.errorFields) return;
      if (error?.type === 'validation' && error?.errors) {
        form.setFields(
          Object.entries(error.errors).map(([name, err]) => ({
            name,
            errors: [err],
          })),
        );
        return;
      }

      console.error(error);
      message.error(error?.message || 'Gagal menyimpan produk.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (record) => {
    try {
      await toggleProductActive(record.id, !(record.isActive !== false));
      message.success(record.isActive !== false ? 'Produk dinonaktifkan.' : 'Produk diaktifkan kembali.');
    } catch (error) {
      console.error(error);
      message.error('Gagal mengubah status produk.');
    }
  };

  const columns = [
    {
      title: 'Nama Produk',
      dataIndex: 'name',
      key: 'name',
      width: 220,
      render: (value, record) => (
        <Space direction="vertical" size={0}>
          <Text strong>{value || '-'}</Text>
          <Text type="secondary">{record.category || 'Produk Jadi'}</Text>
        </Space>
      ),
    },
    {
      title: 'Varian',
      key: 'variants',
      width: 220,
      render: (_, record) => (
        <Space wrap>
          {(record.variants || []).length > 0
            ? record.variants.map((variant) => (
                <Tag key={`${record.id}-${variant.color}`}>
                  {COLOR_VARIANT_MAP[variant.color] || variant.color}
                </Tag>
              ))
            : <Text type="secondary">-</Text>}
        </Space>
      ),
    },
    {
      title: 'Stok Total',
      dataIndex: 'stock',
      key: 'stock',
      width: 110,
      render: (value) => formatNumberID(value),
    },
    {
      title: 'Harga Jual',
      dataIndex: 'price',
      key: 'price',
      width: 140,
      render: (value) => formatCurrencyId(value),
    },
    {
      title: 'HPP / Unit',
      dataIndex: 'hppPerUnit',
      key: 'hppPerUnit',
      width: 140,
      render: (value) => formatCurrencyId(value),
    },
    {
      title: 'Pricing',
      key: 'pricing',
      width: 180,
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          {PRICING_MODE_TAGS[record.pricingMode || 'rule']}
          <Text type="secondary">{pricingRuleMap[record.pricingRuleId] || '-'}</Text>
        </Space>
      ),
    },
    {
      title: 'Status',
      key: 'status',
      width: 120,
      render: (_, record) => (
        <Tag color={record.isActive === false ? 'default' : 'green'}>
          {record.isActive === false ? 'Nonaktif' : 'Aktif'}
        </Tag>
      ),
    },
    {
      title: 'Aksi',
      key: 'actions',
      width: 210,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button size="small" icon={<EyeOutlined />} onClick={() => handleViewDetail(record)}>
            Detail
          </Button>
          <Button size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
            Edit
          </Button>
          <Popconfirm
            title={record.isActive === false ? 'Aktifkan kembali produk?' : 'Nonaktifkan produk?'}
            okText="Ya"
            cancelText="Batal"
            onConfirm={() => handleToggleActive(record)}
          >
            <Button size="small">{record.isActive === false ? 'Aktifkan' : 'Nonaktifkan'}</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <div>
          <h2 style={{ margin: 0 }}>Products</h2>
          <p style={{ margin: '8px 0 0', color: '#666' }}>
            Master produk jadi dengan harga di master dan stok per varian warna.
          </p>
        </div>

        <Space>
          <Button icon={<ReloadOutlined />} onClick={() => window.location.reload()}>
            Refresh
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>
            Tambah Produk
          </Button>
        </Space>
      </div>

      <Alert
        showIcon
        type="info"
        style={{ marginBottom: 16 }}
        message="Nama produk tidak perlu dipecah per warna. Cukup 1 master produk lalu stok warna dikelola di tabel varian. Hapus permanen disembunyikan agar histori tetap aman."
      />

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} md={6}><Card><Statistic title="Total Produk" value={summary.total} /></Card></Col>
        <Col xs={24} md={6}><Card><Statistic title="Produk Aktif" value={summary.active} /></Card></Col>
        <Col xs={24} md={6}><Card><Statistic title="Produk Nonaktif" value={summary.inactive} /></Card></Col>
        <Col xs={24} md={6}><Card><Statistic title="Total Varian" value={summary.totalVariants} /></Card></Col>
      </Row>

      <Card>
        <Table
          rowKey="id"
          loading={loading}
          dataSource={products}
          columns={columns}
          pagination={{ pageSize: 10 }}
          scroll={{ x: 1400 }}
        />
      </Card>

      <Drawer
        title={editingProduct ? 'Edit Produk' : 'Tambah Produk'}
        open={modalVisible}
        onClose={closeModal}
        width={920}
        destroyOnClose
        extra={
          <Space>
            <Button onClick={closeModal}>Batal</Button>
            <Button type="primary" loading={submitting} onClick={handleSubmit}>Simpan</Button>
          </Space>
        }
      >
        <Form form={form} layout="vertical" initialValues={buildFormValues(PRODUCT_DEFAULT_FORM)}>
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item name="name" label="Nama Produk" rules={[{ required: true, message: 'Nama produk wajib diisi.' }]}>
                <Input placeholder="Contoh: Bunga Mawar Flanel" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="categoryId" label="Kategori">
                <Select allowClear placeholder="Pilih kategori" options={(categories || []).map((item) => ({ value: item.id, label: item.name }))} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} md={8}>
              <Form.Item name="hppPerUnit" label="HPP / Unit" rules={[{ required: true, message: 'HPP wajib diisi.' }]}>
                <InputNumber style={{ width: '100%' }} min={0} formatter={(value) => formatNumberID(value)} parser={(value) => String(value || '').replace(/\./g, '')} />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="pricingMode" label="Mode Pricing" rules={[{ required: true, message: 'Mode pricing wajib dipilih.' }]}>
                <Select options={[{ value: 'rule', label: 'Rule' }, { value: 'manual', label: 'Manual' }]} />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="price" label="Harga Jual" rules={[{ required: true, message: 'Harga jual wajib diisi.' }]}>
                <InputNumber style={{ width: '100%' }} min={0} formatter={(value) => formatNumberID(value)} parser={(value) => String(value || '').replace(/\./g, '')} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="pricingRuleId"
            label="Pricing Rule"
            rules={pricingModeValue === 'rule' ? [{ required: true, message: 'Pricing rule wajib dipilih.' }] : []}
          >
            <Select
              allowClear
              disabled={pricingModeValue !== 'rule'}
              placeholder="Pilih pricing rule"
              options={(pricingRules || []).map((item) => ({
                value: item.id,
                label: `${item.name}${item?.isActive ? '' : ' (Nonaktif)'}`,
              }))}
            />
          </Form.Item>

          <Form.Item name="description" label="Deskripsi">
            <TextArea rows={3} placeholder="Catatan produk" />
          </Form.Item>

          <Divider orientation="left">Varian Warna & Stok</Divider>
          <Alert
            type="warning"
            showIcon
            style={{ marginBottom: 16 }}
            message="Harga produk tetap di master. Di bawah ini hanya mengatur warna, stok, minimum stok, dan status varian."
          />

          <Form.List name="variants">
            {(fields, { add, remove }) => (
              <Space direction="vertical" style={{ width: '100%' }} size={12}>
                {fields.map((field) => (
                  <Card key={field.key} size="small">
                    <Row gutter={12}>
                      <Col xs={24} md={5}>
                        <Form.Item {...field} name={[field.name, 'color']} label="Warna" rules={[{ required: true, message: 'Warna wajib dipilih' }]}>
                          <Select options={COLOR_VARIANT_OPTIONS} />
                        </Form.Item>
                      </Col>
                      <Col xs={24} md={4}>
                        <Form.Item {...field} name={[field.name, 'sku']} label="SKU Varian">
                          <Input placeholder="Opsional" />
                        </Form.Item>
                      </Col>
                      <Col xs={24} md={4}>
                        <Form.Item {...field} name={[field.name, 'currentStock']} label="Stok" initialValue={0}>
                          <InputNumber style={{ width: '100%' }} min={0} />
                        </Form.Item>
                      </Col>
                      <Col xs={24} md={4}>
                        <Form.Item {...field} name={[field.name, 'reservedStock']} label="Reserved" initialValue={0}>
                          <InputNumber style={{ width: '100%' }} min={0} />
                        </Form.Item>
                      </Col>
                      <Col xs={24} md={4}>
                        <Form.Item {...field} name={[field.name, 'minStockAlert']} label="Min Stok" initialValue={0}>
                          <InputNumber style={{ width: '100%' }} min={0} />
                        </Form.Item>
                      </Col>
                      <Col xs={24} md={2}>
                        <Form.Item {...field} name={[field.name, 'isActive']} label="Aktif" valuePropName="checked" initialValue>
                          <Switch />
                        </Form.Item>
                      </Col>
                      <Col xs={24} md={1}>
                        <Button danger style={{ marginTop: 30 }} disabled={fields.length === 1} onClick={() => remove(field.name)}>
                          X
                        </Button>
                      </Col>
                    </Row>
                  </Card>
                ))}

                <Button type="dashed" onClick={() => add({ ...DEFAULT_COLOR_VARIANT })} block>
                  Tambah Varian Warna
                </Button>
              </Space>
            )}
          </Form.List>

          <Divider />
          <Card size="small">
            <Row gutter={16}>
              <Col xs={24} md={8}><Statistic title="Jumlah Varian" value={watchedVariants.length} /></Col>
              <Col xs={24} md={8}><Statistic title="Stok Total" value={watchedVariants.reduce((sum, item) => sum + Number(item?.currentStock || 0), 0)} formatter={(value) => formatNumberID(value)} /></Col>
              <Col xs={24} md={8}><Statistic title="Reserved Total" value={watchedVariants.reduce((sum, item) => sum + Number(item?.reservedStock || 0), 0)} formatter={(value) => formatNumberID(value)} /></Col>
            </Row>
          </Card>
        </Form>
      </Drawer>

      <Drawer title="Detail Produk" open={detailVisible} onClose={() => setDetailVisible(false)} width={760} destroyOnClose>
        {selectedProduct ? (
          <Space direction="vertical" style={{ width: '100%' }} size={16}>
            <Descriptions bordered column={1} size="small">
              <Descriptions.Item label="Nama Produk">{selectedProduct.name || '-'}</Descriptions.Item>
              <Descriptions.Item label="Kategori">{selectedProduct.category || '-'}</Descriptions.Item>
              <Descriptions.Item label="Harga Jual">{formatCurrencyId(selectedProduct.price)}</Descriptions.Item>
              <Descriptions.Item label="HPP / Unit">{formatCurrencyId(selectedProduct.hppPerUnit)}</Descriptions.Item>
              <Descriptions.Item label="Mode Pricing">{PRICING_MODE_TAGS[selectedProduct.pricingMode || 'rule']}</Descriptions.Item>
              <Descriptions.Item label="Pricing Rule">{pricingRuleMap[selectedProduct.pricingRuleId] || '-'}</Descriptions.Item>
              <Descriptions.Item label="Status">
                <Tag color={selectedProduct.isActive === false ? 'default' : 'green'}>
                  {selectedProduct.isActive === false ? 'Nonaktif' : 'Aktif'}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Update Terakhir">{formatDateId(selectedProduct.updatedAt, true)}</Descriptions.Item>
              <Descriptions.Item label="Deskripsi">{selectedProduct.description || '-'}</Descriptions.Item>
            </Descriptions>

            <Card size="small" title="Varian Warna">
              <Table
                rowKey={(record) => `${selectedProduct.id}-${record.color}`}
                pagination={false}
                dataSource={selectedProduct.variants || []}
                columns={[
                  { title: 'Warna', dataIndex: 'color', render: (value) => COLOR_VARIANT_MAP[value] || value },
                  { title: 'SKU', dataIndex: 'sku', render: (value) => value || '-' },
                  { title: 'Stok', dataIndex: 'currentStock', render: (value) => formatNumberID(value) },
                  { title: 'Reserved', dataIndex: 'reservedStock', render: (value) => formatNumberID(value) },
                  { title: 'Min Stok', dataIndex: 'minStockAlert', render: (value) => formatNumberID(value) },
                  {
                    title: 'Status',
                    dataIndex: 'isActive',
                    render: (value) => <Tag color={value === false ? 'default' : 'green'}>{value === false ? 'Nonaktif' : 'Aktif'}</Tag>,
                  },
                ]}
              />
            </Card>
          </Space>
        ) : null}
      </Drawer>
    </div>
  );
};

export default Products;
