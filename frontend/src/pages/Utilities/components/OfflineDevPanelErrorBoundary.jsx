import { Component } from "react";
import { Alert, Button, Card, Space } from "antd";
import { ReloadOutlined } from "@ant-design/icons";

class OfflineDevPanelErrorBoundary extends Component {
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
    const { children, title = "Panel gagal dimuat" } = this.props;

    if (!error) return children;

    return (
      <Card size="small" title={title}>
        <Space direction="vertical" size={12} style={{ width: "100%" }}>
          <Alert
            type="warning"
            showIcon
            message="Panel mengalami error dan ditahan agar halaman Maintenance tetap dapat digunakan."
            description={error?.message || "Terjadi error aplikasi pada panel maintenance."}
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
