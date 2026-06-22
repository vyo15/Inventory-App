import { useMemo } from "react";
import { Empty } from "antd";
import { FileTextOutlined, RightOutlined } from "@ant-design/icons";
import { Navigate, useNavigate } from "react-router-dom";
import { sidebarMenuItems } from "../../config/sidebarMenu";
import useAuth from "../../hooks/useAuth";
import { filterSidebarMenuItemsByRole } from "../../utils/auth/roleAccess";
import { findMenuItemByKey } from "../../utils/navigation/sidebarNavigation";
import "./ModuleHub.css";

const buildSections = (moduleItem) => {
  const directChildren = moduleItem?.children || [];
  const hasGroupedChildren = directChildren.some(
    (childItem) => childItem.children?.length,
  );

  if (!hasGroupedChildren) {
    return [
      {
        key: `${moduleItem?.key || "module"}-items`,
        label: "",
        description: "",
        icon: null,
        items: directChildren,
      },
    ];
  }

  return directChildren.map((childItem) => ({
    key: childItem.key,
    label: childItem.hubLabel || childItem.label,
    description: childItem.hubDescription || childItem.description || "",
    icon: childItem.hubIcon || childItem.icon,
    items: childItem.children || [childItem],
  }));
};

// =========================
// SECTION: Module Hub — AKTIF / GUARDED
// Fungsi:
// - menampilkan child menu sebagai card di content area;
// - menggantikan submenu pop-up pada desktop dan bottom navigation mobile.
// Guardrail:
// - data menu selalu difilter role sebelum dirender;
// - copy dan icon membaca sidebarMenu sebagai single source;
// - card hanya menavigasi route existing dan tidak menjalankan business mutation.
// Compatibility:
// - menerima `moduleKey` baru dan `menuKey` lama agar route hub existing tidak putus.
// =========================
const ModuleHub = ({ moduleKey, menuKey }) => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const resolvedModuleKey = moduleKey || menuKey;

  const roleAwareMenuItems = useMemo(() => {
    return filterSidebarMenuItemsByRole(sidebarMenuItems, profile?.role);
  }, [profile?.role]);

  const moduleItem = useMemo(() => {
    return findMenuItemByKey(roleAwareMenuItems, resolvedModuleKey);
  }, [resolvedModuleKey, roleAwareMenuItems]);

  const sections = useMemo(() => buildSections(moduleItem), [moduleItem]);

  if (!moduleItem) {
    return <Navigate to="/unauthorized" replace />;
  }

  const ModuleIcon = moduleItem.hubIcon || moduleItem.icon;
  const moduleDescription =
    moduleItem.hubDescription ||
    moduleItem.description ||
    "Pilih halaman yang ingin dibuka.";

  return (
    <div className="module-hub-page">
      <header className="module-hub-header">
        {ModuleIcon ? (
          <span className="module-hub-header-icon" aria-hidden="true">
            <ModuleIcon />
          </span>
        ) : null}

        <div className="module-hub-header-copy">
          <div className="module-hub-eyebrow">
            {moduleItem.hubEyebrow || "Module Workspace"}
          </div>
          <h1>{moduleItem.hubTitle || moduleItem.label}</h1>
          <p>{moduleDescription}</p>
        </div>
      </header>

      {sections.length > 0 ? (
        <div className="module-hub-sections">
          {sections.map((section) => {
            const SectionIcon = section.icon;

            return (
              <section key={section.key} className="module-hub-section">
                {section.label ? (
                  <div className="module-hub-section-heading">
                    {SectionIcon ? (
                      <span
                        className="module-hub-section-icon"
                        aria-hidden="true"
                      >
                        <SectionIcon />
                      </span>
                    ) : null}

                    <div className="module-hub-section-copy">
                      <h2>{section.label}</h2>
                      {section.description ? (
                        <p>{section.description}</p>
                      ) : null}
                    </div>
                  </div>
                ) : null}

                <div className="module-hub-grid">
                  {section.items.map((menuItem) => {
                    const itemLabel = menuItem.hubLabel || menuItem.label;
                    const itemDescription =
                      menuItem.hubDescription ||
                      menuItem.description ||
                      `Buka halaman ${itemLabel}.`;
                    const IconComponent =
                      menuItem.hubIcon ||
                      menuItem.icon ||
                      SectionIcon ||
                      moduleItem.hubIcon ||
                      moduleItem.icon ||
                      FileTextOutlined;

                    return (
                      <button
                        type="button"
                        key={menuItem.key}
                        className="module-hub-card"
                        onClick={() => menuItem.path && navigate(menuItem.path)}
                        disabled={!menuItem.path}
                        aria-label={`Buka ${itemLabel}`}
                      >
                        <span className="module-hub-card-icon" aria-hidden="true">
                          <IconComponent />
                        </span>
                        <span className="module-hub-card-copy">
                          <strong>{itemLabel}</strong>
                          <span>{itemDescription}</span>
                        </span>
                        <span
                          className="module-hub-card-action"
                          aria-hidden="true"
                        >
                          <RightOutlined />
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        <Empty description="Belum ada halaman pada modul ini" />
      )}
    </div>
  );
};

export default ModuleHub;
