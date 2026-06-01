import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import { Button } from "antd";
import {
  CarOutlined,
  FileTextOutlined,
  InboxOutlined,
  InfoCircleOutlined,
  PrinterOutlined,
  SafetyCertificateOutlined,
  ShoppingOutlined,
  TagsOutlined,
} from "@ant-design/icons";
import "./PurchaseOcrReceiptModal.css";

// IMS NOTE [AKTIF/GUARDED] - Modal struk OCR Shopee
// Fungsi blok: menampilkan detail OCR Shopee sebagai receipt printable.
// Hubungan flow: presentational only; tidak mengubah parser OCR, payload purchase, stok, expense, atau inventory log.
// Guard: print CSS di-scope lewat body.purchase-ocr-print-mode agar print halaman lain tidak ikut blank.
const PurchaseOcrReceiptModal = ({
  open,
  rows = [],
  totalRow = null,
  rawText = "",
  purchaseMeta = {},
  onClose,
}) => {
  useEffect(() => {
    if (!open || typeof document === "undefined") {
      return undefined;
    }

    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    const handleEscapeClose = (event) => {
      if (event.key !== "Escape") return;
      onClose?.();
    };

    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    window.addEventListener("keydown", handleEscapeClose);

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
      document.body.classList.remove("purchase-ocr-print-mode");
      window.removeEventListener("keydown", handleEscapeClose);
    };
  }, [open, onClose]);

  const handlePrint = () => {
    if (typeof document === "undefined") return;

    const cleanupPrintMode = () => {
      document.body.classList.remove("purchase-ocr-print-mode");
      window.removeEventListener("afterprint", cleanupPrintMode);
    };

    document.body.classList.add("purchase-ocr-print-mode");
    window.addEventListener("afterprint", cleanupPrintMode);
    window.print();
    window.setTimeout(cleanupPrintMode, 1000);
  };

  if (!open || typeof document === "undefined") {
    return null;
  }

  const iconByKey = {
    subtotal: <ShoppingOutlined />,
    shipping: <CarOutlined />,
    discount: <TagsOutlined />,
    serviceFee: <SafetyCertificateOutlined />,
    qty: <InboxOutlined />,
    info: <InfoCircleOutlined />,
  };

  return createPortal(
    <div
      className="purchase-ocr-receipt-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="purchase-ocr-receipt-title"
      onClick={onClose}
    >
      <div
        className="purchase-ocr-receipt-shell purchase-ocr-receipt-print-area"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="purchase-ocr-receipt-paper">
          <div className="purchase-ocr-receipt-grain" />
          <div className="purchase-ocr-receipt-top-line" />
          <div className="purchase-ocr-receipt-bottom-line" />

          <div className="purchase-ocr-receipt-content">
            <div className="purchase-ocr-receipt-header">
              <div className="purchase-ocr-receipt-badge">
                <FileTextOutlined />
                OCR Shopee
              </div>
              <h2 id="purchase-ocr-receipt-title" className="purchase-ocr-receipt-title">
                Rincian OCR Shopee
              </h2>
              <p className="purchase-ocr-receipt-subtitle">
                Ringkasan biaya dari hasil OCR belanja Shopee.
              </p>
            </div>

            <div className="purchase-ocr-receipt-divider" />

            <div className="purchase-ocr-receipt-meta">
              <span className="purchase-ocr-receipt-meta-label">No. beli</span>
              <span className="purchase-ocr-receipt-meta-value">
                {purchaseMeta.purchaseNumber || "-"}
              </span>
              <span className="purchase-ocr-receipt-meta-label">Supplier</span>
              <span className="purchase-ocr-receipt-meta-value">
                {purchaseMeta.supplierName || "-"}
              </span>
              {purchaseMeta.dateText ? (
                <>
                  <span className="purchase-ocr-receipt-meta-label">Tanggal</span>
                  <span className="purchase-ocr-receipt-meta-value">
                    {purchaseMeta.dateText}
                  </span>
                </>
              ) : null}
            </div>

            <div className="purchase-ocr-receipt-divider" />

            {rows.length > 0 ? (
              <>
                <div>
                  {rows.map((row, index) => (
                    <div
                      key={`${row.label}-${index}`}
                      className="purchase-ocr-receipt-row"
                    >
                      <span className={`purchase-ocr-receipt-icon purchase-ocr-receipt-icon--${row.tone || "default"}`}>
                        {iconByKey[row.iconKey] || <InfoCircleOutlined />}
                      </span>
                      <span className="purchase-ocr-receipt-label">
                        {row.label}
                      </span>
                      <span
                        className={`purchase-ocr-receipt-value ${
                          row.isDiscount ? "purchase-ocr-receipt-value--discount" : ""
                        }`}
                      >
                        {row.value || "-"}
                      </span>
                    </div>
                  ))}
                </div>

                {totalRow ? (
                  <>
                    <div className="purchase-ocr-receipt-divider" />
                    <div className="purchase-ocr-receipt-total">
                      <div className="purchase-ocr-receipt-total-inner">
                        <div>
                          <div className="purchase-ocr-receipt-total-kicker">
                            Total
                          </div>
                          <div className="purchase-ocr-receipt-total-label">
                            Total pesanan
                          </div>
                        </div>
                        <div className="purchase-ocr-receipt-total-value">
                          {totalRow.value || "-"}
                        </div>
                      </div>
                    </div>
                  </>
                ) : null}
              </>
            ) : (
              <pre className="purchase-ocr-receipt-fallback">
                {rawText || "Detail OCR tidak tersedia."}
              </pre>
            )}

            <div className="purchase-ocr-receipt-divider" />

            <div className="purchase-ocr-receipt-note">
              <InfoCircleOutlined className="purchase-ocr-receipt-note-icon" />
              <span>Bukti screenshot tidak disimpan.</span>
            </div>
          </div>
        </div>

        <div className="purchase-ocr-receipt-actions">
          <Button
            type="primary"
            icon={<PrinterOutlined />}
            onClick={handlePrint}
          >
            Print
          </Button>
          <Button onClick={onClose}>Tutup</Button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default PurchaseOcrReceiptModal;
