import React from "react";
import { Form, Modal } from "antd";
import "./PageFormModal.css";

const resolveModalContainer = () => {
  if (typeof document === "undefined") return undefined;
  return document.querySelector(".app-shell") || document.body;
};

// =========================
// SECTION: Shared Page Form Modal
// Fungsi:
// - menyatukan pola modal + form submit standar lintas halaman operasional
// - menjaga surface modal tetap solid, rapi, dan konsisten di dark/light mode
// Catatan:
// - komponen ini tetap wrapper presentational
// - validation dan logic submit tetap dimiliki halaman pemanggil
// =========================
const PageFormModal = ({
  title,
  open,
  onCancel,
  form,
  onFinish,
  okText = "Simpan",
  cancelText = "Batal",
  width = 720,
  children,
  confirmLoading = false,
  modalClassName = "",
  formProps = {},
  modalProps = {},
}) => {
  const mergedRootClassName = ["page-form-modal-root", modalClassName]
    .filter(Boolean)
    .join(" ");

  return (
    <Modal
      title={title}
      open={open}
      onCancel={onCancel}
      onOk={() => form.submit()}
      okText={okText}
      cancelText={cancelText}
      width={width}
      confirmLoading={confirmLoading}
      rootClassName={mergedRootClassName}
      centered
      getContainer={modalProps.getContainer || resolveModalContainer}
      {...modalProps}
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={onFinish}
        className="page-form-modal-form"
        {...formProps}
      >
        {children}
      </Form>
    </Modal>
  );
};

export default PageFormModal;
