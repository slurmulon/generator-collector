import { symbol as Collector } from './collector.mjs'
import { entity } from './entity.mjs'
import { yielder } from './yielder.mjs'
import { init, invoke, isIterable, isIteratorFunction, isPromise, asSyncIterable } from './util.mjs'

// import { map, yielding } from 'js-coroutines'
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
  // const iterable = isIterable(items) || isIteratorFunction(items) || !!items?.[Collector]
  const iterable = isIterable(items) || isIteratorFunction(items) || !!items?.[Collector]
  const iterator = iterable ? items : [items]

  // console.log('iterable???', iterable, items, resolver)
  // console.log('collector???', items?.[Collector])


  // (A) WORKS (LAST BEFORE 1.30.24)
  // if (!iterable) return yield items

  // if (!iterable) return yield items
  // if (!iterable) return yield* iterator

  // EXPERIMENT (1.30.24)
  //   - was hanging around from last visit to this project 2 years ago - reduces test failures to 1
  // 4.11.24
  //   - Fixes examples/each.mjs, works with tests
  if (!iterable) return yield* each(iterator, resolver)
  //

  // (B) IDEAL, but doesn't work yet
  // if (!iterable) return yield entity(items, resolver)
  // LAST!!!!!!!!!!!!!! 4.11.24
  //   - ON REVISIT, NOTICED: Breaks examples/each.mjs, works with tests
  // if (!iterable) {
  //   console.log('!!!! NOT ITERABLE!!!', items)
  //   yield entity(items, resolver); return
  //   // yield entity(items, resolver)
  // }

  if (iterable && !Array.isArray(iterator)) {
    // FIXME: Should use isIteratorLike instead for `iterable`, cannot reach (iterator.next) ternary (i.e. cannot support GeneratorIterators)!
    // for (const value of (iterator.next ? iterator : iterator())) {
    // BAD BAD BAD - the following log statement was breaking tests because it called init and invoked our generator collector wrongfully!
    // console.log('%%%%%%%%%%%%%%%%%%%%%%%%%%%% init??', init(iterator))
    // console.log('ITERATOR', init(iterator))
    //
    //
    //
    // TODO: VERIFY THAT init (or rather our usage of it here) WORKS WITH Collector
    // for (const value of init(iterator)) {
    //
    //
    // WORKS! 1.31.24
    // for (const value of iterator) {
    // INPROG: Fixes for bugs found in examples/each/index.mjs
    for (const value of asSyncIterable(iterator)) {
      // console.log('@@@ ---- each value', value)
    //
    // NEXT EXPERIMENT 1.30.24 (no diff from init(iterator) usage above)
    // for (const value of invoke(iterator)) {
      // yield entity(value, resolver)
      // (A)
      yield* each(value, resolver)
    } return
  }

  // if (!isIteratorFunction(resolver)) {
  if (iterable && !isIteratorFunction(resolver)) {
    return yield* each(iterator, function* (value) {
      yield entity(value, resolver)
    })
    // LAST/ORIG (before 1.30.24)
    //  - same number of tests fail as above (just 1 right now), but fills certain values with undefined and misses collecting a couple others
    // return yield* each(iterator, yielding(
    //   value => entity(value, resolver)
    // ))
  }

  // (A) Alt to below, seems to work the same 
  // return yield* map(iterator, resolver)

  // // (A) WORKS, but orig (above) is simpler and should work the same
  //  - UPDATE: As of 1.30.24, it seems to now with lates tchanges
  if (iterable && isIteratorFunction(resolver)) {
    return yield* map(iterator, resolver)
  }

  // (A)
  return yield entity(iterator, resolver)
}

export default each
