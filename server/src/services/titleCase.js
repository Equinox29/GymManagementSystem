export const titleCaseWords = (value) =>
  typeof value === 'string'
    ? value
        .trim()
        .toLowerCase()
        .replace(/\b\p{L}/gu, (letter) => letter.toUpperCase())
    : value;

export const localDay = (date = new Date()) => {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
};
