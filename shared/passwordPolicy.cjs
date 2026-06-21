const PASSWORD_POLICY = Object.freeze(require("./passwordPolicy.config.json"));

const hasLetter = (value = "") => /[A-Za-z]/.test(value);
const hasNumber = (value = "") => /\d/.test(value);

const getPasswordPolicyHint = () => PASSWORD_POLICY.hint;

const validatePasswordStrength = (password = "") => {
  const value = String(password || "");

  if (value.length < PASSWORD_POLICY.minLength) {
    return PASSWORD_POLICY.messages.minLength;
  }

  if (value.length > PASSWORD_POLICY.maxLength) {
    return PASSWORD_POLICY.messages.maxLength;
  }

  const letterInvalid = PASSWORD_POLICY.requireLetter && !hasLetter(value);
  const numberInvalid = PASSWORD_POLICY.requireNumber && !hasNumber(value);

  if (letterInvalid || numberInvalid) {
    return PASSWORD_POLICY.messages.letterAndNumber;
  }

  return "";
};

module.exports = {
  PASSWORD_POLICY,
  getPasswordPolicyHint,
  validatePasswordStrength,
};
