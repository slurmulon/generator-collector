import { collector } from '../src/collector.mjs'
import { each } from '../src/each.mjs'
import { list } from '../src/list.mjs'

// import { map, yielding } from 'js-coroutines'

const map = collector(each)

// const flat = (grid, resolver) => map(grid, (row) => list(row, resolver))

const flat = (grid, resolver) => map(grid, function* (row) {
  console.log('----------- das row!', row, resolver)
  yield* each(row, resolver)
})

// CLOSEST
// const flat = collector(function* (items, resolver) {
//   console.log('wut', items, resolver)
//   const all = yield* map(items, function* (row) {
//     console.log('---- row', row, resolver)
//     return yield* each(row, resolver)
//   })

//   console.log('das all!', all)

//   return all.flatten()
// })

async function run () {
  const table = [
    [...Array(4)].map(() => Math.random() * 10000),
    [...Array(4)].map(() => Math.random() * 10000),
    [...Array(4)].map(() => Math.random() * 10000),
    [...Array(4)].map(() => Math.random() * 10000),
    // Array(4).fill(null).map(() => Math.random() * 10000),
    // Array(4).fill(null).map(() => Math.random() * 10000),
    // Array(4).fill(null).map(() => Math.random() * 10000),
  ]

  console.log('table!', table)

  const round = flat(table, function cellular (cell){
    console.log('das cell!', cell, Math.round(cell))

    return Math.round(cell)
  })

  // BEST
  // const round = flat(table, function* (cell) {
  //   console.log('das cell!', cell, Math.round(cell))

  //   return yield Math.round(cell)
  // })

  const all = await round.all()
  console.log('results!', round.state().results)
  // const all = await round.take(6)

  return all
}

run().then(result => {
  console.log('each map', result)

  process.exit(0)
})
