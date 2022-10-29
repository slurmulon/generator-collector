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

      it('async function', async () => {
        const result = await entity(async () => Promise.resolve('works'), 'test')

        expect(result).toEqual({ test: 'works' })
      })

      it('iterator function', async () => {
        const result = await entity(function* () { return 'works' }, 'test')

        expect(result).toEqual({ test: 'works' })
      })

      it('async iterator function', async () => {
        const result = await entity(async function* () { return Promise.resolve('works') }, 'test')

        expect(result).toEqual({ test: 'works' })
      })

      it('iterator', async () => {
        const result = await entity(function* (x) { return x }('works'), 'test')

        expect(result).toEqual({ test: 'works' })
      })

      it('async iterator', async () => {
        const result = await entity(async function* (x) { return Promise.resolve(x) }('works'), 'test')

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

      it('async function', async () => {
        const result = await entity(2, async x => Promise.resolve(x + 3))

        expect(result).toEqual(5)
      })

      it('generator function', async () => {
        const result = await entity(3, function* (x) { return yield x + 5  })

        expect(result).toEqual(8)
      })

      it('async generator function', async () => {
        const result = await entity(4, async function* (x) {
          return yield Promise.resolve(x + 6)
        })

        expect(result).toEqual(10)
      })

      it('promise', async () => {
        const result = await entity(1, Promise.resolve(x => x + 1))

        expect(result).toEqual(2)
      })

      it.each([[null], [undefined], [false], [true], [0], [{}], [Array(0)]])(
        'passive value (%s)', async (resolver) => {
          const result = await entity(1, resolver)

          expect(result).toBe(1)
        }
      )
    })

    describe('handles errors', () => {
      it('throws any errors in value or resolver', () => {
        expect(entity(() => { throw 'works' })).rejects.toMatch('works')
        expect(entity(1, () => { throw 'works' })).rejects.toMatch('works')
      })
    })
  })
})
