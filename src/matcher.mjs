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
