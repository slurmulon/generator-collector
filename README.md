# generator-collector
> :handbag: Lazy pattern matched generators
---

When using generators, have you ever needed to only work up to a certain point and return that value, without needing to know the internal specifics of that generator?

`generator-collector` is minimal library based on `js-coroutines` that makes this an easy and efficient task.

## Problem

Consumption of generators producing the same type of data is trivial.

Many times you simply want to iterate through the entire genreator and/or take the last result:

```js
function* cart() {
  yield { id: 1, item: 'zucchini', type: 'produce' }
  yield { id: 2, item: 'beef', type: 'meat' }
  yield { id: 3, item: 'marinara', type: 'sauce' }
}

for (const item of cart) {
  console.log('cart item', item.id)
}
```

On the contrary, consuming generators that can produce a variety of data is less simple:

```js
function* shop() {
  yield { recycle: { id: 1, item: 'can', amount: 20 } }
  yield { add: { id: 1, item: 'zucchini', type: 'produce' } }
  yield { add: { id: 2, item: 'beef', type: 'meat' } }
  yield { checkout: { payment: 'card', total: 100 } }
}

function bag() {
  const session = shop()
  session.next() // ignore recycle

  // Get each item in the cart (we have to `know` which yields have items, and how many!)
  const items = [session.next(), session.next()]
  const { checkout: { total } } = session.next()

  return { items, total }
}
```

The consumer of this type of generator must become painfully aware of the inner details of that generator in order to parse it.

Even when these details are known and properly supported, the resulting code is brittle and difficult to understand.

## Solution

Using `generator-collector` we can circumvent all of these problems without fundamentally changing our approach:

```js
const shop = collector(function* shop() {
  yield { recycle: { id: 1, item: 'can', amount: 20 } }
  yield { add: { id: 1, item: 'zucchini', type: 'produce' } }
  yield { add: { id: 2, item: 'beef', type: 'meat' } }
  yield { checkout: { payment: 'card', total: 100 } }
})

function bag() {
  const session = shop()

  const items = session.all('add') // reduce all yielded objects with an `add` prop
  const { checkout: { total } } = session.find('checkout') // find first yielded object with a `checkout` prop

  return { items, total }
}
```

## Example

In this more robust example, we show how `generator-collector` improves performance by giving consumers the ability to lazily match results in real-time.

Whenever you await on `collector.find`, the generator will only iterate until it finds the first yielded result that matches your condition.

Aside from improving performance, this gives consumers a huge amount of control over the workflow of the generator.

This is especially useful when, say, you want to wait until all API requests made from a generator are complete and don't are about anything else happening in the genrator.

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

    yield* serve(name, food)
  })

  const cookies = recipe('cookies')
  const { love } = await cookies.find(res => res?.ingredient === 'love')
  console.log('>>>>> found love', love) // only yields twice, stopping on the first matching case

  const { ingredients } = await cookies.all('intredient') // continues yielding to the end of the generator, until all `ingredients` are encountered
  console.log('>>>>>> prepared ingredients', intredients)

  const { food }  await.cookies.find('food')
  console.log('>>>>>> got cookies', food)

  await sleep(5000) // give the cookies time to cool before serving
  await cookies.find('serve') // since we have already yielded through the entire generator, this value is returned from cache

  const { rating } = await stream.find('rating')
  console.log('>>>>>> got review', event)

  console.log('\n\nKitchen success!', rating)
}

example()
```

## License

MIT
