import { isPromise } from './util.mjs'

/**
 * Transforms a plain function into a generator function.
 * Automatically yields result of function if it's a promise.
 *
 * Alternative version of `js-coroutines/yielding` that allows
 * the function's return value to be optionally yielded.
 *
 * @param {Function} fn
 * @param {Boolean} [returns] if the returned value should also be yielded
 * @returns {GeneratorFunction}
 */
export const yielder = (fn, returns = true) => {
  return function* (...args) {
    let result = fn(...args)

    if (isPromise(result)) {
      result = yield result
    }

    return returns ? yield result : result
  }
}

export default yielder
