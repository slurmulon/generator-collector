# generator-collector
> :handbag: Lazily collect and query generators
---

<!-- ## Purpose -->
## Introduction

<!-- When using generators in JS, sometimes I only want to iterate up to a certain value and collect it. -->
As I incorporate generators more in my JS projects, sometimes I only want to iterate up to a certain value and collect it.

I also want to do this **without**:
  - Having to know when or how the generator reaches my value(s) (**Answer**: Declarative interface)
  - Iterating more than necessary to reach my value(s) (**Answer**: Lazy iteration)
  - Writing imperative `for` and `while` loops all over the place (**Answer**: Functional interface)
  - Being constrained by how many different values I need to collect or at what point (**Answer**: Composables, Inversion of control)
  - Forcing generator consumers (or beyond) to become generators themselves (**Answer**: Asynchronous coroutines)
<!-- Have you ever needed to only work up to a certain point in a generator and capture that value, without having to know when the generator reaches it? -->

<!-- Since I couldn't find anything else that fit the bill, `generator-collector` was born. -->

<!-- When consuming generators, have you ever wanted to only work up to a certain point and capture that value, without needing to know when the generator reaches that value? -->

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
const allGreyPets = await query.all(({ color }) => color === 'grey')

// Iterate and reduce every yielded value into an array
const allPets = await query.all()

// Iterate through the entire generator and provide the last yielded result
const lastPet = await query()

// Optionally clear the cached generator results when you're done (helps avoid memory leaks).
// Automatically called when calling the collection as function (e.g. `await query()`)
query.clear()
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

It also simplifies generator integration with async functions thanks to `js-coroutines` - every `collector` query method is a generator-backed promise!

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

In my opinion, this is a huge and avoidable deterent that prevents developers from experiencing the full potential of generators.

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

async function example () {
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
  console.log('>>>>> found love', love) // only yields twice, stopping on the first matching case

  const { ingredients } = await cookies.all('intredient') // continues yielding to the end of the generator, until all `ingredients` are encountered
  console.log('>>>>>> prepared ingredients', intredients)

  const { food } = await cookies.find('food')
  console.log('>>>>>> got cookies', food)

  await cookies.sleep(4000) // give the cookies time to cool before serving
  await cookies.find('serve') // since we have already yielded through the entire generator, this value is returned from cache
  await cookies.sleep(2000) // give the cookies time to be eaten and rated after being served

  const { rating } = await cookies.find('rating') // capture the rating of the cookies
  console.log('>>>>>> got rating', rating)

  console.log('\n\nKitchen success!', rating)
}

example()
```

Aside from improving performance, this gives consumers a huge amount of control over the workflow of the generator.

This is especially useful when, say, you want to wait until a subset of API requests made from a generator are complete and don't care about anything else happening in the generator (like unrelated API requests).

<!-- ## Promises -->
<!-- ## Asynchronous -->

## Integration

Here we will explore how `generator-collectors`, being asynchronous, is framework agnostic and easy to start integrating anywhere that supports promises.

The following examples represent a blog site written in Vue 3.

<!-- They outline how `generator-collectors` can be used to simplify and optimize how page data gets loaded from its API. -->

### `src/api/fetch.js`

The first example is a basic mock module for loading the site's data from its "API" (use your imagination, the point is we're using promises).

Although simple, it's a universal pattern that many people use for centralizing data loading logic and flows across components.

```js
import { collector } from 'generator-collector'

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

First we key each `fetch*` call in a wrapper object, that way consumers can query for that key later:

 - **Before**: `await fetchSite()`
 - **After**: `{ site: await fetchSite() }`

> This wrapper object is the default convention for querying but is not strictly necessary.
> Queries can accept any matcher function and can work with any type of data.

Next we prefix each `await` with `yield`:
 - **Before**: `const site = { site: await fetchSite() }`
 - **After**: `const site = yield { site: await fetchSite() }`

Lastly we update our function signature so it's a collector generator:
 - **Before**: `const fetch = async function () {`
 - **After**: `const fetch = collector(async function* () {`

Now this generator is a queryable (async friendly) collection.

Upon iteration, anything that's `yield`ed gets collected, and anything that's collected can be queried:

```js
const fetch = collector(async function* () {
  const { site } = yield { site: await fetchSite() }
  const { user } = yield { user: await fetchCurrentUser(site.token) }
  const { posts } = yield { posts: await fetchSitePosts(site, 0) }

  // Wrap result with `data` to avoid collecting result in .all() queries (just a preference)
  // Need to return + yield as well if we want this collected (probably a bug, shouldn't be necessary)
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

### `src/views/Account.vue`

Now imagine we are creating a new account management page for logged in users.

On this page we only need to load the `site` and the `user`, so we do not care about `posts`.

If `fetch` was a traditional promise this would be a problem, and we'd either have to:
  - Import `fetchSite` and `fetchCurrentUser` ourselves and then call `fetchCurrentUser(site.token)` (duplication)
  - Start breaking out methods like `fetchSiteAndUser` for the different data loading workflows
  - Just fetch `posts` anyways through `fetch` and forget about them (wasteful).

With `generator-collectors` we avoid all of these compromising solutions with a minimal amount of code:

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

  // The following collector query avoids waste without forcing you to write and/or import
  // methods just for this unique workflow.

  const { user } = await data.find('user')

  // Sync our view with the value, without worrying about posts in any way.
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
// Generator is invoked and ready to query (does not yield until first query is made)
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

To solve this problem, we can achieve a stateful solution by simply hoisting invocation up in our execution scope.

##### Stateful / Singleton

By invocating at a module level and exporting/importing the resulting collection (single invocation), the generator will only run once during the lifetime of the application unless you explicitly clear its cache (stateful):

```js
const data = fetch()
// ...
data.clear() // next query will use a fresh generator, making all necessary API requests again
```
The generator's state lasts as long as the scope it was invoked in (assuming its memory can be freed and garbage collected - use `.clear()` as needed).

This cache-first approach is explicit, the most efficient and probably ideal for the majority of use cases.

But depending on your application's complexity, managing the cache can be difficult - it's either the whole cache or no cache.

> In the future I may provide methods for manipulating the cached results of the collector.



## License

MIT
