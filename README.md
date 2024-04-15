# generator-collector
> :recycle: Lazily collect and query generators in JS
---

> :warning: This project is **experimental** and should not be considered stable for production use.

## Features

- Collect and query generator results using coroutines
- Iterate only to the values you need, only when you need them
- Seamless integration with promises and async functions

## Resources

- :book: [Documentation](https://slurmulon.github.io/generator-collector)
- :anchor: [Install](https://slurmulon.github.io/generator-collector/#/install)
- :wrench: [API](https://slurmulon.github.io/generator-collector/#/api/)
- :bulb: [Usage and Examples](https://slurmulon.github.io/generator-collector/#/usage)

## Example

The following `node` example uses `generator-collector` and `js-coroutines` to query for the 5 best red wines in France.

```js
import { collector, promiser, each } from 'generator-collector'
import { map, sort } from 'js-coroutines' // optional, but plays nice with other coroutine libraries

async function wine () {
  // Create a generator-based "promiser" (coroutine) that loads and sorts a list of wines within a category
  const api = promiser(function* (category = 'reds') {
    const response = yield fetch(`https://api.sampleapis.com/wines/${category}`)
    const data = yield response.json()

    const rated = yield* sort(data, function* (a, b) {
      return yield b.rating.average - a.rating.average
    })

    const items = yield* map(rated, function* (item) {
      return yield { ...item, category }
    })

    return items
  })

  // Create a collector that reduces each result from the queried API responses into a single collection
  const load = collector(function* (query = null) {
    yield* each(query ?? categories, api)
  }, {
    // Override default insert behavior of `push.call` (now `push.apply`).
    // Enables flat reduction ef each item in API responses ([a, b, c] vs. [[a], [b], [c]]).
    insert: (store, value) => Array.prototype.push.apply(store, value)
  })

  // Invoke our data fetching collector for red wines (call `.load()` instead for all wine categories)
  const query = load(['reds'])

  // Load all the red wines from the API (since we need the full list to know the "best")
  const all = await query.all()

  // Scan results for the top 5 best red wines from France
  const best = await query.take(5, (item) => item.location.startsWith('France'), true)

  return { all, best }
}

wine().then(result => {
  console.log('Loaded best red wines in France', result.best, result.all.length)

  process.exit(0)
})
```

## Contact & Support

-  Create a [GitHub issue](https://github.com/slurmulon/generator-collector/issues) for bug reports, feature requests, or questions
-   Add a ⭐️ [star on GitHub](https://github.com/slurmulon/generator-collector) or ❤️ [tweet](https://twitter.com/intent/tweet?url=https%3A%2F%2Fgithub.com%2Fslurmulon%2Fgenerator-collector&hashtags=js,generators,promises,queries) to support the project!

## License

Copyright © Erik Vavro. All rights reserved.

Licensed under the [MIT License](https://opensource.org/licenses/MIT).
