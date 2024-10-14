import { bind, isFunction } from "lodash";

/**
 * Extends object a by mutably adding to it the properties of object b.
 *
 * @param {Object} a The object to be extended
 * @param {Object} b The object to copy properties from
 * @param {Object} thisArg The object to bind function to
 *
 * @param {Boolean} [allOwnKeys]
 * @returns {Object} The resulting value of object a
 */
export const extend = (
  a: any,
  b: any,
  thisArg: any,
  { allOwnKeys }: { allOwnKeys?: boolean } = {}
) => {
  b.forEach(
    (val: any, key: string) => {
      if (thisArg && isFunction(val)) {
        a[key] = bind(val, thisArg);
      } else {
        a[key] = val;
      }
    },
    { allOwnKeys }
  );
  return a;
};

export function getStaticMethods(
  cl: any,
  includeProperty: string[] = [],
  excludeProperty: string[] = ["constructor"]
): Record<string, any> {
  const propertyNames = Object.getOwnPropertyNames(cl);

  const result: Record<string, any> = {};
  // 过滤出静态方法
  propertyNames
    .filter((property) => {
      return (
        (typeof cl[property] === "function" &&
          !excludeProperty.includes(property) &&
          !property.startsWith("_")) ||
        includeProperty.includes(property)
      );
    })
    .map((property) => {
      result[property] = cl[property];
    });

  console.log("result :>> ", result);
  return result;
}
