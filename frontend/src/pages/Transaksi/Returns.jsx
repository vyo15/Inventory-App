import React, { useEffect, useMemo, useState } from "react";
import {
  Modal,
  Form,
  Select,
  InputNumber,
  DatePicker,
  Input,
  message,
  Tag,
  Tooltip,
} from "antd";
import { PlusOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import PageHeader from "../../components/Layout/Page/PageHeader";
import PageSection from "../../components/Layout/Page/PageSection";
import DataTableView from "../../components/Layout/Table/DataTableView";
import { DataRefreshIndicator, getDataTableEmptyText } from "../../components/Layout/Feedback/DataLoadingState";
import {
  buildVariantOptionsFromItem,
  findVariantByKey,
  getItemStockSnapshot,
  inferHasVariants,
} from "../../utils/variants/variantStockHelpers";
import { formatNumberId, parseIntegerIdInput } from "../../utils/formatters/numberId";
import { resolveDisplayReference } from "../../utils/references/displayReferenceResolver";
import { showFormValidationFeedback } from '../../utils/forms/formValidationFeedback';
import {
  createReturnTransaction,
  listenReturnProducts,
  listenReturnRawMaterials,
  listenReturnRecords,
} from "../../services/Transaksi/returnsService";


// IMS NOTE [AKTIF/GUARDED] - Standar input angka bulat
// Fungsi blok: mengarahkan InputNumber aktif ke step 1, precision 0, dan parser integer Indonesia.
// Hubungan flow: hanya membatasi input/display UI; service calculation stok, kas, HPP, payroll, dan report tidak diubah.
// Alasan logic: IMS operasional memakai angka tanpa desimal, sementara data lama decimal tidak dimigrasi otomatis.
// Behavior: input baru no-decimal; business rules dan schema/database runtime tetap sama.

const { Option } = Select;

// =========================
// SECTION: Returns Page
// =========================
const Returns = () => {
  const [form] = Form.useForm();

  // =========================
  // SECTION: State utama
  // =========================
  const [returnRecords, setReturnRecords] = useState([]);
  const [products, setProducts] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedItemType, setSelectedItemType] = useState("product");

  // =========================
  // SECTION: Submit loading guard
  // AKTIF + GUARDED:
  // - mencegah user menekan Simpan Retur berkali-kali saat transaction masih berjalan;
  // - menjaga satu klik submit tidak membuat double stock atau double inventory log.
  // =========================
  const [isSubmittingReturn, setIsSubmittingReturn] = useState(false);

  const selectedItemId = Form.useWatch("itemId", form);
  const selectedVariantKey = Form.useWatch("variantKey", form);

  // =========================
  // SECTION: Semua item
  // =========================
  const allItems = useMemo(() => {
    return [...products, ...materials];
  }, [products, materials]);

  const selectedItemsByType = selectedItemType === "product" ? products : materials;
  const selectedItem = useMemo(
    () => selectedItemsByType.find((item) => item.id === selectedItemId) || null,
    [selectedItemId, selectedItemsByType],
  );
  const selectedItemHasVariants = inferHasVariants(selectedItem || {});
  const variantOptions = useMemo(
    () => (selectedItemHasVariants ? buildVariantOptionsFromItem(selectedItem) : []),
    [selectedItem, selectedItemHasVariants],
  );
  const selectedVariant = useMemo(
    () => (selectedItemHasVariants ? findVariantByKey(selectedItem, selectedVariantKey) : null),
    [selectedItem, selectedItemHasVariants, selectedVariantKey],
  );

  // =========================
  // SECTION: Live Data Subscription
  // =========================
  useEffect(() => {
    const unsubscribeReturns = listenReturnRecords(
      (nextReturnRecords) => {
        setReturnRecords(nextReturnRecords);
        setLoadError("");
        setIsLoading(false);
      },
      (error) => {
        console.error("Gagal memuat data retur:", error);
        setReturnRecords([]);
        setLoadError("Gagal memuat data retur.");
        setIsLoading(false);
        message.error("Gagal memuat data retur.");
      },
    );

    const unsubscribeProducts = listenReturnProducts(
      (nextProducts) => {
        setProducts(nextProducts);
      },
      (error) => {
        console.error("Gagal memuat produk untuk retur:", error);
        message.error("Gagal memuat produk untuk retur.");
      },
    );

    const unsubscribeMaterials = listenReturnRawMaterials(
      (nextMaterials) => {
        setMaterials(nextMaterials);
      },
      (error) => {
        console.error("Gagal memuat bahan baku untuk retur:", error);
        message.error("Gagal memuat bahan baku untuk retur.");
      },
    );

    return () => {
      unsubscribeReturns();
      unsubscribeProducts();
      unsubscribeMaterials();
    };
  }, []);

  useEffect(() => {
    form.setFieldsValue({ itemId: undefined, variantKey: undefined });
  }, [form, selectedItemType]);

  useEffect(() => {
    form.setFieldsValue({ variantKey: undefined });
  }, [form, selectedItemId]);

  // =========================
  // SECTION: Modal Helpers
  // =========================
  const resetReturnFormState = () => {
    form.resetFields();
    setIsModalOpen(false);
    setSelectedItemType("product");
  };

  const openCreateReturnModal = () => {
    form.resetFields();
    form.setFieldsValue({ date: dayjs(), type: "product" });
    setSelectedItemType("product");
    setIsModalOpen(true);
  };

  // =========================
  // SECTION: Submit Return
  // AKTIF + GUARDED:
  // - flow ini adalah jalur resmi retur yang menambah stok kembali;
  // - dokumen retur, update stok, dan inventory log wajib commit bersama dalam backend SQLite transaction;
  // - tidak memakai addInventoryLog/updateInventoryStock langsung agar tidak ada stok berubah tanpa audit log.
  // DATA LAMA:
  // - flow lama melakukan update stok lebih dulu, lalu addDoc returns, lalu addInventoryLog; jika addDoc/log gagal, stok bisa sudah berubah.
  // AKTIF:
  // - orkestrasi transaction retur sudah dipindah ke returnsService; page hanya mengirim payload form dan menampilkan hasil.
  // =========================
  const handleSubmitReturn = async (values) => {
    if (isSubmittingReturn) return;

    setIsSubmittingReturn(true);

    try {
      await createReturnTransaction({
        values,
        allItems,
      });

      message.success("Retur berhasil ditambahkan!");
      resetReturnFormState();
    } catch (error) {
      console.error(error);
      message.error(error?.message || "Gagal menyimpan retur");
    } finally {
      setIsSubmittingReturn(false);
    }
  };

  // =========================
  // SECTION: Table Columns
  // =========================
  /* =====================================================
     SECTION: Compact Returns Table Columns — AKTIF/GUARDED
     Fungsi:
     - Menampilkan ringkasan retur tanpa horizontal scroll besar.
     Dipakai oleh:
     - Returns main table.
     Alasan perubahan:
     - Tanggal, item/asal, qty retur, dan catatan harus terbaca langsung tanpa mengubah flow stok retur.
     Catatan cleanup:
     - Detail retur bisa dibuat drawer khusus jika audit retur bertambah kompleks.
     Risiko:
     - Jangan mengubah transaction retur, stock-in return, source relation, atau inventory log dari render kolom ini.
     ===================================================== */
  const returnTableColumns = [
    {
      title: "Tanggal / Ref",
      key: "dateReference",
      width: 170,
      render: (_, record) => {
        const dateText = record.date?.toDate ? dayjs(record.date.toDate()).format("DD-MM-YYYY HH:mm") : "-";
        const referenceText = resolveDisplayReference(record, {
          fields: ["returnNumber", "returnCode", "code", "referenceNumber", "sourceRef", "referenceCode"],
          fallback: "Referensi belum tersedia",
          allowTechnicalId: false,
        });
        return (
          <div style={{ minWidth: 0 }}>
            <div className="ims-cell-title">{dateText}</div>
            <Tooltip title={referenceText}>
              <div className="ims-cell-meta" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {referenceText}
              </div>
            </Tooltip>
          </div>
        );
      },
    },
    {
      title: "Item / Asal",
      key: "itemSource",
      width: 270,
      render: (_, record) => {
        const itemName = record.itemName || "-";
        const typeTag = record.type === "product" ? <Tag color="blue">Produk</Tag> : <Tag color="gold">Bahan Baku</Tag>;
        const variantTag = record.variantLabel || record.variantKey ? (
          <Tag color="purple">{record.variantLabel || record.variantKey}</Tag>
        ) : (
          <Tag>Master</Tag>
        );

        return (
          <div style={{ minWidth: 0 }}>
            <Tooltip title={itemName}>
              <div className="ims-cell-title" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {itemName}
              </div>
            </Tooltip>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 4 }}>
              {typeTag}
              {variantTag}
            </div>
          </div>
        );
      },
    },
    {
      title: "Qty Return",
      dataIndex: "quantity",
      key: "quantity",
      width: 130,
      align: "right",
      render: (value, record) => {
        const unit = record.stockUnit || record.unit || "";
        return <strong>{formatNumberId(value)}{unit ? ` ${unit}` : ""}</strong>;
      },
    },
    {
      title: "Alasan / Catatan",
      dataIndex: "note",
      key: "note",
      width: 280,
      render: (value) => {
        const noteText = value || "-";
        return (
          <Tooltip title={noteText}>
            <span style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {noteText}
            </span>
          </Tooltip>
        );
      },
    },
  ];

  const returnMobileCardConfig = {
    title: (record) => resolveDisplayReference(record, {
      fields: ['returnNumber', 'returnCode', 'code', 'referenceNumber', 'sourceRef', 'referenceCode'],
      fallback: 'Referensi belum tersedia',
      allowTechnicalId: false,
    }),
    subtitle: (record) => [
      record.date?.toDate ? dayjs(record.date.toDate()).format('DD-MM-YYYY HH:mm') : '-',
      record.itemName || 'Item tidak tercatat',
    ],
    tags: (record) => [
      <Tag key="item-type" color={record.type === 'product' ? 'blue' : 'gold'}>
        {record.type === 'product' ? 'Produk' : 'Bahan Baku'}
      </Tag>,
      <Tag key="variant" color={record.variantLabel || record.variantKey ? 'purple' : 'default'}>
        {record.variantLabel || record.variantKey || 'Master'}
      </Tag>,
    ],
    meta: [
      { label: 'Qty Return', value: (record) => {
        const unit = record.stockUnit || record.unit || '';
        return `${formatNumberId(record.quantity)}${unit ? ` ${unit}` : ''}`;
      } },
      { label: 'Tanggal', value: (record) => (record.date?.toDate ? dayjs(record.date.toDate()).format('DD-MM-YYYY') : '-') },
    ],
    content: (record) => record.note || '-',
  };

  /* =====================================================
     SECTION: Returns Render Panel — GUARDED
     Fungsi:
     - Menata tabel dan form retur agar tipe item, varian, qty, alasan, dan dampak stok tetap jelas.

     Dipakai oleh:
     - Halaman Returns.

     Alasan perubahan:
     - Batch 3 merapikan microcopy retur tanpa mengubah stock mutation, reference relation, refund/cash logic, atau payload submit.

     Catatan cleanup:
     - Detail retur bisa dibuat drawer audit jika relasi sales/purchase makin kompleks.

     Risiko:
     - Jangan mengubah logic stok kembali, relation transaksi, inventory log, atau validation dari section ini.
     ===================================================== */
  return (
    <>
      <PageHeader
        title="Retur"
        subtitle="Retur dan stok kembali."
        actions={[
          {
            key: "add-return",
            type: "primary",
            icon: <PlusOutlined />,
            label: "Tambah Retur",
            onClick: openCreateReturnModal,
          },
        ]}
      />

      <PageSection
        title="Data Retur"
        subtitle="Stok kembali sesuai item/varian."
      >
        {/* =========================
            SECTION: tabel retur baseline global
            Fungsi:
            - retur tidak punya detail drawer, jadi tabel ringkas fokus ke data inti tanpa aksi tambahan
            - kolom varian memakai schema final dari record retur/log
            Status: aktif / final
        ========================= */}
        <DataRefreshIndicator loading={isLoading} dataSource={returnRecords} />
        <DataTableView
          showRefreshIndicator={false}
          className="app-data-table"
          dataSource={returnRecords}
          columns={returnTableColumns}
          rowKey="id"
          tableLayout="fixed"
          locale={{ emptyText: getDataTableEmptyText(isLoading, loadError || "Belum ada data retur.") }}
          mobileCardConfig={returnMobileCardConfig}
        />
      </PageSection>

      <Modal
        title="Tambah Retur"
        open={isModalOpen}
        onOk={form.submit}
        onCancel={() => {
          if (!isSubmittingReturn) {
            resetReturnFormState();
          }
        }}
        confirmLoading={isSubmittingReturn}
        okButtonProps={{ disabled: isSubmittingReturn }}
        cancelButtonProps={{ disabled: isSubmittingReturn }}
        okText="Simpan"
        cancelText="Batal"
        width={720}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmitReturn}
          onFinishFailed={(errorInfo) => showFormValidationFeedback(errorInfo, { form })}
        >
          <Form.Item
            name="date"
            label="Tanggal"
            rules={[{ required: true, message: "Tanggal wajib diisi" }]}
          >
            <DatePicker style={{ width: "100%" }} />
          </Form.Item>

          <Form.Item
            name="type"
            label="Jenis Item"
            rules={[{ required: true, message: "Jenis wajib dipilih" }]}
          >
            <Select
              placeholder="Pilih jenis item"
              onChange={(value) => setSelectedItemType(value)}
            >
              <Option value="product">Produk</Option>
              <Option value="material">Bahan Baku</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="itemId"
            label="Nama Item"
            rules={[{ required: true, message: "Item wajib dipilih" }]}
          >
            <Select placeholder="Pilih item" showSearch optionFilterProp="children">
              {selectedItemType === "product"
                ? products.map((item) => (
                    <Option key={item.id} value={item.id}>
                      {item.name}
                    </Option>
                  ))
                : materials.map((item) => (
                    <Option key={item.id} value={item.id}>
                      {item.name}
                    </Option>
                  ))}
            </Select>
          </Form.Item>

          {selectedItemHasVariants ? (
            <Form.Item
              name="variantKey"
              label={selectedItem?.variantLabel || "Varian"}
              rules={[{ required: true, message: "Varian wajib dipilih" }]}
              extra="Item bervarian wajib pilih varian."
            >
              <Select placeholder="Pilih varian" showSearch optionFilterProp="children">
                {variantOptions.map((item) => (
                  <Option key={item.value} value={item.value}>
                    {item.label} - Stok: {formatNumberId(item.raw?.currentStock || 0)}
                  </Option>
                ))}
              </Select>
            </Form.Item>
          ) : null}

          {selectedItem ? (
            /* IMS NOTE [AKTIF/GUARDED] - Snapshot stok Returns.
               Fungsi blok: menampilkan stok current/reserved/available item retur sebagai panel read-only pasif.
               Hubungan flow: hanya mengganti tampilan Alert lama; transaction retur, stock revert, inventory log, validasi, dan payload backend SQLite tidak berubah.
               Alasan logic: stok sebelum retur adalah info kontekstual, bukan warning/error, sehingga mengikuti panel clean seperti Purchases/Stock Adjustment.
               Status: AKTIF untuk UI Returns, GUARDED terhadap business rule retur dan stok. */
            <div className="ims-readonly-panel">
              <div className="ims-readonly-panel-header">
                <div>
                  <div className="ims-readonly-panel-title">
                    Stok Item Sebelum Retur
                  </div>
                  <div className="ims-readonly-panel-description">
                    Info stok sebelum retur disimpan.
                  </div>
                </div>
                <Tag color={selectedItemHasVariants ? "purple" : "default"}>
                  {selectedItemHasVariants ? "Varian" : "Master"}
                </Tag>
              </div>

              <div style={{ marginBottom: 10 }}>
                <span className="ims-cell-title">
                  {selectedItem.name || "Item"}
                </span>
                {selectedItemHasVariants ? (
                  <span style={{ color: "var(--ims-text-secondary)" }}>
                    {` — ${selectedVariant?.variantLabel || selectedVariant?.name || "Pilih varian"}`}
                  </span>
                ) : null}
              </div>

              <div className="ims-readonly-stat-grid">
                <div className="ims-readonly-stat-field">
                  <div className="ims-readonly-stat-label">Stok Saat Ini</div>
                  <div className="ims-readonly-stat-value">
                    {formatNumberId((selectedItemHasVariants ? selectedVariant?.currentStock : getItemStockSnapshot(selectedItem).currentStock) || 0)}
                  </div>
                </div>
                <div className="ims-readonly-stat-field">
                  <div className="ims-readonly-stat-label">Stok Tertahan</div>
                  <div className="ims-readonly-stat-value">
                    {formatNumberId((selectedItemHasVariants ? selectedVariant?.reservedStock : getItemStockSnapshot(selectedItem).reservedStock) || 0)}
                  </div>
                </div>
                <div className="ims-readonly-stat-field">
                  <div className="ims-readonly-stat-label">Stok Tersedia</div>
                  <div className="ims-readonly-stat-value">
                    {formatNumberId((selectedItemHasVariants ? selectedVariant?.availableStock : getItemStockSnapshot(selectedItem).availableStock) || 0)}
                  </div>
                </div>
              </div>

              {selectedItemHasVariants ? (
                <div className="ims-readonly-panel-note">
                  Item bervarian wajib memilih varian agar retur masuk ke varian yang benar.
                </div>
              ) : null}
            </div>
          ) : null}

          <Form.Item
            name="quantity"
            label="Jumlah"
            rules={[{ required: true, message: "Jumlah wajib diisi" }]}
          >
            <InputNumber min={1} step={1} precision={0} parser={parseIntegerIdInput} style={{ width: "100%" }} />
          </Form.Item>

          <Form.Item name="note" label="Catatan">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};

export default Returns;
