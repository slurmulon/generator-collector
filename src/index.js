// WORKS! Use this over typescript version (but ultimately typescript-ify this)
// Just `node src.index.js` to run

const { run, find, filter, map, singleton, yielding, concat, some, wrapAsPromise } = require('js-coroutines')

const RefGenerator = function* () {}
const RefAsyncGenerator = async function* () {}

function sleep (time = 0, value) {
  return new Promise(resolve => {
    const result = value ?? { sleep: { time, value } }

    // setTimeout(() => resolve(value), time)
    setTimeout(() => resolve(result), time)
  })
}

function isGeneratorFunction (fn) {
  return (fn?.constructor === RefGenerator.constructor) || (typeof fn === 'function' && fn.constructor?.name === 'GeneratorFunction')
}

function isAsyncGeneratorFunction (fn) {
  return (fn?.constructor === RefAsyncGenerator.constructor) || typeof fn === 'function' && fn.constructor?.name === 'AsyncGeneratorFunction'
}

function isIteratorFunction (fn) {
  return isGeneratorFunction(fn) || isAsyncGeneratorFunction(fn)
}

function isGeneratorIterator (value) {
  return value?.constructor === RefGenerator.prototype.constructor ||
    (typeof value?.[Symbol.iterator] === 'function' &&
     typeof value?.['next'] === 'function' &&
     typeof value?.['throw'] === 'function')
}

function isPromise (value) {
  if (
    value !== null &&
    typeof value === 'object' &&
    typeof value.then === 'function' &&
    typeof value.catch === 'function'
  ) {
    return true
  }

  return false
}

// const resolve = wrapAsPromise(function* (promise, map) {
// const cast = wrapAsPromise(function* (data, resolver) {
const future = wrapAsPromise(function* (data, resolver) {
  if (typeof data === 'function') {
    return future(data(), resolver)
  }

  const value = isPromise(data) ? yield data : data

  if (typeof resolver === 'string') {
    return { [resolver]: value }
  }

  if (typeof resolver === 'function') {
    // return resolver(value) // WORKS
    return yield* yielding(resolver, 0)(value) // WORKS (necessary?)
  }

  if (isPromise(resolver)) {
    return future(value, yield resolver)
  }

  if (isGeneratorFunction(resolver)) {
    return future(value, wrapAsPromise(resolver))
  }

  return value
})

// TODO: Rename to matcher
const matching = (selector) => (value) => {
  if (typeof selector === 'string') {
    if (typeof value === 'object') {
      return (value === selector || value.hasOwnProperty(selector))
    }

    return value === selector
  }

  if (typeof selector === 'function') {
    return selector(value)
  }

  if (Array.isArray(selector)) {
    return selector.some(matching)
  }

  return !!selector
}

const collector = (it) => (...args) => {
  let results = []

  function* exec (it) {
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
      console.log('===== yielding', node)

      if (isPromise(node)) {
        results.push(yield node)
      } else {
        results.push(node)
        yield node
      }
    }

    return results
  }

  const unwrap = value => value?.data ?? value?.value ?? value

  const gen = exec(it)

  // @see: https://javascript.info/async-iterators-generators
  const context = {
    find: singleton(function* (selector = true, next = false) {
      console.log('\n@@@ find', selector)

      let node = gen.next()

      const match = yield* find(
        results,
        yielding(matching(selector), 0)
      )

      if (!next && match) {
        return unwrap(match)
      }

      while (!node?.done) {
        const value = unwrap(node.value)

        if (matching(selector)(node.value)) {
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
        yielding(matching(selector), 0)
      )

      return yield* map(
        matches,
        yielding(unwrap, 0)
      )
    }),

    last: (selector = true) => run(function* () {
      const matches = yield* filter(
        results || [],
        yielding(matching(selector), 0)
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

    async *[Symbol.asyncIterator]() {
      let node = gen.next()

      while (!node?.done) {
        const value = unwrap(node.value)
        yield value
        node = await gen.next(value)
      }
    },

    *[Symbol.iterator]() {
      let node = gen.next()

      while (!node?.done) {
        const value = unwrap(node.value)
        yield value
        node = gen.next(value)
      }
    }
  }

  // Collector function aliases
  context.get = context.first = context.find
  context.wait = context.sleep = sleep

  // Not much of a point in being able to provide a selector here (or at least, it just becomes confusing for the reader/user)
  // return Object.assign(() => context.last(), context)
  return Object.assign(async (cleanup = true) => {
    const result = await context.last()

    if (cleanup) {
      setTimeout(() => context.clear(), 0)
    }

    return result
  }, context)
}

module.exports = module.exports || {}
module.exports.default = module.exports

module.exports.collector = collector
module.exports.future = future
module.exports.matching = matching
module.exports.sleep = sleep
