import { each } from '../src/each'
import { collector } from '../src/collector'
import { isPromise } from '../src/util'

describe('each', () => {
  describe('signature', () => {
    it('`items` defaults to an empty array', () => {
      const iter = each()
      const result = iter.next()

      expect(result).toEqual({ value: [], done: true })
    })

    it('`items` casts non-iterables to arrays', async () => {
      const iter = each(4, x => x * 2)
      const result = await iter.next().value

      expect(result).toEqual(8)
    })
  })

  describe('iteration', () => {
    it('yields each item in provided iterable as a resolved entity (i.e. yield*)', async () => {
      const inc = function* (x) {
        yield Promise.resolve(x + 1)
        yield Promise.resolve(x + 2)
        yield Promise.resolve(x + 3)
      }

      const data = collector(function* (init) {
        yield* each(inc(init + 2), (x) => x * 2)
        yield* each(inc(init + 8), (x) => x * 3)
      })

      const query = data(4)
      const results = await query.all()

      expect(results).toEqual([14, 16, 18, 39, 42, 45])
    })

    it('yields each item in provided collector as a resolved entity (i.e. yield*)', async () => {
      const inc = collector(function* (x) {
        yield Promise.resolve(x + 1)
        yield Promise.resolve(x + 2)
        yield Promise.resolve(x + 3)
      })

      // Using collector directly
      const data1 = collector(function* (init) {
        yield* each(inc(init + 2), (x) => x * 2)
        yield* each(inc(init + 8), (x) => x * 3)
      })

      const query1 = data1(4)
      const results1 = await query1.all()

      expect(results1).toEqual([14, 16, 18, 39, 42, 45])

      // Using collector via iterator
      const data2 = collector(function* (init) {
        yield* each(Array.from(inc(init + 2)), (x) => x * 2)
        yield* each(Array.from(inc(init + 8)), (x) => x * 3)
      })

      const query2 = data2(5)
      const results2 = await query2.all()

      expect(results2).toEqual([16, 18, 20, 42, 45, 48])
    })
  })

  // test using resolver as string
  // test resolver returning a promise
})

