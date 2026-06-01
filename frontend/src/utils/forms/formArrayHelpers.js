export const getFormArrayValue = (form, fieldName) =>
  form.getFieldValue(fieldName) || [];

export const upsertArrayItemByIndex = (items = [], index, nextItem) => {
  const next = [...items];

  if (index !== null && index !== undefined && index >= 0) {
    next[index] = nextItem;
    return next;
  }

  next.push(nextItem);
  return next;
};

export const removeArrayItemByIndex = (items = [], index) =>
  items.filter((_, itemIndex) => itemIndex !== index);

export const getNextSequenceNumber = (items = [], fieldName = 'sequenceNo') =>
  items.length + 1 > 0
    ? Math.max(
        0,
        ...items.map((item) => Number(item?.[fieldName] || 0)),
      ) + 1
    : 1;
