import { Tooltip } from "antd";

const CompactCell = ({ children, tight = true, align = "start", className = "", style } = {}) => (
  <div
    className={`ims-cell-stack${tight ? " ims-cell-stack-tight" : ""}${className ? ` ${className}` : ""}`}
    style={{ alignItems: align, ...style }}
  >
    {children}
  </div>
);

export const CompactCellText = ({
  children,
  value,
  fallback = "-",
  strong = false,
  secondary = false,
  caption = false,
  ellipsis = true,
  tooltip = true,
  maxWidth = "100%",
  className = "",
  style,
} = {}) => {
  const rawValue = value ?? children;
  const text = rawValue === undefined || rawValue === null || rawValue === ""
    ? fallback
    : String(rawValue);
  const typeClass = caption
    ? "ims-cell-caption"
    : secondary
      ? "ims-cell-meta"
      : strong
        ? "ims-cell-title"
        : "";
  const content = (
    <span
      className={`${typeClass}${ellipsis ? " ims-cell-text-ellipsis" : ""}${className ? ` ${className}` : ""}`}
      style={{ maxWidth, fontWeight: strong ? 600 : undefined, ...style }}
    >
      {text}
    </span>
  );

  return tooltip && ellipsis ? <Tooltip title={text}>{content}</Tooltip> : content;
};

export default CompactCell;
