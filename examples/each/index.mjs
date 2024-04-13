import { collector } from '../../src/collector.mjs'
import { each } from '../../src/each.mjs'

// Create a collector generator from `each` (by itself, `each` is a standard generator function)
// This will behave as a recursive `flatMap` since every collected result is already stored to a flat array
const flat = collector(each)

async function run () {
  // Create our table generator, which lazily iterates through a 2d grid and yields a coordinate/id string for each cell
  // e.g. ['1.1', '1.2', '1.3', '1.4', '2.1', '2.2', ...]
  const table = function* (height = 10000, width = 4) {
    for (let row = 1; row <= height; row++) {
      for (let col = 1; col <= width; col++) {
        yield `${row}.${col}`
      }
    }
  }

  console.log('calculating and flattening...', table)

  // Provide a plain resolver function that maps each cell/value in our table/grid/matrix
  // Either use the parameter defaults or provide your own to `table`
  // const round = flat(table(10, 10), cell => {
  const floats = flat(table, cell => {
    console.log('iterating and resolving cell', cell)

    // Map the cell id to a float on each iteration
    return Number.parseFloat(cell)
  })

  // You can provide your resolver as a generator function, too!
  // const round = flat(table, function* (cell) {
  //   return yield Number.parseFloat(cell)
  // })

  // Although our table contains 40000 cells by default, we only want the first 6
  // Thanks to `take`, any cells beyond iteration 6 will never be calculated or visited!
  const items = await floats.take(6)

  return {
    items,
    total: floats.state().depth
  }
}

run().then(result => {
  console.log(`iterated, calculated and flattened only ${result.total} of 40000 potential results:\n`, result.items)

  process.exit(0)
})
