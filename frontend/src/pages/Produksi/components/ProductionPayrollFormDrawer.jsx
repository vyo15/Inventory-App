import {
  Button,
  Col,
  DatePicker,
  Drawer,
  Form,
  Input,
  InputNumber,
  Row,
  Select,
  Space,
  Typography,
} from "antd";
import dayjs from "dayjs";
import { DEFAULT_PRODUCTION_PAYROLL_FORM } from "../../../constants/productionPayrollOptions";
import formatCurrency from "../../../utils/formatters/currencyId";
import { parseIntegerIdInput } from "../../../utils/formatters/numberId";

const ProductionPayrollFormDrawer = ({
  editingRecord,
  employeeOptions,
  form,
  formVisible,
  handleGenerateFromWorkLog,
  handleSubmit,
  referenceData,
  resetFormState,
  setFormVisible,
  submitting,
  workLogOptions,
}) => (
      <Drawer
        title={
          editingRecord?.id
            ? "Edit Payroll Produksi"
            : "Tambah Payroll Produksi"
        }
        open={formVisible}
        onClose={() => {
          setFormVisible(false);
          resetFormState();
        }}
        width={860}
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
        <Form
          form={form}
          layout="vertical"
          initialValues={{
            ...DEFAULT_PRODUCTION_PAYROLL_FORM,
            payrollDate: dayjs(),
          }}
        >
          <Row gutter={16}>
            <Col xs={24} md={8}>
              <Form.Item
                label="No. Payroll"
                name="payrollNumber"
              >
                <Input placeholder="Otomatis: PAY-DDMMYYYY-001" disabled />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item
                label="Tanggal Payroll"
                name="payrollDate"
                rules={[
                  { required: true, message: "Tanggal payroll wajib diisi" },
                ]}
              >
                <DatePicker style={{ width: "100%" }} format="DD/MM/YYYY" />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Typography.Text type="secondary">
                Draft payroll disarankan diambil dari work log completed.
              </Typography.Text>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} md={16}>
              <Select
                style={{ width: "100%", marginBottom: 16 }}
                showSearch
                optionFilterProp="label"
                placeholder="Pilih work log completed untuk generate draft payroll..."
                options={workLogOptions}
                onChange={handleGenerateFromWorkLog}
              />
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item
                label="Work Log"
                name="workLogId"
                rules={[{ required: true, message: "Work log wajib dipilih" }]}
              >
                <Select
                  showSearch
                  optionFilterProp="label"
                  options={workLogOptions}
                  placeholder="Pilih work log..."
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item label="Karyawan" name="workerId">
                <Select
                  showSearch
                  optionFilterProp="label"
                  options={employeeOptions}
                  placeholder="Pilih karyawan..."
                  onChange={(value) => {
                    const employee = referenceData.employees.find(
                      (item) => item.id === value,
                    );
                    form.setFieldsValue({
                      workerCode: employee?.code || "",
                      workerName: employee?.name || "",
                    });
                  }}
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} md={6}>
              <Form.Item label="Payroll Mode" name="payrollMode">
                <Select
                  options={[
                    { value: "per_qty", label: "Per Qty" },
                    { value: "per_batch", label: "Per Batch" },
                  ]}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={6}>
              <Form.Item label="Payroll Rate" name="payrollRate">
                <InputNumber min={0} step={1} precision={0} parser={parseIntegerIdInput} style={{ width: "100%" }} />
              </Form.Item>
            </Col>
            <Col xs={24} md={6}>
              <Form.Item label="Payroll Qty Base" name="payrollQtyBase">
                <InputNumber min={1} step={1} precision={0} parser={parseIntegerIdInput} style={{ width: "100%" }} />
              </Form.Item>
            </Col>
            <Col xs={24} md={6}>
              <Form.Item label="Output Qty Used" name="outputQtyUsed">
                <InputNumber min={0} step={1} precision={0} parser={parseIntegerIdInput} style={{ width: "100%" }} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} md={4}>
              <Form.Item label="Bonus" name="bonusAmount">
                <InputNumber min={0} step={1} precision={0} parser={parseIntegerIdInput} style={{ width: "100%" }} />
              </Form.Item>
            </Col>
            <Col xs={24} md={4}>
              <Form.Item label="Potongan" name="deductionAmount">
                <InputNumber min={0} step={1} precision={0} parser={parseIntegerIdInput} style={{ width: "100%" }} />
              </Form.Item>
            </Col>
            <Col xs={24} md={4}>
              <Form.Item label="Worked Qty" name="workedQty">
                <InputNumber min={0} step={1} precision={0} parser={parseIntegerIdInput} style={{ width: "100%" }} />
              </Form.Item>
            </Col>
            <Col xs={24} md={4}>
              <Form.Item label="Team Worker Count" name="teamWorkerCount">
                <InputNumber min={1} step={1} precision={0} parser={parseIntegerIdInput} style={{ width: "100%" }} />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item shouldUpdate noStyle>
                {({ getFieldsValue }) => {
                  const values = getFieldsValue();
                  const rate = Number(values.payrollRate || 0);
                  const qtyBase = Number(values.payrollQtyBase || 1);
                  const outputQtyUsed = Number(values.outputQtyUsed || 0);
                  const bonus = Number(values.bonusAmount || 0);
                  const deduction = Number(values.deductionAmount || 0);

                  let amountCalculated = 0;

                  if (values.payrollMode === "per_batch") {
                    const workedQty = Number(values.workedQty || outputQtyUsed || 0);
                    amountCalculated = workedQty * rate;
                  } else {
                    amountCalculated =
                      qtyBase > 0 ? (outputQtyUsed / qtyBase) * rate : 0;
                  }

                  const finalAmount = amountCalculated + bonus - deduction;

                  return (
                    <Form.Item label="Preview Final Amount">
                      <Input value={formatCurrency(finalAmount)} disabled />
                    </Form.Item>
                  );
                }}
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24}>
              <Form.Item label="Catatan Perhitungan" name="calculationNotes">
                <Input.TextArea rows={2} />
              </Form.Item>
            </Col>
            <Col xs={24}>
              <Form.Item label="Catatan Internal" name="notes">
                <Input.TextArea rows={2} />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Drawer>
);

export default ProductionPayrollFormDrawer;
