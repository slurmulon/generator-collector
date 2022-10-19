export const RefGenerator = function* () {}
export const RefAsyncGenerator = async function* () {}

export function isGeneratorFunction (fn) {
  return (fn?.constructor === RefGenerator.constructor) || (typeof fn === 'function' && fn.constructor?.name === 'GeneratorFunction')
}

export function isAsyncGeneratorFunction (fn) {
  return (fn?.constructor === RefAsyncGenerator.constructor) || (typeof fn === 'function' && fn.constructor?.name === 'AsyncGeneratorFunction')
}

export function isIteratorFunction (fn) {
  return isGeneratorFunction(fn) || isAsyncGeneratorFunction(fn)
}

export function isIteratorLike (value) {
  return typeof value?.[Symbol.iterator] === 'function' &&
    typeof value?.['next'] === 'function' &&
    typeof value?.['throw'] === 'function'
}

export function isGeneratorIterator (value) {
  return value?.constructor === RefGenerator.prototype.constructor || isIteratorLike(value)
}

export function isAsyncGeneratorIterator (value) {
  return value?.constructor === RefAsyncGenerator.prototype.constructor || isIteratorLike(value)
}

export function isIterator (value) {
  return isGeneratorIterator(value) || isAsyncGeneratorIterator(value)
}

export function isPromise (value) {
  return (
    value !== null &&
    typeof value === 'object' &&
    typeof value.then === 'function' &&
    typeof value.catch === 'function'
  )
}

export async function future (value, ...args) {
  if (isPromise(value)) {
    return future(await value)
  }

  if (isIteratorFunction(value)) {
    return future(value(...args))
  }

  if (isIterator(value)) {
    let node = await value.next(...args)

    while (!node?.done) {
      node = await value.next(node.value)
    }

    return await node.value
  }

  if (typeof value === 'function') {
    return future(value(...args))
  }

  return value
}

export function unwrap (value, key = '') {
  return (
    value?.data
    ?? value?.value
    ?? value?.[key]
    ?? value
  )
}

export function sleep (time = 0, value) {
  return new Promise(resolve => {
    const result = value ?? { sleep: time }

    setTimeout(() => resolve(result), time)
  })
}
