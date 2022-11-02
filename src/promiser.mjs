import { isIteratorFunction } from './util.mjs'

export function promiser (generator) {
  if (!isIteratorFunction(generator)) {
    throw TypeError(`promiser must wrap a generator function: ${generator?.constructor?.name}`)
  }

  return function (...args) {
    const iterator = generator(...args)

    return Promise.resolve().then(async function resolved (data) {
      const { done, value } = await iterator.next(data)

      if (done) return value

      return Promise
        .resolve(value)
        .then(resolved, iterator.throw.bind(iterator))
    })
  }
}

export default promiser
