// Import remap shim for outdated module semantics in js-coroutines package (missing "modules: false")
import * as co from 'js-coroutines'

const pkg = co.default || co

export const find = pkg.find
export const filter = pkg.filter
export const map = pkg.map
export const sort = pkg.sort
export const groupBy = pkg.groupBy
export const yielding = pkg.yielding

export default pkg
