import { collector } from '../../src/collector.mjs'
import { entity } from '../../src/entity.mjs'
import reader from '../util/reader.mjs'

import coroutines from 'js-coroutines'
const { map, sort, yielding } = coroutines

const DEALER = '💸'
const BLACK_SUITS = ['♣️', '♠️',]
const RED_SUITS = ['♦️', '❤️']
const ALL_SUITS = [...BLACK_SUITS, ...RED_SUITS]
const ALL_CARDS = [2, 3, 4, 5, 6, 7, 8, 9, 10, ['J', 10], ['Q', 10], ['K', 10], ['A', 1]]

// Asks users for decisions when playing in manual games
const { ask } = reader()

/**
 * Generates one or more copies of an entire deck of cards, in order.
 */
function* deck (copies = 1) {
  while (copies-- > 0) {
    for (const suit of ALL_SUITS)
    for (const card of ALL_CARDS) {
      const [value = card, weight = card] = [].concat(card)

      const data = {
        suit,
        value,
        weight,
        face: `${value}${suit}`,
      }

      yield { card: data }
    }
  }
}

/**
 * Shuffles the deck and returns a collector that can be shared among the players of a card game.
 */
const shuffle = collector(function* (copies = 1) {
  const cards = [...deck(copies)]

  const stack = yield* map(cards, yielding(value => ({
    value,
    sort: Math.random() * cards.length
  })))

  const mix = yield* sort(stack, (a, b) => a.sort - b.sort)

  for (const card of mix) {
    yield card.value
  }

  return mix
})

/**
 * Creates a dealer collector that starts the `game` (source deck) by dealing
 * out `count` cards to each player, round-robin style.
 * Iterates forever once `count` is 1 since most card games deal 1 card to
 * a player at a time after their initial hand.
 */
const deal = (game, count = 1) => collector(function* (...players) {
  while (!game.state().done && (count === 1 || count-- > 0)) {
    for (const player of players) {
      const card = game.take('card', 1, true)

      card.then(c => console.log('[deal:card]\t', player, '\t\t', c[0].card.face))

      yield entity(card, ([{ card }]) => ({ player, card }))
    }
  }
})

/**
 * Creates a collectable player's hand for a card game.
 * Allows you to draw cards for a player and easily obtain every
 * card dealt to a player in a game.
 */
const handOf = (game, player, init = []) => {
  // Deal one card at a time to only the player in scope via collector coroutines
  const dealer = deal(game, 1)(player)

  return {
    player,
    init,

    // Lazily acquire all dealt cards for the scoped player (lazy = does NOT iterate generator)
    async cards () {
      const hand = await dealer.all(card => card.player === player, true)

      return [...init, ...hand]
    },

    // Draw one card from the dealer to the scoped player, forcing deck/generator iteration (greedy)
    async draw () {
      const [card] = await dealer.take('card', 1, true)

      return card
    }
  }
}

/**
 * The main show. Creates and orchestrate a single game of blackjack among a dealer and `guests`.
 * Lazily iterates through the game and supports multiple running instances of blackjack games.
 * Utilizes a mixture of promises and coroutines to achieve a thread-friendly and cooperative state machine.
 *
 * When `auto` is true, only computers will play the game.
 * When `auto` is false (default), humans make decisions for every player besides the dealer.
 * When `casino` is true, a deck is added for each player in the game (simulating "security").
 */
async function blackjack (guests = ['💎 🤑', '💎 🎃', '💎 💀'], auto = false, casino = false) {
  const players = [DEALER, ...guests]
  const { length: spread } = players

  // If we're playing at a casino, add a deck for each player to prevent card counting :)
  const game = shuffle(casino ? spread : 1)
  const dealer = deal(game, 2)(...players)

  // Start the game by dealing two cards to each player
  const cards = await dealer.take('card', spread * 2)

  // Create a `producer<dealer> -> consumer<hand>` coroutine mapping of each player
  const hands = players.reduce((all, player) => {
    const hand = cards.filter(card => card.player === player)

    all[player] = handOf(game, player, hand)

    return all
  }, {})

  // Tracks each players' latest turn and whether or not they are still an active player
  // TODO: Probably conflate with `hands`, no good reason to re-reduce
  const state = players.reduce((acc, player) => ({
    ...acc,
    [player]: { result: null, active: true }
  }), {})

  // Determines the leader of the current session at any given point in time
  const leader = () => Object.entries(state)
    .map(([player, { result }]) => result)
    .filter(({ score }) => score <= 21)
    .sort((a, b) => b?.score - a?.score)[0]

  // Make a turn's result (primarily the cards) pretty for console printing
  const pretty = (result) => ({
    ...result,
    cards: result
      .cards
      .map(({ card }) => card?.face)
  })

  // Continually apply game rules until somebody wins or the game naturally ends
  // TODO: Handle case where dealer is only remaining player
  // TODO: Handle ties
  async function play () {
    while (true) for (const player of [...guests, DEALER]) if (state[player].active) {
      console.log('\n[turn:start]\t', player)

      const result = await entity(turn(player), pretty)

      state[player].result = result

      // Somebody got blackjack, so they win
      if (result.score === 21) {
        return { done: 'blackjack', ...result }
      }

      // Player busted and is out this round
      if (result.score > 21) {
        state[player].active = false
      }

      // Find winner if end of round (dealer's turn is done) and nobody won already
      if (result.score >= 17 && player === DEALER) {
        return { done: 'score', ...leader() }
      }
    }
  }

  // Processes the turn for a single player, recursively continuing the turn if possible.
  async function turn (player) {
    const dealing = player === DEALER
    const hand = hands[player]
    const cards = await hand.cards()
    const score = cards.reduce((total, { card: { weight } }) => total + weight, 0)
    const limit = dealing ? 17 : 15

    // Hit if we're below the player's ideal limit, or ask user if non-auto gameplay
    // TODO: Handle aces properly (may need two different tallies)
    if (
      ((dealing || auto) && score < limit) ||
      ((!dealing && !auto) && score < 21 && (
        await ask(`\n[turn:ask] Would you like to hit? [${player} ~~ ${score} ~~ ${cards.map(h => h.card.face).join('  ')} ] [y/n]: `)
      ))
    ) {
      const hit = await hand.draw()

      console.log('[turn:hit]\t', player, score, score + hit.card.weight, '\t', hit.card.face)

      return turn(player)
    }

    console.log('[turn:yield]\t', player, ' ', score, '\t', cards.map(h => h.card.face))

    return { score, cards, player }
  }

  const round = await play()

  console.log('\n[play:round]\t 🏆\t', round, '\n')

  return round
}

// Multiple concurrent games? No problem!
Promise.all([
  blackjack(),
  blackjack(['🎩 P1', '🎩 P2', '🎩 P3'])
]).then(() => {
  process.exit(0)
})
