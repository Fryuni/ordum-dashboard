export function somethingChanged(left: object, newFields: object): boolean {
  return Object.entries(newFields).some(([key, newValue]) => {
    const oldValue = (left as any)[key];
    return oldValue !== newValue;
  });
}
