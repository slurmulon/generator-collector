import { collector } from '../../src/collector.mjs'
import { each } from '../../src/each.mjs'

const map = collector(each)

// Create a flatMap version of `each` by simply wrapping our `map` collector with another `each` generator
// Only handles 2d arrays, but could be refactored to be recursive
const flat = (grid, resolver) => map(grid, function* (row) {
  yield* each(row, resolver)
})

async function run () {
  // const table = [
  //   [...Array(4)].map(() => Math.random() * 10000),
  //   [...Array(4)].map(() => Math.random() * 10000),
  //   [...Array(4)].map(() => Math.random() * 10000),
  //   [...Array(4)].map(() => Math.random() * 10000),
  // ]

  // const row = function* (cols, factor = 10000) {
  //   while (cols-- > 0) {
  //     yield Math.random() * factor
  //   }
  // }

  // const table = function* (height = 4, width = 3, factor = 10000) {
  const table = function* (height = 100, width = 100, factor = 10000) {
    let h = height,
        w = width

    while (h-- > 0) {
      while (w-- > 0) {
        yield Math.random() * factor
      }
    }
  }

    // yield* Array(4).map(() => Math.random() * 10000)
    // yield* Array(4).map(() => Math.random() * 10000)
    // yield* Array(4).map(() => Math.random() * 10000)
    // yield* Array(4).map(() => Math.random() * 10000)
  // }

  console.log('rounding and flattening...', table)

  // Provide a plain resolver function that rounds each cell/value in a 2d matrix
  // const round = flat(table, cell => Math.round(cell))
  // const round = flat(table, cell => {
  // Either use the parameter defaults or provide your own to `table`
  const round = flat(table(10, 10), cell => {
    console.log('iterating and resolving cell', cell, Math.round(cell))

    return Math.round(cell)
  })

  // You can provide your resolver as a generator function, too
  // const round = flat(table, function* (cell) {
  //   return yield Math.round(cell)
  // })

  // const all = await round.all()
  const all = await round.take(6)

  // return all
  return {
    all,
    total: round.state().depth
  }
}

run().then(result => {
  // console.log('iterated, rounded and flattened only 6 of 16 results:\n', result)

  console.log(`iterated, rounded and flattened only ${result.total} of 10000 potential results:\n`, result.all)

  process.exit(0)
})
