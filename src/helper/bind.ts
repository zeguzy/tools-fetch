export default function bind(fn: any, thisArg: any) {
  return function wrap() {
    return fn.apply(thisArg, arguments);
  };
}
