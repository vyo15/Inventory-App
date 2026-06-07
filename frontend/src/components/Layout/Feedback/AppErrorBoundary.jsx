import React from "react";
import { Alert, Button, Result, Space, Typography } from "antd";
import { BugOutlined, ReloadOutlined } from "@ant-design/icons";

const { Text } = Typography;

/* =====================================================
SECTION: AppErrorBoundary — AKTIF / UI SAFETY NET
Fungsi:
- Menangkap error render di area halaman agar aplikasi tidak berubah menjadi white screen total.
- Memberi fallback UI yang bisa dimuat ulang tanpa mengubah route, role guard, schema, atau business flow.

Dipakai oleh:
- AppLayout untuk membungkus AppRoutes.

Catatan guard:
- Komponen ini hanya UI fallback. Jangan menaruh logic repair data, reset, stock mutation, atau auto-write di sini.
===================================================== */
class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      error: null,
      errorInfo: null,
      lastResetKey: props.resetKey,
    };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    console.error("IMS page render error ditangkap AppErrorBoundary:", error, errorInfo);
  }

  componentDidUpdate(previousProps) {
    if (previousProps.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({
        error: null,
        errorInfo: null,
        lastResetKey: this.props.resetKey,
      });
    }
  }

  handleRetry = () => {
    this.setState({
      error: null,
      errorInfo: null,
      lastResetKey: this.props.resetKey,
    });
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    const { error, errorInfo } = this.state;

    if (!error) {
      return this.props.children;
    }

    const errorMessage = error?.message || "Error runtime tidak dikenal.";
    const componentStack = errorInfo?.componentStack || "";

    return (
      <Result
        status="warning"
        icon={<BugOutlined />}
        title="Halaman gagal ditampilkan"
        subTitle="Aplikasi tetap aktif. Error halaman ditahan agar tidak menjadi white screen."
        extra={(
          <Space size={10} wrap>
            <Button type="primary" icon={<ReloadOutlined />} onClick={this.handleRetry}>
              Coba tampilkan lagi
            </Button>
            <Button onClick={this.handleReload}>Muat ulang aplikasi</Button>
          </Space>
        )}
      >
        <Alert
          type="warning"
          showIcon
          message="Detail error untuk debugging"
          description={(
            <Space direction="vertical" size={6} style={{ width: "100%" }}>
              <Text code>{errorMessage}</Text>
              {componentStack ? <Text type="secondary">Cek Console browser untuk stack lengkap.</Text> : null}
            </Space>
          )}
        />
      </Result>
    );
  }
}

export default AppErrorBoundary;
