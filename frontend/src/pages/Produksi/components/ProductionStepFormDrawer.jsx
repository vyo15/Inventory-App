import {
  Button,
  Col,
  Divider,
  Drawer,
  Form,
  Input,
  InputNumber,
  Row,
  Select,
  Space,
  Switch,
  Typography,
} from "antd";
import InfoPopoverButton from "../../../components/Layout/Feedback/InfoPopoverButton";
import {
  DEFAULT_PRODUCTION_STEP_FORM,
  PRODUCTION_STEP_BASIS_TYPES,
  PRODUCTION_STEP_MONITORING_METRICS,
  PRODUCTION_STEP_PAYROLL_MODES,
  PRODUCTION_STEP_PROCESS_TYPES,
  formatProductionStepPayrollPreview,
} from "../../../constants/productionStepOptions";
import { parseIntegerIdInput } from "../../../utils/formatters/numberId";

const ProductionStepFormDrawer = ({
  editingStep,
  form,
  formVisible,
  handleSubmit,
  resetFormState,
  setFormVisible,
  submitting,
}) => (
      <Drawer
        title={editingStep?.id ? "Edit Step Produksi" : "Tambah Step Produksi"}
        open={formVisible}
        onClose={() => {
          setFormVisible(false);
          resetFormState();
        }}
        width={520}
        destroyOnClose
        extra={
          <Space>
            <Button
              onClick={() => {
                setFormVisible(false);
                resetFormState();
              }}
            >
              Batal
            </Button>
            <Button type="primary" loading={submitting} onClick={handleSubmit}>
              Simpan
            </Button>
          </Space>
        }
      >
        <Form form={form} layout="vertical" initialValues={{ ...DEFAULT_PRODUCTION_STEP_FORM, isActive: true }}>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
            <InfoPopoverButton
              label="Panduan Step"
              title="Cara menyusun Tahapan Produksi"
              description="Buat satu step untuk satu proses kerja nyata. Gunakan nama yang universal agar step dapat dipakai lintas jenis bunga."
              items={[
                { key: "bom", label: "BOM", value: "Menentukan proses yang dijalankan oleh satu resep produksi." },
                { key: "work-log", label: "Work Log", value: "Mencatat realisasi operator, hasil, dan penyelesaian proses." },
                { key: "payroll", label: "Upah", value: "Tarif step dibaca saat Work Log selesai." },
                { key: "naming", label: "Penamaan", value: "Gunakan nama proses, bukan nama produk atau jenis bunga tertentu." },
              ]}
            />
          </div>
          {/* =====================================================
          SECTION: Production Step internal code hidden from main UI — AKTIF
          Fungsi:
          - Form Production Step tidak menampilkan input kode utama agar user fokus pada nama step, kategori, deskripsi, urutan, payroll rule, dan status.

          Dipakai oleh:
          - Drawer form ProductionSteps dan productionStepsService sebagai pembuat kode internal.

          Alasan perubahan:
          - Kode STP tetap dibuat otomatis oleh service, tetapi tidak perlu menjadi input utama konfigurasi step.

          Catatan cleanup:
          - Kode internal tetap dipakai untuk relasi/audit teknis, tetapi tidak ditampilkan sebagai informasi utama UI.

          Risiko:
          - Jangan mengubah relasi employee-worklog saat menyembunyikan kode internal.
          ===================================================== */}
          <Form.Item
            label="Nama Step"
            name="name"
            rules={[{ required: true, message: "Nama step wajib diisi" }]}
          >
            <Input placeholder="Contoh: Potong Bahan Dasar" />
          </Form.Item>

          <Form.Item
            label="Kategori"
            name="processType"
            tooltip="Menentukan arah perubahan hasil proses, bukan jenis bunga yang sedang dibuat."
            rules={[{ required: true, message: "Kategori step wajib dipilih" }]}
          >
            <Select options={PRODUCTION_STEP_PROCESS_TYPES} placeholder="Pilih kategori step" />
          </Form.Item>

          <Form.Item label="Fungsi / Deskripsi" name="description">
            <Input.TextArea autoSize={{ minRows: 2, maxRows: 4 }} placeholder="Jelaskan fungsi step ini secara singkat" />
          </Form.Item>

          <Form.Item
            label="Cara Kerja Step"
            name="basisType"
            tooltip="Menentukan satuan aktivitas proses. Nilai ini berbeda dari Mode Bayar pada aturan upah."
            rules={[{ required: true, message: "Cara kerja step wajib dipilih" }]}
          >
            <Select options={PRODUCTION_STEP_BASIS_TYPES} placeholder="Pilih cara kerja step" />
          </Form.Item>

          <Form.Item
            label="Monitoring Profil Produksi"
            name="monitoringMetric"
            tooltip="Opsional. Pilih jenis hasil hanya jika step memakai Production Profile. Sistem tidak lagi menebak dari nama step."
          >
            <Select options={PRODUCTION_STEP_MONITORING_METRICS} />
          </Form.Item>

          <Divider orientation="left">Aturan Upah Produksi</Divider>

          <Row gutter={12}>
            <Col xs={24} md={12}>
              <Form.Item
                label="Mode Bayar"
                name="payrollMode"
                tooltip="Pilih tarif per qty hasil atau satu kali untuk setiap batch Work Log."
              >
                <Select options={PRODUCTION_STEP_PAYROLL_MODES} placeholder="Pilih mode bayar" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item
                label="Tarif Upah"
                name="payrollRate"
                tooltip="Tarif operator yang dibaca saat Work Log selesai. Payroll final tetap berasal dari Work Log completed."
              >
                <InputNumber min={0} step={1} precision={0} parser={parseIntegerIdInput} style={{ width: "100%" }} placeholder="Contoh: 2000" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            noStyle
            shouldUpdate={(previousValues, currentValues) =>
              previousValues.payrollMode !== currentValues.payrollMode ||
              previousValues.payrollRate !== currentValues.payrollRate
            }
          >
            {({ getFieldsValue }) => (
              <Typography.Text
                type="secondary"
                style={{ display: "block", marginTop: -8, marginBottom: 16 }}
              >
                Ringkasan upah: {formatProductionStepPayrollPreview(getFieldsValue())}
              </Typography.Text>
            )}
          </Form.Item>

          <Form.Item label="Status Aktif" name="isActive" valuePropName="checked">
            <Switch checkedChildren="Aktif" unCheckedChildren="Nonaktif" />
          </Form.Item>
        </Form>
      </Drawer>
);

export default ProductionStepFormDrawer;
