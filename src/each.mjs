import { symbol as Collector } from './collector.mjs'
import { entity } from './entity.mjs'
import { yielder } from './yielder.mjs'
import { isIterable, isIteratorFunction, isPromise } from './util.mjs'

import { map } from 'js-coroutines'

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
 * @param {Array|Collector|GeneratorIterator} [items]
 * @param {*} resolver
 * @yields {Promise} each iterated item as a resolved entity
 */
// export const each = map
//

// WORKS
// const yielder = (fn, returns = true) => {
//   return function* (...args) {
//     let result = fn(...args)

//     // console.log('yielderrrrrrrr', result, args)

//     // if (result && result.then) {
//     if (isPromise(result)) {
//       result = yield result
//     }

//     return returns ? yield result : result
//   }
// }

export function* each (items = [], resolver) {
  // BEST
  // console.log('EACH!!!', items, resolver, isIteratorFunction(resolver))
  const iterable = isIterable(items) || items?.[Collector]
  const iterator = iterable ? items : [items]

  // if (typeof resolver === 'string') {
  //   // return yield* each(items, yielding(item => ({ [resolver]: item })))
  //   return yield* each(iterator, yielder(item => ({ [resolver]: item })))
  // }

  if (iterable && !Array.isArray(iterator)) {
    // WORKS
    // return yield* each(Array.from(iterator), resolver)
    // const results = yield* iterator
    // return yield* each(results, resolver)

    // ALSO WORKS
    //  - better since it doesn't block on Array.from
    // const results = []
    for (const value of iterator) {
      yield entity(value, resolver)
      // results.push(result)
    }
    // return results
    return
  }

  if (!isIteratorFunction(resolver)) {
    // return yield* each(items, yielding(resolver))
    // NEXT (BEST)
    // return yield* each(iterator, yielder(resolver))
    // NEXT (BEST2)
    //  - FIXES both examples/each.mjs and tests
    return yield* each(iterator, function* (value) {
      yield entity(value, resolver)
    })
    // return each(items, yielder(resolver))
    // return map(items, yielder(resolver))
  }
  // console.log('EACH MAPPING', iterator, resolver)

  // NEXT (BEST)
  // FIXES example/each.mjs, breaks 2 tests (doesn't resolve promises!)
  return yield* map(iterator, resolver)

  // FIXES tests, breaks example/each.mjs
  // for (const value of (iterator.next ? iterator() : iterator)) {
  //   yield entity(value, resolver)
  // }
  // return yield* map(iterator, function* (value) {
  //   return yield entity(value, resolver)
  // })

  // return yield* map(items, yielding(item => {
  //   // return resolver(item)
  //   return entity(item, resolver)
  // }))
}

// TODO: Refactor this to be `js-coroutines/map` but ALSO accept (optionally) non-generator functions (or automatically wrap them as such)
export function* each2 (items = [], resolver) {
  const iterable = isIterable(items) || items?.[Collector]
  const iterator = iterable ? items : [items]

  if (isIteratorFunction(resolver)) {
    return yield* each(iterator, resolver(iterator[0]))
    // return yield* each(iterator.next(, )
  }

  if (isIterator(resolver)) {
    const { value, done } = resolver.next(iterator[0])
    // console.log('das iterator', value, done, iterator[0])
    // if (done) return yield value
    // if (done) return value
    if (done) return iterator[0]
    return yield* each(items, resolver)
  }

  let results = []

  for (const item of iterator) {
    // const data = yield entity(item, resolver)
    // const data = resolver?.(item)
    // FIXES handling of promises but limits resolver use to function for non-promises
    // TODO Also should handle situation if resolver is a generator/iterator (in entity)
    const data = isPromise(item)
      ? yield entity(item, resolver)
      : resolver?.(item)

    // if (isIteratorFunction(resolver)) {
    //   return yield* each(item, resolver(item))
    //   // return entity(value, Array.from(resolver(value)))
    // }

    // if (isIterator(resolver)) {

    // }


    // console.log('GOT DATA', item, data, resolver, entity(item, resolver))

    results.push(
      // 'turd'
      data
      // yield entity(item, resolver)
      // entity(item, resolver)
    )

    yield data


    // console.log('next RESULT DATA', results)
  }

  // console.log('FINAL RESULTS YO', results)

  // return 'dingus'
  return results
  // return list(Promise.all(results))
}

export default each
