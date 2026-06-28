import config from "./passwordPolicy.config.json" with { type: "json" };
import { createPasswordPolicy } from "./passwordPolicy.core.js";

const policyApi = createPasswordPolicy(config);

export const PASSWORD_POLICY = policyApi.PASSWORD_POLICY;
export const getPasswordPolicyHint = policyApi.getPasswordPolicyHint;
export const validatePasswordStrength = policyApi.validatePasswordStrength;
