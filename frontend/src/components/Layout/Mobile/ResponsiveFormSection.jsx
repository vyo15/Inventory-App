import React from "react";
import { Card, Typography } from "antd";
import "./ResponsiveFormSection.css";

const { Text } = Typography;

// =====================================================
// SECTION: ResponsiveFormSection — AKTIF / UI-ONLY
// Fungsi:
// - memecah form panjang menjadi section yang mudah dibaca di mobile.
// - memaksa layout mobile 1 kolom via className standar.
// Guardrail:
// - tidak mengubah validation rules, submit handler, atau business flow.
// =====================================================
const ResponsiveFormSection = ({ title, subtitle, children, className = "" }) => (
  <Card className={["ims-responsive-form-section", className].filter(Boolean).join(" ")}>
    {(title || subtitle) ? (
      <div className="ims-responsive-form-section__header">
        {title ? <h3>{title}</h3> : null}
        {subtitle ? <Text>{subtitle}</Text> : null}
      </div>
    ) : null}
    <div className="ims-responsive-form-section__body">{children}</div>
  </Card>
);

export default ResponsiveFormSection;
