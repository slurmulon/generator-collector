import { collector } from '../../src/collector.mjs'
import { each } from '../../src/each.mjs'

const map = collector(each)

// Create a collectable flatMap version of `each` by simply wrapping our `map` collector with another `each` generator
// Only handles 2d arrays for simplicity, but could be refactored to be recursive
const flat = (grid, resolver) => map(grid, function* (row) {
  yield* each(row, resolver)
})

async function run () {
  const table = [
    [...Array(4)].map(() => Math.random() * 10000),
    [...Array(4)].map(() => Math.random() * 10000),
    [...Array(4)].map(() => Math.random() * 10000),
    [...Array(4)].map(() => Math.random() * 10000),
  ]

  console.log('rounding and flattening...', table)

  // Provide a plain resolver function that rounds each cell/value in a 2d matrix
  const round = flat(table, cell => {
    console.log('iterating and resolving cell', cell, Math.round(cell))

    return Math.round(cell)
  })

  // You can provide your resolver as a generator function, too
  // const round = flat(table, function* (cell) {
  //   console.log('iterating cell', cell, Math.round(cell))

  //   return yield Math.round(cell)
  // })

  // const all = await round.all()
  const all = await round.take(6)

  return all
}

run().then(result => {
  console.log('iterated, rounded and flattened only 6 of 16 results:\n', result)

  process.exit(0)
})
