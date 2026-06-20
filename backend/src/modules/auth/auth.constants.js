const ROLES = ["administrator", "user"];
const USER_STATUSES = ["active", "inactive"];
const USERNAME_PATTERN = /^[a-z0-9._-]+$/;
const SESSION_DURATION_HOURS = 12;

module.exports = {
  ROLES,
  SESSION_DURATION_HOURS,
  USERNAME_PATTERN,
  USER_STATUSES,
};
