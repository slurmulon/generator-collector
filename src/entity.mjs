import { sync, isPromise, isIterator, isIteratorFunction } from './util.mjs'

export async function entity (data, resolver) {
  try {
    if (typeof data === 'function') {
      return entity(data(resolver), resolver)
    }

    const value = isPromise(data) ? await data : data

    // console.log('(1) [entity] &&&&& data, value', data, value, resolver)

    if (typeof resolver === 'string') {
      return { [resolver]: value }
    }

    if (isIteratorFunction(resolver)) {
      return entity(value, resolver(value))
    }

    if (isIterator(resolver)) {
      return entity(await sync(resolver))
    }

    if (isPromise(resolver)) {
      return entity(value, await resolver)
    }

    if (typeof resolver === 'function') {
      const r = await resolver(value)
      // console.log('ENTITY FUN RESOLVER', r)
      return r
    }

    // console.log('(2) [entity] ********** resoled', data, value, resolver)

    return value
  } catch (error) {
    console.error(error)
    throw error
  }
}

export default entity
