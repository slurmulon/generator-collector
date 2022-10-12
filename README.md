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
 - Effortlessly translate affected asynchronous functions into generator functions by replacing `await` with `yield`.
 - Collection queries are asynchronous (`async/await`) yet backed entirely by thread-friendly generators.
 - Optimize your generator's iteration based on how you structure and order your collection queries.


> :warning: **Notice**
> 
> `generator-collector` is **expiermental** and should not be considered stable for production use.

## Preview

```js
import { collector } from 'generator-collector'

// Provide any generator function, especially one that can return different values
const pets = collector(function* (owner) {
  yield { cat: true, name: 'Bigs', message: 'meow', color: 'white', owner }
  yield { dog: true, name: 'Chancey', message: 'woof', color: 'grey', owner }
  yield { cat: true, name: 'Glorb', message: 'meowwwwww', color: 'grey', owner }
  yield { dog: true, name: 'Zeus', message: 'WOOF', color: 'white', owner }
})

// Invoke your generator function as usual, but receive a "collection" query API instead of a generator
const query = pets('George')

// Lazily and asynchronously query the yielded results of the generator
const firstDog = await query.find('dog') // Iterates up to the first yielded object with a 'dog' property
const nextDog = await query.find('dog', true) // Returns the next dog after the last encountered match in a previous find (next = true)
const allCats = await query.all('cat') // Iterates the entire generator and return all yielded objects with `cat`
const allDogs = await query.all('dog') // Same as above, but avoids consuming the entire generator again!
const glorbCat = await query.find(({ name }) => name === 'Glorb') // Provide your own matcher functions to any query method
const firstGreyPet = await query.find(({ color }) => color === 'grey')
const allGreyPets = await query.all(({ color }) => color === 'grey')
const allPets = await query.all() // Iterate and reduce every yielded value into an array
const lastPet = await query() // Iterate through the entire generator and provide the last result

// Optionally clear the cached generator results when you're done (helps avoid memory leaks).
// Automatically called when calling the collection as function (e.g. `await query()`)
query.clear()
```

## Approach

This solution is largely inspired by Elixir's amazing `with` statement, which has noticeably improved the structure and flexibility of my own code.

It also aims to leverage and expand on the innovative `js-coroutines` package, which anyone interested in next-level browser performance should certainly check out.

### Design

`generator-collector` allows you to declare _what_ you need from a complex generator without needing to concern _when or how_ it gets generated.

You can think of it as a declarative API for watching (and collecting) the yielded results of your generator.

Simply wrap any generator function with `collector`, which returns a functional proxy to your generator.
Once that function is called (providing any arguments as you normally would to your generator function), the generator is invoked and a collection object is returned.

You can then call (and `await`) query methods on the returned collection (`.find()`, `.all()`) to lazily capture any matching results of your generator as it iterates.

This declarative approach gives you more flexibility and control over how you consume generators and asyncronous functions, especially those producing multiple types of data.

It also simplifies generator integration with async functions thanks to `js-coroutines` - every `collector` query method is a generator-backed promise!

Use it only where you need it, use it without complicating your code, and leave the rest of your code happily unaffected.

### Performance

The iteration process is primarily optimized based on the query methods (`.all()`, `.find()`) you call in your collection consumer (and in which order).

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
### Before (Problem)

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

  // Get each item in the cart (we have to `know` which yields have items, and how many!)
  const items = [session.next(), session.next()]
  const { checkout: { total } } = session.next()

  return { items, total }
}
```

The consumer of this type of generator must become painfully aware of the inner details of the generator in order to parse it.

Even when these details are known and properly supported, the consumer's code is brittle and difficult to understand.

In my opinion, this is a huge and avoidable deterent that prevents developers from experiencing the full potential of generators.

## After (Solution)

Using `generator-collector` we can circumvent all of these problems without fundamentally changing our approach:

```js
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

There is also nothing stopping you from iterating through the collection natively - instead just call `.next()` in a `while` or `for of` like you would with any generator.

> :warning: **Warning**
> 
> Although you can access your generator function directory via `.next()`, be aware that this will **not** trigger any of your queries.
> 
> It's strongly recommended to either use collection queries or `.next()`, **never** both on the same collection generator.

## Laziness

In this example we show how `generator-collector` improves performance by giving consumers the ability to lazily match results in real-time.

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


## License

MIT
