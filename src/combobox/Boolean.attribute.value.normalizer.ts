/** Transform invalid (nullish or stringed) values to correct boolean value */
export function toBoolean(value: any) {
  if (value == null || value === 'false' || value === false) value = false;
  if (value === true || value === 'true' || value === '') value = true;
  return Boolean(value);
}