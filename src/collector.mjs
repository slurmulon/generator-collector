import { entity } from './entity.mjs'
import { matcher } from './matcher.mjs'
import {
  isGeneratorFunction,
  isAsyncGeneratorFunction,
  isPromise,
  unwrap,
  sleep
} from './util.mjs'

// js-coroutines is not a module package, so we import this way for cross-system compatibility
import coroutines from 'js-coroutines'
const {
// import {
  run,
  find,
  filter,
  map,
  singleton,
  yielding
// } from 'js-coroutines'
} = coroutines

export const collector = (it) => (...args) => {
  let results = []

  function* walk (it) {
  // async function* walk (it) {
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
    // for await (const node of gen) {
      // WORKS!!!!!!!
      //  - Only problem is it pushes results after yielding node...
      // results.push(yield node)
      //
      // results.push(node)
      // yield node

      if (isPromise(node)) {
        // const r = yield node
        // const r = yield entity(node)
        // // const r = run(node)
        // console.log(' ------- promised yield', node, r)
        // results.push(r)

        console.log(' ------- $$$$$$$$$$$$$$$$$ promised yield', node)
        results.push(yield node)
      } else {
        console.log('----- normal yield', node)
        results.push(node)
        yield node
      }
    }

    return results
  }

  const gen = walk(it)

  const context = {
    find: singleton(function* (selector = true, next = false) {
      let node = gen.next()
      // let node = yield gen.next()

      // console.log('\n\nfind node!', selector, node)

      // WORKS!!!!!!!!!
      // if (isPromise(node.value)) {
      //   // console.log('is promise, about to yield', node.value)
      //   // node = yield node.value
      //   const res = yield node.value
      //   // node = { done: node.done, value: yield node.value }
      //   node.value = res
      //   console.log('was promise, new node!', node, res, results)
      // }

      const match = yield* find(
        results,
        yielding(matcher(selector), 1)
      )

      // console.log('cached match?????????', selector, match, results)

      if (!next && match) {
        // return unwrap(match)
        // WORKS!!!!!!!
        // return entity(match, unwrap)
        return yield entity(match, unwrap)
      }

      while (!node?.done) {
        // const value = entity(node, unwrap)
        // const value = entity(node.value, unwrap)
        // WORKS!!!!!!!!
        const value = yield entity(node.value, unwrap)
        // const value = isPromise(node.value) ? yield entity(node.value, unwrap) : unwrap(node.value)

        // console.log('while match', selector, node.value, value, matcher(selector)(value))

        // if (matcher(selector)(node.value)) {
        //   return value
        // WORKS!!!!!!!
        if (matcher(selector)(value)) {
          // return value
          // console.log('!!!!!!!! RETURNING WHILE MATCH', value)
          return value
        } else {
          // node = gen.next(value)
          // yield value
          //
          // node = gen.next(yield value)
          //
          // WORKS!!!!!!!!!
          node = gen.next(value)

          // WORKS with async (yield* in all prevents full usage)
          // node = yield gen.next(value)

          // yield value
        }
      }

      // TODO: entity(match, unwrap)
      return unwrap(match)
    }),

    all: singleton(function* (selector = true) {
      const node = gen.next()
      // const node = yield gen.next()
      // console.log('alllllll', node, gen)
      // ORIG
      // const source = node.done
      //   ? (node.value !== undefined ? results.concat(node.value) : results)
      //   : yield* gen

      const source = node.done
        ? results
        : yield* gen

      // console.log('_____ all source', source, node.value, node.done)

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

    // next (...args) {
    //   return gen?.next?.(...args)
    // },

    results () {
      return results
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
