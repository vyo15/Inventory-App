import { Button, Progress, Tag, Upload } from "antd";
import { UploadOutlined } from "@ant-design/icons";
import ImsNotice from "../../../components/Layout/Feedback/ImsNotice";
import "./PurchaseOcrDraftPanel.css";

// IMS NOTE [AKTIF/GUARDED] - Panel draft OCR Shopee
// Fungsi blok: preview hasil OCR dan feedback lokal setelah user menerapkan qty/biaya ke form.
// Hubungan flow: UI-only; handler upload/apply tetap dari Purchases parent agar purchase payload, stock, expense, dan inventory log tidak berubah.
const NOTICE_VARIANT_MAP = {
  info: "info",
  warning: "guard",
  error: "critical",
  success: "status",
};

const PurchaseOcrDraftPanel = ({
  shopeeOcrState,
  applyFeedback,
  onUpload,
  onApply,
  formatMoney,
  reviewAlertTypeMap,
  reviewTagColorMap,
}) => {
  const parsed = shopeeOcrState?.parsed;
  const isReading = shopeeOcrState?.status === "reading";
  const hasApplyFeedback = Boolean(applyFeedback?.appliedAt);

  return (
    <div className="purchase-ocr-draft-panel">
      <div className="purchase-ocr-draft-panel__header">
        <div className="purchase-ocr-draft-panel__heading">
          <div className="purchase-ocr-draft-panel__title">
            Auto Isi Qty & Biaya dari Screenshot Shopee
          </div>
          <div className="purchase-ocr-draft-panel__description">
            Upload screenshot rincian pesanan untuk membaca Qty, Subtotal, Ongkir, Diskon Ongkir, Voucher/Koin, Biaya Layanan, dan Total.
          </div>
        </div>
        <Upload
          accept="image/*"
          beforeUpload={onUpload}
          showUploadList={false}
          disabled={isReading}
        >
          <Button icon={<UploadOutlined />} loading={isReading}>
            Upload Screenshot
          </Button>
        </Upload>
      </div>

      <ImsNotice
        className="purchase-ocr-draft-panel__guard"
        variant="guidance"
        compact
        title="OCR hanya membuat draft qty & biaya. Supplier, item, satuan, konversi, stok masuk, dan Simpan Pembelian tetap dikonfirmasi manual."
      />

      {isReading ? (
        <div className="purchase-ocr-reading-state">
          <div className="purchase-ocr-reading-state__text">
            Membaca screenshot: {shopeeOcrState.fileName || "gambar"}
          </div>
          <Progress percent={shopeeOcrState.progress} size="small" />
        </div>
      ) : null}

      {shopeeOcrState?.status === "error" || shopeeOcrState?.status === "needs_review" ? (
        <ImsNotice
          className="purchase-ocr-draft-panel__status"
          variant={shopeeOcrState.status === "error" ? "critical" : "guard"}
          compact
          title={shopeeOcrState.error}
        />
      ) : null}

      {parsed ? (
        <div className={`purchase-ocr-preview ${hasApplyFeedback ? "purchase-ocr-preview--applied" : ""}`}>
          <div className="purchase-ocr-preview__header">
            <div>
              <div className="purchase-ocr-preview__title">Preview qty & biaya dari screenshot</div>
              <div className="purchase-ocr-preview__description">
                Cek qty, subtotal, ongkir, voucher/koin, biaya layanan, dan total sebelum diterapkan ke form. Data pribadi dari screenshot tidak disimpan.
              </div>
            </div>
            <Tag color={reviewTagColorMap?.[parsed.reviewSeverity] || "default"}>
              {parsed.reviewStatusLabel || "Perlu dicek"}
            </Tag>
          </div>

          <ImsNotice
            variant={NOTICE_VARIANT_MAP[reviewAlertTypeMap?.[parsed.reviewSeverity]] || "info"}
            compact
            title={parsed.reviewStatusLabel || "Status OCR"}
            description={(
              <div>
                <div>{parsed.reviewMessage || "Cek ulang hasil OCR sebelum diterapkan."}</div>
                {parsed.reviewReasons?.length ? (
                  <ul className="purchase-ocr-preview__reasons">
                    {parsed.reviewReasons.map((reason) => (
                      <li key={reason}>{reason}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            )}
          />

          <div className="purchase-ocr-preview__grid">
            {[
              ["Qty beli", parsed.quantity || "Tidak terbaca"],
              ["Subtotal barang", formatMoney(parsed.subtotalItems)],
              ["Ongkir pengiriman", formatMoney(parsed.shippingCost)],
              ["Diskon ongkir", `- ${formatMoney(parsed.shippingDiscount)}`],
              ["Voucher / koin / potongan", `- ${formatMoney(parsed.voucherDiscount)}`],
              ["Biaya layanan", formatMoney(parsed.serviceFee)],
              ["Total pesanan", formatMoney(parsed.totalOrder)],
            ].map(([label, value]) => (
              <div key={label} className="purchase-ocr-preview__item">
                <div className="purchase-ocr-preview__label">{label}</div>
                <strong className="purchase-ocr-preview__value">
                  {value}
                </strong>
              </div>
            ))}
          </div>

          {!parsed.totalMatches && parsed.totalOrder > 0 ? (
            <ImsNotice
              className="purchase-ocr-preview__warning"
              variant="guard"
              compact
              title="Rumus OCR belum cocok"
              description={`Hasil hitung sistem ${formatMoney(parsed.calculatedTotal)}, total pesanan ${formatMoney(parsed.totalOrder)}. Selisih ${formatMoney(Math.abs(parsed.totalDifference || 0))}.`}
            />
          ) : null}

          {hasApplyFeedback ? (
            <ImsNotice
              className="purchase-ocr-apply-feedback"
              variant="status"
              compact
              title="Qty & biaya sudah diterapkan ke form"
              description={applyFeedback.description || "Cek ulang field pembelian sebelum klik Simpan."}
            />
          ) : null}

          <Button
            type="primary"
            danger={parsed.autoApplyBlocked}
            className="purchase-ocr-preview__apply-button"
            onClick={onApply}
            disabled={!parsed.hasUsefulValues || parsed.autoApplyBlocked}
          >
            {parsed.autoApplyBlocked
              ? "Tidak Bisa Diterapkan Otomatis"
              : hasApplyFeedback
                ? "Sudah Diterapkan ke Form"
                : parsed.needsManualReview
                  ? "Terapkan Setelah Dicek Manual"
                  : "Terapkan Qty & Biaya ke Form"}
          </Button>
        </div>
      ) : null}
    </div>
  );
};

export default PurchaseOcrDraftPanel;
