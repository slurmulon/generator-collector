# API
---

## Core

### `collector(function* generator): CollectorGenerator` :id=collector

Wraps a generator function and captures any yielded results encountered during iteration.

Calling the resulting function invokes the generator, providing an iterable collection object with special asynchronous query methods.

Does not support async generators due to internal usage of `yield*` and the current state of `js-coroutines`.

Automatically resolves any yielded promises (e.g. `await somePromise()` = `yield somePromise()`).

```js
import { collector } from 'generator-collector'

const data = collector(function* () {
  yield 1
  yield Promise.resolve(2)
  yield [3, 4]
})

const query = data()
const results = [...query()] // [1, 2, [3, 4]]
```

### `entity(value: any, resolver: string | function): Promise<any>` :id=entity

The collected yielded results of a generator are referred to as "entities".

Beyond that, there is no strict definition, format or value type of an entity.

The utility of the `entity` function is it provides a consistent way to yield, collect and query _any_ type of value, regardless if it's synchronous, asynchronous, etc.

`entity` accepts any synchronous or asynchronous `value`, maps it against the provided `resolver` recursively (until `value` is both synchronous and not a function), then returns a yieldable promise.

Resolvers can be defined as a:
 - **String**: Wraps value in a single-property object, enabling (but not strictly necessary for) querying
 - **Function**: Accepts a resolved value and maps it into a new value

It's only required to use `entity` when you:
 - Want to normalize all yielded values from your collector for querying purposes (**recommended**)
 - Need to await on nested promises in your collector generator functions (`async function*` is not possible)

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

## Queries

`generator-collector` provides a simple yet fundamental query interface.

`generator-collector` does not explicitly concern itself with joins,
indexes or other relational features found in (actual) database systems.

This sort of logic can be achieved if needed by using nested `collectors`, however that topic is out of the scope of essential documentation.

The invocation of a query is always lazy, but the _iteration_ of a query can be either lazy (`.first`) or greedy (`.all`, `.last`).

For optimal iteration, call lazy queries (`.find`) before greedy queries (`.all`, `.last`) whenever possible.

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

### `find([optional selector=true], [optional next=false]): Promise<any>` :id=query-find

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

### `all([optional selector=true]): Promise<Array<any>>` :id=query-all

Provides all yielded values matching a selector as a flat array.

Iterates the entire generator (greedy) in order to determine every matching value.

Logically identical to `Array.prototype.filter`.

 - **Returns**: All yielded values matching selector
 - **Iteration**: Greedy

!> NEVER use on infinite generators, the promise can never resolve!

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

### `last([optional selector=true]): Promise<any>` :id=query-last

Provides the last yielded value matching a selector.

Iterates the entire generator (greedy) in order to determine every matching value.

Logically identical to `Array.prototype.at(arr, -1)`.

 - **Returns**: Last yielded value matching selector
 - **Iteration**: Greedy

!> NEVER use on infinite generators, the promise can never resolve!

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
