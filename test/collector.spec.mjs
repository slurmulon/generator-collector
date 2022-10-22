import { collector } from '../src/collector'

describe('collector', () => {

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

          expect(query.results().length).toEqual(3)
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

        it.only('resolves any yielded promises', async () => {
          const data = collector(function* () {
            yield Promise.resolve({ a: 1 })
            // yield { b: 2 }
            // TODO: Test this! Captures { b:2 } as well when not a promise!
            // yield { b: 1.5 }
            // TODO: Test this! Fails to capture {b:1.5} when a promise!
            yield Promise.resolve({ b: 1.5 }) // TODO: Test this! Captures when not a promise
            console.log('\n\n\n\n-------------- after b=1.5 ---------------\n\n\n\n')
            // FIXME: Still doesn't work on latest fixes (basically a promise after a matching promise)
            //   - WORKING NOW (create tests for this!)
            // yield Promise.resolve({ b: 2 }) 
            yield Promise.resolve({ y: 0 })
            // WORKING NOW same as above (create tests for this!)
            yield { b: 2 }
            yield Promise.resolve({ x: 0 })
            yield { b: 3 }
            // yield Promise.resolve({ b: 3 }) // FIXME: Doesn't match because promise doesn't get resolved
            yield { c: 4 }
          })

          const query = data()

          const result = await query.find('b')
          console.log('first b!', result)
          // console.log('query.results', await query.results())
          // expect(result).toEqual({ b: 2 })
          expect(result).toEqual({ b: 1.5 })
          // expect(result).toEqual({ b: 3 })
          // expect(result).toEqual('glorb')
          console.log('next b!', await query.find('b', true))
          // console.log('query.results 1', await query.find(true, true))
          // console.log('query.results 2', await query.all())
          const results = await query.results()
          console.log('query.results 2', results)
          expect(results).toEqual([{ a: 1 }, { b: 1.5 }, { b: 2 }])
          // console.log('query.results 2', await query.find(true, true),  await query.results())
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
              yield 16
              yield 27
              yield 30
            })

            const query = data()
            const results = await query.all(x => (x % 2 === 0 || x % 5 === 0))

            expect(results).toEqual([4, 5, 16, 30])
          })
        })
      })

      // boolean, number, null
    })

    describe('last', () => {

    })

    describe('iterator', () => {

    })
  })
})

