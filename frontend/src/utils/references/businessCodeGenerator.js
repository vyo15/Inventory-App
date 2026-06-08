import { prepareBusinessCodeCounterSequenceInTransaction } from "./businessCodeCounterService";

const safeTrim = (value) => String(value ?? "").trim();

const normalizeBusinessPrefix = (value = "CODE") => safeTrim(value)
  .toUpperCase()
  .replace(/[^A-Z0-9-]+/g, "-")
  .replace(/-+/g, "-")
  .replace(/^-|-$/g, "") || "CODE";

export const formatBusinessDateCode = (date = new Date(), dateFormat = "DDMMYYYY") => {
  const parsedDate = date instanceof Date ? date : new Date(date);
  const normalizedDate = Number.isNaN(parsedDate.getTime()) ? new Date() : parsedDate;
  const year = normalizedDate.getFullYear();
  const month = String(normalizedDate.getMonth() + 1).padStart(2, "0");
  const day = String(normalizedDate.getDate()).padStart(2, "0");
  return dateFormat === "YYYYMMDD" ? `${year}${month}${day}` : `${day}${month}${year}`;
};

export const buildDailyBusinessCode = ({
  prefix = "CODE",
  date = new Date(),
  sequence = 1,
  dateFormat = "DDMMYYYY",
  sequenceLength = 3,
} = {}) => `${normalizeBusinessPrefix(prefix)}-${formatBusinessDateCode(date, dateFormat)}-${String(
  Number(sequence || 1)
).padStart(sequenceLength, "0")}`;

export const getDailyBusinessCodeSequence = ({
  code,
  prefix = "CODE",
  date = new Date(),
  dateFormat = "DDMMYYYY",
} = {}) => {
  const prefixDate = `${normalizeBusinessPrefix(prefix)}-${formatBusinessDateCode(date, dateFormat)}-`;
  const normalizedCode = safeTrim(code).toUpperCase();
  if (!normalizedCode.startsWith(prefixDate)) return 0;
  return Number(normalizedCode.slice(prefixDate.length).match(/^\d+/)?.[0] || 0);
};

export const prepareDailySequenceCodeInTransaction = async ({
  prefix = "CODE",
  date = new Date(),
  dateFormat = "DDMMYYYY",
  sequenceLength = 3,
  minimumSequence = 0,
} = {}) => {
  const reservation = await prepareBusinessCodeCounterSequenceInTransaction({ minimumSequence });

  return {
    code: buildDailyBusinessCode({
      prefix,
      date,
      sequence: reservation.sequence,
      dateFormat,
      sequenceLength,
    }),
    counterId: reservation.counterId,
    sequence: reservation.sequence,
    previousSequence: reservation.previousSequence,
    commit: reservation.commit,
  };
};

export const buildSequentialBusinessCode = ({
  prefix = "CODE",
  sequence = 1,
  sequenceLength = 3,
} = {}) => `${normalizeBusinessPrefix(prefix)}-${String(Number(sequence || 1)).padStart(
  sequenceLength,
  "0"
)}`;

export const getSequentialBusinessCodeSequence = ({ code, prefix = "CODE" } = {}) => {
  const prefixValue = `${normalizeBusinessPrefix(prefix)}-`;
  const normalizedCode = safeTrim(code).toUpperCase();
  if (!normalizedCode.startsWith(prefixValue)) return 0;
  return Number(normalizedCode.slice(prefixValue.length).match(/^\d+/)?.[0] || 0);
};

export const prepareSequentialCodeInTransaction = async ({
  prefix = "CODE",
  sequenceLength = 3,
  minimumSequence = 0,
} = {}) => {
  const reservation = await prepareBusinessCodeCounterSequenceInTransaction({ minimumSequence });

  return {
    code: buildSequentialBusinessCode({
      prefix,
      sequence: reservation.sequence,
      sequenceLength,
    }),
    sequence: reservation.sequence,
    previousSequence: reservation.previousSequence,
    commit: reservation.commit,
  };
};

export const generateDailySequenceCode = async (options = {}) => buildDailyBusinessCode({
  ...options,
  sequence: 1,
});

export const generateSequentialCode = async (options = {}) => buildSequentialBusinessCode({
  ...options,
  sequence: 1,
});

export const isBusinessCodeExists = async () => false;

export const generateUniqueSequentialCode = async ({
  prefix = "CODE",
  sequenceLength = 3,
} = {}) => buildSequentialBusinessCode({ prefix, sequence: 1, sequenceLength });
