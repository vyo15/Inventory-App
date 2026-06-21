let fallbackSequence = 0;

const nextFallbackSequence = () => {
  fallbackSequence = (fallbackSequence + 1) % Number.MAX_SAFE_INTEGER;
  return fallbackSequence.toString(36);
};

export const createClientId = (prefix = "item") => {
  const normalizedPrefix = String(prefix || "item").trim() || "item";
  const randomUuid = globalThis.crypto?.randomUUID?.();
  if (randomUuid) return `${normalizedPrefix}-${randomUuid}`;

  return [
    normalizedPrefix,
    Date.now().toString(36),
    nextFallbackSequence(),
    Math.random().toString(36).slice(2, 10),
  ].join("-");
};

export default createClientId;
