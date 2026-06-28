import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Button, Space, Typography } from "antd";
import { ReloadOutlined } from "@ant-design/icons";
import useSqliteRealtime from "../../hooks/useSqliteRealtime";
import {
  isGlobalRealtimeReloadEvent,
  realtimeEventMatchesScopes,
} from "../../config/realtimeRouteScopes";
import "./LiveRouteRefresh.css";

const { Text } = Typography;

const isElementVisible = (element) => {
  if (!element) return false;
  const style = window.getComputedStyle(element);
  return style.display !== "none" && style.visibility !== "hidden" && element.getClientRects().length > 0;
};

const isRefreshUnsafe = () => {
  if (typeof document === "undefined") return false;
  const activeElement = document.activeElement;
  const editableActive = Boolean(
    activeElement
    && (
      ["INPUT", "TEXTAREA", "SELECT"].includes(activeElement.tagName)
      || activeElement.isContentEditable
    )
  );
  const overlaySelectors = [
    ".ant-modal-wrap",
    ".ant-drawer-content-wrapper",
    ".ant-popover",
    ".ant-picker-dropdown",
  ];
  const visibleOverlay = overlaySelectors.some((selector) => (
    [...document.querySelectorAll(selector)].some(isElementVisible)
  ));
  return editableActive || visibleOverlay;
};

const LiveRouteRefresh = ({ children, scopes = [] }) => {
  const { lastEvent, status } = useSqliteRealtime();
  const [refreshKey, setRefreshKey] = useState(0);
  const [pendingEvent, setPendingEvent] = useState(null);
  const handledRevisionRef = useRef(null);
  const stableScopes = useMemo(() => [...new Set(scopes.filter(Boolean))], [scopes]);

  const applyRefresh = () => {
    setPendingEvent(null);
    setRefreshKey((value) => value + 1);
  };

  useEffect(() => {
    if (!realtimeEventMatchesScopes(lastEvent, stableScopes)) return;
    const revisionKey = `${lastEvent.type}:${lastEvent.revision ?? lastEvent.occurredAt ?? "fallback"}`;
    if (handledRevisionRef.current === revisionKey) return;
    handledRevisionRef.current = revisionKey;

    if (isGlobalRealtimeReloadEvent(lastEvent)) {
      window.setTimeout(() => window.location.reload(), 250);
      return;
    }

    if (document.visibilityState === "hidden" || isRefreshUnsafe()) {
      setPendingEvent(lastEvent);
      return;
    }

    const timer = window.setTimeout(applyRefresh, 180);
    return () => window.clearTimeout(timer);
  }, [lastEvent, stableScopes]);

  useEffect(() => {
    if (!pendingEvent) return undefined;
    const refreshWhenSafe = () => {
      if (document.visibilityState === "hidden" || isRefreshUnsafe()) return;
      applyRefresh();
    };
    window.addEventListener("focus", refreshWhenSafe);
    document.addEventListener("visibilitychange", refreshWhenSafe);
    return () => {
      window.removeEventListener("focus", refreshWhenSafe);
      document.removeEventListener("visibilitychange", refreshWhenSafe);
    };
  }, [pendingEvent]);

  return (
    <div className="ims-live-route-refresh">
      {pendingEvent ? (
        <Alert
          className="ims-live-route-refresh__notice"
          type="info"
          showIcon
          message="Data baru tersedia"
          description={(
            <Space size={8} wrap>
              <Text>Perubahan dari perangkat lain ditahan agar form yang sedang diisi tidak hilang.</Text>
              <Button size="small" icon={<ReloadOutlined />} onClick={applyRefresh}>
                Muat Ulang Data
              </Button>
            </Space>
          )}
        />
      ) : null}
      {status?.connected === false && status?.state === "reconnecting" ? (
        <div className="ims-live-route-refresh__status" role="status">
          Sinkronisasi realtime sedang menyambung ulang. Fallback refresh tetap aktif.
        </div>
      ) : null}
      <Fragment key={refreshKey}>{children}</Fragment>
    </div>
  );
};

export default LiveRouteRefresh;
