// WORKS! Use this over typescript version (but ultimately typescript-ify this)
// Just `node src.index.js` to run

const { run, find, filter, map, singleton, yielding, wrapAsPromise } = require('js-coroutines')

function sleep (time = 0, value) {
  return new Promise((resolve /*, reject*/) => {
    setTimeout(() => resolve(value), time);
  });
}


// const query = (it, ...args) => {
// const query = (it) => (...args) => {
// LAST
// const query = (it) => async (...args) => {
const query = (it) => singleton(function* (...args) {
  const exec_ORIG = () => {
    const results = []
    const gen = it(...args)
    let node = gen.next()

    while (!node.done) {
      // console.log('pushing node', node.value)
      results.push(node.value)
      node = gen.next(node.value) // not necessary to pass node.value as param, but perhaps convenient? could also be a problem depending on the use case (could replace return value unexpectedly, maybe even lead to memory leak?)
    }

    return results
  }

  function* exec_2(it) {
    const results = []
    const gen = it(...args)

    for (let node of gen) {
      // if (!node.done) {
        console.log('pushing node', node)
        results.push(node)
        // yield node.value
        // node = gen.next(node.value) // not necessary, but perhaps convenient? could also be a problem depending on the use case (could replace return value unexpectedly, maybe even lead to memory leak?)

        // yield gen.next()
      // }
    }

    return results
  }

  let results = []
  // const exec = singleton(function* (it) {
  const exec = function* (it, resolved) {
    results = []
    const gen = it(...args)
    // const results = []

    for (let node of gen) {
      results.push(node)
      console.log('=========== yielding node', it, node)
      yield node
      // makes no difference
      // if (resolved?.(node)) {
      //   return node
      // }
      // Works the same as `yield node`, weirdly
      // yield results
      // yield true
      // IDEA: Allow "release" param to be provided to QueryGeneratorResult, and then only yield when the current item is true!!!
      // @source: http://js-coroutines.com/docs/global.html#singleton
      // if(results.length % 100 === 0) yield
    }

    return results
  // }, [])
  }

  // const matches = (selector) => (value) => (value?.scope === selector || (value === 'object' && value.hasOwnProperty(selector)))
  // const matches = (selector) => (value) => {
  const matching = (selector) => (value) => {
    // console.log('matching?', selector, value)
    // console.log('wut', selector, value?.scope === selector, (value === 'object' && value.hasOwnProperty(selector)))
    // return (value?.scope === selector || (typeof value === 'object' && value.hasOwnProperty(selector)))
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

  // Immediately invoke generator (do we always want to do this?)
  //  - Probably not, because we want the pattern matching to occur DURING iteration, not after
  // const results = exec(it)
  // const results = await exec(it)
  // FIXME: Basically we only want to run the exec in "eager" operations, such as "find"  (those that can stop early)
  // const results = yield* exec(it)
  // let results = null
  const gen = exec(it)

  const context = {
    // select: wrapAsPromise(function* (selector: QuerySelector) {
    // TODO; Rename to find (this isn't really select as in modifying the reponse, it's whether the value matches is whether it gets selected
    // select: function* (selector) {
    // select: selector => run(function* () {
    // one: selector => run(function* () {
    // find: (selector = true) => run(function* () {
    find: singleton(function* (selector = true) {
      console.log('\n\nfind', selector)
      // if (!results) results = yield* exec(it)
      // if (!results) results = yield* exec(it, matching(selector))
      // yield* results
      // const results = exec(selector)
      // const results = exec(it)
      // const results = yield exec(it)
      // const results = yield* exec(it)
      // TODO: Make this more efficient (and generator-ee) but stopping on the first result instead of processing all of them up front
      // LAST
      // const match = yield* find(
      //   results,
      //   // yielding(matching(selector))
      //   yielding(matching(selector), 0)
      // )

      // const gen = it(...args)

      // LAST2
      let res = null
      let node = gen.next()

      console.log('@@@ gen state', gen, node)

      // while (!node?.done && !res) {
      while (!node?.done) {
        const value = unwrap(node.value)
        console.log('matching???', selector, node.value, matching(selector)(node.value))
        if (matching(selector)(node.value)) {
          // console.log('--- node', node, gen)
          // yield unwrap(node)
          // res = node = gen.next(value)
          // yield node
          return value
        } else {
          node = gen.next(value)
          yield node
        }
      }

      const match = yield* find(
        results,
        yielding(matching(selector), 0)
      )
      // console.log('--- match', selector, unwrap(match))

      return unwrap(match)

      // LAST
      // return node
      // return res

      // return null

      // return match?.[selector] ?? match?.data ?? match
      // return match?.data ?? match
      // return unwrap(match)
    }),
    all: (selector = true) => run(function* () {
      // const results = yield* gen
      // if (!results) results = yield* exec(it)
      // const results = exec(it)
      // yield results
      // const results = yield exec(it)
      // const results = yield* exec(it)
      // console.log('all results', results, selector)
      const matches = yield* filter(
        results,
        yielding(matching(selector))
      )

      return yield* map(
        matches,
        // Use this if we want to automatically unwrap values. Use the next solution if not.
        // yielding(match => match?.[selector] ?? match?.data ?? match)
        yielding(match => match?.data ?? match)
      )
    }),
    // Just remove this, same as find
    first: (selector = true) => run(function* () {
      const matches = yield* filter(
        results,
        yielding(matching(selector))
      )

      // TODO: Also apply map logic (or refactor .all so it can be called outside of surrounding run()"
      // return matches[0]
      return unwrap(matches[0])
    }),
    last: (selector = true) => run(function* () {
      // const results = yield* gen
      // if (!results) results = yield* exec(it)
      // yield results
      // const results = exec(it)
      // const results = yield exec(it)
      // const results = yield* exec(it)
      const matches = yield* filter(
        results,
        yielding(matching(selector))
      )
      // const matches = context.all(selector)
      // TODO: Also apply map logic (or refactor .all so it can be called outside of surrounding run()"
      // return matches[matches.length - 1]
      return unwrap(matches[matches.length - 1])
    })
  }

  // return context
  // return Object.assign((selector) => context.last(selector), context)
  // Not much of a point in being able to provide a selector here (or at least, it just becomes confusing for the reader/user)
  return Object.assign(() => context.last(), context)
// }
})

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
    // yield { hello: name, event: true }
    yield { name, event: 'hello' }
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

  // const meet = wrapAsPromise(function* (name) {
  //   // const id = yield* intros(name).select('id')
  //   // const { id } = yield* intros(name).select('meeting')
  //   // const { id } = yield* select(intros(name), 'meeting')
  //   // const { id } = yield* select(intros, 'meeting')(name)
  //   // const { id } = yield* query(intros, name).select('meeting')
  //   const met = yield* query(intros, name).select('meeting')

  //   console.log('MET ID!', met)

  //   return met
  //   // return { id, name }
  // })

  // const meeting = await meet('Elon Musk')

  // const meeting = await query(intros, 'Elon Musk').find('meeting')
  // const { meeting } = await query(intros, 'Elon Musk').find('meeting')
  // const events = await query(intros, 'Elon Musk').all('event')
  // const results = query(intros, 'Elon Musk')
  // const results = query(intros)('Elon Musk')
  //
  // const results = intros('Elon Musk')
  const stream = await intros('Elon Musk')
  // console.log('wuttt', await results.find('event'))
  const { event } = await stream.find('event')
  console.log('>>>>>> got event', event)
  const { meeting } = await stream.find('meeting')
  console.log('>>>>>> got meeting', meeting)
  const events = await stream.all('event')
  // const last = await results.last()
  const last = await stream()
  // const events = await results.all(['id', 'hello'])

  console.log('MEETING SUCCES!', meeting, events, last, event)
}

test()


