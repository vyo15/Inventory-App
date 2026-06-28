import { Alert, Button } from "antd";
import DataLoadingState from "../Feedback/DataLoadingState";
import EmptyStateBlock from "../Feedback/EmptyStateBlock";
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
        description={description || "Periksa layanan lokal atau coba muat ulang."}
        action={actionLabel && onAction ? <Button onClick={onAction}>{actionLabel}</Button> : null}
      />
    );
  }

  return (
    <EmptyStateBlock
      compact
      className="ims-mobile-state-block ims-mobile-state-block--empty"
      title={title}
      description={description || "Belum ada data."}
      actionLabel={actionLabel}
      onAction={onAction}
      minHeight={160}
    />
  );
};

export default MobileStateBlock;
