import { invoke, isPromise, isIterator, isIteratorFunction } from './util.mjs'
import { promiser } from './promiser.mjs'

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

  // ORIG
  if (isIteratorFunction(resolver)) {
    // return entity(value, Array.from(resolver(value)))
    // return entity(Array.from(resolver(value)))
    return entity(value, resolver(value))
    // return entity(resolver(value))
  }

  if (isIterator(resolver)) {
    return entity(await invoke(resolver))
  }

  // NEXT
  // if (isIterator(resolver) || isIteratorFunction(resolver)) {
  //   console.log('@@@@@@@@@@@@@@@@@@@@@@@ entity iteratorllike resolver', value, resolver)
  //   return entity(value, promiser(resolver)(value))
  // }

  if (isPromise(resolver)) {
    // console.log('@@@@@@@@@@@@@@@@@@@@@@@ entity promise resolver', value, resolver)
    return entity(value, await resolver)
  }

  if (typeof resolver === 'function') {
    // console.log('@@@@@@@ entity resolver function', await resolver(value))
    // return await resolver(value)
    return await resolver(value)
  }

  return value
  // Causes inbetween undefines in examples/each.mjs
  // return Promise.resolve(value)
}

export default entity
