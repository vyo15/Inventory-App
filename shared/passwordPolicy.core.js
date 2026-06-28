export const createPasswordPolicy = (config = {}) => {
  const policy = Object.freeze({ ...config });
  const hasLetter = (value = "") => /[A-Za-z]/.test(value);
  const hasNumber = (value = "") => /\d/.test(value);

  const getPasswordPolicyHint = () => policy.hint;

  const validatePasswordStrength = (password = "") => {
    const value = String(password || "");

    if (value.length < policy.minLength) return policy.messages.minLength;
    if (value.length > policy.maxLength) return policy.messages.maxLength;

    const normalizedValue = value.trim().toLowerCase();
    if ((policy.commonPasswords || []).includes(normalizedValue)) {
      return policy.messages.commonPassword;
    }

    const letterInvalid = policy.requireLetter && !hasLetter(value);
    const numberInvalid = policy.requireNumber && !hasNumber(value);
    if (letterInvalid || numberInvalid) return policy.messages.letterAndNumber;

    return "";
  };

  return {
    PASSWORD_POLICY: policy,
    getPasswordPolicyHint,
    validatePasswordStrength,
  };
};
