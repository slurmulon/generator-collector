import { entity } from '../src/entity'
import { isPromise } from '../src/util'

describe('entity', () => {
  describe('signature', () => {
    it('is a function', () => {
      expect(typeof entity).toBe('function')
    })

    it('returns a promise', () => {
      const result = entity()

      expect(isPromise(result)).toBe(true)
    })
  })

  describe('maps values against resolvers', () => {
    describe('supports value as a', () => {
      it('non-promise', async () => {
        const result = await entity('works', 'test')

        expect(result).toEqual({ test: 'works' })
      })

      it('promise', async () => {
        const result = await entity(Promise.resolve('works'), 'test')

        expect(result).toEqual({ test: 'works' })
      })

      it('function', async () => {
        const result = await entity(() => 'works', 'test')

        expect(result).toEqual({ test: 'works' })
      })
    })

    describe('supports resolver as a', () => {
      it('string', async () => {
        const result = await entity(1, 'test')

        expect(result).toEqual({ test: 1 })
      })

      it('function', async () => {
        const result = await entity(1, x => x + 1)

        expect(result).toEqual(2)
      })

      it('generator function', async () => {
        console.time('gentime')
        const result = await entity(3, function* (x) { return yield x + 5  })
        console.timeEnd('gentime')

        expect(result).toEqual(8)
      })

      it('async generator function', async () => {
        const result = await entity(4, async function* (x) {
          return yield Promise.resolve(x + 6)
        })

        expect(result).toEqual(10)
      })

      it.each([[null], [undefined], [false], [true], [0], [{}], [Array(0)]])(
        'passive value (%s)', async (resolver) => {
          const result = await entity(1, resolver)

          expect(result).toBe(1)
        }
      )
    })
  })
})
