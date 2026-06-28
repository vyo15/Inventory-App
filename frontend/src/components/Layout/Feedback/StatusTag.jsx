import { Tag } from "antd";

const TONE_COLORS = Object.freeze({
  success: "green",
  info: "blue",
  warning: "orange",
  danger: "red",
  neutral: "default",
  brand: "gold",
  accent: "purple",
});

const StatusTag = ({
  tone = "neutral",
  color,
  label,
  children,
  className = "",
  ...tagProps
}) => (
  <Tag
    {...tagProps}
    className={["ims-status-tag", className].filter(Boolean).join(" ")}
    color={color || TONE_COLORS[tone] || TONE_COLORS.neutral}
  >
    {children ?? label ?? "-"}
  </Tag>
);

export { TONE_COLORS };
export default StatusTag;
