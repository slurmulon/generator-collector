import { isIteratorFunction } from './util.mjs'

/**
 * Wraps and invokes a generator function, recursively resolving any promises
 * yielded during iteration.
 *
 * Supports both plain and async generator functions.
 * Established as the default `consumer` in `collector` because of this benefit.
 *
 * @param {GeneratorFunction} generator
 * @returns {Promise} result of generator
 */
export function promiser (generator) {
  // if (!isIteratorFunction(generator)) {
  //   throw TypeError(`promiser must wrap a generator function: ${generator?.constructor?.name}`)
  // }

  return function (...args) {
    // const iterator = generator(...args)
    const iterator = generator.next ? generator : generator(...args)

    return Promise.resolve().then(async function resolved (data) {
      const { done, value } = await iterator.next(data)

      // console.log('DONE!', done, await value, data)

      if (done) return value
      // if (done || await value === void 0) return value || data

      return Promise
        .resolve(value)
        .then(resolved, iterator.throw.bind(iterator))
    })
  }
}

export default promiser
