const getRequestActorUser = (req = {}) => req.localAuth?.user || {};

const getRequestActor = (req = {}) => getRequestActorUser(req).username || "system";

module.exports = {
  getRequestActor,
  getRequestActorUser,
};
