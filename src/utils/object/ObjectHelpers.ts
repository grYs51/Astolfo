export const stringifyArgs = (args: object) =>
  Object.entries(args)
    .map(([key, value]) => `${key}: ${value}`)
    .join(', ');

export const deleteUndefined = <T extends object>(obj: T): T => {
  return Object.entries(obj).reduce(
    //also removed falsey values, good enough?
    (newT: T, [key, value]) => (value ? { ...newT, [key]: value } : newT),
    {} as T
  );
};
