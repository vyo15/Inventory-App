import { createElement } from "react";
import { Typography } from "antd";

const { Text } = Typography;

export const formatMaintenanceDate = (value) => {
  if (!value) return "-";
  const date = typeof value?.toDate === "function" ? value.toDate() : new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("id-ID");
};

export const renderCompactText = (value, maxWidth = 220, fallback = "-") => {
  const text = Array.isArray(value) ? value.filter(Boolean).join(", ") : value;

  if (text === undefined || text === null || text === "") {
    return fallback;
  }

  return createElement(
    Text,
    {
      style: { display: "inline-block", maxWidth: "100%", width: maxWidth },
      ellipsis: { tooltip: String(text) },
    },
    String(text),
  );
};

export const buildActorLabel = ({ profile, authUser } = {}) => (
  profile?.displayName
  || profile?.username
  || profile?.email
  || authUser?.email
  || authUser?.uid
  || "client-ui"
);

export const getAuditIssueCountColor = (value) => (Number(value || 0) > 0 ? "red" : "green");
