import { Link } from "react-router-dom";
import { Button, Drawer, Progress, Tag, Typography } from "antd";
import {
  ArrowRightOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  DatabaseOutlined,
  WarningOutlined,
} from "@ant-design/icons";
import { formatNumberId } from "../../../utils/formatters/numberId";
import { getNumericValue } from "../helpers/dashboardPageHelpers";

const { Text } = Typography;

const DashboardInitialSetupDrawer = ({
  open,
  completedSteps,
  requiredSteps,
  progressPercent,
  nextStep,
  phaseGroups,
  onClose,
}) => (
  <Drawer
    title={
      <div className="dashboard-setup-drawer-title">
        <span className="dashboard-setup-drawer-title-icon"><DatabaseOutlined /></span>
        <span>
          <strong>Setup Database Awal</strong>
          <small>Urutan aman sebelum transaksi harian dimulai.</small>
        </span>
      </div>
    }
    open={open}
    onClose={onClose}
    placement="right"
    width={500}
    rootClassName="dashboard-setup-drawer-root"
    className="dashboard-setup-drawer"
    destroyOnHidden
    extra={
      <Tag color="blue" className="dashboard-setup-drawer-progress-tag">
        {formatNumberId(completedSteps)}/{formatNumberId(requiredSteps)} selesai
      </Tag>
    }
    footer={
      <div className="dashboard-setup-drawer-footer">
        <Text>Checklist hanya membaca data dan tidak membuat transaksi otomatis.</Text>
        <Button onClick={onClose}>Sembunyikan sementara</Button>
      </div>
    }
  >
    {open ? (
      <div className="dashboard-setup-drawer-content">
        <section className="dashboard-setup-summary">
          <div className="dashboard-setup-summary-topline">
            <span>Progress setup</span>
            <strong>{formatNumberId(completedSteps)} dari {formatNumberId(requiredSteps)} selesai</strong>
          </div>
          <Progress
            percent={getNumericValue(progressPercent)}
            showInfo={false}
            size="small"
          />
          {nextStep ? (
            <div className="dashboard-setup-next-step">
              <span>Langkah berikutnya</span>
              <strong>{nextStep.order}. {nextStep.label}</strong>
              <Text>{nextStep.description}</Text>
              <Link
                to={nextStep.to}
                className="dashboard-setup-next-action"
                onClick={onClose}
              >
                Isi sekarang <ArrowRightOutlined />
              </Link>
            </div>
          ) : null}
        </section>

        <div className="dashboard-setup-phase-list">
          {phaseGroups.map((phase) => (
            <section key={phase.key} className="dashboard-setup-phase">
              <div className="dashboard-setup-phase-heading">
                <strong>{phase.label}</strong>
                <small>{phase.description}</small>
              </div>
              <div className="dashboard-setup-step-list">
                {phase.steps.map((step) => (
                  <Link
                    key={step.key}
                    to={step.to}
                    onClick={onClose}
                    className={`dashboard-setup-step ${step.complete ? "is-complete" : step.warning ? "is-warning" : "is-pending"}`}
                  >
                    <span className="dashboard-setup-step-number">{step.order}</span>
                    <span className="dashboard-setup-step-copy">
                      <strong>{step.label}</strong>
                      <small>{step.description}</small>
                    </span>
                    <span className="dashboard-setup-step-status">
                      {step.complete ? <CheckCircleOutlined /> : step.warning ? <WarningOutlined /> : <ClockCircleOutlined />}
                      <span>{step.complete ? "Siap" : step.warning ? "Perlu audit" : "Belum siap"}</span>
                    </span>
                    <ArrowRightOutlined className="dashboard-setup-step-arrow" />
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    ) : null}
  </Drawer>
);

export default DashboardInitialSetupDrawer;
