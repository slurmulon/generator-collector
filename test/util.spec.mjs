import { isGeneratorFunction, isGeneratorIterator, asyncToGenerator } from '../src/util'

describe.only('asyncToGenerator', () => {
  it('converts async functions into plain generator functions', () => {
    const fn = async function () {
      const a = await Promise.resolve('1')
      const b = await Promise.resolve('2')

      return { a, b }
    }

    const result = asyncToGenerator(fn)

    console.log('DAS RESULT!!!!', result)

    expect(isGeneratorFunction(result)).toBe(true)

    const gen = result()

    expect(isGeneratorIterator(gen)).toBe(true)
    expect(gen.next()).toEqual({ a: 1, b: 2 })
  })
})
