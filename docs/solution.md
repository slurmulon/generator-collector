# Solution
---

This solution is influenced by Elixir's amazing `with` statement, which has noticeably improved the structure and flexibility of my own code.

It also aims to leverage and expand on the innovative `js-coroutines` package, which anyone interested in next-level browser performance should certainly check out.

## Design

`generator-collector` allows you to declare _what_ you need from a complex generator without needing to concern _when or how_ it gets generated.

You can think of it as a declarative API for watching (and collecting) the yielded results of your generator.

This declarative approach gives you more flexibility and control over how you consume generators, especially those producing multiple types of data.

This is achieved by abstracting away the iterative/procedural details of the generator behind a data-driven facade (but still makes them accessible for native generator compatibility).

It also simplifies generator integration with async functions thanks to `js-coroutines` - you can yield promises in non-async generator functions, and every `collector` query method is a coroutine-backed promise!

Use it only where you need it, use it without complicating your code, and leave the rest of your code happily unaffected.

## Performance

Outside of the natural benefits of generators/coroutines, the iteration process is primarily optimized based on the query methods (`.all()`, `.find()`) you call in your collection consumer (and in which order).

More specifically, it can optimize the generator iteration process depending on what your consumer needs and when it needs it. The rules are simple and straightforward:

 - It will never iterate farther than needed to find the first matching result (via `collection.find(selector)`).
 - It will automatically iterate through the _entire_ generator if you're querying on the entire collection (via `collection.all(selector)` or `collection.last(selector)`).

Out in the wild, additional factors influence how eager, lazy and thorough the iteration process is:
  - The order in which you call `find` and `all`/`last` queries in your collection consumer
  - The nature of your consumer's queries (i.e. what data/values you're querying for, and how much)
  - The nature of your generator's results (i.e. what types of data it returns, how many values it returns)
  - The order which your generator yields its results

For the best potential performance gains, hoist your `find` queries before any `all` or `last` queries wherever it's possible.

In general, the less iterations your generator has to go through to produce the results of your consumer's queries, the greater the performance.

## Precision

Because iteration is backed by `js-coroutines`, minimum duration gaps (typically less than a frame) are added between yields to allow other activity on the thread to make progress.

This allows you to work with a large amount of data and helps ensure complex tasks do not cause frame drops. The performance is high, but it naturally results in reduced timing consistency/precision (roughly ~12.5ms to ~32ms).

If you require high-precision animations that syncronize perfectly with timelines, media, etc., then this performance feature may work against your needs.

The performance advantages of `js-coroutines` outweigh the downsides, so this is intentional and will not change (however, in the future I may provide an alternative generator query API).

If you notice arbitrary variations between the steps of your timelines, the duration gaps are almost certainly the cause and you may need to resort to other solutions such as `gsap`.
