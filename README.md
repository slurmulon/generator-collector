# generator-collector
> :handbag: Lazy pattern matched generators
---

When using generators, have you ever needed to only work up to a certain point and return that value, without needing to know the internal specifics of that generator?

`generator-collector` is minimal library based on `js-coroutines` that makes this an easy and efficient task.

## Example

```js
import { collector } from 'generator-collector'

async function example () {
  const ingredients = function* () {
    yield { ingredient: 'sugar', quantity: '85g' }
    yield { ingredient: 'egg', quantity: '1' }
    yield { ingredient: 'chocolate-chips', quantity: '340g' }
    yield { junk: true }
    yield { ingredient: 'flour', quantity: '8tbs' }
    yield { ingredient: 'love': quantity: Infinity }
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
  const { ingredients } = await cookies.all('intredient')
  console.log('>>>>>> prepared ingredients', intredients)

  const { food }  await.cookies.find('food')
  console.log('>>>>>> got cookies', food)

  await sleep(5000) // give the cookies time to cool before serving
  await cookies.find('serve')

  const { rating } = await stream.find('rating')
  console.log('>>>>>> got review', event)

  console.log('\n\nKitchen success!', rating)
}

example()
```

## License

MIT
