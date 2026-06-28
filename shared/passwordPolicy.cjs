const { createPasswordPolicy } = require("./passwordPolicy.core.js");
const config = require("./passwordPolicy.config.cjs");

module.exports = createPasswordPolicy(config);
