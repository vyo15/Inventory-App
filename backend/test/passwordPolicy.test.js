const assert = require("node:assert/strict");
const { test } = require("node:test");
const {
  PASSWORD_POLICY,
  getPasswordPolicyHint,
  validatePasswordStrength,
} = require("../../shared/passwordPolicy.cjs");

test("password policy membatasi panjang maksimum tanpa mengubah syarat minimum", () => {
  assert.equal(PASSWORD_POLICY.minLength, 8);
  assert.equal(PASSWORD_POLICY.maxLength, 128);
  assert.equal(validatePasswordStrength("A1short"), PASSWORD_POLICY.messages.minLength);
  assert.equal(
    validatePasswordStrength(`A1${"x".repeat(127)}`),
    PASSWORD_POLICY.messages.maxLength,
  );
  assert.equal(
    validatePasswordStrength("Password123"),
    PASSWORD_POLICY.messages.commonPassword,
  );
  assert.equal(validatePasswordStrength("KataSandi-2026"), "");
  assert.match(getPasswordPolicyHint(), /bukan password umum/i);
});
