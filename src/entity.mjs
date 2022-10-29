import { invoke, isPromise, isIterator, isIteratorFunction } from './util.mjs'

export async function entity (data, resolver) {
  try {
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
  } catch (error) {
    // console.error(error)
    throw error
  }
}

export default entity
