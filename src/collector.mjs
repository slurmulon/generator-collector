import { entity, unwrap } from './entity.mjs'
import { matcher } from './matcher.mjs'
import {
  isGeneratorFunction,
  isAsyncGeneratorFunction,
  isPromise,
  sleep
} from './util.mjs'

// js-coroutines is not a module package, so we import this way for cross-system compatibility
import coroutines from 'js-coroutines'
const {
  run,
  find,
  filter,
  map,
  singleton,
  yielding
} = coroutines

export const collector = (it) => (...args) => {
  let results = []

  function* walk (it) {
    if (isAsyncGeneratorFunction(it)) {
      throw TypeError(`collect cannot support async generator functions due to yield*`)
    }

    if (!isGeneratorFunction(it)) {
      throw TypeError(`collector must wrap a generator function: ${it?.constructor?.name}`)
    }

    results = []

    // TODO: Swap name of gen and it, proper convention
    const gen = it(...args)

    for (const node of gen) {
      // console.log('===== yielding', node)
      if (isPromise(node)) {
        results.push(yield node)
      } else {
        results.push(node)
        yield node
      }
    }

    return results
  }

  const gen = walk(it)

  // @see: https://javascript.info/async-iterators-generators
  const context = {
    find: singleton(function* (selector = true, next = false) {
      let node = gen.next()

      const match = yield* find(
        results,
        yielding(matcher(selector), 1)
      )

      if (!next && match) {
        return unwrap(match)
      }

      while (!node?.done) {
        const value = unwrap(node.value)

        if (matcher(selector)(node.value)) {
          return value
        } else {
          node = gen.next(value)
          yield value
        }
      }

      return unwrap(match)
    }),

    all: singleton(function* (selector = true) {
      const node = gen.next()
      const source = node.done
        ? (node.value !== undefined ? results.concat(node.value) : results)
        : yield* gen

      const matches = yield* filter(
        source || [],
        yielding(matcher(selector), 1)
      )

      return yield* map(
        matches,
        yielding(unwrap, 1)
      )
    }),

    last: (selector = true) => run(function* () {
      const matches = yield* filter(
        results || [],
        yielding(matcher(selector), 1)
      )

      return unwrap(matches[matches.length - 1])
    }),

    // TODO: query: group(selector)
    // TODO: query: take(count, selector)

    clear () {
      gen.return(results)

      results = []

      return context
    },

    next () {
      return gen?.next?.()
    },

    *[Symbol.iterator]() {
      let node = gen.next()

      while (!node?.done) {
        const value = unwrap(node.value)
        yield value
        node = gen.next(value)
      }
    },

    async *[Symbol.asyncIterator]() {
      let node = await gen.next()

      while (!node?.done) {
        const value = unwrap(node.value)
        yield value
        node = await gen.next(value)
      }
    }
  }

  // Collector function aliases
  context.get = context.first = context.find
  context.wait = context.sleep = sleep

  // Not much of a point in being able to provide a selector here (or at least, it just becomes confusing for the reader/user)
  return Object.assign(async (cleanup = true) => {
    const result = await context.last()

    if (cleanup) {
      setTimeout(() => context.clear(), 0)
    }

    return result
  }, context)
}

export default collector
