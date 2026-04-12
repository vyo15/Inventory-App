import {
  APP_ROLE_STORAGE_KEY,
  DEFAULT_APP_ROLE,
} from "../../constants/roleOptions";

export const getCurrentAppRole = () => {
  const savedRole = localStorage.getItem(APP_ROLE_STORAGE_KEY);
  return savedRole || DEFAULT_APP_ROLE;
};

export const setCurrentAppRole = (role) => {
  localStorage.setItem(APP_ROLE_STORAGE_KEY, role || DEFAULT_APP_ROLE);
};

export const canAccessItemByRole = (item = {}, role = DEFAULT_APP_ROLE) => {
  if (!Array.isArray(item.roles) || item.roles.length === 0) {
    return true;
  }

  return item.roles.includes(role);
};

export const filterMenuByRole = (items = [], role = DEFAULT_APP_ROLE) => {
  return items
    .map((item) => {
      const filteredChildren = Array.isArray(item.children)
        ? filterMenuByRole(item.children, role)
        : [];

      if (Array.isArray(item.children) && filteredChildren.length === 0) {
        return canAccessItemByRole(item, role) && item.path ? item : null;
      }

      if (Array.isArray(item.children)) {
        return canAccessItemByRole(item, role)
          ? { ...item, children: filteredChildren }
          : null;
      }

      return canAccessItemByRole(item, role) ? item : null;
    })
    .filter(Boolean);
};

export const flattenMenuPaths = (items = []) => {
  return items.reduce((paths, item) => {
    if (item.path) {
      paths.push(item.path);
    }

    if (Array.isArray(item.children)) {
      paths.push(...flattenMenuPaths(item.children));
    }

    return paths;
  }, []);
};
