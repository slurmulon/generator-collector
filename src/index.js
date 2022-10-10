// WORKS! Use this over typescript version (but ultimately typescript-ify this)
// Just `node src.index.js` to run

const { run, find, filter, map, singleton, yielding, wrapAsPromise } = require('js-coroutines')

function sleep (time = 0, value) {
  return new Promise((resolve /*, reject*/) => {
    setTimeout(() => resolve(value), time);
  });
}


// const query = (it, ...args) => {
// const query = (it) => singleton(function* (...args) {
const query = (it) => (...args) => {
  let results = []

  const exec = function* (it, resolved) {
    results = []
    const gen = it(...args)
    // const results = []

    for (let node of gen) {
      results.push(node)
      console.log('=========== yielding node', it, node)
      yield node
      // IDEA: Allow "release" param to be provided to QueryGeneratorResult, and then only yield when the current item is true!!!
      // @source: http://js-coroutines.com/docs/global.html#singleton
      // if(results.length % 100 === 0) yield
    }

    return results
  // }, [])
  }

  const matching = (selector) => (value) => {
    // console.log('matching?', selector, value)
    if (Array.isArray(selector)) {
      // return selector.every(matches) // WARN: This is basically IN logic in SQL (sometimes we'll want NOT IN, or .some
      return selector.some(matching)
    }

    if (typeof selector === 'string') {
      if (typeof value === 'object') {
        // return (value?.scope === selector || value.hasOwnProperty(selector))
        // return (value?.context === selector || value.hasOwnProperty(selector))
        return (value?.key === selector || value.hasOwnProperty(selector))
      }
    }

    if (typeof selector === 'function') {
      return selector(value)
    }

    return !!selector
  }

  const unwrap = value => value?.data ?? value

  const gen = exec(it)

  const context = {
    find: singleton(function* (selector = true) {
      console.log('\n\nfind', selector)

      let node = gen.next()

      const match = yield* find(
        results,
        // yielding(matching(selector), 0)
        yielding(matching(selector))
      )

      // FIXME: Doesn't handle the case where the first match from .find returns empty (breaks the chain)
      if (match) {
        const value = unwrap(match)
        // yield value
        // node = gen.next(value)
        return value
      }

      while (!node?.done) {
        const value = unwrap(node.value)

        if (matching(selector)(node.value)) {
          return value
        } else {
          node = gen.next(value)
          // yield node
          yield value // may be able to live without
        }
      }

      return unwrap(match)
    }),

    // all: (selector = true) => run(function* () {
    // LAST
    all: singleton(function * (selector = true) {
    // FIXES .bad but causes early termination on happy path
    // all: (selector = true) => run(function* () {
      // gen.next()
      // Necessary to ensure latest changes fully delegate to consumer
      //  - Actually, may have been breaking .find('bad')
      //  - Without it though, `matched` value (from .find) ends up getting used always
      // const results = yield* gen
      // LAST
      const source = gen.next().done ? results : yield* gen //yield* gen

      const matches = yield* filter(
        source || [],
        yielding(matching(selector))
      )

      return yield* map(
        matches,
        // Use this if we want to automatically unwrap values. Use the next solution if not.
        // yielding(match => match?.[selector] ?? match?.data ?? match)
        yielding(unwrap)
      )
    }),

    // Just remove this, same as find
    first: (selector = true) => run(function* () {
      const matches = yield* filter(
        results,
        yielding(matching(selector))
      )

      return unwrap(matches[0])
    }),

    last: (selector = true) => run(function* () {
      const matches = yield* filter(
        results,
        yielding(matching(selector))
      )

      return unwrap(matches[matches.length - 1])
    })
  }

  // return context
  // return Object.assign((selector) => context.last(selector), context)
  // Not much of a point in being able to provide a selector here (or at least, it just becomes confusing for the reader/user)
  return Object.assign(() => context.last(), context)
}
// })

async function test () {
  // const hello = product('hello', function* (name) {
  // const hello = producer('hello', function* (name) {
  // const hello = gen('hello', function* (name) {
  // const hello = subgen('hello', function* (name) {
  // const hello = routine('hello', function* (name) {
    // yield `hello ${name}`
  // }
  // Same as above
  const hello = function* (name) {
    // yield { meeting: { name } }
    // yield { junk: true }
    yield { name, event: 'hello' }
    yield { junk: true }
    yield { meeting: { name } }
  }

  // const goodbye = routine('goodbye', function* (name) {
  //   yield `goodbye ${name}`
  //   yield { id: Math.random() * 1000 }
  const goodbye = function* (name) {
    // yield { bye: name, event: true }
    yield { name, event: 'bye' }
    yield { meeting: { id: Math.random() * 1000 } }
  }

  // const intros = routine('intros', function* (name) {
  // const intros = function* (name) {
  // const intros = multi(function* (name) {
  // const intros = collect(function* (name) {
  // const intros = gather(function* (name) {
  // const intros = stream(function* (name) {
  // const intros = flow(function* (name) {
  const intros = query(function* (name) {
    yield* hello(name)
    // yield sleep(2000) // does'nt work yet
    yield* goodbye(name)
  })

  // const meeting = await query(intros, 'Elon Musk').find('meeting')
  // const { meeting } = await query(intros, 'Elon Musk').find('meeting')
  // const events = await query(intros, 'Elon Musk').all('event')
  // const results = query(intros, 'Elon Musk')
  // const results = query(intros)('Elon Musk')
  //
  // const results = intros('Elon Musk')
  const stream = intros('Elon Musk')
  // const stream = await intros('Elon Musk')
  // console.log('wuttt', await results.find('event'))
  // FIXME: Breaks when first, prevents events from being collected
  // const bad = await stream.find('bad')
  // await stream.find('meeting')
  const { event } = await stream.find('event')
  console.log('>>>>>> got event', event)
  await sleep(2000)
  const { meeting } = await stream.find('meeting')
  console.log('>>>>>> got meeting', meeting)
  const events = await stream.all('event')
  const lastEvent = await stream.last('event')
  // const last = await results.last()
  const last = await stream()
  // const events = await results.all(['id', 'hello'])

  console.log('\n\nMEETING SUCCES!', meeting, events, last, event, lastEvent)
}

test()


