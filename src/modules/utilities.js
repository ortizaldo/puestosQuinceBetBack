/**
 * @exports textComparer
 * @description Just compare text. Useful in password comparers, but could be used any where else
 * @return {boolean}
 */
export const textComparer = (text1, text2) => text1 && text2 && text1 === text2;

/**
 * @exports deleteBody
 * @param {string} userId
 * @description Will return the "deleted" fields when deleting a document.
 * @example
 * `{
 * 	deleted: true, // Will always be true
 * 	deletedAt: new Date(), // Always a new generated Date
 * 	deletedBy: userId, // The userId passed as parameter
 * }`
 * @return {any}
 */
export const deleteBody = (userId) => ({
  deleted: true,
  deletedAt: new Date(),
  deletedBy: userId,
});

/**
 * @exports disableBody
 * @param {string} userId
 * @description Will return the "disabled" fields when deleting a document.
 * @example
 * `{
 * 	disabled: true, // Will always be true
 * 	disabledAt: new Date(), // Always a new generated Date
 * 	disabledBy: userId, // The userId passed as parameter
 * }`
 * @return {any}
 */
export const disableBody = (userId) => ({
  disabled: true,
  disabledAt: new Date(),
  disabledBy: userId,
});

export const nestedFieldValue = () => {
  const result = null;
  // const field = fieldName.replace(/\[(\w+)\]/g, ".$1").replace(/^\./, "");
  // const a = field.split(".");
  // try {
  //   for (let i = 0, n = a.length; i < n; i += 1) {
  //     const k = a[i];
  //     if (object && k in object) {
  //       result = object[k];
  //     } else {
  //       result = '';
  //     }
  //   }
  // } catch (err) {
  //   result = object[field];
  // }
  return result;
};
