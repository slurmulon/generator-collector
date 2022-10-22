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

export async function sync (value, ...args) {
  if (isPromise(value)) {
    return sync(await value)
  }

  if (isIteratorFunction(value)) {
    return sync(value(...args))
  }

  if (isIterator(value)) {
    let node = await value.next(...args)

    while (!node?.done) {
      node = await value.next(node.value)
    }

    return await node.value
  }

  if (typeof value === 'function') {
    return sync(value(...args))
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

export function asyncToGenerator (fn) {
  return function* (...args) {
    let state = 'pending'
    let value = null

    const pull = function* () {
      yield 'fail'
      console.log('---- PULLING!!!!', value)
      yield value
    }

    const push = function* () {
      console.log('pushing....')
      fn(...args).then(r => {
        state = 'fulfilled'
        console.log('WTF', r)
        value = r
        
        setTimeout(() => {
          console.log('PULLING VALUE', value)
          puller.next(value)
        }, 2000)
        // gen.return(r)
        // gen.next(r)
        // gen.next()
      })
      .catch(error => {
        state = 'error'
        console.error(error)
        puller.throw(error)
        // gen.throw(error)
        // throw error
      })

      return yield* puller
    }
    const pusher = push()
    const puller = pull()

    const n = pusher.next()
    puller.next()

    console.log('returning pusher', pusher, n)
    return pusher
  }
}

export function asyncToGenerator_2 (fn) {
  // let value = null

  // const it = function* () { yield true; yield value }
  // const it = function* () { const v = yield; console.log('YIELDING', v); return v;}
  // const it = function* () { yield value }
  // const it = function* () { while (true) yield }

  return function* (...args) {
    // const gen = it()

    let value = null
    // const it = function* () { while (state) yield value; }
    const it = function* () { yield; }
    const gen = it()
    console.log('fn???', fn, args)
    let state = 'pending'
    fn(...args).then(r => {
      state = 'fulfilled'
      console.log('WTF', r)
      value = r
      gen.return(r)
      // gen.next(r)
      // gen.next()
    })
    .catch(error => {
      state = 'error'
      console.error(error)
      gen.throw(error)
      // throw error
    })
    // fn(...args)
    //   .then(res => { gen.return(res) })
    //   .catch(error => { console.log('BOOM'); console.error(error); gen.throw(error) })

    // while (state === 'pending') { yield value; }

    // return gen.next()
    // return value
    // return yield* it()
    return yield* gen
  }
}

// @see: https://github.com/zertosh/async-to-generator/blob/master/async-to-generator.js
// export function asyncToGenerator (fn) {
//   return function(...args) {
//     const gen = fn.apply(this, ...args);
//     return new Promise(function(resolve, reject) {
//       function step(key, arg) {
//         let info, value
//         try {
//           info = gen[key](arg);
//           value = info.value;
//         } catch (error) {
//           reject(error);
//           return;
//         }
//         if (info.done) {
//           resolve(value);
//         } else {
//           Promise.resolve(value).then(_next, _throw);
//         }
//       }
//       function _next(value) {
//         step('next', value);
//       }
//       function _throw(err) {
//         step('throw', err);
//       }
//       step('next');
//     });
//   };
// };


