import { collector } from '../../src/collector.mjs'

const randomizer = collector(function* (range = 100) {
  while (true) {
    yield Math.round(Math.random() * range)
  }
})

async function run () {
  const range = 100000000
  const mod = 256
  const count = 64

  // Invoke an infinite random number generator based on our range
  const numbers = randomizer(range)

  // Iterate until we receive 64 random numbers divisible by 256 between 0 and 100,000,000
  const results = await numbers.take(x => x % mod === 0, count)

  console.log(`[random % ${mod}] x [${count}] up to [${range}] in [${numbers.state().depth}] iterations:`, results)

  return results
}

Promise.all(
  [...Array(4)].map(() => run())
).then(() => process.exit(0))
