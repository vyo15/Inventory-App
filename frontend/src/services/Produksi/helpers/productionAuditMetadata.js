export const getProductionActorName = (currentUser = null) => currentUser?.email
  || currentUser?.displayName
  || currentUser?.username
  || currentUser?.uid
  || "system";

export const getCurrentIsoTimestamp = () => new Date().toISOString();
