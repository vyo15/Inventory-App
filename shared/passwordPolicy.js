import PASSWORD_POLICY_CONFIG from "./passwordPolicy.config.json";

export const PASSWORD_POLICY = Object.freeze(PASSWORD_POLICY_CONFIG);

const hasLetter = (value = "") => /[A-Za-z]/.test(value);
const hasNumber = (value = "") => /\d/.test(value);

export const getPasswordPolicyHint = () => PASSWORD_POLICY.hint;

export const validatePasswordStrength = (password = "") => {
  const value = String(password || "");

  if (value.length < PASSWORD_POLICY.minLength) {
    return PASSWORD_POLICY.messages.minLength;
  }

  const letterInvalid = PASSWORD_POLICY.requireLetter && !hasLetter(value);
  const numberInvalid = PASSWORD_POLICY.requireNumber && !hasNumber(value);

  if (letterInvalid || numberInvalid) {
    return PASSWORD_POLICY.messages.letterAndNumber;
  }

  return "";
};
