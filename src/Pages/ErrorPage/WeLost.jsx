import React from "react";
import { Button, Result } from "antd";
import Dashboard from "../Dashboard/Dashboard";

const WeLost = () => {
  return (
    <div className="not-found">
      <Result
        status="error"
        title="404 Not Found"
        subTitle="Sorry, the page you visited does not exist."
        extra={[
          <Button type="primary" key="console" href={<Dashboard />}>
            Back to Dashboard
          </Button>,
        ]}
      ></Result>
    </div>
  );
};

export default WeLost;
