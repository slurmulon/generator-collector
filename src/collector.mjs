import { entity } from './entity.mjs'
import { matcher } from './matcher.mjs'
import { promiser } from './promiser.mjs'
import {
  isGeneratorFunction,
  isAsyncGeneratorFunction,
  unwrap,
  sleep,
} from './util.mjs'

import {
  find,
  filter,
  map,
  groupBy,
  yielding,
} from 'js-coroutines'

export const collector = (generator, consumer = promiser) => (...args) => {
  let results = []
  let current = null
  let depth = 0
  let done = false

  if (isAsyncGeneratorFunction(generator)) {
    throw TypeError(`collector cannot support async generator functions due to yield*`)
  }

  if (!isGeneratorFunction(generator)) {
    throw TypeError(`collector must wrap a generator function: ${generator?.constructor?.name}`)
  }

  function* walk (gen) {
    results = []
    depth = 0
    done = false

    const path = gen.apply(this, args)

    for (const node of path) {
      depth++
      current = node
      yield node
    }

    done = true

    return results
  }

  const iterator = walk(generator)

  const context = {
    find: consumer(function* (selector = true, next = false) {
      // It the current iterated node exists, us it unless we're forcing an iteration
      let node = current
        ? next
          ? iterator.next()
          : current
        : iterator.next()

      const known = yield* find(
        results,
        yielding(matcher(selector))
      )

      // Return first captured matching result if we aren't forcing an iteration
      if (!next && known) {
        return yield entity(known, unwrap)
      }

      // Continue iterating until we find, capture and return the first matching result
      while (!node?.done) {
        const value = yield entity(node.value, unwrap)

        results.push(value)

        if (matcher(selector)(value)) {
          return value
        }

        node = iterator.next(value)
      }

      return null
    }),

    all: consumer(function* (selector = true, lazy = false) {
      // Flush the entire generator and capture all parsed results before filtering, allowing
      // user-provided selector functions (and matcher) to accept purely synchronous values.
      // In general we must iterate and parse the entire generator to know every matching result.
      if (!lazy) yield context.find(false, true)

      return yield* filter(
        results || [],
        yielding(matcher(selector))
      )
    }),

    last: consumer(function* (selector = true, lazy = false) {
      const matches = yield context.all(selector, lazy)

      return matches[matches.length - 1] ?? null
    }),

    group: consumer(function* (selector = true, grouping, lazy = false) {
      const matches = yield context.all(selector, lazy)

      return yield* groupBy(
        matches || [],
        yielding(grouping)
      )
    }),

    take: consumer(function* (selector = true, count = 1, next = false) {
      const items = []
      let depth = 0

      // Take from collected results when iteration is already complete
      if (!next && done) {
        const matches = yield *filter(
          results,
          yielding(matcher(selector))
        )

        return yield* map(
          matches.slice(0, count),
          yielding(value => entity(value, unwrap))
        )
      }

      // Continue iterating and find the next matching results until we are done
      while (depth < count && !done) {
        const iterate = depth ? true : next
        const item = yield context.find(selector, iterate)

        if (item != null) {
          items.push(item)
          depth++
        }
      }

      return items
    }),

    clear () {
      iterator.return(results)

      results = []
      current = null
      depth = 0
      done = false

      return context
    },

    results () {
      return [].concat(results)
    },

    state () {
      return { current, depth, done, results }
    },

    *[Symbol.iterator] () {
      let node = iterator.next()

      while (!node?.done) {
        const value = unwrap(node.value)

        results.push(value)
        yield value

        node = iterator.next(value)
      }
    },

    async *[Symbol.asyncIterator] () {
      let node = await iterator.next()

      while (!node?.done) {
        const value = await entity(node.value, unwrap)

        results.push(value)
        yield value

        node = await iterator.next(value)
      }
    }
  }

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
