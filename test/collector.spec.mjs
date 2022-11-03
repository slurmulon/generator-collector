import { collector } from '../src/collector'

// TODO: Error handling tests

describe('collector', () => {
  describe('params', () => {
    it('rejects async generator functions', () => {
      expect(() => {
        collector(async function* () {})()
      }).toThrow(TypeError)
    })

    describe('only accepts generator functions', () => {
      it.each([
        [null],
        [undefined],
        [false],
        [true],
        [0],
        ['string'],
        [{}],
        [Array(0)],
        [function() {}],
        [Symbol.iterator],
        [(function*(){})()],
        [(async function*(){})()]
      ])(
        'invalid value (%s)', (value) => {
          expect(() => {
            collector(value)()
          }).toThrow(TypeError)
        }
      )
    })

    // returns a function that creates a new generator each time it's called
  })

  describe('queries', () => {
    describe('find', () => {
      describe('signature', () => {
        // aliases (get, first)
      })

      describe('selectors', () => {
        // truthy
        // falsey

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

        it('returns next matching result on subsequent iterations using different selector (next=true)', async () => {
          const data = collector(function* () {
            yield { a: 1 }
            yield { a: 2 }
            yield { b: 3 }
            yield { b: 4 }
            yield { c: 5 }
          })

          const query = data()

          const result = await query.find('a')
          expect(result).toEqual({ a: 1 })

          const result2 = await query.find('a', true)
          expect(result2).toEqual({ a: 2 })

          expect(query.results().length).toEqual(2)

          const result3 = await query.find('b')
          expect(result3).toEqual({ b: 3 })

          expect(query.results().length).toEqual(3)

          const result4 = await query.find('b', true)
          expect(result4).toEqual({ b: 4 })

          expect(query.results().length).toEqual(4)

          const result5 = await query.find('b')
          expect(result5).toEqual({ b: 3 })

          expect(query.results().length).toEqual(4)
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
              yield Promise.resolve({ b: 1 }) // TODO: Test this! Captures when not a promise
              yield { b: 2 }
              yield Promise.resolve({ x: 0 })
              yield { b: 3 }
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
          //  - nested promise chain
        })
      })
    })

    describe('all', () => {
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

    describe('take', () => {
      describe('selectors', () => {
        describe('string', () => {
          it('matches up to {count} objects containing an own property named string', async () => {
            const data = collector(function* () {
              yield Promise.resolve({ a: 1 })
              yield { b: 1 }
              yield Promise.resolve({ b: 2 })
              yield { b: 4 }
              yield { c: 1 }
            })

            const query = data()
            const results = await query.take('b', 2)

            expect(results).toEqual([{ b: 1 }, { b: 2 }])
          })

          it('matches up to {count} objects containing an own property named string', async () => {
            const data = collector(function* () {
              yield Promise.resolve({ a: 1 })
              yield { b: 1 }
              yield Promise.resolve({ b: 2 })
              yield { b: 3 }
              yield { c: 1 }
            })

            const query = data()
            const results = await query.take('b', 2)

            expect(results).toEqual([{ b: 1 }, { b: 2 }])
          })
        })
      })

      describe('iteration', () => {
        it('returns matching results subsequent calls (next = alternating)', async () => {
          const data = collector(function* () {
            yield Promise.resolve({ a: 1 })
            yield { b: 1 }
            yield Promise.resolve({ b: 2 })
            yield { b: 3 }
            yield { c: 1 }
          })

          const query = data()

          const results1 = await query.take('b', 2)
          expect(results1).toEqual([{ b: 1 }, { b: 2 }])
          expect(query.results().length).toEqual(3)

          const results2 = await query.take('b', 1, true)
          expect(results2).toEqual([{ b: 1 }])
          expect(query.results().length).toEqual(3)

          const results3 = await query.take('b', 1)
          expect(results3).toEqual([{ b: 3 }])
          expect(query.results().length).toEqual(4)

          await query.all()
          const results4 = await query.take('b', 4, true)
          expect(results4).toEqual([{ b: 1 }, { b: 2 }, { b: 3 }])
          expect(query.results().length).toEqual(5)

          const results5 = await query.take('b', 3)
          expect(results5).toEqual([])
          expect(query.results().length).toEqual(5)
        })

        it('provides correct results when count exceeds match set', async () => {
          const data = collector(function* () {
            yield Promise.resolve({ a: 1 })
            yield { b: 1 }
            yield Promise.resolve({ b: 2 })
            yield { b: 3 }
            yield { c: 1 }
          })

          const query = data()
          const results = await query.take('b', 100)

          expect(results).toEqual([{ b: 1 }, { b: 2 }, { b: 3 }])
          expect(query.results().length).toEqual(5)
        })

        it('provides an empty array when no results match', async () => {
          const data = collector(function* () {
            yield Promise.resolve({ a: 1 })
            yield { b: 1 }
            yield Promise.resolve({ b: 2 })
            yield { b: 3 }
            yield { c: 1 }
          })

          const query = data()
          const results = await query.take('x', 4)

          expect(results).toEqual([])
          expect(query.results().length).toEqual(5)

          // Ensure lazy query still works after mismatched query
          const results2 = await query.take('b', 2, true)
          expect(results2).toEqual([{ b: 1 }, { b: 2 }])
          expect(query.results().length).toEqual(5)

          // Ensure greedy query still works after mismatched query
          const results3 = await query.take('b', 2, false)
          expect(results3).toEqual([])
          expect(query.results().length).toEqual(5)
        })
      })
    })

    describe('group', () => {
      describe('selectors', () => {
        it('matches all objects against {selector} then groups them by {grouping}', async () => {
          const data = collector(function* () {
            yield Promise.resolve({ a: 1 })
            yield { b: 1 }
            yield Promise.resolve({ b: 2 })
            yield { b: 3 }
            yield { b: 4 }
            yield { c: 1 }
          })

          const query = data()
          const results = await query.group('b', ({ b }) => b % 2)

          expect(results).toEqual({
            '0': [{ b: 2 }, { b: 4 }],
            '1': [{ b: 1 }, { b: 3 }]
          })
        })
      })
    })

    describe('walk', () => {
      it('resets collector state when called', () => {
        const data = collector(function* () {})
        const query = data()

        expect(query.state()).toEqual({
          current: null,
          results: [],
          depth: 0,
          done: false
        })
      })

      it('calls generator function with provided arguments', async () => {
        const data = collector(function* (x) {
          yield { a: 1 * x}
          yield { b: 2 * x }
          yield { c: 3 * x }
        })

        const query = data(3)
        const results = await query()

        expect(results).toEqual([{ a: 3 }, { b: 6 }, { c: 9 }])
      })

      it('increases depth and updates cursor before yielding', async () => {
        const data = collector(function* (x) {
          yield { a: 1 * x}
          yield { b: 2 * x }
          yield { c: 3 * x }
        })

        const query = data(3)
        await query.get('a')
        const state = query.state()

        expect(state.depth).toEqual(1)
        expect(state.current).toEqual({ a: 3 })
      })

      it('sets done to true when iteration is complete', async () => {
        const data = collector(function* (x) {
          yield { a: 1 * x}
          yield { b: 2 * x }
          yield { c: 3 * x }
        })

        const query = data(3)
        await query.all()

        expect(query.state().done).toBe(true)
      })

      it('Symbol.iterator', () => {
        const data = collector(function* (x) {
          yield { a: 1 * x}
          yield { b: 2 * x }
          yield { c: 3 * x }
        })

        const query = data(3)

        expect(Array.from(query)).toEqual([{ a: 3 }, { b: 6 }, { c: 9 }])
      })

      it('Symbol.asyncIterator', async () => {
        const data = collector(function* (x) {
          yield Promise.resolve({ a: 1 * x})
          yield { b: 2 * x }
          yield Promise.resolve({ c: 3 * x })
        })

        const query = data(3)
        const results = []

        for await (const node of query) {
          results.push(node)
        }

        expect(results).toEqual([{ a: 3 }, { b: 6 }, { c: 9 }])
      })
    })
  })
})
