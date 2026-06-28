const authContract = require("../../../../shared/authContract.json");

const ROLES = Object.freeze([...authContract.roles]);
const USER_STATUSES = Object.freeze([...authContract.userStatuses]);
const USERNAME_PATTERN = new RegExp(authContract.usernamePattern);
const SESSION_DURATION_HOURS = authContract.sessionDurationHours;

module.exports = {
  ROLES,
  SESSION_DURATION_HOURS,
  USERNAME_PATTERN,
  USER_STATUSES,
};
