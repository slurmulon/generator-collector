export const RefGenerator = function* () {}
export const RefAsyncGenerator = async function* () {}

export function sleep (time = 0, value) {
  return new Promise(resolve => {
    const result = value ?? { sleep: { time, value } }

    setTimeout(() => resolve(result), time)
  })
}

export function isGeneratorFunction (fn) {
  return (fn?.constructor === RefGenerator.constructor) || (typeof fn === 'function' && fn.constructor?.name === 'GeneratorFunction')
}

export function isAsyncGeneratorFunction (fn) {
  return (fn?.constructor === RefAsyncGenerator.constructor) || typeof fn === 'function' && fn.constructor?.name === 'AsyncGeneratorFunction'
}

export function isIteratorFunction (fn) {
  return isGeneratorFunction(fn) || isAsyncGeneratorFunction(fn)
}

export function isGeneratorIterator (value) {
  return value?.constructor === RefGenerator.prototype.constructor ||
    (typeof value?.[Symbol.iterator] === 'function' &&
     typeof value?.['next'] === 'function' &&
     typeof value?.['throw'] === 'function')
}

export function isPromise (value) {
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
