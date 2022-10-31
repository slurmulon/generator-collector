import { sleep } from '../../src/util.mjs'
import readline from 'readline'

export default function reader (delay = 0) {
  const queue = []

  function question (query) {
    const reader = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    })

    return new Promise(resolve => reader.question(query, answer => {
      reader.close()
      resolve(`${answer}`.toLowerCase() !== 'n')
    }))
  }

  async function ask (query) {
    return new Promise(async resolve => {
      const ready = !queue.length

      const answer = () => new Promise(async done => {
        // Give some time for all other external console messages to print
        await sleep(delay)

        queueMicrotask(async () => {
          const result = await question(query)

          resolve(result)
          done(result)
        })
      })

      queue.unshift(answer)

      if (ready) {
        await input.next()
      }
    })
  }

  async function* inputs() {
    while (queue.length > 0) {
      const question = await queue.pop()
      const answer = await question()

      console.log('')

      yield answer
    }
  }

  const input = inputs()

  return { input, ask, queue }
}
