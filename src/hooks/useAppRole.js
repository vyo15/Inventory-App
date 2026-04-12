import { useEffect, useState } from "react";
import {
  APP_ROLE_STORAGE_KEY,
  DEFAULT_APP_ROLE,
} from "../constants/roleOptions";
import { getCurrentAppRole, setCurrentAppRole } from "../utils/access/accessControl";

const useAppRole = () => {
  const [role, setRole] = useState(DEFAULT_APP_ROLE);

  useEffect(() => {
    setRole(getCurrentAppRole());
  }, []);

  useEffect(() => {
    const handleStorageChange = () => {
      setRole(getCurrentAppRole());
    };

    window.addEventListener("storage", handleStorageChange);
    window.addEventListener(APP_ROLE_STORAGE_KEY, handleStorageChange);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener(APP_ROLE_STORAGE_KEY, handleStorageChange);
    };
  }, []);

  const updateRole = (nextRole) => {
    setCurrentAppRole(nextRole);
    setRole(nextRole);
    window.dispatchEvent(new Event(APP_ROLE_STORAGE_KEY));
  };

  return { role, setRole: updateRole };
};

export default useAppRole;
