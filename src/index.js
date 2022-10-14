// WORKS! Use this over typescript version (but ultimately typescript-ify this)
// Just `node src.index.js` to run

const { run, find, filter, map, singleton, yielding, wrapAsPromise } = require('js-coroutines')

// TODO: Move into collector, for convenience
function sleep (time = 0, value) {
  return new Promise((resolve /*, reject*/) => {
    setTimeout(() => resolve(value), time)
  })
}


const collector = (it) => (...args) => {
  let results = []

  const exec = function* (it) {
    results = []
    // TODO: Swap name of gen and it, proper convention
    const gen = it(...args)
    // WORKS (while 2)
    // let node = null
    // WORKS (while)
    // let node = gen.next()

    for (const node of gen) {
    // while (!node || !node.done) {
      console.log('=========== yielding node', node)
      // WORKS (for)
      results.push(node)
      yield node

      // yield node.value
      // node = gen.next()
      //
      // WORKS (while)
      // yield node.value
      // results.push(node.value)
      // node = gen.next()

      // results.push(node.value)
      // yield node.value
      // node = gen.next()

      // ***** WORKS (while) *****
      //   - Also captures return without yield
      //   - Need to decide if we actually want this - nice thing about for iterator is it lets you be explicit and control this yourself
      // node = gen.next()
      // results.push(node.value)
      // yield node.value

      // IDEA: Allow "release" param to be provided to QueryGeneratorResult, and then only yield when the current item is true!!!
      // @source: http://js-coroutines.com/docs/global.html#singleton
      // if(results.length % 100 === 0) yield
    }

    return results
  }

  const matching = (selector) => (value) => {
    if (Array.isArray(selector)) {
      // return selector.every(matches) // WARN: This is basically IN logic in SQL (sometimes we'll want NOT IN, or .some
      return selector.some(matching)
    }

    if (typeof selector === 'string') {
      if (typeof value === 'object') {
        // return (value?.scope === selector || value.hasOwnProperty(selector))
        // return (value?.context === selector || value.hasOwnProperty(selector))
        // return (value?.key === selector || value.hasOwnProperty(selector))
        return (value?.key === selector || value.hasOwnProperty(selector))
      }

      return value === selector
    }

    if (typeof selector === 'function') {
      return selector(value)
    }

    return !!selector
  }

  const unwrap = value => value?.data ?? value

  const gen = exec(it)

  // TODO: Use symol iterator
  // @see: https://javascript.info/async-iterators-generators
  const context = {
    find: singleton(function* (selector = true, next = false) {
      console.log('\n\nfind', selector)

      let node = gen.next()

      const match = yield* find(
        results,
        // yielding(matching(selector), 0)
        yielding(matching(selector))
      )

      // if (match) {
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
      // const source = gen.next().done ? results : yield* gen
      const node = gen.next()
      const source = node.done ? results.concat(node.value) : yield* gen

      const matches = yield* filter(
        source || [],
        yielding(matching(selector))
      )

      return yield* map(
        matches,
        yielding(unwrap)
      )
    }),

    // Just remove this, same as find
    // first: (selector = true) => run(function* () {
    //   const matches = yield* filter(
    //     results || [],
    //     yielding(matching(selector))
    //   )

    //   return unwrap(matches[0])
    // }),

    last: (selector = true) => run(function* () {
      const matches = yield* filter(
        results || [],
        yielding(matching(selector))
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

    sleep
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
  const hello = function* (name) {
    yield { name, event: 'hello' }
    yield { name, event: 'chatter' }
    yield { junk: true }
    yield { meeting: { name, hello: true } }
  }

  const goodbye = function* (name) {
    // yield { bye: name, event: true }
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
  const intros = collector(function* (name) {
    yield* hello(name)
    yield { notdone: true }
    yield* goodbye(name)
    // return yield { totallydone: true } // FIXME: Not getting captured, only with yield (due to for loop vs while!)
    return { totallydone: true } // FIXME: Not getting captured, only with yield (due to for loop vs while!)
  })

  const stream = intros('Elon Musk')
  // const stream = await intros('Elon Musk')
  // const bad = await stream.find('bad')
  // await stream.find('meeting')
  const { event } = await stream.find('event')
  console.log('>>>>>> got event', event)
  const { event: chatter } = await stream.find('event', true)
  console.log('>>>>>> got next event', chatter)
  await sleep(2000)
  const { meeting } = await stream.find('meeting')
  console.log('>>>>>> got meeting', meeting)
  const events = await stream.all('event')
  const lastEvent = await stream.last('event')
  const lastMeeting = await stream.last('meeting')
  // const last = await results.last()
  const last = await stream()
  // const events = await results.all(['id', 'hello'])

  console.log('\n\nMeeting success!', meeting, events, last, event, lastEvent, lastMeeting)
}

test()


