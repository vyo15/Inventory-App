/* eslint-disable react-refresh/only-export-components */
import { useEffect, useMemo, useState } from "react";
import { Alert, Button, Modal, Space, Typography } from "antd";

const { Paragraph, Text } = Typography;

const ACTION_RESULT_EVENT = "ims:action-result-feedback";
const POPUP_STATUSES = new Set(["success", "error", "info"]);

let isActionResultHostMounted = false;

const normalizeText = (value, fallback = "") => {
  if (value === null || value === undefined || value === "") return fallback;
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return fallback;
};

const normalizeDetails = (details = []) => {
  if (!Array.isArray(details)) return [];
  return details
    .map((item) => normalizeText(item, ""))
    .filter(Boolean)
    .slice(0, 8);
};

const getStatusConfig = (status) => {
  if (status === "error") {
    return {
      modal: Modal.error,
      alertType: "error",
      defaultTitle: "Proses gagal",
      defaultContent: "Terjadi kendala saat menjalankan proses.",
      maskClosable: false,
    };
  }

  if (status === "info") {
    return {
      modal: Modal.info,
      alertType: "info",
      defaultTitle: "Informasi proses",
      defaultContent: "Informasi proses tersedia.",
      maskClosable: true,
    };
  }

  return {
    modal: Modal.success,
    alertType: "success",
    defaultTitle: "Proses berhasil",
    defaultContent: "Proses berhasil dijalankan.",
    maskClosable: true,
  };
};

const normalizeOptions = (status, options = {}) => {
  const config = getStatusConfig(status);
  const normalizedOptions = typeof options === "string" ? { content: options } : options || {};
  const error = normalizedOptions.error;
  const errorMessage = error?.message || (typeof error === "string" ? error : "");
  const content = normalizedOptions.content || normalizedOptions.message || errorMessage || config.defaultContent;

  const contextDetails = [
    normalizedOptions.module ? `Modul: ${normalizeText(normalizedOptions.module)}` : "",
    normalizedOptions.action ? `Aksi: ${normalizeText(normalizedOptions.action)}` : "",
  ].filter(Boolean);

  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    status: POPUP_STATUSES.has(status) ? status : "success",
    title: normalizedOptions.title || config.defaultTitle,
    content,
    details: normalizeDetails([...contextDetails, ...(Array.isArray(normalizedOptions.details) ? normalizedOptions.details : [])]),
    note: normalizeText(normalizedOptions.note, ""),
    okText: normalizedOptions.okText || "Mengerti",
    width: normalizedOptions.width || 520,
  };
};

const getModalContainer = () => {
  if (typeof document === "undefined") return undefined;
  return document.body;
};

const ActionResultContent = ({ status, content, details, note }) => {
  const config = getStatusConfig(status);

  return (
    <Space direction="vertical" size={12} style={{ width: "100%" }}>
      {content ? <Paragraph style={{ marginBottom: 0 }}>{content}</Paragraph> : null}

      {details.length ? (
        <Space direction="vertical" size={8} style={{ width: "100%" }}>
          {details.map((item) => (
            <Alert key={item} type={config.alertType} showIcon message={item} />
          ))}
        </Space>
      ) : null}

      {note ? <Text type="secondary">{note}</Text> : null}
    </Space>
  );
};

const copyActionDetails = async (payload) => {
  if (typeof navigator === "undefined" || !navigator.clipboard) return;

  const detailText = [
    payload.title,
    payload.content,
    ...normalizeDetails(payload.details),
    payload.note,
  ].filter(Boolean).join("\n");

  await navigator.clipboard.writeText(detailText);
};

const showStaticFallbackModal = (payload) => {
  const config = getStatusConfig(payload.status);

  return config.modal({
    title: payload.title,
    content: (
      <ActionResultContent
        status={payload.status}
        content={payload.content}
        details={payload.details}
        note={payload.note}
      />
    ),
    okText: payload.okText,
    centered: true,
    width: payload.width,
    zIndex: 1600,
    getContainer: getModalContainer,
    maskClosable: config.maskClosable,
  });
};

const showActionResult = (status, options = {}) => {
  const payload = normalizeOptions(status, options);

  if (typeof window !== "undefined" && isActionResultHostMounted) {
    // AKTIF / UI POLICY: popup hasil proses hanya untuk success, error, dan info yang memang dipicu action user.
    // Event dikirim async supaya popup muncul setelah modal konfirmasi selesai menutup.
    window.setTimeout(() => {
      window.dispatchEvent(new CustomEvent(ACTION_RESULT_EVENT, { detail: payload }));
    }, 0);

    return {
      destroy: () => {},
      update: () => {},
    };
  }

  return showStaticFallbackModal(payload);
};

export const ActionResultModalHost = () => {
  const [queue, setQueue] = useState([]);
  const activePayload = queue[0] || null;

  useEffect(() => {
    isActionResultHostMounted = true;

    const handleActionResult = (event) => {
      const nextPayload = event?.detail;
      if (!nextPayload?.status || !POPUP_STATUSES.has(nextPayload.status)) return;
      setQueue((previousQueue) => [...previousQueue, nextPayload]);
    };

    window.addEventListener(ACTION_RESULT_EVENT, handleActionResult);

    return () => {
      window.removeEventListener(ACTION_RESULT_EVENT, handleActionResult);
      isActionResultHostMounted = false;
    };
  }, []);

  const footer = useMemo(() => {
    if (!activePayload) return null;

    const actions = [];
    if (activePayload.status === "error") {
      actions.push(
        <Button key="copy" onClick={() => copyActionDetails(activePayload)}>
          Salin detail
        </Button>,
      );
    }

    actions.push(
      <Button key="ok" type="primary" onClick={() => setQueue((previousQueue) => previousQueue.slice(1))}>
        {activePayload.okText || "Mengerti"}
      </Button>,
    );

    return actions;
  }, [activePayload]);

  return (
    <Modal
      open={Boolean(activePayload)}
      title={activePayload?.title || "Informasi proses"}
      centered
      width={activePayload?.width || 520}
      zIndex={1600}
      getContainer={getModalContainer}
      maskClosable={activePayload?.status !== "error"}
      footer={footer}
      onCancel={() => setQueue((previousQueue) => previousQueue.slice(1))}
      destroyOnHidden
    >
      {activePayload ? (
        <ActionResultContent
          status={activePayload.status}
          content={activePayload.content}
          details={activePayload.details}
          note={activePayload.note}
        />
      ) : null}
    </Modal>
  );
};

export const showActionSuccess = (options = {}) => showActionResult("success", options);

export const showActionInfo = (options = {}) => showActionResult("info", options);

export const showActionError = (options = {}) => showActionResult("error", options);
