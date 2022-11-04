import { invoke, isPromise, isIterator, isIteratorFunction } from './util.mjs'

/**
 * Recursively invokes and resolves any "dynamic" data (promise, function, generator)
 * into a "static" (string, number, object, etc) asyncronous value.
 *
 * Provides a simple and flexible way to normalize data yielded by generators for querying.
 * Especially useful for working with promises and other iterators in generator functions.
 *
 * All captured values in `collector` are normalized via `entity`.
 *
 * TODO: Allow recursivity to be configured, it's arguably too implicit and aggressive.
 *
 * @param {*} data
 * @param {*} resolver
 * @returns {Promise}
 */
export async function entity (data, resolver) {
  // Normalize data
  if (typeof data === 'function') {
    return entity(data(resolver), resolver)
  }

  const value = isPromise(data) ? await data : data

  if (isIterator(data)) {
    return entity(await invoke(data), resolver)
  }

  // Normalize resolver
  if (typeof resolver === 'string') {
    return { [resolver]: value }
  }

  if (isIteratorFunction(resolver)) {
    return entity(value, resolver(value))
  }

  if (isIterator(resolver)) {
    return entity(await invoke(resolver))
  }

  if (isPromise(resolver)) {
    return entity(value, await resolver)
  }

  if (typeof resolver === 'function') {
    return await resolver(value)
  }

  return value
}

export default entity
