/**
 * An ATTRIBUTE value as a boolean: present means true (`multiple=""`, `multiple="multiple"`),
 * absent (`null`) means false. The string "false" also means false, so `multiple="false"` from a
 * template or a framework that stringifies values doesn't turn the feature on.
 */
export function toBoolean(value: any) {
  if (value == null || value === 'false' || value === false) value = false;
  if (value === true || value === 'true' || value === '') value = true;
  return Boolean(value);
}

/**
 * A PROPERTY value as a boolean, like native boolean properties (`select.multiple = ''` is false):
 * JavaScript truthiness, except the string "false", which stays false as with attributes.
 *
 * Frameworks that set properties rely on this: Preact clears a removed or `undefined` prop with
 * `element.multiple = ''`, which must turn the feature off. Attribute values (`setAttribute`,
 * the initial attributes) go through `toBoolean` instead.
 */
export function propertyToBoolean(value: unknown) {
  return value !== 'false' && Boolean(value);
}
