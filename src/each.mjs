import { symbol as Collector } from './collector.mjs'
import { entity } from './entity.mjs'
import { isIterable } from './util.mjs'

/**
 * Accepts iterable `items` and yields each item/value as a promised `entity` via provided `resolver`.
 * Ideal for situations where you need to `yield*` another iterator while performing transformations.
 *
 * If you just used `yield` instead (even with `each`), the entire iterator would be collected as a single value, instead of collecting each individual value yielded by the iterator.
 *
 * Does NOT support async iterators since its primary purpose is to support `yield*`.
 * However, `entity` still automatically resolves all yielded promises for you.
 *
 * @generator
 * @param {Array|Collector|GeneratorIterator} [items]
 * @param {*} resolver
 * @yields {Promise} each iterated item as a resolved entity
 */
export function* each (items = [], resolver) {
  const iterable = isIterable(items) || items?.[Collector]
  const iterator = iterable ? items : [items]

  for (const item of iterator) {
    yield entity(item, resolver)
  }
}

export default each
