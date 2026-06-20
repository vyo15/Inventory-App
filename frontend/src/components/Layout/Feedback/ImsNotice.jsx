import React from "react";
import "./ImsNotice.css";

const DEFAULT_ICONS = {
  guidance: "✓",
  info: "i",
  status: "✓",
  guard: "!",
  warning: "!",
  critical: "!",
  danger: "!",
  success: "✓",
  "data-quality": "i",
};

const joinClassNames = (...items) => items.filter(Boolean).join(" ");

const ImsNotice = ({
  variant = "info",
  title,
  description,
  kicker,
  icon,
  actions = [],
  sideItems = [],
  sideLayout = "stack",
  compact = false,
  className = "",
  style,
}) => {
  const normalizedVariant = variant || "info";
  const noticeIcon = icon || DEFAULT_ICONS[normalizedVariant] || DEFAULT_ICONS.info;
  const hasSideItems = Array.isArray(sideItems) && sideItems.length > 0;
  const hasActions = Array.isArray(actions) && actions.length > 0;
  const normalizedSideLayout = sideLayout === "inline" ? "inline" : "stack";

  return (
    <section
      className={joinClassNames(
        "ims-notice",
        `ims-notice--${normalizedVariant}`,
        compact && "ims-notice--compact",
        hasSideItems && normalizedSideLayout === "inline" && "ims-notice--side-inline",
        !hasSideItems && "ims-notice--single",
        className,
      )}
      style={style}
    >
      <div className="ims-notice__body">
        <div className="ims-notice__main">
          <div className="ims-notice__icon" aria-hidden="true">{noticeIcon}</div>
          <div className="ims-notice__content">
            {kicker ? <div className="ims-notice__kicker">{kicker}</div> : null}
            {title ? <div className="ims-notice__title">{title}</div> : null}
            {description ? <div className="ims-notice__description">{description}</div> : null}
            {hasActions ? (
              <div className="ims-notice__actions">
                {actions.map((action, index) => {
                  const key = action.key || action.label || index;
                  const actionClassName = joinClassNames(
                    "ims-notice__button",
                    action.type === "primary" && "ims-notice__button--primary",
                    action.danger && "ims-notice__button--danger",
                  );

                  if (action.href) {
                    return (
                      <a key={key} className={actionClassName} href={action.href} onClick={action.onClick}>
                        {action.label}
                      </a>
                    );
                  }

                  return (
                    <button key={key} type="button" className={actionClassName} onClick={action.onClick} disabled={action.disabled}>
                      {action.label}
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>
        </div>

        {hasSideItems ? (
          <div className="ims-notice__side" aria-label="Ringkasan notice">
            {sideItems.map((item, index) => (
              <div key={item.key || item.label || index} className="ims-notice__side-item">
                {item.label ? <span className="ims-notice__side-label">{item.label}</span> : null}
                <span className={joinClassNames("ims-notice__side-value", item.tone && `ims-notice__side-value--${item.tone}`)}>
                  {item.value}
                </span>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
};

export default ImsNotice;
