import coroutines from 'js-coroutines'
import { isPromise, isGeneratorFunction } from './util.js'
const { yielding, wrapAsPromise } = coroutines

export const entity = wrapAsPromise(function* (data, resolver) {
  if (typeof data === 'function') {
    return entity(data(), resolver)
  }

  const value = isPromise(data) ? yield data : data

  if (typeof resolver === 'string') {
    return { [resolver]: value }
  }

  if (typeof resolver === 'function') {
    // return resolver(value) // WORKS
    return yield* yielding(resolver, 0)(value) // WORKS (necessary?)
  }

  if (isPromise(resolver)) {
    return entity(value, yield resolver)
  }

  if (isGeneratorFunction(resolver)) {
    return entity(value, wrapAsPromise(resolver))
  }

  return value
})

export const unwrap = (value, key = '') => (
  value?.data
  ?? value?.value
  ?? value?.[key]
  ?? value
)

export default { entity, unwrap }
