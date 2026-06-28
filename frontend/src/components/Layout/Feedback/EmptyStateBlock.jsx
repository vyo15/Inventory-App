import { Button, Empty, Typography } from "antd";
import "./EmptyStateBlock.css";

const { Text, Title } = Typography;

const EmptyStateBlock = ({
  title,
  description = "Data belum tersedia.",
  actionLabel,
  onAction,
  actionType = "primary",
  image = Empty.PRESENTED_IMAGE_SIMPLE,
  compact = false,
  className = "",
  minHeight,
}) => (
  <div
    className={[
      "empty-state-block",
      compact ? "empty-state-block--compact" : "",
      className,
    ].filter(Boolean).join(" ")}
    style={minHeight ? { minHeight } : undefined}
  >
    <Empty
      image={image}
      description={(
        <div className="empty-state-copy">
          {title ? <Title level={5} className="empty-state-title">{title}</Title> : null}
          {description ? <Text className="empty-state-text">{description}</Text> : null}
        </div>
      )}
    >
      {actionLabel && onAction ? (
        <Button type={actionType} onClick={onAction}>{actionLabel}</Button>
      ) : null}
    </Empty>
  </div>
);

export default EmptyStateBlock;
