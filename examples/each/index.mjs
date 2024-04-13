import { collector } from '../../src/collector.mjs'
import { each } from '../../src/each.mjs'

// Create a Collector generator from `each` (`each is a vanilla generator method)
const map = collector(each)

// Create a flatMap version of `each` by simply wrapping our `map` collector with another `each` generator
const flat = (grid, resolver) => map(grid, function* (row) {
  yield* each(row, resolver)
})

async function run () {
  // The standard synchronous approach... blocking, greedy and SLOW....
  // const table = [
  //   [...Array(4)].map(() => Math.random() * 10000),
  //   [...Array(4)].map(() => Math.random() * 10000),
  //   [...Array(4)].map(() => Math.random() * 10000),
  //   [...Array(4)].map(() => Math.random() * 10000),
  // ]

  // The improved generator approach - lazy, scalable and efficient!
  const table = function* (height = 100, width = 100, factor = 10000) {
    let h = height,
        w = width

    while (h-- > 0) {
      while (w-- > 0) {
        yield Math.random() * factor
      }
    }
  }

  console.log('rounding and flattening...', table)

  // Provide a plain resolver function that rounds each cell/value in a 2d matrix
  // Either use the parameter defaults or provide your own to `table`
  // const round = flat(table(10, 10), cell => {
  const round = flat(table, cell => {
    console.log('iterating and resolving cell', cell, Math.round(cell))

    return Math.round(cell)
  })

  // You can provide your resolver as a generator function, too!
  // const round = flat(table, function* (cell) {
  //   return yield Math.round(cell)
  // })

  const all = await round.take(6)

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
