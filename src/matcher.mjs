/**
 * Given any selector, returns a function that accepts a value and returns true
 * when that value matches the selector according to `generator-collector`'s rules.
 *
 * @param {*} selector
 * @returns {Function<*, boolean>}
 */
export const matcher = (selector) => (value) => {
  if (typeof selector === 'string') {
    if (typeof value === 'object') {
      return value.hasOwnProperty(selector)
    }

    return value === selector
  }

  if (typeof selector === 'function') {
    return selector(value)
  }

  if (Array.isArray(selector)) {
    return selector.some(matcher)
  }

  return !!selector
}

export default matcher
