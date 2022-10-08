import { run, wrapAsPromise } from 'js-coroutines'
/**
 * - yields numbers
 * - returns strings
 * - can be passed in booleans
 */
// function* counter(): Generator<number, string, boolean> {
// @see: https://www.typescriptlang.org/docs/handbook/release-notes/typescript-3-6.html#stricter-generators

interface QueryGeneratorValue<T> extends QueryGeneratorResult<T, TReturn = any> {
  // kind: string;
  // context: string;
  scope: string;
  data: TReturn;
}

// type IteratorResult<T, TReturn = any> =
  // | IteratorYieldResult<T>
  // | IteratorReturnResult<TReturn>;
type QueryGeneratorResult<T, TReturn = any> =
  | QueryGeneratorYieldResult<T>
  | QueryGeneratorReturnResult<TReturn>;

// interface IteratorYieldResult<TYield> {
interface QueryGeneratorYieldResult<TYield> extends IteratorYieldResult<TYield> {
  done?: false;
  // value: TYield;
  value: QueryGeneratorValue<TYield> | TYield;
}

// interface IteratorReturnResult<TReturn> {
interface QueryGeneratorReturnResult<TReturn> extends IteratorReturnResult<TReturn> {
  done: true;
  // value: TReturn;
  value: QueryGeneratorValue<TReturn> | TReturn;
}

export type QuerySelector<T = any> = string | Symbol | (...any) => T

// export type QueryableGeneratorResult = IteratorResult
// export interface QueryableGenerator extends Generator<T = unknown, TReturn = any, TNext = unknown> {
export interface QueryGenerator<T = any> extends Generator<QueryGeneratorResult, QueryGeneratorResult, TNext = unknown> {
  // unwrap
  resolve: (QueryGeneratorResult<T>) => T
  // capture
  select: (QuerySelector<T>) => T
  // select: (QuerySelector<T>) => Promise<T>
  // first: (QuerySelector<T>) => T
  // last: (QuerySelector<T>) => T
  // all: (QuerySelector<Array<T>>) => Array<T>
}

type MaybeQueryResult<T = any> = QueryGeneratorValue<T> | T;

const isQueryResult = (value: MaybeQueryResult<any>): boolean => {
  if (typeof value === 'object') {
    return typeof value.scope === 'string' && value.hasProperty('data')
  }

  return false
}

const query = (it: Generator, ...args: []): QueryGenerator<T = any> => {
  const exec = () => {
    let node = it(args).next()
    const results = []
    while (!node.done) {
      results.push(node.value)
      // console.log(result.value); // 1 3 5 7 9
      node = it.next();

      // if (isQueryResult
    }
    return results
  }

  const matches = (selector: QuerySelector) => (value: MaybeQueryResult) => (value?.scope === selector || (selector === 'object' && value.hasProperty(selector)))

  return {
    // select: wrapAsPromise(function* (selector: QuerySelector) {
    // TODO; Rename to find (this isn't really select as in modifying the reponse, it's whether the value matches is whether it gets selected
    select: function* (selector: QuerySelector) {
      // const results = exec(selector)
      const results = yield exec(it)
      const matching = yield* find(
        results,
        // yielding(res => res.scope === selector || (selector === 'object' && res.hasProperty(selector)))
        yielding(matches(selector))
      )

      return yield* map(
        matching,
        yielding(res => res?.data ?? res)
      )
    },
    // all: wrapAsPromise(function* (selector: QuerySelector) {
    all: function* (selector: QuerySelector) {
      const results = yield exec(it)
      const matching = yield* filter(
        results,
        // yielding(res => res.scope === selector || (selector === 'object' && res.hasProperty(selector)))
        yielding(matches(selector))
      )

      return yield* map(
        matching,
        yielding(res => res?.data ?? res)
      )
    },
  } as QueryGenerator<T>
}

async function test () {
  // const hello = product('hello', function* (name) {
  // const hello = producer('hello', function* (name) {
  // const hello = gen('hello', function* (name) {
  // const hello = subgen('hello', function* (name) {
  // const hello = routine('hello', function* (name) {
    // yield `hello ${name}`
  // }
  // Same as above
  const hello = function* (name) {
    yield { hello: name }
  })

  // const goodbye = routine('goodbye', function* (name) {
  //   yield `goodbye ${name}`
  //   yield { id: Math.random() * 1000 }
  const goodbye = function* (name) {
    yield { bye: name }
    yield { meeting: { id: Math.random() * 1000 } }
  })

  // const intros = routine('intros', function* (name) {
  const intros = function* (name) {
    yield* hello(name)
    yield* goodbye(name)
  })

  const meet = wrapAsPromise(function* (name) {
    // const id = yield* intros(name).select('id')
    // const { id } = yield* intros(name).select('meeting')
    // const { id } = yield* select(intros(name), 'meeting')
    // const { id } = yield* select(intros, 'meeting')(name)
    const { id } = yield* query(intros, name).select('meeting')

    return { id, name }
  })

  const meeting = await meet('Elon Musk')

  console.log('MEETING SUCCES!', meeting)
}

test.then()

// export interface UseClonedOptions<T = any> extends WatchOptions {
//   /**
//    * Custom clone function.
//    *
//    * By default, it use `JSON.parse(JSON.stringify(value))` to clone.
//    */
//   clone?: (source: T) => T

//   /**
//    * Manually sync the ref
//    *
//    * @default false
//    */
//   manual?: boolean
// }

// export interface UseClonedReturn<T> {
//   /**
//    * Cloned ref
//    */
//   cloned: ComputedRef<T>
//   /**
//    * Sync cloned data with source manually
//    */
//   sync: () => void
// }
