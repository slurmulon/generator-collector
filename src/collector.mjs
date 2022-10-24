import { entity } from './entity.mjs'
import { matcher } from './matcher.mjs'
import {
  isGeneratorFunction,
  isAsyncGeneratorFunction,
  unwrap,
  sleep,
} from './util.mjs'

// js-coroutines is not a module package, so we import this way for cross-system compatibility
// import coroutines from 'js-coroutines'
// const {
import {
  run,
  find,
  filter,
  map,
  singleton,
  yielding,
  reduce,
  wrapAsPromise
} from 'js-coroutines'
// } = coroutines

export const collector = (it) => (...args) => {
  let results = []
  let current = null
  let depth = 0
  let done = false

  function* walk (it) {
    if (isAsyncGeneratorFunction(it)) {
      throw TypeError(`collect cannot support async generator functions due to yield*`)
    }

    if (!isGeneratorFunction(it)) {
      throw TypeError(`collector must wrap a generator function: ${it?.constructor?.name}`)
    }

    results = []
    depth = 0
    done = false

    const path = it(...args)

    for (const node of path) {
      depth++
      current = node
      yield node
    }

    done = true

    return results
  }

  const gen = walk(it)

  const context = {
    find: wrapAsPromise(function* (selector = true, next = false) {
      let node = gen.next()

      const known = yield* find(
        results,
        yielding(matcher(selector))
      )

      // Return first captured matching result if we aren't forcing an iteration
      if (!next && known) {
        return entity(known, unwrap)
      }

      // Continue iterating until we find, capture and return the first matching result.
      // Yields control of the thread and then repeats this process upon subsequent queries.
      while (!node?.done) {
        const value = yield entity(node.value, unwrap)

        results.push(value)

        if (matcher(selector)(value)) {
          return value
        }

        node = gen.next(value)
      }

      return null
    }),

    all: wrapAsPromise(function* (selector = true) {
      // Flush the entire generator and capture all parsed results before filtering, allowing
      // user-provided selector functions (and matcher) to accept purely synchronous values.
      // In general we must iterate and parse the entire generator to know every matching result.
      yield context.find(false, true)

      return yield* filter(
        results || [],
        yielding(matcher(selector))
      )
    }),

    last: wrapAsPromise(function* (selector = true) {
      const matches = yield context.all(selector)

      return matches[matches.length - 1] ?? null
    }),

    // TODO: query: group(selector)
    // TODO: query: take(count, selector)

    clear () {
      gen.return(results)

      results = []
      current = null
      depth = 0
      done = false

      return context
    },

    results () {
      return results
    },

    *[Symbol.iterator]() {
      let node = gen.next()

      while (!node?.done) {
        const value = entity(node.value, unwrap)

        results.push(value)
        yield value

        node = gen.next(value)
      }
    },

    async *[Symbol.asyncIterator]() {
      let node = await gen.next()

      while (!node?.done) {
        const value = await entity(node.value, unwrap)

        results.push(value)
        yield value

        node = await gen.next(value)
      }
    }
  }

  Object.defineProperty(context, 'state', {
    enumerable: false,
    get: () => ({ cursor, depth, done, results })
  })

  // Collector function aliases
  context.get = context.first = context.find
  context.wait = context.sleep = sleep

  // Allows generator to be called as any other async function.
  // Iterates the entire generator then returns an array of every
  // collected and parsed (purely synchronous) result, in order.
  return Object.assign(async (cleanup = true) => {
    await context.find(false, true)

    if (cleanup) {
      setTimeout(() => context.clear(), 0)
    }

    return results
  }, context)
}

export default collector
