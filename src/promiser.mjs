import { iterate } from './util.mjs'

/**
 * Wraps and invokes a generator function, recursively resolving any promises
 * yielded during iteration.
 *
 * Supports both plain and async generator functions.
 * Established as the default `consumer` in `collector` because of this benefit.
 *
 * @param {Generator|GeneratorFunction} generator
 * @returns {Promise} result of generator
 */
export function promiser (generator) {
  return function (...args) {
    const iterator = iterate(generator, ...args)

    return Promise.resolve().then(async function resolved (data) {
      const { done, value } = await iterator.next(data)

      if (done) return value

      return Promise
        .resolve(value)
        .then(resolved, iterator.throw.bind(iterator))
    })
  }
}

export default promiser
