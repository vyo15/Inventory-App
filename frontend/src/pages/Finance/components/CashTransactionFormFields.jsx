import { DatePicker, Form, Input, Select } from "antd";
import dayjs from "dayjs";
import { formatNumberId, parseIntegerIdInput } from "../../../utils/formatters/numberId";
import RupiahInputNumber from "../../../components/Layout/Forms/RupiahInputNumber";

const CashTransactionFormFields = ({
  typeLabel,
  typeRequiredMessage,
  typePlaceholder = "Pilih Tipe",
  typeOptions = [],
  defaultType,
}) => (
  <>
    <Form.Item
      name="type"
      label={typeLabel}
      rules={[{ required: true, message: typeRequiredMessage }]}
      initialValue={defaultType}
    >
      <Select
        placeholder={typePlaceholder}
        options={typeOptions.map((value) => ({ label: value, value }))}
      />
    </Form.Item>

    <Form.Item
      name="amount"
      label="Jumlah"
      rules={[{ required: true, message: "Harap masukkan jumlah!" }]}
    >
      <RupiahInputNumber
        min={0}
        step={1}
        precision={0}
        inputClassName="ims-filter-control"
        formatter={(value) => formatNumberId(value)}
        parser={parseIntegerIdInput}
      />
    </Form.Item>

    <Form.Item
      name="description"
      label="Deskripsi"
      rules={[{ required: true, message: "Harap masukkan deskripsi!" }]}
    >
      <Input.TextArea rows={3} />
    </Form.Item>

    <Form.Item
      name="date"
      label="Tanggal"
      rules={[{ required: true, message: "Harap pilih tanggal!" }]}
      initialValue={dayjs()}
    >
      <DatePicker className="ims-filter-control" />
    </Form.Item>
  </>
);

export default CashTransactionFormFields;
