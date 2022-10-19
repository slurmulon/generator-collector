// import { singleton, wrapAsPromise } from 'js-coroutines'
import { future, isPromise, isIterator, isIteratorFunction } from './util.mjs'

// export const entity = async (data, resolver) => {
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

// export const entity = wrapAsPromise(function* (data, resolver) {
//   if (typeof data === 'function') {
//     // return entity(data(), resolver)
//     return entity(data(resolver), resolver)
//   }

//   const value = isPromise(data) ? yield data : data

//   if (typeof resolver === 'string') {
//     return { [resolver]: value }
//   }

//   if (isGeneratorFunction(resolver)) {
//     // return entity(value, run(resolver))
//     // return entity(value, yield* resolver(value))
//     // return entity(value, singleton(resolver)) // WORKS
//     return entity(value, wrapAsPromise(resolver)) // WORKS
//   }

//   if (isGeneratorIterator(resolver)) {
//     return entity(value, yield resolver)
//   }

//   if (isPromise(resolver)) {
//     return entity(value, yield resolver)
//   }

//   if (typeof resolver === 'function') {
//     return resolver(value) // WORKS (fastest, in tests)
//     // return entity(resolver(value)) // WORKS
//     // return yield* yielding(resolver, 0)(value) // WORKS (necessary?)
//     // return entity(yield* yielding(resolver, 0)(value)) // WORKS (necessary?)
//   }

//   return value
// })

export const unwrap = (value, key = '') => (
  value?.data
  ?? value?.value
  ?? value?.[key]
  ?? value
)

export default { entity, unwrap }
