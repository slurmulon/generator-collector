// WORKS! Use this over typescript version (but ultimately typescript-ify this)
// Just `node src.index.js` to run

const { run, find, filter, map, singleton, yielding, concat, some, wrapAsPromise } = require('js-coroutines')

const RefGenerator = function* () {}
const RefAsyncGenerator = async function* () {}

// TODO: Move into collector, for convenience
function sleep (time = 0, value) {
  return new Promise((resolve /*, reject*/) => {
    setTimeout(() => resolve(value), time)
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

// function isGenerator (value) {
function isGeneratorIterator (value) {
  return value?.constructor === RefGenerator.prototype.constructor
    && typeof value?.[Symbol.iterator] === 'function'
    && typeof value?.['next'] === 'function'
    && typeof value?.['throw'] === 'function'
}

// function isGenerator (value) {
//   return typeof value === 'object' && fn.constructor.name === 'GeneratorFunction'
// }

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

// const commit = wrapAsPromise(function* (key, data) {
//   const value = yield data

//   return { [key]: data }
//   // return yield { [key]: data }
// })

// const resolve = wrapAsPromise(function* (promise, map) {
// const cast = wrapAsPromise(function* (promise, resolver) {
// const cast = wrapAsPromise(function* (data, resolver) {
const future = wrapAsPromise(function* (data, resolver) {
  const value = isPromise(data) ? yield data : data

  if (typeof resolver === 'string') {
    return { [resolver]: value }
  }

  if (typeof resolver === 'function') {
    return resolver(value)
  }

  // TODO: Test
  if (isPromise(resolver)) {
    return future(value, yield resolver)
    // return yield future(value, resolver)
  }

  // TODO: Test
  // if (isGenerator(resolver)) {
  //   return cast(value, wrapAsPromise(resolver))
  // }

  return value
})

// TODO: Rename to matcher
// const matching = (selector) => function* matches (value) {
const matching = (selector) => (value) => {
  if (Array.isArray(selector)) {
    // return selector.every(matches)
    // WARN: This is basically IN logic in SQL (sometimes we'll want NOT IN, or .some
    // TODO: Make function a generator and use js-coroutines/some instead (remove yielding from queries)
    return selector.some(matching)
    // return yield* some(selector, matching(selector))
    // return some(selector, matching(selector))
  }

  if (typeof selector === 'string') {
    if (typeof value === 'object') {
      return (value?.key === selector || value.hasOwnProperty(selector))
    }

    return value === selector
  }

  if (typeof selector === 'function') {
    return selector(value)
  }

  return !!selector
}

const collector = (it) => (...args) => {
  let results = []

  function* exec (it) {
    if (isAsyncGeneratorFunction(it)) {
      throw TypeError(`collect cannot support async generator functions due to yield*`)
    }

    // if (!isIteratorFunction(it)) {
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

      // IDEA: Allow "release" param to be provided to QueryGeneratorResult, and then only yield when the current item is true!!!
      // @source: http://js-coroutines.com/docs/global.html#singleton
      // if(results.length % 100 === 0) yield
    }

    return results
  }

  // const unwrap = value => value?.data ?? value
  const unwrap = value => value?.data ?? value?.value ?? value

  const gen = exec(it)

  // TODO: Use symol iterator
  // @see: https://javascript.info/async-iterators-generators
  const context = {
    find: singleton(function* (selector = true, next = false) {
    // find: singleton(async function* (selector = true, next = false) {
      console.log('\n\nfind', selector)

      let node = gen.next()

      const match = yield* find(
        results,
        // yielding(matching(selector), 0)
        yielding(matching(selector))
        // matching(selector)
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

          // yield value
          // node = await gen.next(value)
        }
      }

      return unwrap(match)
    }),

    all: singleton(function* (selector = true) {
    // all: singleton(async function* (selector = true) {
      // const node = await gen.next()
      const node = gen.next()
      // const source = node.done ? results.concat(node.value) : yield* gen
      const source = node.done
        ? (node.value !== undefined ? results.concat(node.value) : results)
        : yield* gen

      const matches = yield* filter(
        source || [],
        yielding(matching(selector))
        // matching(selector)
      )

      return yield* map(
        matches,
        yielding(unwrap)
      )
    }),

    last: (selector = true) => run(function* () {
      const matches = yield* filter(
        results || [],
        yielding(matching(selector))
        // matching(selector)
      )

      return unwrap(matches[matches.length - 1])
    }),

    clear () {
      gen.return(results)

      results = []

      return context
    },

    next () {
      return gen?.next?.()
    },

    sleep,

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

  // Collector query aliases
  context.get = context.first = context.find

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
// })

async function test () {
  // const tips = commit('tips', ['$$$', 'space', 'subsidies'])
  // const tips = Promise.resolve({ tips: true, money: ['$$$', 'space', 'subsidies'] })

  const hello = function* (name) {
    yield { name, event: 'hello' }
    yield { name, event: 'chatter' }
    yield { junk: true }
    yield { meeting: { name, hello: true } }
  }

  const goodbye = function* (name) {
    // yield { bye: name, event: true }
    // yield commit('tips', { event: 'tips', money: ['space', 'subsidies'] })
    // const t = commit('tips', tips)
    // console.log('got t', t)
    // yield t
    yield sleep(2000)
    // yield Promise.resolve({ tips: true, money: ['$$$', 'space', 'subsidies'] })

    // WORKS
    console.time('getting-tips')
    // yield sleep(2000, { tips: true, money: ['$$$', 'space', 'subsidies'] })
    //  - all async yields for "tips" work
    // yield commit('tips', { event: 'tips', money: ['space', 'subsidies'] })
    // yield cast(Promise.resolve({ event: 'tips', money: ['space', 'subsidies'] }), 'tips')
    // yield cast(Promise.resolve({ event: 'tips', money: ['space', 'subsidies'] }), data => ({ tips: data }))
    const learnings = sleep(1500, { event: 'tips', money: ['batteries', 'space', 'subsidies'] })
    // yield hook
    // yield link
    // yield future
    // yield resolve
    // yield when
    // yield then
    // yield push
    // yield plug
    // yield cast(learnings, data => ({ tips: data, event: 'learnings' }))
    yield future(learnings, data => ({ tips: data, event: 'learnings' }))
    // yield { event: 'learnings', tips: (yield learnings) } // wont work, DOCUMENT
    // yield hook(learnings, data => ({ tips: data, event: 'learnings' }))
    console.timeEnd('getting-tips')
    // yield tips

    yield { name, event: 'bye' }
    yield { meeting: { id: Math.random() * 1000, goodbye: true } }
  }

  // const intros = routine('intros', function* (name) {
  // const intros = multi(function* (name) {
  // const intros = collect(function* (name) {
  // const intros = gather(function* (name) {
  // const intros = stream(function* (name) {
  // const intros = flow(function* (name) {
  // const intros = query(function* (name) {
  // const intros = queryable(function* (name) {
  // const intros = trail(function* (name) {
  // const intros = collector(function* (name) {
  // const intros = yarn(function* (name) {
  // const intros = walk(function* (name) {
  // const intros = walker(function* (name) {
  // const intros = walkable(function* (name) {
  // hook
  // clutch
  // const intros = queryable(function* (name) {

  // FIXME/SUPPORT async
  const intros = collector(function* (name) {
  // const intros = collector(async function* (name) {
    yield* hello(name)
    yield { notdone: true }
    // await sleep(3000)
    //
    console.time('still-meeting')
    yield sleep(3000) // working promise without async await!
    console.timeEnd('still-meeting')

    yield* goodbye(name)
    return yield Promise.resolve({ totallydone: true }) // FIXME: Not getting captured, only with yield (due to for loop vs while!)
    // return yield { totallydone: true } // FIXME: Not getting captured, only with yield (due to for loop vs while!)
    // return { totallydone: true } // FIXME: Not getting captured, only with yield (due to for loop vs while!)
  })

  const stream = intros('Elon Musk')
  // const stream = await intros('Elon Musk')
  // const bad = await stream.find('bad')
  // await stream.find('meeting')
  const { event } = await stream.find('event')
  console.log('>>>>>> got event', event)
  const { event: chatter } = await stream.find('event', true)
  console.log('>>>>>> got next event', chatter)
  console.log('.... sleeping 2 seconds ....')
  await sleep(2000)
  const { meeting } = await stream.find('meeting')
  console.log('>>>>>> got meeting', meeting)
  const events = await stream.all('event')
  const lastEvent = await stream.last('event')
  const lastMeeting = await stream.last('meeting')
  const foundTips = await stream.all('tips')
  // const foundTips = await stream.find(({ event }) => event === 'tips')
  // const last = await results.last()
  // const last = await stream()
  // const events = await results.all(['id', 'hello'])

  // console.log('\n\nMeeting success!', meeting, events, last, event, lastEvent, lastMeeting)
  console.log('\n\nMeeting success!', meeting, events, lastMeeting)
  console.log(' ---- tips', foundTips)
  console.log(' ---- all', await stream.all(true))

  process.exit(0)
}

test()


