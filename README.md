# generator-collector
> :recycle: Lazily collect and query generators
---

## Introduction

As I use generators more in my JS projects, sometimes I only want to iterate up to a certain value and collect it.

I also want to do this **without**:
  - Having to know when or how the generator reaches my value(s) (**Answer**: Declarative interface)
  - Iterating more than necessary to reach my value(s) (**Answer**: Lazy iteration)
  - Writing imperative `for` and `while` loops and/or requiring multiple statements (**Answer**: Functional interface)
  - Being constrained by how many different values I need to collect or at what point (**Answer**: Composables, Inversion of control)
  - Forcing generator consumers (or beyond) to become generators themselves (**Answer**: Asynchronous coroutines)

`generator-collector` is a minimal library based on `js-coroutines` that makes this all an easy and lightweight task:

 - Lazily query generators only for what your consumer needs - iteration is declarative yet intuitive and controllable.
 - Minimal impact on your code - don't worry, you don't need to "generatorfy" _every_ function :trollface:.
 - Effortlessly translate affected asynchronous functions into generator functions by replacing `await` with `yield` and `function` with `function*`.
 - Collection queries are asynchronous (`async/await`) yet backed entirely by thread-friendly generators.
 - Optimize your generator's iteration based on how you structure and order your collection queries.


> :warning: **Notice**
> 
> `generator-collector` is **expiermental** and should not be considered stable for production use.

## Preview

```js
import { collector } from 'generator-collector'

// Provide any generator function, especially one that can return different types or values
const pets = collector(function* (owner) {
  yield { cat: true, name: 'Bigs', message: 'meow', color: 'white', owner }
  yield { dog: true, name: 'Chancey', message: 'woof', color: 'grey', owner }
  yield { cat: true, name: 'Glorb', message: 'meowwwwww', color: 'grey', owner }
  yield { dog: true, name: 'Zeus', message: 'WOOF', color: 'white', owner }
})

// Invoke your generator function as usual, but receive a "collection" query API instead of a generator
const query = pets('George')

// Lazily and asynchronously query the yielded results of the generator:

// Iterates up to the first yielded object with a 'dog' property
const firstDog = await query.find('dog')

// Returns the next dog after the last encountered match in a previous find query (next = true)
const nextDog = await query.find('dog', true)

// Iterates the entire generator and return all yielded objects with `cat`
const allCats = await query.all('cat')

// Same as above, but avoids consuming the entire generator again!
const allDogs = await query.all('dog')

// Provide your own matcher function to any query method
const glorbCat = await query.find(({ name }) => name === 'Glorb')
const firstGreyPet = await query.find(({ color }) => color === 'grey')
const lastGreyPet = await query.last(({ color }) => color === 'grey')
const allGreyPets = await query.all(({ color }) => color === 'grey')

// Iterate and reduce every yielded value into an array
const allPets = await query.all()
const allPets2 = await query()

// Supports native iteration constructs (NOT recommended to combine with queries!)
for (const pet of query) console.log('iter pet', pet)
for await (const pet of query) console.log('async iter pet', pet)
const results1 = Array.from(query) // => query.all(), query()
const results2 = [...query] // => query.all(), query()

// Optionally clear the cached generator results when you're done (helps avoid memory leaks).
// Automatically called when calling the collection as function (e.g. `await query()`)
query.clear()
```

## Installation

Currently only ESM modules are supported. UMD and CJS builds will be supported soon.

### ESM

```sh
$ npm i github:slurmulon/generator-collectors
```

## API

### Core

### `collector(function* generator) -> CollectorGenerator`

Wraps a generator function and captures any yielded results encountered during iteration.

Calling the resulting function invokes the generator, providing an iterable collection object with special asynchronous query methods.

Does not support async generators due to internal usage of `yield*` and the current state of `js-coroutines`.

Automatically resolves any yielded promises (e.g. `await somePromise()` = `yield somePromise()`.

```js
import { collector } from 'generator-collector'

const data = collector(function* () {
  yield 1
  yield Promise.resolve(2)
  yield [3, 4]
})

const query = data()
const results = [...query] // [1, 2, [3, 4]]
```

### `entity(value: any, resolver: string | function): Promise<any>`

The collected yielded results of a generator are referred to as "entities".

Beyond that, there is no strict definition, format or value type of an entity.

The utility of the `entity` function is it provides a consistent way to yield, collect and query _any_ type of value, regardless if it's synchronous, asynchronous, etc.

`entity` accepts any synchronous or asynchronous `value` and maps it against the provided `resolver`, returning a yieldable promise.

Resolvers can be defined as a:
 - **String**: Wraps value in a single property object, enabling (but not strictly necessary for) querying
 - **Function**: Accepts a resolved value and maps it into a new value

It's only required to use `entity` when you:
 - Want to normalize all yielded values from your collector for querying purposes (**recommended**)
 - Need to await on promises in your collector generator functions (`async function*` is not possible)

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

### Queries

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

#### Selectors

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

#### Functions

#### `find([optional selector=true], [optional next=false]): Promise<any>`

Provides the first yielded value matching a selector, pausing iteration once found (lazy).

Subsequent identical calls will always return the first occurance of a matching value unless `next` is `true`.

Logically identical to `Array.prototype.find`.

 - Returns: First yielded value matching selector
 - Iteration: Lazy
 - Aliases: `get`, `first`

#### `all([optional selector=true]): Promise<Array<any>>`

Provides all yielded values matching a selector as a flat array.

Iterates the entire generator (greedy) in order to determine every matching value.

Logically identical to `Array.prototype.filter`.

 - Returns: All yielded values matching selector
 - Iteration: Greedy
 - Caution: NEVER use on infinite generators, the promise can never resolve!

#### `last([optional selector=true]): Promise<any>`

Provides the last yielded value matching a selector.

Iterates the entire generator (greedy) in order to determine every matching value.

Logically identical to `Array.prototype.at(arr, -1)`.

 - Returns: Last yielded value matching selector
 - Iteration: Greedy
 - Caution: NEVER use on infinite generators, the promise can never resolve!

##### `Symbol.iterator` + `Symbol.asyncGenerator`

A collector generator can be iterated as any other generator since it implements the `Symbol.iterator` and `Symbol.asyncIterator` interfaces:

```js
import { collector } from 'generator-collector'

const letters = collector(function* (x) {
  yield { 'a': x }
  yield { 'b': x+1 }
  yield { 'c'  x+2 }
})

// Invoked queryable generator
const query = letters(1)

// [{ a: 1 }, { b: 2 }, { c: 3 }]
const res1 = Array.from(query)
const res2 = [...query]

for (const x of query) console.log(x)
for await (const x of query) console.log(x)
```

## Approach

This solution is influenced by Elixir's amazing `with` statement, which has noticeably improved the structure and flexibility of my own code.

It also aims to leverage and expand on the innovative `js-coroutines` package, which anyone interested in next-level browser performance should certainly check out.

### Design

`generator-collector` allows you to declare _what_ you need from a complex generator without needing to concern _when or how_ it gets generated.

You can think of it as a declarative API for watching (and collecting) the yielded results of your generator.

<!-- Simply wrap any generator function with `collector`, which returns a functional proxy to your generator.
Once that function is called (providing any arguments as you normally would to your generator function), the generator is invoked and a collection object is returned.

You can then call (and `await`) query methods on the returned collection (`.find()`, `.all()`) to lazily capture any matching results of your generator as it iterates. -->

This declarative approach gives you more flexibility and control over how you consume generators, especially those producing multiple types of data.

This is achieved by abstracting away the iterative/procedural details of the generator behind a data-driven facade (but still makes them accessible for native generator compatibility).

It also simplifies generator integration with async functions thanks to `js-coroutines` - you can yield promises in non-async generator functions, and every `collector` query method is a coroutine-backed promise!

Use it only where you need it, use it without complicating your code, and leave the rest of your code happily unaffected.

### Performance

Outside of the natural benefits of generators/coroutines, the iteration process is primarily optimized based on the query methods (`.all()`, `.find()`) you call in your collection consumer (and in which order).

More specifically, it can optimize the generator iteration process depending on what your consumer needs and when it needs it. The rules are simple and straightforward:

 - It will never iterate farther than needed to find the first matching result (via `collection.find(selector)`).
 - It will automatically iterate through the _entire_ generator if you're querying on the entire collection (via `collection.all(selector)` or `collection.last(selector)`).

Out in the wild, additional factors influence how eager, lazy and thorough the iteration process is:
  - The order in which you call `find` and `all`/`last` queries in your collection consumer
  - The nature of your consumer's queries (i.e. what data/values you're querying for, and how much)
  - The nature of your generator's results (i.e. what types of data it returns, how many values it returns)
  - The order which your generator yields its results

For the best potential performance gains, hoist your `find` queries before any `all` or `last` queries wherever it's possible.

In general, the less iterations your generator has to go through to produce the results of your consumer's queries, the greater the performance.

## Comparison

### Before

Consumption of generators producing the same type of data is trivial and rarely a problem.

Many times you simply want to iterate through the entire generator, take the last result, etc:

```js
function* cart() {
  yield { id: 1, item: 'zucchini', type: 'produce' }
  yield { id: 2, item: 'beef', type: 'meat' }
  yield { id: 3, item: 'marinara', type: 'sauce' }
}

for (const item of cart) {
  console.log('cart item', item.id)
  doSomethingWithCartItem(item)
}
```

On the contrary, consuming generators that can produce a variety of data is inelegant and ambiguous:

```js
function* shop () {
  yield { recycle: { id: 1, item: 'can', amount: 20 } }
  yield { add: { id: 1, item: 'zucchini', type: 'produce' } }
  yield { add: { id: 2, item: 'beef', type: 'meat' } }
  yield { checkout: { payment: 'card', total: 100 } }
}

function groceries () {
  const session = shop()
  session.next() // ignore recycle

  // Get each item in the cart
  // Problem: Without more robust logic, we have to know which yields have items, and how many
  const items = [session.next(), session.next()]
  const { checkout: { total } } = session.next()

  return { items, total }
}
```

The consumer of this type of generator must become painfully aware of the inner details of the generator in order to parse it.

Even when these details are known and properly supported, the consumer's code is brittle and difficult to understand.

In my opinion, this is a huge yet avoidable deterent that prevents developers from experiencing the full potential of generators.

## After

Using `generator-collector` we can circumvent all of these problems without fundamentally changing our approach:

```js
import { collector } from 'generator-collector'

const shop = collector(function* shop() {
  yield { recycle: { id: 1, item: 'can', amount: 20 } }
  yield { add: { id: 1, item: 'zucchini', type: 'produce' } }
  yield { add: { id: 2, item: 'beef', type: 'meat' } }
  yield { checkout: { payment: 'card', total: 100 } }
})

function async groceries () {
  const session = shop()

  const items = await session.all('add') // reduce all yielded objects with an `add` prop
  const { checkout: { total } } = await session.find('checkout') // find first yielded object with a `checkout` prop

  return { items, total }
}
```

This solution reads much nicer and easily scales with the complexity of your code.

We also gain the benefits of generators while keeping them contained and compatible with our async functions.

<!-- There is also nothing stopping you from iterating through the collection natively - instead just call `.next()` in a `while` or `for of` like you would with any generator.

> :warning: **Warning**
> 
> Although you can access your generator function directory via `.next()`, be aware that this will **not** trigger any of your queries.
> 
> It's strongly recommended to either use collection queries or `.next()`, **never** both on the same collection generator. -->

## Laziness

In this example we show how `generator-collector` can improve performance by giving consumers the ability to lazily match results while we iterate.

Whenever you await on `collector.find`, the generator will only iterate until it finds the first yielded result that matches your condition.

```js
import { collector } from 'generator-collector'

async function bakery () {
  const ingredients = function* () {
    yield { ingredient: 'sugar', quantity: '85g' }
    yield { ingredient: 'love': quantity: Infinity }
    yield { ingredient: 'egg', quantity: '1' }
    yield { ingredient: 'chocolate-chips', quantity: '340g' }
    yield { junk: true }
    yield { ingredient: 'flour', quantity: '8tbs' }
  }

  const bake = function* () {
    const contents = yield* ingredients()

    yield { cook: 'mix', contents } 
    yield { cook: 'bake', preheat: true, temp: 375, time: 10, contents }
    yield { food: { id: Math.random() * 1000, type: 'cookies', amount: 20 } }
  }

  const serve = function* (name, food) {
    yield { serve: { name, food } }
    yield { rating: { name, food, rating: Math.floor(Math.random() * 5) } }
  }

  const recipe = collector(function* (name) {
    const { food } = yield* bake(name)

    return yield* serve(name, food)
  })

  const cookies = recipe('cookies')
  const { love } = await cookies.find(res => res?.ingredient === 'love')
  console.log('found love', love) // only yields twice, stopping on the first matching case

  const { food } = await cookies.find('food')
  console.log('got cookies', food)

  await cookies.sleep(4000) // give the cookies time to cool before serving
  await cookies.find('serve') // continue iterating until we serve

  console.log('ate cookies')
  await cookies.sleep(2000) // give the cookies time to be eaten and rated after being served

  const { rating } = await cookies.find('rating') // capture the rating of the cookies
  console.log('rated cookies', rating)
}

bakery()
```

Aside from improving thread performance, this gives consumers more control over the workflow of the generator without exposing its internal details.

This is especially useful when, say, you want to wait until a subset of API requests made from a generator are complete and don't care about anything else happening in the generator beyond that (like unrelated API requests).

## Integration

Here we will explore how `generator-collectors` is framework agnostic and easy to integrate with anything that's already using promises.

The following examples represent a blog site written in Vue 3, and the data loading interface will be refactored to use a collector.

### Producer

The first example is a basic mock module for loading (producing) the site's data from its "API" (use your imagination, the point is we're using promises).

Although simple, it's a universal pattern that many people use to centralize data loading logic and flows across components.

#### `src/api/fetch.js`

```js
function fetchSite() {
  return Promise.resolve({ id: 1, name: 'Generator Blog', url: 'http://genblog.fake', links: [], token: '12345' })
}

function fetchCurrentUser(session) {
  return Promise.resolve({ id: 10, name: 'Jen', username: 'jen', token: '987623', session })
}

function fetchSitePosts(site, page) {
  return Promise.resolve({ site, items: [1, 2, 3, 4, 5] })
}

const fetch = async function () {
  const site = await fetchSite()
  const user = await fetchCurrentUser(site.token)
  const posts = await fetchSitePosts(site, 0)

  return { site, user, posts }
})
```

In order to integrate `generator-collector`, the only function we need to change is `fetch`.

First we key each `fetch*` promise in a wrapper object, that way consumers can query for that key later:

 - **Before**: `await fetchSite()`
 - **After**: `entity(fetchSite(), site => ({ site }))` or `entity(fetchSite(), 'site')` (identical)
<!-- - **After**: `{ site: await fetchSite() }` -->

> We use `entity` here because we want to wrap `fetchSite`'s promised data with `{ site }` so it's easier to query (optional).
> 
> If your promise already returns data that suits your queries, using `entity` is not necessary and you can just replace `await` with `yield`:
>
> `await fetchSite()` :arrow_right: `yield fetchSite()`.
>
> Otherwise, you **must** use `entity` to provide a yieldable and mappable promise.
>
> `entity` is necessary as a replacement for `await` because `js-coroutines` doesn't support async generators yet:
>
> `const { site } = yield { site: await fetchSite() } // NOPE: Ideal, but doesn't work (yet)`

<!-- > This wrapper object is the default convention for querying but is not strictly necessary.
> Queries can accept any matcher function and can work with any type of data. -->

Next we prefix each `entity` with `yield` and destructure the result for assignment:
 - **Before**: `const site = entity(fetchSite(), 'site')`
 - **After**: `const { site } = yield entity(fetchSite(), 'site')`
<!-- - **Before**: `const site = { site: await fetchSite() }` -->
<!-- - **After**: `const site = yield { site: await fetchSite() }` -->

Lastly we update our function signature so it's a collector generator:
 - **Before**: `const fetch = async function () {`
 - **After**: `const fetch = collector(function* () {`

Now this generator is a queryable (async friendly) collection.

Upon iteration, anything that's `yield`ed gets collected, and anything that's collected can be queried:

```js
import { collector, entity } from 'generator-collector'

const fetch = collector(function* () {
  const { site } = yield entity(fetchSite(), 'site')
  const { user } = yield entity(fetchCurrentUser(site.token), 'user')
  const { posts } = yield entity(fetchSitePosts(site, 0), 'posts')

  // Wrap result with `data` to avoid collecting result in .all() queries (just a preference)
  // Need to return + yield as well if we want this collected (by design)
  return yield { data: { site, user, posts } }
})
```

<!-- If you wanted to just obtain whatever `fetch` returns, just call `fetch` twice (once for invocation, once for iteration) and `await`:

```js
const data = await fetch()()

// or, depending on your style

// Invoke the generator
const loader = fetch()
// Iterate to and return the final result
const data = await loader()
``` -->

### Consumer

Now imagine we are creating a new account management page for logged in users (our component is the "consumer").

On this page we only need to load the `site` and the `user`, so we do not care about `posts`.

If `fetch` was a traditional promise this would be a problem, and we'd either have to:
  - Import `fetchSite` and `fetchCurrentUser` ourselves and then call `fetchCurrentUser(site.token)` (duplication)
  - Start breaking out methods like `fetchSiteAndUser` for the different data loading workflows (complex)
  - Just fetch `posts` anyways through `fetch` and forget about them (wasteful).

With `generator-collectors` we avoid all of these compromising solutions with a minimal amount of code:

#### `src/views/Account.vue`

```html
<template>
  <h1>{{ user?.username }}</h1>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { fetch } from '@/api/fetch'

const user = ref(null)

onMounted(async () => {
  // Since we are loading data for a user's account page, we don't want to be wasteful
  // and load the site's posts, too.
  const data = fetch()

  // The following collector query avoids this waste while reusing `fetch`'s logic
  const { user } = await data.get('user')

  // Sync our user with the view, without worrying about posts in any way.
  user.value = user
})
</script>
```

Of course there are many other approaches to handling this situation (memoization, watchers, Service Workers, etc), but `generator-collectors` is designed as a supplemental solution, not a replacement.

It simply gives you another approach to this problem while introducing the advantages of generators into your app (which, if used properly, can really add up!).

<!-- // This is not only efficient, but it helps avoid copypasta and complicated function interfaces needed to support all of the data loading workflows your app requires. -->

> For simplicity, our `fetchSite` method is a strict prerequisite for `fetchUser` because it provides it a site/session token, and therefore nothing is being over (or under) requested.
> 
> If that wasn't the case, and we also didn't care about `site` in this component, then technically we would still be over requesting. Whether or not that's a problem is up to you.
>
> If this is a problem, it's recommended to refactor the `fetch` methods to be more flexible first, then re-evaluate if a collector is still beneficial and go from there.

### Invocation

Before wrapping up our integration example, it's worth mentioning some considerations around invocation.

By invoking the collector we create a collection that, when iterated, starts at the beginning of the generator:

```js
// Our generator function is invoked with its typical args (in this case, none) and ready to query.
// It will NOT yield until the first query is made.
const data = fetch()
```

<!-- Invocation prepares the generator for iteration, but does not initialize iteration. -->
Invocation produces a collection generator that is ready for iteration, but it **does not** initialize iteration.

Iteration is lazy and will not take place until the first query (`.find()`, `.last()`, etc) is called.

As for _where_ and _when_ we invoke, there are many options since it relies exclusively on the scoping rules of JS.

We can invoke here in the `api/fetch` module, in our components, or just about anywhere else.

Where and when you invoke the generator matters but is entirely dependent on your application's needs.

##### Functional / Pure

By defering invocation to our components on a per-instance basis (as in our example), the `fetch` generator will start from the beginning (functional/pure invocation)
whenever that component is mounted.

Although this guarantees the freshes data (stateless), it may result in repeat or redundant requests depending on your expectations.

For example, imagine that whenever we load `site` from one component, we want that data to be cached across all components and do not want to refetch `site` again until we clear that cache.

To solve this problem, we can achieve a stateful solution by simply hoisting invocation higher in our call scope.

##### Stateful / Singleton

By invocating at a module level and exporting/importing the resulting collection (single invocation), the generator will only run once during the lifetime of the application unless you explicitly clear its cache (stateful):

```js
const data = fetch()
// ...
data.clear() // next query will use a fresh generator, making all necessary API requests again
```
The generator's state lasts as long as the scope it was invoked in (assuming its memory can be freed and garbage collected - use `.clear()` as needed).

This cache-first approach is explicit, very efficient and ideal for pure 0-arity functions with few or no dependencies on external state changes.

But depending on your application's complexity, managing the cache can be difficult - it's either the whole cache or no cache.

> In the future I may provide methods for manipulating the cached results of the collector.

## License

Copyright © Erik Vavro. All rights reserved.

Licensed under the [MIT License](https://opensource.org/licenses/MIT).
