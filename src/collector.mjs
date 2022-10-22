import { entity } from './entity.mjs'
import { matcher } from './matcher.mjs'
import {
  isGeneratorFunction,
  isAsyncGeneratorFunction,
  isPromise,
  unwrap,
  sleep,
  asyncToGenerator
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
  wrapAsPromise
} from 'js-coroutines'
// } = coroutines

export const collector = (it) => (...args) => {
  let results = []
  // let promise = null
  let promise = Promise.resolve(null)
  let cursor = null

  function* capture (result) {
    const value = yield entity(result, unwrap)

    console.log('CAPTURED!', value)

    // results = yield* concat(results, [value])
    results.push(value)

    return value
  }

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


      // cursor = node

      // if (isPromise(node)) {
      //   results.push(yield node)
      // } else {
      //   results.push(node)
      //   yield node
      // }

      // LAST
      //  - Mostly works but breaks non-async values sometimes (see smoke test)
      // results.push(yield entity(node))

      // BEST
      if (isPromise(node)) {
        console.log('\n\n(3) [collector.promise] .... pushing promise node! ...', node, results)
        // const r = yield entity(node)
        // LAST
        // const r = yield node
        // results.push(r)
        // const r = yield node
        // results.push(r)

        // const r = (yield* [entity(node)])
        // const r = yield Promise.resolve({ fart: true })
        // const r = yield entity(node)
        // results.push(r)
        // yield r
        //
        //
        // WORKS BEST!
        // promise = node.then(v => results.push(v))
        // yield node

        // NEXT!! - consider just capturing result in other functions wrapped by js-coroutines!
        // const done = yield* capture(node)
        yield node

        // console.log('(3) [collector.promise] PUSHED promise node!', node)
        // console.log('(3) [collector.promise] PUSHED promise node!', node, r)
        // console.log('(3) [collector.promise] pushed promise node!', node, r, entity(node).then(x => console.log('-------------------- inner wut', x)))
      } else {
        // yield node
        // console.log('(3) [collector.norm] pushing normal node', node, results)
        // WORKS BEST! (orig)
        results.push(node)
        yield node


        // WORKS BEST! (2)
        // promise.then(() => results.push(node))
        // yield node

        // console.log('(3) [collector.norm] PUSHED normal node', node)
      }


        // console.log('(3) [collector.promise] .... pushing promise node! ...', node, asyncToGenerator(entity))
        // const r = yield entity(node)

        // // const r = yield* asyncToGenerator(entity)(node)
        // results.push(r) 

        // console.log('(3) [collector.promise] PUSHED promise node!', node, r)
        // // console.log('(3) [collector.promise] pushed promise node!', node, r, entity(node).then(x => console.log('-------------------- inner wut', x)))


      // const v = entity(node)
      // console.log('v', v, v.then(x => console.log('xxxxxx', x)))
      // results.push(v)
      // yield v
      //

      // let result = null
      // if (node.next) {
      //   // result = await run(nextResult)
      //   console.log('1. GEN NODE', node, result)
      //   result = yield* node
      //   console.log('2. GEN NODE', node, result)
      // } else if (node.then) {
      //   console.log('1. PROMISE NODE', node, result)
      //   result = yield node//.then()
      //   console.log('2. PROMISE NODE', node, result)
      // } else {
      //   result = node
      //   yield node
      // }

      // results.push(result)
    }

    return results
  }

  const gen = walk(it)

  const context = {
    find: singleton(function* (selector = true, next = false) {
    // find: wrapAsPromise(function* (selector = true, next = false) {
      // let node = null
      let node = gen.next()
      // let node = yield gen.next()
      //
      console.log('\n\nFIND node', selector, node, results)

      const match = yield* find(
        results,
        // yielding(matcher(selector), 1)
        yielding(matcher(selector))
      )

      if (!next && match) {
        console.log('cached match', match)
        // return yield entity(match, unwrap)
        return entity(match, unwrap)
      }

      // while (!node?.done) {
      while (!node?.done) {
        // LAST BEST
        // node = gen.next()

        const value = yield entity(node.value, unwrap)
        // const prom = entity(node.value, unwrap)
        // const value = yield prom
        // console.log('DAS VALUE', node, value)
        // const matches = yield* yielding(matcher(selector))(value)
        // console.log('matches?', matches)

        // node = gen.next(value)

        if (isPromise(node.value)) {
          results.push(value)
        }

        if (matcher(selector)(value)) {
        // if (matches) {
          // console.log('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!! match', selector, value)
          // const wut = yield value // undefined
          //
          // const wut = yield prom
          // // const wut = yield gen.next(value) // undefined
          // console.log('________________________________ after match', selector, value, wut, results)
          // return wut
          //
          //
          //
          // LAST!!!!!!!!!!!!!!!!!!!!!!!!!
          // if (isPromise(node.value)) {
          //   results.push(value)
          // }
          return value
          //
          // return value
          // return yield value
          // return entity(value, unwrap)
          // return yield entity(value, unwrap)
          //
          // yield value
          // yield entity(value, unwrap)
          // const n = gen.next(value)
          // const n = gen.next(value)
          // console.log('@@@@@@@@@@@@@ next value', n)
          // if (isPromise(n.value)) {
          //   yield n.value
          // }
          // return value

          //console.log('@@@@@@@@@@@@@ next value', value)
          //// const res = function*() { return yield entity(value, unwrap) }
          //// const fin = yield* res()
          //const fin = yield run(function*() { return yield entity(value, unwrap) })
          //console.log('********* FIN', fin)
          ////
          //return fin
        // }

        }

        // if (isPromise(node.value)) {
        //   results.push(value)
        // }

        node = gen.next(value)

        // } else {
        //   node = gen.next(value)
        // }
      }

      // while (!node?.done) {
      //   const value = yield entity(node.value, unwrap)
      //   console.log('DAS VALUE', value)
      //   const matches = yield* yielding(matcher(selector))(value)
      //   console.log('matches?', matches)

      //   // node = gen.next(value)

      //   // if (matcher(selector)(value)) {
      //   if (matches) {
      //     console.log('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!! match', selector, value)
      //     // yield value
      //     return value
      //     // return yield value
      //     // return entity(value, unwrap)
      //     // return yield entity(value, unwrap)
      //   // }
      //   } else {
      //     node = gen.next(value)
      //   }
      // }

      // while (!node?.done) {
      //   const value = yield entity(node.value, unwrap)

      //   node = gen.next(value)

      //   if (matcher(selector)(value)) {
      //     console.log('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!! match', selector, value)
      //     // return value
      //     return value
      //     // return entity(value, unwrap)
      //     // return yield entity(value, unwrap)
      //   }
      //   // } else {
      //   //   node = gen.next(value)
      //   // }
      // }

      // while (!node?.done) {
      //   const value = isPromise(node.value) ? yield node.value : node.value

      //   if (matcher(selector)(value)) {
      //     return value
      //   } else {
      //     node = gen.next(value)
      //   }
      // }

      // while (!node?.done) {
      //   // const value = yield entity(node.value, unwrap)
      //   const prom = entity(node.value, unwrap)
      //   const value = yield prom
      //   // NEXT
      //   // const value = ''
      //   console.log('(3) [collector] matching value???!', prom, value, selector, matcher(selector)(value))

      //   // WORKS!!!!!!!
      //   if (matcher(selector)(value)) {
      //     // return value
      //     // yield value
      //     // return value
      //     // node = gen.next(value)
      //     // return value
      //     // return 'glorb'

      //     console.log('MATCHED GLORBING', prom, value)
      //     // yield 'glorb'
      //     // return 'glorb'
      //     // return yield 'glorb'
      //     // node = gen.next(value)

      //     // node = gen.next(yield prom)
      //     // return 'glorb'

      //     // NEXT
      //     // return yield prom

      //     return value
      //   } else {
      //     // node = gen.next(value)
      //     // yield value

      //     // WORKS!!!!!!!!!
      //     node = gen.next(value)

      //     // NEXT
      //     // node = gen.next(yield prom)
      //   }
      // }


      const last = yield* find(
        results,
        // yielding(matcher(selector), 1)
        yielding(matcher(selector))
      )
      console.log('FIND END', match, last)
      // return last
      return entity(last, unwrap)
      // TODO: entity(match, unwrap)
      // return yield entity(match || node?.value, unwrap)
      // return unwrap(match)
    }),

    all: singleton(function* (selector = true) {
      const node = gen.next()
      const source = node.done ? results : yield* gen // TODO: Test calling .all on last yield in generator

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

    next (...args) {
      return gen?.next?.(...args)
    },

    results () {
      // if (!cursor?.done) {
        // gen?.next?.()
      // }

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
