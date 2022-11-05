import { entity } from './entity.mjs'

/**
 * Maps resolver to each item in the array, unlike `entity` which resolves the array as a whole.
 *
 * @param {Array} items
 * @param {*} resolver
 * @returns Promise<Array>
 */
export async function list (items = [], resolver) {
  const values = await entity(items)

  return Promise.all(
    values.map(value => entity(value, resolver))
  )
}

export default list
