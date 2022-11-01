import { isIteratorFunction} from './util.mjs'

export function promiser (generator) {
  if (!isIteratorFunction(generator)) {
    throw TypeError(`promisify must wrap a generator function: ${generator?.constructor?.name}`)
  }

  return function (...args) {
    const iter = generator.apply(this, args)

    return Promise.resolve().then(async function resolved (data) {
      const { done, value } = await iter.next(data)

      if (done) return value

      return Promise
        .resolve(value)
        .then(resolved, iter.throw.bind(iter)) // repeat
    })
  }
}

export default promiser
