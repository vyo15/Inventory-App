const ROLES = ["administrator", "user"];
const USER_STATUSES = ["active", "inactive"];
const USERNAME_PATTERN = /^[a-z0-9._-]+$/;
const BOOTSTRAP_CONFIRM_KEYWORD = "CREATE LOCAL ADMIN";
const SESSION_DURATION_HOURS = 12;

module.exports = {
  BOOTSTRAP_CONFIRM_KEYWORD,
  ROLES,
  SESSION_DURATION_HOURS,
  USERNAME_PATTERN,
  USER_STATUSES,
};
