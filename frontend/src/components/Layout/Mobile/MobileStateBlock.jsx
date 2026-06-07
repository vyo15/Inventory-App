import React from "react";
import { Alert, Button, Empty } from "antd";
import DataLoadingState from "../Feedback/DataLoadingState";
import "./MobileStateBlock.css";

// =====================================================
// SECTION: MobileStateBlock — AKTIF / UI-ONLY
// Fungsi:
// - standar loading, empty, dan error mobile agar tidak muncul layar kosong atau TypeError mentah.
// Guardrail:
// - komponen ini tidak melakukan fetch/mutation; retry callback tetap dari page.
// =====================================================
const MobileStateBlock = ({
  type = "empty",
  title,
  description,
  actionLabel,
  onAction,
}) => {
  if (type === "loading") {
    return (
      <DataLoadingState
        variant="card"
        rows={3}
        message={description || "Memuat data..."}
        className="ims-mobile-state-block"
        minHeight={160}
      />
    );
  }

  if (type === "error") {
    return (
      <Alert
        showIcon
        type="error"
        className="ims-mobile-state-block ims-mobile-state-block--error"
        message={title || "Data belum bisa dimuat"}
        description={description || "Periksa backend lokal atau coba muat ulang."}
        action={actionLabel && onAction ? <Button onClick={onAction}>{actionLabel}</Button> : null}
      />
    );
  }

  return (
    <div className="ims-mobile-state-block ims-mobile-state-block--empty">
      <Empty
        description={description || title || "Belum ada data."}
      />
      {actionLabel && onAction ? (
        <Button type="primary" onClick={onAction}>{actionLabel}</Button>
      ) : null}
    </div>
  );
};

export default MobileStateBlock;
