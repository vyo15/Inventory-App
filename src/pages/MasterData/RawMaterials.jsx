import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Col,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Row,
  Select,
  Space,
  Statistic,
  Switch,
  Table,
  Tag,
  Typography,
  message,
} from 'antd';
import {
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase';
import { formatNumberID } from '../../utils/formatters/numberId';
import { formatCurrencyId } from '../../utils/formatters/currencyId';
import {
  createRawMaterial,
  listenRawMaterials,
  RAW_MATERIAL_DEFAULT_FORM,
  removeRawMaterial,
  updateRawMaterial,
} from '../../services/MasterData/rawMaterialsService';
import {
  DEFAULT_RAW_MATERIAL_VARIANT,
  ensureAtLeastOneRawMaterialVariant,
} from '../../utils/variants/rawMaterialVariantHelpers';

const { Option } = Select;
const { Text } = Typography;

const unitOptions = ['pcs', 'meter', 'yard', 'kg', 'gram', 'liter', 'ml', 'roll', 'pack', 'batang'];

const buildFormValues = (record = {}) => ({
  ...RAW_MATERIAL_DEFAULT_FORM,
  ...record,
  hasVariants: record.hasVariants === true,
  variants:
    record.hasVariants === true
      ? ensureAtLeastOneRawMaterialVariant(record.variants || [])
      : [],
});

const integerParser = (value) => value?.replace(/\./g, '') || '';

const RawMaterials = () => {
  const [materials, setMaterials] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [pricingRules, setPricingRules] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [form] = Form.useForm();

  const pricingModeValue = Form.useWatch('pricingMode', form);
  const hasVariantsValue = Form.useWatch('hasVariants', form);
  const variantLabelValue = Form.useWatch('variantLabel', form);
  const watchedVariants = Form.useWatch('variants', form) || [];

  useEffect(() => {
    setLoading(true);

    const unsubMaterials = listenRawMaterials(
      (data) => {
        setMaterials(data);
        setLoading(false);
      },
      (error) => {
        console.error(error);
        message.error('Gagal memuat bahan baku.');
        setLoading(false);
      },
    );

    const unsubSuppliers = onSnapshot(
      collection(db, 'supplierPurchases'),
      (snapshot) => {
        setSuppliers(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
      },
      (error) => {
        console.error(error);
        message.error('Gagal memuat supplier.');
      },
    );

    const unsubPricingRules = onSnapshot(
      collection(db, 'pricing_rules'),
      (snapshot) => {
        setPricingRules(
          snapshot.docs
            .map((d) => ({ id: d.id, ...d.data() }))
            .filter((item) => item?.targetType === 'raw_materials'),
        );
      },
      (error) => {
        console.error(error);
        message.error('Gagal memuat pricing rules.');
      },
    );

    return () => {
      unsubMaterials();
      unsubSuppliers();
      unsubPricingRules();
    };
  }, []);

  const summary = useMemo(() => {
    return {
      total: materials.length,
      withVariants: materials.filter((item) => item.hasVariants).length,
      noVariants: materials.filter((item) => !item.hasVariants).length,
      totalVariants: materials.reduce((sum, item) => sum + Number(item.variantCount || 0), 0),
    };
  }, [materials]);

  const openCreateModal = () => {
    setIsEditing(false);
    setEditingRecord(null);
    form.setFieldsValue(buildFormValues(RAW_MATERIAL_DEFAULT_FORM));
    setModalVisible(true);
  };

  const closeModal = () => {
    setModalVisible(false);
    setSubmitting(false);
    setIsEditing(false);
    setEditingRecord(null);
    form.resetFields();
  };

  const handleEdit = (record) => {
    setIsEditing(true);
    setEditingRecord(record);
    form.setFieldsValue(buildFormValues(record));
    setModalVisible(true);
  };

  const handleDelete = async (id) => {
    try {
      await removeRawMaterial(id);
      message.success('Bahan baku berhasil dihapus.');
    } catch (error) {
      console.error(error);
      message.error('Gagal menghapus bahan baku.');
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);

      if (editingRecord?.id) {
        await updateRawMaterial(editingRecord.id, values, suppliers);
        message.success('Bahan baku berhasil diupdate.');
      } else {
        await createRawMaterial(values, suppliers);
        message.success('Bahan baku berhasil ditambahkan.');
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
      message.error(error?.message || 'Gagal menyimpan bahan baku.');
    } finally {
      setSubmitting(false);
    }
  };

  const variantStats = useMemo(() => {
    if (!Array.isArray(watchedVariants) || watchedVariants.length === 0) {
      return { count: 0, stock: 0 };
    }

    return watchedVariants.reduce(
      (acc, item) => ({
        count: acc.count + (String(item?.name || '').trim() ? 1 : 0),
        stock: acc.stock + Number(item?.currentStock || 0),
      }),
      { count: 0, stock: 0 },
    );
  }, [watchedVariants]);

  const columns = [
    {
      title: 'Nama Bahan Baku',
      dataIndex: 'name',
      key: 'name',
      width: 250,
      render: (value, record) => (
        <Space direction="vertical" size={4}>
          <Text strong>{value || '-'}</Text>
          <Space size={6} wrap>
            <Tag color={record.hasVariants ? 'blue' : 'default'}>
              {record.hasVariants ? 'Pakai Varian' : 'Tanpa Varian'}
            </Tag>
            {record.hasVariants ? (
              <Tag color="purple">
                {formatNumberID(record.variantCount || 0)} varian
              </Tag>
            ) : null}
          </Space>
        </Space>
      ),
    },
    {
      title: 'Satuan',
      dataIndex: 'stockUnit',
      key: 'stockUnit',
      width: 100,
      render: (val) => val || '-',
    },
    {
      title: 'Stok',
      dataIndex: 'stock',
      key: 'stock',
      width: 100,
      render: (val) => formatNumberID(val),
    },
    {
      title: 'Min.',
      dataIndex: 'minStock',
      key: 'minStock',
      width: 100,
      render: (val) => formatNumberID(val),
    },
    {
      title: 'Harga Referensi Restock',
      dataIndex: 'restockReferencePrice',
      key: 'restockReferencePrice',
      width: 190,
      render: (val, record) => `${formatCurrencyId(val)} / ${record.stockUnit || '-'}`,
    },
    {
      title: 'Modal Aktual Rata-rata',
      dataIndex: 'averageActualUnitCost',
      key: 'averageActualUnitCost',
      width: 190,
      render: (val, record) => `${val ? formatCurrencyId(val) : '-'} / ${record.stockUnit || '-'}`,
    },
    {
      title: 'Harga Jual',
      dataIndex: 'sellingPrice',
      key: 'sellingPrice',
      width: 170,
      render: (val, record) => `${formatCurrencyId(val)} / ${record.stockUnit || '-'}`,
    },
    {
      title: 'Varian',
      key: 'variants',
      width: 240,
      render: (_, record) => {
        if (!record.hasVariants) {
          return <Text type="secondary">-</Text>;
        }

        return (
          <Space size={[4, 4]} wrap>
            {(record.variants || []).slice(0, 3).map((variant, index) => (
              <Tag key={`${record.id}-${variant.name}-${index}`}>{variant.name}</Tag>
            ))}
            {(record.variants || []).length > 3 ? (
              <Tag>+{formatNumberID((record.variants || []).length - 3)}</Tag>
            ) : null}
          </Space>
        );
      },
    },
    {
      title: 'Aksi',
      key: 'action',
      width: 140,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
            Edit
          </Button>
          <Popconfirm title="Hapus bahan baku ini?" onConfirm={() => handleDelete(record.id)}>
            <Button danger size="small" icon={<DeleteOutlined />}>
              Hapus
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
        }}
      >
        <div>
          <h2 style={{ margin: 0 }}>Raw Materials</h2>
          <p style={{ margin: '8px 0 0 0', color: '#666' }}>
            Master bahan baku dengan mode item tunggal atau varian opsional agar data tidak menumpuk.
          </p>
        </div>

        <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>
          Tambah Bahan Baku
        </Button>
      </div>

      <Alert
        style={{ marginBottom: 16 }}
        type="info"
        showIcon
        message="Gunakan varian hanya jika bahan memang punya turunan seperti warna, ukuran, atau spesifikasi. Lem atau lakban tetap lebih rapi tanpa varian."
      />

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} md={6}>
          <Card>
            <Statistic title="Total Bahan Baku" value={materials.length} />
          </Card>
        </Col>
        <Col xs={24} md={6}>
          <Card>
            <Statistic title="Pakai Varian" value={summary.withVariants} />
          </Card>
        </Col>
        <Col xs={24} md={6}>
          <Card>
            <Statistic title="Tanpa Varian" value={summary.noVariants} />
          </Card>
        </Col>
        <Col xs={24} md={6}>
          <Card>
            <Statistic title="Total Varian" value={summary.totalVariants} />
          </Card>
        </Col>
      </Row>

      <Card>
        <Table
          rowKey="id"
          loading={loading}
          dataSource={materials}
          columns={columns}
          pagination={{ pageSize: 10 }}
          scroll={{ x: 1600 }}
        />
      </Card>

      <Modal
        title={isEditing ? 'Edit Bahan Baku' : 'Tambah Bahan Baku'}
        open={modalVisible}
        onCancel={closeModal}
        onOk={handleSubmit}
        okText="Simpan"
        confirmLoading={submitting}
        cancelText="Batal"
        width={960}
        destroyOnHidden
      >
        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item
                name="name"
                label="Nama Bahan Baku"
                rules={[{ required: true, message: 'Nama bahan baku wajib diisi.' }]}
              >
                <Input placeholder="Contoh: Kain Flanel" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="supplierId" label="Supplier">
                <Select allowClear placeholder="Pilih supplier" optionFilterProp="children" showSearch>
                  {(suppliers || []).map((supplier) => (
                    <Option key={supplier.id} value={supplier.id}>
                      {(supplier.item ? `${supplier.item} - ` : '') + (supplier.storeName || '-')}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} md={8}>
              <Form.Item
                name="stockUnit"
                label="Satuan Stok"
                rules={[{ required: true, message: 'Satuan stok wajib dipilih.' }]}
              >
                <Select placeholder="Pilih satuan">
                  {unitOptions.map((unit) => (
                    <Option key={unit} value={unit}>
                      {unit}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="hasVariants" label="Pakai Varian" valuePropName="checked">
                <Switch
                  checkedChildren="Ya"
                  unCheckedChildren="Tidak"
                  onChange={(checked) => {
                    if (checked) {
                      form.setFieldsValue({
                        stock: 0,
                        variants: ensureAtLeastOneRawMaterialVariant(form.getFieldValue('variants') || []),
                      });
                    } else {
                      form.setFieldsValue({
                        variants: [],
                        variantLabel: '',
                      });
                    }
                  }}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="variantLabel" label="Label Varian" extra="Opsional. Contoh: Warna, Ukuran, Spesifikasi">
                <Input disabled={!hasVariantsValue} placeholder="Contoh: Warna" />
              </Form.Item>
            </Col>
          </Row>

          <Card
            size="small"
            title="Aturan Master"
            style={{ marginBottom: 16 }}
          >
            <Alert
              type="info"
              showIcon
              message="Sesuai konsep final: stok berada di variant jika pakai varian, tetapi minimum stok, harga referensi restock, modal aktual rata-rata, dan harga jual tetap disimpan di master bahan baku."
            />
          </Card>

          <Row gutter={16}>
            <Col xs={24} md={8}>
              <Form.Item
                name="stock"
                label={hasVariantsValue ? 'Stok Master (Otomatis)' : 'Stok Awal'}
                extra={
                  hasVariantsValue
                    ? 'Kalau pakai varian, stok master dihitung otomatis dari total semua varian.'
                    : 'Stok awal hanya dipakai untuk item tanpa varian.'
                }
              >
                <InputNumber
                  disabled={hasVariantsValue || isEditing}
                  style={{ width: '100%' }}
                  min={0}
                  precision={0}
                  formatter={(value) => formatNumberID(value)}
                  parser={integerParser}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item
                name="minStock"
                label="Minimum Stok Master"
                rules={[{ required: true, message: 'Minimum stok wajib diisi.' }]}
                extra="Berlaku untuk bahan utama, bukan dipecah per varian."
              >
                <InputNumber
                  style={{ width: '100%' }}
                  min={0}
                  precision={0}
                  formatter={(value) => formatNumberID(value)}
                  parser={integerParser}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item
                name="pricingMode"
                label="Mode Pricing"
                rules={[{ required: true, message: 'Mode pricing wajib dipilih.' }]}
              >
                <Select
                  onChange={(value) => {
                    if (value === 'manual') {
                      form.setFieldsValue({ pricingRuleId: null });
                    }
                  }}
                >
                  <Option value="rule">Rule</Option>
                  <Option value="manual">Manual</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item
                name="restockReferencePrice"
                label="Harga Referensi Restock / Satuan"
                rules={[{ required: true, message: 'Harga referensi restock wajib diisi.' }]}
                extra="Tetap disimpan di master meskipun bahan memakai varian."
              >
                <InputNumber
                  style={{ width: '100%' }}
                  min={0}
                  precision={0}
                  formatter={(value) => formatNumberID(value)}
                  parser={integerParser}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item
                name="averageActualUnitCost"
                label="Modal Aktual Rata-rata / Satuan"
                rules={[{ required: true, message: 'Modal aktual rata-rata wajib diisi.' }]}
                extra="Dipakai sebagai base cost utama untuk pricing raw materials."
              >
                <InputNumber
                  style={{ width: '100%' }}
                  min={0}
                  precision={0}
                  formatter={(value) => formatNumberID(value)}
                  parser={integerParser}
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item
                name="pricingRuleId"
                label="Pricing Rule"
                rules={[
                  {
                    required: pricingModeValue === 'rule',
                    message: 'Pricing rule wajib dipilih untuk mode rule.',
                  },
                ]}
              >
                <Select allowClear disabled={pricingModeValue !== 'rule'} placeholder="Pilih pricing rule">
                  {(pricingRules || []).map((rule) => (
                    <Option key={rule.id} value={rule.id}>
                      {rule.name}
                      {rule?.isActive ? '' : ' (Nonaktif)'}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item
                name="sellingPrice"
                label="Harga Jual / Satuan"
                rules={[{ required: true, message: 'Harga jual wajib diisi.' }]}
                extra="Master price tetap satu agar maintenance harga lebih rapi."
              >
                <InputNumber
                  style={{ width: '100%' }}
                  min={0}
                  precision={0}
                  formatter={(value) => formatNumberID(value)}
                  parser={integerParser}
                />
              </Form.Item>
            </Col>
          </Row>

          {hasVariantsValue ? (
            <>
              <Alert
                style={{ marginBottom: 16 }}
                type="info"
                showIcon
                message={`Gunakan varian untuk ${variantLabelValue || 'turunan bahan'} seperti warna, ukuran, atau spesifikasi lain. Pada tahap ini varian hanya menyimpan identitas dan stok.`}
              />

              <Card
                title={`Daftar ${variantLabelValue || 'Varian'} Bahan`}
                size="small"
                extra={
                  <Button
                    icon={<PlusOutlined />}
                    onClick={() => {
                      const current = form.getFieldValue('variants') || [];
                      form.setFieldsValue({
                        variants: [...current, { ...DEFAULT_RAW_MATERIAL_VARIANT }],
                      });
                    }}
                  >
                    Tambah Varian
                  </Button>
                }
              >
                <Form.List name="variants">
                  {(fields, { remove }) => (
                    <Space direction="vertical" size={12} style={{ width: '100%' }}>
                      {fields.map((field, index) => (
                        <Card
                          key={field.key}
                          size="small"
                          title={`${variantLabelValue || 'Varian'} ${index + 1}`}
                          extra={
                            <Button danger type="text" icon={<DeleteOutlined />} onClick={() => remove(field.name)}>
                              Hapus
                            </Button>
                          }
                        >
                          <Row gutter={12}>
                            <Col xs={24} md={8}>
                              <Form.Item
                                {...field}
                                name={[field.name, 'name']}
                                label={`Nama ${variantLabelValue || 'Varian'}`}
                                rules={[{ required: true, message: 'Nama varian wajib diisi.' }]}
                              >
                                <Input placeholder={variantLabelValue ? `Contoh: ${variantLabelValue} Merah` : 'Contoh: Merah'} />
                              </Form.Item>
                            </Col>
                            <Col xs={24} md={8}>
                              <Form.Item {...field} name={[field.name, 'sku']} label="Kode / SKU Varian">
                                <Input placeholder="Opsional" />
                              </Form.Item>
                            </Col>
                            <Col xs={24} md={8}>
                              <Form.Item {...field} name={[field.name, 'isActive']} label="Aktif" valuePropName="checked">
                                <Switch checkedChildren="Aktif" unCheckedChildren="Nonaktif" />
                              </Form.Item>
                            </Col>
                          </Row>
                          <Row gutter={12}>
                            <Col xs={24} md={12}>
                              <Form.Item {...field} name={[field.name, 'currentStock']} label="Stok Varian">
                                <InputNumber
                                  style={{ width: '100%' }}
                                  min={0}
                                  precision={0}
                                  formatter={(value) => formatNumberID(value)}
                                  parser={integerParser}
                                />
                              </Form.Item>
                            </Col>
                            <Col xs={24} md={12}>
                              <Form.Item {...field} name={[field.name, 'reservedStock']} label="Reserved Stock" hidden>
                                <InputNumber style={{ width: '100%' }} min={0} precision={0} />
                              </Form.Item>
                              <Alert
                                type="warning"
                                showIcon
                                message="Harga dan minimum stok tidak diisi di sini. Semua kontrol nilai tetap dikelola dari master bahan baku."
                              />
                            </Col>
                          </Row>
                        </Card>
                      ))}
                    </Space>
                  )}
                </Form.List>
              </Card>

              <Alert
                style={{ marginTop: 16 }}
                type="success"
                showIcon
                message={`Ringkasan varian: ${formatNumberID(variantStats.count)} varian | total stok ${formatNumberID(variantStats.stock)}`}
              />
            </>
          ) : null}

          <Alert
            style={{ marginTop: 16 }}
            type="warning"
            showIcon
            message="Mode varian dipakai hanya kalau memang perlu. Kalau item sederhana seperti lem, lakban, atau bahan tanpa turunan, tetap lebih rapi tanpa varian."
          />
        </Form>
      </Modal>
    </div>
  );
};

export default RawMaterials;
