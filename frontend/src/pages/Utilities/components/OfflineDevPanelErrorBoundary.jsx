import React from "react";
import { Alert, Button, Card, Space } from "antd";
import { ReloadOutlined } from "@ant-design/icons";

class OfflineDevPanelErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("Offline dev panel error:", error, info);
  }

  handleReset = () => {
    this.setState({ error: null });
  };

  render() {
    const { error } = this.state;
    const { children, title = "Panel offline gagal dimuat" } = this.props;

    if (!error) return children;

    return (
      <Card size="small" title={title}>
        <Space direction="vertical" size={12} style={{ width: "100%" }}>
          <Alert
            type="warning"
            showIcon
            message="Panel offline dinonaktifkan sementara agar halaman Reset Maintenance tidak white screen."
            description={error?.message || "Terjadi error runtime pada panel offline."}
          />
          <Button icon={<ReloadOutlined />} onClick={this.handleReset}>
            Coba tampilkan lagi
          </Button>
        </Space>
      </Card>
    );
  }
}

export default OfflineDevPanelErrorBoundary;
