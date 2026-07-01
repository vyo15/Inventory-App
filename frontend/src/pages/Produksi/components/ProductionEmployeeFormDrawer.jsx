import {
  Button,
  Card,
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
  DEFAULT_PRODUCTION_EMPLOYEE_FORM,
  PRODUCTION_EMPLOYEE_CUSTOM_PAYROLL_MODES,
  PRODUCTION_EMPLOYEE_EMPLOYMENT_TYPES,
  PRODUCTION_EMPLOYEE_GENDERS,
  PRODUCTION_EMPLOYEE_PAYROLL_OUTPUT_BASIS,
  PRODUCTION_EMPLOYEE_ROLES,
  formatEmployeePayrollPreview,
} from "../../../constants/productionEmployeeOptions";
import { parseIntegerIdInput } from "../../../utils/formatters/numberId";

const ArchivedPerQtyField = ({ children, label, name, requiredMessage }) => (
  <Form.Item
    noStyle
    shouldUpdate={(previous, next) =>
      previous.customPayrollMode !== next.customPayrollMode
      || previous.useCustomPayrollRate !== next.useCustomPayrollRate
    }
  >
    {({ getFieldValue }) => {
      const isRequired = getFieldValue("useCustomPayrollRate")
        && getFieldValue("customPayrollMode") === "per_qty";

      return (
        <Form.Item
          label={label}
          name={name}
          rules={isRequired ? [{ required: true, message: requiredMessage }] : []}
        >
          {children}
        </Form.Item>
      );
    }}
  </Form.Item>
);

const ProductionEmployeeFormDrawer = ({
  editingEmployee,
  employeeCodeLoading,
  form,
  formVisible,
  handleSubmit,
  resetFormState,
  setFormVisible,
  stepOptions,
  submitting,
}) => (
      <Drawer
        title={
          editingEmployee?.id
            ? "Edit Karyawan Produksi"
            : "Tambah Karyawan Produksi"
        }
        open={formVisible}
        onClose={() => {
          setFormVisible(false);
          resetFormState();
        }}
        width={760}
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
            <Button
              type="primary"
              loading={submitting}
              disabled={!editingEmployee?.id && employeeCodeLoading}
              onClick={handleSubmit}
            >
              Simpan
            </Button>
          </Space>
        }
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={DEFAULT_PRODUCTION_EMPLOYEE_FORM}
        >
          <Divider orientation="left">Informasi Dasar</Divider>

          <Row gutter={16}>
            <Col xs={24} md={8}>
              <Form.Item
                label="Kode Karyawan"
                name="code"
                extra={
                  editingEmployee?.id
                    ? "Kode lama dipertahankan saat edit agar relasi Work Log/Payroll existing tetap aman."
                    : "Kode dibuat otomatis dengan format DDMMYYYY-XXX dan dikunci ulang saat simpan."
                }
                rules={[{ required: true, message: "Kode wajib digenerate" }]}
              >
                <Input
                  disabled
                  placeholder={
                    employeeCodeLoading ? "Membuat kode otomatis..." : "Contoh: 25042026-001"
                  }
                />
              </Form.Item>
            </Col>

            <Col xs={24} md={16}>
              <Form.Item
                label="Nama Karyawan"
                name="name"
                rules={[{ required: true, message: "Nama wajib diisi" }]}
              >
                <Input placeholder="Contoh: Ani" />
              </Form.Item>
            </Col>

            <Col xs={24} md={8}>
              <Form.Item label="Gender" name="gender">
                <Select options={PRODUCTION_EMPLOYEE_GENDERS} />
              </Form.Item>
            </Col>

            <Col xs={24} md={8}>
              <Form.Item label="No. HP" name="phone">
                <Input placeholder="08xxxxxxxxxx" />
              </Form.Item>
            </Col>

            <Col xs={24} md={8}>
              <Form.Item
                label="Status Aktif"
                name="isActive"
                valuePropName="checked"
              >
                <Switch disabled />
              </Form.Item>
            </Col>

            <Col xs={24}>
              <Form.Item label="Alamat" name="address">
                <Input.TextArea rows={2} placeholder="Alamat..." />
              </Form.Item>
            </Col>
          </Row>

          <Divider orientation="left">Informasi Kerja</Divider>

          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item
                label="Jenis Kerja"
                name="employmentType"
                rules={[
                  { required: true, message: "Jenis kerja wajib dipilih" },
                ]}
              >
                <Select options={PRODUCTION_EMPLOYEE_EMPLOYMENT_TYPES} />
              </Form.Item>
            </Col>

            <Col xs={24} md={12}>
              <Form.Item
                label="Role"
                name="role"
                rules={[{ required: true, message: "Role wajib dipilih" }]}
              >
                <Select options={PRODUCTION_EMPLOYEE_ROLES} />
              </Form.Item>
            </Col>

            <Col xs={24}>
              <Form.Item label="Skill Tags" name="skillTags">
                <Select
                  mode="tags"
                  placeholder="Contoh: potong, rakit, senior"
                  tokenSeparators={[","]}
                />
              </Form.Item>
            </Col>
          </Row>

          <Divider orientation="left">Assignment Tahapan Produksi</Divider>

          <Row gutter={16}>
            <Col xs={24}>
              <Form.Item
                label="Tahapan yang Bisa Dikerjakan"
                name="assignedStepIds"
              >
                <Select
                  mode="multiple"
                  placeholder="Pilih tahapan produksi..."
                  optionFilterProp="label"
                  options={stepOptions.map((step) => ({
                    value: step.id,
                    label: step.name || "-",
                  }))}
                />
              </Form.Item>
            </Col>
          </Row>

          <Divider orientation="left">Preferensi Payroll Arsip</Divider>

          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
            <InfoPopoverButton
              label="Info Arsip Payroll"
              title="Status pengaturan payroll karyawan"
              description="Payroll final mengikuti rule pada menu Tahapan Produksi. Pengaturan custom payroll karyawan hanya dipertahankan sebagai arsip audit."
              items={[
                { key: "source", label: "Payroll baru", value: "Dibuat dari Tahapan Produksi dan Work Log completed." },
                { key: "archive", label: "Field di bawah", value: "Read-only dan tidak dipakai untuk generate payroll baru." },
              ]}
            />
          </div>

          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item
                label="Gunakan Tarif Custom"
                name="useCustomPayrollRate"
                valuePropName="checked"
              >
                <Switch disabled />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item shouldUpdate noStyle>
            {({ getFieldValue }) => {
              const useCustomPayrollRate = getFieldValue(
                "useCustomPayrollRate",
              );

              return (
                <Row gutter={16}>
                  <Col xs={24} md={8}>
                    <Form.Item
                      label="Mode Payroll Custom (Arsip)"
                      name="customPayrollMode"
                      rules={
                        useCustomPayrollRate
                          ? [
                              {
                                required: true,
                                message: "Mode payroll custom wajib dipilih",
                              },
                            ]
                          : []
                      }
                    >
                      <Select
                        options={PRODUCTION_EMPLOYEE_CUSTOM_PAYROLL_MODES}
                        disabled
                      />
                    </Form.Item>
                  </Col>

                  <Col xs={24} md={8}>
                    <Form.Item label="Tarif Custom (Arsip)" name="customPayrollRate">
                      <InputNumber
                        min={0} step={1} precision={0} parser={parseIntegerIdInput}
                        style={{ width: "100%" }}
                        disabled
                      />
                    </Form.Item>
                  </Col>

                  <Col xs={24} md={8}>
                    <ArchivedPerQtyField
                      label="Basis Qty Custom (Arsip)"
                      name="customPayrollQtyBase"
                      requiredMessage="Basis qty custom wajib diisi"
                    >
                      <InputNumber
                        min={1}
                        step={1}
                        precision={0}
                        parser={parseIntegerIdInput}
                        style={{ width: "100%" }}
                        disabled
                      />
                    </ArchivedPerQtyField>
                  </Col>

                  <Col xs={24} md={12}>
                    <ArchivedPerQtyField
                      label="Basis Output Payroll Custom (Arsip)"
                      name="customPayrollOutputBasis"
                      requiredMessage="Basis output wajib dipilih"
                    >
                      <Select
                        options={PRODUCTION_EMPLOYEE_PAYROLL_OUTPUT_BASIS}
                        disabled
                      />
                    </ArchivedPerQtyField>
                  </Col>

                  <Col xs={24} md={12}>
                    <Form.Item shouldUpdate noStyle>
                      {({ getFieldsValue }) => {
                        const values = getFieldsValue();
                        const preview = formatEmployeePayrollPreview(values);

                        return (
                          <Form.Item label="Preview Payroll">
                            <Card size="small">
                              <Typography.Text>{preview}</Typography.Text>
                            </Card>
                          </Form.Item>
                        );
                      }}
                    </Form.Item>
                  </Col>

                  <Col xs={24}>
                    <Form.Item label="Catatan Payroll (Arsip)" name="payrollNotes">
                      <Input.TextArea
                        rows={2}
                        placeholder="Catatan payroll khusus karyawan..."
                        disabled
                      />
                    </Form.Item>
                  </Col>
                </Row>
              );
            }}
          </Form.Item>

          <Divider orientation="left">Catatan Tambahan</Divider>

          <Row gutter={16}>
            <Col xs={24}>
              <Form.Item label="Catatan Internal" name="notes">
                <Input.TextArea rows={3} placeholder="Catatan internal..." />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Drawer>
);

export default ProductionEmployeeFormDrawer;
