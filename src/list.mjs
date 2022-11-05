import { entity } from './entity.mjs'

export async function list (items = [], resolver) {
  const values = await entity(items)

  return Promise.all(
    values.map(value => entity(value, resolver))
  )
}


