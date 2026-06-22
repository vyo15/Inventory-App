import { forwardRef } from "react";
import { Input, InputNumber, Space } from "antd";

const mergeClassNames = (...values) => values.filter(Boolean).join(" ");

/**
 * Input angka Rupiah berbasis Space.Compact.
 *
 * Komponen ini tetap meneruskan value/onChange ke InputNumber sehingga aman
 * dipakai langsung sebagai child Form.Item tanpa mengubah payload form.
 */
const RupiahInputNumber = forwardRef(({
  className = "",
  inputClassName = "",
  inputStyle,
  prefixWidth = 52,
  style,
  ...inputNumberProps
}, ref) => (
  <Space.Compact
    block
    className={mergeClassNames("ims-rupiah-input", className)}
    style={style}
  >
    <Input
      aria-label="Mata uang Rupiah"
      readOnly
      tabIndex={-1}
      value="Rp"
      style={{
        width: prefixWidth,
        flex: `0 0 ${prefixWidth}px`,
        pointerEvents: "none",
        textAlign: "center",
      }}
    />
    <InputNumber
      ref={ref}
      {...inputNumberProps}
      className={mergeClassNames("ims-rupiah-input__number", inputClassName)}
      style={{ width: "100%", ...inputStyle }}
    />
  </Space.Compact>
));

RupiahInputNumber.displayName = "RupiahInputNumber";

export default RupiahInputNumber;
