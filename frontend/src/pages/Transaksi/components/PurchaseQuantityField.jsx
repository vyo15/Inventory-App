import { Form, InputNumber } from "antd";
import { formatNumberId, parseIntegerIdInput } from "../../../utils/formatters/numberId";

const PurchaseQuantityField = ({ extra } = {}) => (
  <Form.Item
    name="quantity"
    label="Qty Beli"
    rules={[{ required: true, message: "Qty wajib diisi" }]}
    extra={extra}
  >
    <InputNumber
      min={1}
      step={1}
      precision={0}
      className="ims-filter-control"
      formatter={(value) => formatNumberId(value)}
      parser={parseIntegerIdInput}
    />
  </Form.Item>
);

export default PurchaseQuantityField;
