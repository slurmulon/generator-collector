import { collector } from '../src/collector'

describe('collector', () => {
  describe('params', () => {
    // it('rejects async generator functions', () => {

    // })

    // it('only accepts generator functions', () => {

    // })

    // returns a function that creates a new generator each time it's called
  })

  describe('queries', () => {
    describe('find', () => {
      describe('signature', () => {
        // is function
        // aliases (get, first)
      })

      describe('selectors', () => {
        describe('string', () => {
          it('matches any object containing an own property named string', async () => {
            const data = collector(function* () {
              yield { bad: null }
              yield { good: null }
            })

            const query = data()
            const result = await query.find('good')

            expect(result).toEqual({ good: null })
          })
        })

        describe('function', () => {
          it('matches any value resulting in true when passed to function', async () => {
            const data = collector(function* () {
              yield 4
              yield 9
              yield 16
              yield 25
            })

            const query = data()
            const result = await query.find(x => x % 8 === 0)

            expect(result).toBe(16)
          })
        })

        // boolean, number, null
      })

      describe('iteration', () => {
        it('collects and normalizes yielded results as it walks', async () => {
          const data = collector(function* () {
            yield { a: 1 }
            yield Promise.resolve({ b: 2 })
            yield () => ({ c: 3 })
            yield function* () { return yield { d: 4 } }
            yield async function* () { return yield Promise.resolve({ e: 5 }) }
          })

          const query = data()
          const results = await query.all()

          expect(results).toEqual([
            { a: 1 },
            { b: 2 },
            { c: 3 },
            { d: 4 },
            { e: 5 }
          ])
        })

        it('iterates up to and captures first result matching selector', async () => {
          const data = collector(function* () {
            yield { a: 1 }
            yield { b: 2 }
            yield { c: 3 }
          })

          const query = data()
          const result = await query.find('b')

          expect(result).toEqual({ b: 2 })
          expect(query.results().length).toEqual(2)
        })

        it('returns previous matching result on subsequent iterations (default: next=false)', async () => {
          const data = collector(function* () {
            yield { a: 1 }
            yield { b: 2 }
            yield { b: 3 }
            yield { c: 4 }
          })

          const query = data()

          const result = await query.find('b')
          expect(result).toEqual({ b: 2 })

          const result2 = await query.find('b')
          expect(result2).toEqual({ b: 2 })

          expect(query.results().length).toEqual(2)
        })

        it('returns next matching result on subsequent iterations (next=true)', async () => {
          const data = collector(function* () {
            yield { a: 1 }
            yield { b: 2 }
            yield { b: 3 }
            yield { c: 4 }
          })

          const query = data()

          const result = await query.find('b')
          expect(result).toEqual({ b: 2 })

          const result2 = await query.find('b', true)
          expect(result2).toEqual({ b: 3 })

          expect(query.results().length).toEqual(3)
        })

        it('returns null when no matching results can be found (next=true)', async () => {
          const data = collector(function* () {
            yield { a: 1 }
            yield { b: 2 }
            yield { c: 3 }
          })

          const query = data()
          const result = await query.find('x')

          expect(result).toBe(null)
          expect(query.results().length).toEqual(3)
        })

        describe('resolves promises', () => {
          it('when first yielded value is a promise', async () => {
            const data = collector(function* () {
              yield Promise.resolve({ a: 1 })
              // yield { b: 2 }
              // TODO: Test this! Captures { b:2 } as well when not a promise!
              // yield { b: 1.5 }
              // TODO: Test this! Fails to capture {b:1.5} when a promise!
              yield Promise.resolve({ b: 1 }) // TODO: Test this! Captures when not a promise
              // FIXME: Still doesn't work on latest fixes (basically a promise after a matching promise)
              //   - WORKING NOW (create tests for this!)
              // yield Promise.resolve({ b: 2 }) 
              // yield Promise.resolve({ y: 0 })
              // WORKING NOW same as above (create tests for this!)
              yield { b: 2 }
              yield Promise.resolve({ x: 0 })
              yield { b: 3 }
              // yield Promise.resolve({ b: 3 }) // FIXME: Doesn't match because promise doesn't get resolved
              yield { c: 4 }
            })

            const query = data()

            const b1 = await query.find('b')
            expect(b1).toEqual({ b: 1 })

            const results1 = await query.results()
            expect(results1).toEqual([{ a: 1 }, { b: 1 }])

            const b2 = await query.find('b', true)
            expect(b2).toEqual({ b: 2 })

            const results2 = await query.results()
            expect(results2).toEqual([{ a: 1 }, { b: 1 }, { b: 2 }])
          })

          it('when second yield is first promise value', async () => {
            const data = collector(function* () {
              yield { a: 1 }
              yield Promise.resolve({ b: 1 })
              yield Promise.resolve({ b: 2 })
              yield { c: 4 }
            })

            const query = data()

            const b1 = await query.find('b')
            expect(b1).toEqual({ b: 1 })

            const results1 = await query.results()
            expect(results1).toEqual([{ a: 1 }, { b: 1 }])

            const b2 = await query.find('b', true)
            expect(b2).toEqual({ b: 2 })

            const results2 = await query.results()
            expect(results2).toEqual([{ a: 1 }, { b: 1 }, { b: 2 }])
          })

          it('when last yield is first promise value', async () => {
            const data = collector(function* () {
              yield { a: 1 }
              yield { b: 1 }
              yield Promise.resolve({ c: 3 })
            })

            const query = data()

            const { c } = await query.find('c')
            expect(c).toEqual(3)

            const results = await query.results()
            expect(results).toEqual([{ a: 1 }, { b: 1 }, { c: 3 }])
          })


          // TODO:
          //  - promise with delay/duration (ensure yield sequence syncs perfectly with results)
        })
      })
    })

    describe('all', () => {
      describe('signature', () => {
        // is function
      })

      describe('selectors', () => {
        describe('string', () => {
          it('matches any object containing an own property named string', async () => {
            const data = collector(function* () {
              yield { a: 1 }
              yield { b: 1 }
              yield { b: 2 }
              yield { a: 2 }
            })

            const query = data()
            const results = await query.all('a')

            expect(results).toEqual([{ a: 1 }, { a: 2 }])
          })
        })

        describe('function', () => {
          it('matches any value resulting in true when passed to function', async () => {
            const data = collector(function* () {
              yield 4
              yield 5
              yield 9
              yield Promise.resolve(16)
              yield 27
              yield Promise.resolve(30)
            })

            const query = data()
            const results = await query.all(x => (x % 2 === 0 || x % 5 === 0))

            expect(results).toEqual([4, 5, 16, 30])
          })
        })

        // TODO: results (ensure both async/sync values collected sequentially)
      })

      // boolean, number, null
    })

    describe('last', () => {
      describe('signature', () => {
        // is function
      })

      describe('selectors', () => {
        describe('truthy', () => {
          it('returns last iterated value', async () => {
            const data = collector(function* () {
              yield { a: 1 }
              yield { b: 1 }
              yield { b: 2 }
              yield { a: 2 }
            })

            const query = data()
            const result = await query.last(true)

            expect(result).toEqual({ a: 2 })
          })
        })

        describe('falsey', () => {
          it('returns null but still iterates the entire generator', async () => {
            const data = collector(function* () {
              yield { a: 1 }
              yield { b: 2 }
            })

            const query = data()
            const result = await query.last(false)

            expect(result).toBe(null)
            expect(query.results()).toEqual([{ a: 1 }, { b: 2 }])
          })
        })

        describe('string', () => {
          it('matches the last object containing an own property named string', async () => {
            const data = collector(function* () {
              yield Promise.resolve({ a: 1 })
              yield { b: 1 }
              yield Promise.resolve({ b: 2 })
              yield { a: 2 }
            })

            const query = data()

            const a = await query.last('a')
            expect(a).toEqual({ a: 2 })

            const b = await query.last('b')
            expect(b).toEqual({ b: 2 })
          })
        })
      })
    })

    describe('iterator', () => {

    })
  })
})

