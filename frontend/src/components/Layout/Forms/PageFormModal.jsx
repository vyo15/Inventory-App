import React from "react";
import { Form, Modal } from "antd";
import ResponsiveFormSection from "../Mobile/ResponsiveFormSection";
import { showFormValidationFeedback } from "../../../utils/forms/formValidationFeedback";
import "./PageFormModal.css";

const resolveModalContainer = () => {
  if (typeof document === "undefined") return undefined;
  return document.querySelector(".app-shell") || document.body;
};

/*
=====================================================
SECTION: Integrasi validasi PageFormModal — AKTIF
Fungsi:
- Menyatukan modal + form submit standar lintas halaman operasional.
- Menampilkan popup field wajib melalui helper shared saat submit gagal validasi AntD Form.

Dipakai oleh:
- Halaman yang memakai PageFormModal untuk create/edit modal.

Alasan perubahan:
- User perlu pesan “Data belum lengkap” yang jelas saat klik Simpan tanpa mengisi field wajib.

Catatan cleanup:
- Halaman custom drawer/modal tetap perlu catch lokal sampai semua form memakai PageFormModal.

Risiko:
- Jika onFinishFailed custom dari pemanggil diabaikan, pesan validasi khusus halaman bisa hilang. Karena itu callback custom tetap dipanggil setelah popup shared.
=====================================================
*/
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
  responsiveSection = true,
  responsiveSectionTitle,
  responsiveSectionSubtitle,
  formProps = {},
  modalProps = {},
}) => {
  const mergedRootClassName = ["page-form-modal-root", modalClassName]
    .filter(Boolean)
    .join(" ");

  const handleFinishFailed = (errorInfo) => {
    showFormValidationFeedback(errorInfo, {
      form,
      fieldLabels: formProps.fieldLabels || {},
    });

    if (typeof formProps.onFinishFailed === "function") {
      formProps.onFinishFailed(errorInfo);
    }
  };

  const safeFormProps = { ...formProps };
  delete safeFormProps.fieldLabels;
  delete safeFormProps.onFinishFailed;

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
        onFinishFailed={handleFinishFailed}
        className="page-form-modal-form"
        {...safeFormProps}
      >
        {responsiveSection ? (
          <ResponsiveFormSection
            title={responsiveSectionTitle}
            subtitle={responsiveSectionSubtitle}
            className="page-form-modal-responsive-section"
          >
            {children}
          </ResponsiveFormSection>
        ) : children}
      </Form>
    </Modal>
  );
};

export default PageFormModal;
