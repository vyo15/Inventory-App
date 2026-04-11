import React from "react";
import { Button, Result } from "antd";
import { Link } from "react-router-dom";
import "./WeLost.css";

const WeLost = () => {
  return (
    <div className="not-found">
      <Result
        status="error"
        title="404 Not Found"
        subTitle="Sorry, the page you visited does not exist."
        extra={[
          <Button type="primary" key="console">
            <Link to="/Dashboard">Back to Dashboard</Link>
          </Button>,
        ]}
      ></Result>
    </div>
  );
};

export default WeLost;
