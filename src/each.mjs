import { symbol as Collector } from './collector.mjs'
import { entity } from './entity.mjs'
import { yielder } from './yielder.mjs'
import { init, invoke, isIterable, isIteratorFunction, isPromise, asSyncIterable } from './util.mjs'

import { map, yielding } from './lib/js-coroutines.mjs'

/**
 * Accepts iterable `items` and yields each item/value as a promised `entity` via provided `resolver`.
 * Ideal for situations where you need to `yield*` another iterator while performing transformations.
 *
 * If you just used `yield` instead (even with `each`), the entire iterator would be collected as a single value,
 * instead of collecting each individual value yielded by the iterator.
 *
 * Functionally identical to `js-coroutines/map` but allows `generator-collector` resolvers and Generators (instead of just GeneratorFunctions) to be provided.
 *
 * Does NOT support async iterators since its primary purpose is to support `yield*`.
 * However, when used in a `collector`, still automatically resolves all yielded promises for you.
 *
 * @generator
 * @param {Array|Collector|Iterator|Generator} [items]
 * @param {*} resolver
 * @yields {Promise} each iterated item as a resolved entity
 */
export function* each (items = [], resolver) {
  const iterable = isIterable(items) || isIteratorFunction(items) || !!items?.[Collector]
  const iterator = iterable ? items : [items]

  if (!iterable) {
    return yield* each(iterator, resolver)
  }

  if (iterable && !Array.isArray(iterator)) {
    for (const value of asSyncIterable(iterator)) {
      yield* each(value, resolver)
    } return
  }

  if (iterable && !isIteratorFunction(resolver)) {
    return yield* each(iterator, function* (value) {
      yield entity(value, resolver)
    })
  }

  return yield* map(iterator, resolver)

  // Functionally identical to above return - more explicit/readable, but perhaps more confusing..?
  // if (iterable && isIteratorFunction(resolver)) {
  //   return yield* map(iterator, resolver)
  // }

  // return yield entity(iterator, resolver)
}

export default each
