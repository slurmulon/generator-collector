# API
---

## Core

### `collector(function* generator, consumer = promiser): CollectorGenerator` :id=collector

Wraps a `generator` function and captures any yielded results encountered during iteration.

Calling the resulting function invokes the generator, providing an iterable collection object with special asynchronous query methods.

Does not support async generators due to internal usage of `yield*` but
automatically resolves any yielded promises (e.g. `await somePromise()` = `yield somePromise()`) when
iterating asynchronously.

```js
import { collector } from 'generator-collector'

const data = collector(function* () {
  yield 1
  yield Promise.resolve(2)
  yield [3, 4]
})

const query = data()
const resultSync = [...query()] // [1, Promise(2), [3, 4]]
const resultAsync = Promise.all([...query()]) // [1, 2, [3, 4]]
```

#### Consumers

?> Unless you have unique needs, it's not necessary or recommended to provide a custom `consumer` to `collector`.

Collector queries return promises that are orchestrated and resolved by a `consumer`.

A `consumer` is any function that converts a generator function into an asynchronous function.

In essence they are just asynchronous coroutines that can both iterate generators and resolve promises.

Because they are responsible for orchestration, `consumers` also enable you to tailor and optimize iteration to your specific needs.

##### 🎯 `promiser` (default)

The default `consumer`, which provides a minimal async coroutine interface around generators, is `collector-generator/promiser`.

The `promiser` coroutine simply resolves any promises yielded by the generator function it consumes, immediately yielding back control.

`promiser` does not explicitly utilize `requestIdleCallback`, `setTimeout` or other techniques typically needed for iterative high-performance animations around large data sets.

> Although `generator-collector` uses `promiser` by default, it _still_ uses `js-coroutines` internally via `find`, `map`, `yielding`, etc.

```js
import { collector, promiser } from 'generator-collector'

const empty = collector(function* () {}, promiser)
// Same as:
// const empty = collector(function* () {})
```

#### ⚡ `js-coroutines`

If you prefer or require that your application optimizes the thread as much as possible at the expense of timing consistency, you can instead provide `js-coroutine`'s `wrapAsPromise` or `singleton` functions as your `consumer`:

> Credit: Example contains snippets from [`js-coroutines`](https://github.com/miketalbot/js-coroutines#getting-started-writing-your-own-generators)

```js
import { collector } from 'generator-collector'
import { wrapAsPromise, forEach, map } from 'js-coroutines'

const squares = collector(function* () {
  let results

  // Create 2 million rows of random values
  results = new Array(2000000)
  for (let i = 0; i < 2000000; i++) {
    // Every 128th record, yield back control to allow thread to compute other tasks
    if ((i & 127) === 0) yield
    results[i] = (Math.random() * 10000) | 0
  }

  // Double all the values
  yield* forEach(
    results,
    yielding((r, i) => (results[i] = r * 2))
  )

  // Map their square roots
  return yield* map(
    results,
    yielding((r) => Math.sqrt(r))
  )
}, wrapAsPromise)
// ☝️  `wrapAsPromise` adds at least 160ms between each yield, ideal for high frame rates
```

### `entity(value: any, resolver: string | function): Promise<any>` :id=entity

The collected yielded results of a generator are referred to as "entities".

Beyond that, there is no strict definition, format or value type of an entity.

The utility of the `entity` function is it provides a consistent way to yield, collect and query _any_ type of value, regardless if it's synchronous, asynchronous, etc.

`entity` accepts any synchronous or asynchronous `value`, maps it against the provided `resolver` recursively (until `value` is both synchronous and not a function), then returns a yieldable promise.

Resolvers can be defined as a:
 - **String**: Wraps value in a single-property object, enabling (but not strictly necessary for) querying
 - **Function**: Accepts a resolved value and maps it into a new value

```js
import { collector, entity } from 'generator-collector'

const values = collector(function* () {
  const { a } = yield entity(1, 'a') // { a: 1 }
  const { b } = yield entity(Promise.resolve(2), 'b') // { b: 2 }
  const { c } = yield entity(3, data => ({ c: data })) // { c: 3 }
  const { d } = yield entity(Promise.resolve(4), data => ({ d: data })) // { d: 4 }
  const { e } = yield entity(() => 5, data => ({ e: data })) // { e: 5 }
  const { f } = yield entity(() => Promise.resolve(6), 'f') // { f: 6 }
  const { g } = yield entity(function* () { return yield 7 }, 'g') // { g: 7 }
  const { h } = yield { h: 8 } // data already in a favorable synchronous format? no need for `entity`
})

const indexes = [...values()].map(result => Object.values(result)[0]) // [1, 2, 3, 4, 5, 6, 7, 8]
```

### `list(items: any, resolver): Promise<any>` :id=list

Same as `entity` but applies `resolver` to each value in `items` instead of to `items` as a whole.

?> [`each`](#each) resolves the same way as `list`, but since it's a generator so it can be used with `yield*`!


```js
import { collector, list, entity } from 'generator-collector'

const values = collector(function* () {
  const a = yield list([1, 2, 3], 'a') // [{ a: 1 }, { a: 2 }, { a: 3 }]
  const b = yield list(Promise.resolve([4, 5, 6]), 'b') // [{ b: 4 }, { b: 5 }, { b: 6 }]
  const c = yield entity([7, 8, 9], 'c') // { c: [7, 8, 9] }
})

// [[{ a: 1 }, { a: 2 }, { a: 3 }], [{ b: 4 }, { b: 5 }, { b: 6 }], { c: [7, 8, 9] }]
const all = await values().all()
```

### `each(items: any, resolver): Generator<Promise>` :id=each

Same resolution logic as `list` but returns a generator instead of a promise, allowing it to be used with `yield*`.

When it comes to collection, the primary difference between `each` and `list` is:
  - `each` will continue iteration and cause each value in the iterator to be collected individually (**flat**).
  - `list` will await, collect and return a single array, NOT the individual iterated values (**nested**).

Automatically converts non-iterable `items` into a single-value array.

Automatically resolves promised values (contained within `items`) via `entity`.

Does NOT accept `items` as a promise since it cannot automatially resolve this promise without interfering with collection.

```js
import { collector, each } from 'generator-collector'

const values = collector(function* () {
  const a = yield* each([1, 2, 3], 'a') // [{ a: 1 }, { a: 2 }, { a: 3 }]
  const b = yield* each(([Promise.resolve(4), 5, 6]), 'b') // [{ b: 4 }, { b: 5 }, { b: 6 }]
  const c = yield* each(7, 'c') // [{ c: 7}]
})

// [{ a: 1 }, { a: 2 }, { a: 3 }, { b: 4 }, { b: 5 }, { b: 6 }, { c: 7 }]
const all = await values().all()
```

## Queries

`generator-collector` provides a simple yet fundamental query interface.

`generator-collector` does not explicitly concern itself with joins,
indexes or other relational features found in (actual) database systems.

This sort of logic can be achieved if needed by using nested `collectors`, however that topic is out of the scope of essential documentation.

The invocation of a query is always lazy, but the _iteration_ of a query can be either:
  - **Lazy**: Only queries against previously collected results (`.first`)
  - **Greedy**: Iterates the entire generator to match against all results (`.all`, `.last`, `.group`).
  - **Eager**: Continues iterating the generator until enough results match (`.first`, `.take`)

For optimal iteration, call lazy and eager queries before greedy queries whenever possible.

The results of queries are awaitable promises, serving as a boundary between generator functions (invasive, complicated integration) and async functions (less invasive, easier integration).

Once a collector's generator has completed iteration, queries will not re-invoke the generator
and will match only against its cached results.

The cached/collected results and iteration state of a generator can be cleared any time using `.clear()`.

### Selectors <!-- {docsify-ignore} -->

Every query method can accept a selector (default: `true`).

Selectors define what values are considered "matching" in any given query.

Selectors can be either a:
 - **String**: Matches any yielded object value containing an own property equal to the string
 - **Function**: Accepts a yielded value and returns true if a value matches (i.e. JavaScript `Array.prototype.find`)
 - **Boolean**: `true` matches all yielded values, `false` matches no yielded values
 - **Other**: Matches any yielded value strictly equal to the selector

Selectors do not impact the values your collector captures - it just captures anything that gets `yield`ed.
Selectors only influence the results of your query at hand.

Lastly, selectors will only capture the `return` value of your collector generator function when
using `return yield`.

This is by design since it allows you to explicitly define whether you want to separate your
generator's returned value from all other yielded values (regardless of any queries or selectors).

### `find(selector=true, next=false): Promise<any>` :id=query-find

Provides the first yielded value matching a selector, pausing iteration once found (lazy).

Subsequent identical calls will always return the first occurance of a matching value unless `next` is `true`.

Logically identical to `Array.prototype.find`.

 - **Returns**: First yielded value matching selector
 - **Iteration**: Lazy
 - **Aliases**: `get`, `first`

```js
import { collector } from 'generator-collector'

const letters = collector(function* (x) {
  yield { 'a': x }
  yield { 'b': x+4 }
  yield { 'c': x+8 }
})

// Invoked queryable generator
const query = letters(1)

// { b: 4 }
const b = await query.find(x => x >= 3)

// { c: 9 }
const c = await query.find(x => x >= 3, true)
```

### `all(selector=true, lazy=false): Promise<Array<any>>` :id=query-all

Provides all yielded values matching a selector as a flat array.

Iterates the entire generator when greedy (`lazy: false`) in order to determine every matching value.

Matches only against previously collected generator results when `lazy: true`.

Logically identical to `Array.prototype.filter`.

 - **Returns**: All yielded values matching selector
 - **Iteration**: Greedy (default), Lazy

!> NEVER use greedy queries on infinite generators, the promise will never resolve!

```js
import { collector } from 'generator-collector'

const letters = collector(function* (x) {
  yield { 'a': x }
  yield { 'b': x+2 }
  yield { 'b': x+3 }
  yield { 'c': x+4 }
})

// Invoked queryable generator
const query = letters(1)

// [{ b: 3 }, { b: 4 }]
const results = await query.all('b')
```

### `last(selector=true, lazy=false): Promise<any>` :id=query-last

Provides the last yielded value matching a selector.

Iterates the entire generator when greedy (`lazy: false`) in order to determine every matching value.

Matches only against previously collected generator results when `lazy: true`.

Logically identical to `Array.prototype.at(arr, -1)`.

 - **Returns**: Last yielded value matching selector
 - **Iteration**: Greedy (default), Lazy

!> NEVER use greedy queries on infinite generators, the promise will never resolve!

```js
import { collector } from 'generator-collector'

const letters = collector(function* (x) {
  yield { 'a': x }
  yield { 'b': x+2 }
  yield { 'b': x+3 }
  yield { 'c': x+4 }
})

// Invoked queryable generator
const query = letters(1)

// { b: 4 }
const b = await query.last('b')
```

### `take(selector=true, count=1, lazy=false): Promise<Array>` :id=query-take

Provides up to `count` yielded values matching a selector (inclusive).

Continues iterating generator when eager (`lazy: false`) in order to determine enough matching values.

Matches only against previously collected generator results when `lazy: true`.

 - **Returns**: Up to `count` yielded values matching selector
 - **Iteration**: Eager (default), Lazy

```js
import { collector } from 'generator-collector'

const letters = collector(function* (x) {
  yield { 'a': x }
  yield { 'b': x+2 }
  yield { 'b': x+3 }
  yield { 'c': x+4 }
})

// Invoked queryable generator
const query = letters(2)

// eager iteration => { b: 4 }
const [b] = await query.take('b', 1)

// lazy iteration => { b: 4 }
const [b2] = await query.take('b', 1, true)

// eager iteration, more matches => { b: 5 }
const [b3] = await query.take('b', 1)

// eager iteration, no more matches => []
const [b4] = await query.take('b', 1)

// lazy iteration, complete => [{ b: 4 }, { b: 5 }]
const [b5, b6] = await query.take('b', 2, true)

// eager iteration, complete => []
const b7 = await query.take('b', 3)
```

### `group(selector=true, grouping, lazy=false): Promise<Object>` :id=query-group

Groups all yielded values matching a selector according to `grouping` function into a single object.

Iterates the entire generator when greedy (`lazy: false`) in order to determine every matching value.

Matches only against previously collected generator results when `lazy: true`.

 - **Returns**: Yielded values matching selector grouped by `grouping`
 - **Iteration**: Greedy (default), Lazy

!> NEVER use greedy queries on infinite generators, the promise will never resolve!

```js
import { collector } from 'generator-collector'

const letters = collector(function* (x) {
  yield { 'a': x, color: 'red' }
  yield { 'b': x+2, color: 'blue' }
  yield { 'b': x+3, color: 'red' }
  yield { 'c': x+4, color: 'blue' }
})

// Invoked queryable generator
const query = letters(1)

// greedy iteration, selecting all results
const {
  red,  // [{ a: 1, color: 'red' }, { b: 4, color: 'red' }]
  blue  // [{ b: 3, color: 'blue' }, { c: 5, color: 'blue' }]
} = await query.group(true, ({ color }) => color)
```

### `Symbol.iterator` + `Symbol.asyncIterator` :id=query-iterator

A collector generator can be iterated as any other generator since it implements the `Symbol.iterator` and `Symbol.asyncIterator` interfaces:

!> Avoid combining native iterators with other queries!

```js
import { collector } from 'generator-collector'

const letters = collector(function* (x) {
  yield { 'a': x }
  yield { 'b': x+1 }
  yield { 'c': x+2 }
})

// Invoked queryable generator
const query = letters(1)

// [{ a: 1 }, { b: 2 }, { c: 3 }]
const res1 = Array.from(query)
const res2 = [...query]

for (const x of query) console.log(x)
for await (const x of query) console.log(x)
```
