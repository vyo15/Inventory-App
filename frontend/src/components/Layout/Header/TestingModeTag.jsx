import { useEffect, useState } from "react";
import { ExperimentOutlined } from "@ant-design/icons";
import { Tag } from "antd";
import { getTestingLabRuntimeStatus } from "../../../services/System/testingLabService";

const TestingModeTag = () => {
  const [guard, setGuard] = useState(null);

  useEffect(() => {
    let active = true;
    getTestingLabRuntimeStatus()
      .then((status) => {
        if (active) setGuard(status?.guard || null);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  if (!guard?.isSandbox) return null;

  const safeSandbox = guard.available === true;
  return (
    <Tag
      icon={<ExperimentOutlined />}
      color={safeSandbox ? "gold" : "red"}
      className="app-header-testing-tag"
    >
      {safeSandbox ? "MODE TESTING" : "SANDBOX TIDAK AMAN"}
    </Tag>
  );
};

export default TestingModeTag;
