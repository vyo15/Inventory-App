import React from "react";
import { Alert, Card } from "antd";

class OfflineDevPanelErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      errorMessage: "",
    };
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      errorMessage: error?.message || "Panel offline dev gagal dimuat.",
    };
  }

  componentDidCatch(error, info) {
    // GUARD: panel offline hanya dev utility. Error panel tidak boleh membuat halaman reset white screen.
    console.error("Offline dev panel error:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <Card size="small">
          <Alert
            type="warning"
            showIcon
            message="Panel offline dev gagal dimuat"
            description={this.state.errorMessage}
          />
        </Card>
      );
    }

    return this.props.children;
  }
}

export default OfflineDevPanelErrorBoundary;
