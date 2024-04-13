import { collector } from '../../src/collector.mjs'
import { entity } from '../../src/entity.mjs'
import { nanoid } from '../util/id.mjs'
import reader from '../util/reader.mjs'

import { map, sort, yielding } from '../../src/lib/js-coroutines.mjs'

const DEALER = '🎰 💸'
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
      const [value = card, rank = card] = [].concat(card)

      const data = {
        suit,
        value,
        rank,
        face: `${value}${suit}`,
      }

      yield { card: data }
    }
  }
}

/**
 * Shuffles any number of decks and returns a collector that can be shared by players in a game.
 */
const shuffle = collector(function* (copies = 1) {
  const cards = [...deck(copies)]
  const { length } = cards

  const stack = yield* map(cards, yielding(value => ({
    value,
    sort: Math.random() * length
  })))

  const mix = yield* sort(stack, (a, b) => a.sort - b.sort)

  for (const card of mix) {
    yield card.value
  }

  return mix
})

/**
 * Creates a dealer collector that starts the by dealing out `count`
 * cards to each player from a `game` deck collector, round-robin style.
 *
 * Iterates forever (round-robin) once `count` is 1 since most card
 * games deal 1 card to a player at a time after their initial hand.
 */
const deal = (game, count = 1) => collector(function* (...players) {
  while (!game.deck.state().done && (count === 1 || count-- > 0)) {
    for (const player of players) {
      const card = game.deck.take(1, 'card')

      card.then(value => console.log(`[game:${game.id}] [deal:card]\t`, player, '\t\t', value[0].card.face))

      yield entity(card, ([{ card }]) => ({ player, card }))
    }
  }
})

/**
 * Creates a player's hand for a card game, consuming cards from a dealer (collector).
 *
 * Allows you to draw cards for a player and obtain every card dealt to them in a game.
 */
const handOf = (game, player, init = []) => {
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
      const [card] = await dealer.take(1, 'card')

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
async function blackjack ({
  id,
  guests = ['💎 🤑', '💎 🎃', '💎 💀'],
  auto = false,
  casino = false
} = {}) {
  if (!Array.isArray(guests) || !guests?.length) {
    throw TypeError('At least one guest player is required in blackjack')
  }

  const players = [DEALER, ...guests]
  const { length: spread } = players

  const game = {
    id: id ?? nanoid(),
    deck: shuffle((casino || spread > 6) ? spread : 1)
  }

  // Start the game by dealing two cards to each player
  const dealer = deal(game, 2)(...players)
  const cards = await dealer.take(spread * 2, 'card')

  // Create a `producer<dealer> -> consumer<player>` game state map for each player
  const state = players.reduce((all, player) => ({
    ...all,
    [player]: {
      active: true,
      result: null,
      hand: handOf(game, player,
        cards.filter(card => card.player === player)
      )
    }
  }), {})

  // Determines the leader of the current game at any given point in time
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
  async function play () {
    while (true) for (const player of [...guests, DEALER]) if (state[player].active) {
      console.log(`\n[game:${game.id}] [turn:start]\t`, player)

      const result = await entity(turn(player), pretty)

      state[player].result = result

      // Player got blackjack, so they win
      if (result.score === 21) {
        return { done: 'blackjack', ...result }
      }

      // Player busted and is out this round
      if (result.score > 21) {
        state[player].active = false
      }

      // Find winner if end of round (dealer's turn is done) and nobody won yet
      if (result.score >= 17 && player === DEALER) {
        return { done: 'score', ...leader() }
      }
    }
  }

  // Calculates the score for a player based on their current hand.
  // Returns everything needed to drive the game's turn rules for a player.
  async function summarize (player) {
    const { hand } = state[player]
    const cards = await hand.cards()

    // Calculate the highest possible score for a player's hand that doesn't bust 21
    const score = [...cards]
      .sort((a, b) => b.card.rank - a.card.rank)
      .reduce((total, { card: { rank } }) => {
        const score = total + rank
        // Aces can be ranked up (11) or down (1)
        if (rank === 1) {
          return score > 11 ? score : score + 10
        }
        return score
      }, 0)

    return { player, score, hand, cards }
  }

  // Processes the turn for a single player, recursively continuing the turn if possible.
  async function turn (player) {
    const { hand, cards, score } = await summarize(player)
    const dealing = player === DEALER
    const limit = dealing ? 17 : 15

    // Hit if we're below the player's ideal limit (auto: true), or ask user via CLI (auto: false)
    // TODO: Handle splits
    if (
      ((dealing || auto) && score < limit) ||
      ((!dealing && !auto) && score < 21 && (
        await ask(`\n[game:${game.id}] [turn:ask] Would you like to hit? [${player} ~~ ${score} ~~ ${cards.map(h => h.card.face).join('  ')} ] [y/n]: `)
      ))
    ) {
      const hit = await hand.draw()

      console.log(`[game:${game.id}] [turn:hit]\t\t`, player, score, score + hit.card.rank, '\t', hit.card.face)

      return turn(player)
    }

    console.log(`[game:${game.id}] [turn:yield]\t`, player, ' ', score, '\t', cards.map(h => h.card.face))

    return { score, cards, player }
  }

  const round = await play()

  console.log(`\n[game:${game.id}] [result]\t 🏆\t`, round, '\n')

  return round
}

const config = {
  auto: true,
  casino: false
}

// Multiple concurrent games? No problem!
Promise.all([
  // Human controlled games
  blackjack({ ...config, guests: ['💎 🤑', '💎 🎃', '💎 💀'], auto: false }),
  blackjack({ ...config, guests: ['🎩 🦧', '🎩 🦄', '🎩 🐷'], auto: false }),

  // Computer controlled games
  blackjack({ ...config, guests: ['🤖 !1', '🤖 !2', '🤖 !3'] }),
  blackjack({ ...config, guests: ['🤖 @1', '🤖 @2', '🤖 @3'] }),
  blackjack({ ...config, guests: ['🤖 $1', '🤖 $2', '🤖 $3'] }),
  blackjack({ ...config, guests: ['🤖 %1', '🤖 %2', '🤖 %3'] }),
]).then(() => {
  process.exit(0)
})
