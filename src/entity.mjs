import { future, isPromise, isIterator, isIteratorFunction } from './util.mjs'

export async function entity (data, resolver) {
  try {
    if (typeof data === 'function') {
      return entity(data(resolver), resolver)
    }

    const value = isPromise(data) ? await data : data

    if (typeof resolver === 'string') {
      return { [resolver]: value }
    }

    if (isIteratorFunction(resolver)) {
      return entity(value, resolver(value))
    }

    if (isIterator(resolver)) {
      return entity(await future(resolver))
    }

    if (isPromise(resolver)) {
      return entity(value, await resolver)
    }

    if (typeof resolver === 'function') {
      // WORKS: But do we want to do this? Prevents resolvers from returning functions.
      // return entity(resolver(value))
      return resolver(value)
    }

    return value
  } catch (e) {
    console.error(e)
    throw e
  }
}

export default entity
