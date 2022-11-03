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
    throw TypeError(`collector cannot wrap async generator functions due to yield*`)
  }

  if (!isGeneratorFunction(generator)) {
    throw TypeError(`collector must wrap a generator function: ${generator?.constructor?.name}`)
  }

  function* walk (gen) {
    results = []
    current = null
    depth = 0
    done = false

    const path = gen(...args)

    for (const node of path) {
      depth++
      current = node
      yield node
    }

    done = true

    return results
  }

  let iterator = walk(generator)

  const context = {
    find: consumer(function* (selector = true, next = false) {
      // If the current iterated node exists, use it unless we're forcing an iteration
      let node = current
        ? next
          ? iterator.next(current)
          : { done, value: current, past: true }
        : iterator.next()

      const found = yield* find(
        results,
        yielding(matcher(selector))
      )

      // Return first captured matching result if we aren't forcing an iteration
      if (!next && found) {
        return yield entity(found, unwrap)
      }

      // Continue iterating until we find, capture and return the first matching result
      while (!node?.done) {
        const value = yield entity(node?.value, unwrap)

        if (!node?.past) {
          results.push(value)
        }

        if (matcher(selector)(value)) {
          return value
        }

        node = iterator.next(value)
      }

      return null
    }),

    all: consumer(function* (selector = true, lazy = false) {
      // If greedy, flush the entire generator and capture all parsed results before filtering,
      // allowing user-provided selector functions (and matcher) to accept purely synchronous values.
      if (!lazy) yield context.flush()

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

    take: consumer(function* (selector = true, count = 1, lazy = false) {
      const items = []
      let depth = 0

      // Take from collected results when iteration is already complete
      if (lazy && done) {
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
        const item = yield context.find(selector, depth ? true : !lazy)

        if (item != null) {
          items.push(item)
          depth++
        }
      }

      return items
    }),

    next (selector = true) {
      return context.find(selector, true)
    },

    flush () {
      return context.find(false, true)
    },

    clear () {
      iterator.return(results)

      iterator = walk(generator)

      return context
    },

    results () {
      return [].concat(results)
    },

    state () {
      return { current, depth, done, results }
    },

    *[Symbol.iterator] (...args) {
      let node = iterator.next(...args)

      while (!node?.done) {
        const value = unwrap(node.value)

        results.push(value)
        yield value

        node = iterator.next(value)
      }
    },

    async *[Symbol.asyncIterator] (...args) {
      let node = await iterator.next(...args)

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
  return Object.assign(async (clear = true) => {
    await context.find(false, true)

    if (clear) {
      setTimeout(() => context.clear(), 0)
    }

    return results
  }, context)
}

export default collector
