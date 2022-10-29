import { collector } from '../src/collector.mjs'
import { entity } from '../src/entity.mjs'
import { sleep } from '../src/util.mjs'
import coroutines from 'js-coroutines'
const { map, yielding } = coroutines

const DEALER = '💸' // 🏦
const BLACK_SUITS = ['♣️', '♠️',]
const RED_SUITS = ['♦️', '❤️']
const ALL_SUITS = [...BLACK_SUITS, ...RED_SUITS]
const ALL_CARDS = [2, 3, 4, 5, 6, 7, 8, 9, 10, ['J', 10], ['Q', 10], ['K', 10], ['A', 1]]

function* deck (multiples = 1) {
  while (multiples-- > 0) {
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

const shuffle = collector(function* (multiples = 1) {
  const cards = [...deck(multiples)]

  const mix = yield* map(cards, yielding(value => ({
    value,
    sort: Math.random() * cards.length
  })))

  const stack = mix.sort((a, b) => a.sort - b.sort)

  for (const card of stack) {
    yield card.value
  }

  return stack
})

const deal = (game, count = 1) => collector(function* (...players) {
  while (!game.state().done && (count === 1 || count-- > 0)) {
    for (const player of players) {
      const card = game.take('card', 1, true)

      card.then(c => console.log('[deal:card]\t', player, '\t\t', c[0].card.face))

      yield entity(card, ([{ card }]) => ({ player, card }))
    }
  }
})

const handOf = (player, init = []) => function (game) {
  // Deal one card at a time to only the player in scope via collector coroutines
  const dealer = deal(game, 1)(player)

  return {
    player,

    async cards () {
      // Lazily acquire all dealt cards for the scoped player (lazy = does NOT iterate generator)
      const hand = await dealer.all(card => card.player === player, true)

      return [...init, ...hand]
    },

    async draw () {
      return dealer.take('card', 1, true)
    }
  }
}

async function blackjack (guests = ['🤑', '🎃', '💀'], casino = false) {
  const players = [DEALER, ...guests]
  const { length: spread } = players

  // If we're playing at a casino, add a deck for each player to prevent card reading
  const game = shuffle(casino ? spread : 1)
  const dealer = deal(game, 2)(...players)

  // Start the game by dealing two cards to each player
  const cards = await dealer.take('card', spread * 2)

  // Create a `producer<dealer> -> consumer<hand>` coroutine mapping of each player
  const hands = players.reduce((all, player) => {
    const hand = cards.filter(card => card.player === player)

    all[player] = handOf(player, hand)(game)

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

  async function play () {
    // Continually apply game rules until somebody wins or the game naturally ends
    // TODO: Handle case where dealer is only remaining player
    // TODO: Handle ties
    while (true) for (const player of [...guests, DEALER]) {
      if (state[player].active) {
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
  }

  async function turn (player) {
    const dealing = player === DEALER
    const hand = hands[player]
    const cards = await hand.cards()
    const score = cards.reduce((total, { card: { weight } }) => total + weight, 0)
    const ceil = dealing ? 17 : 15

    // If not the dealer, wait for a random but brief amount of time to simulate thinking
    if (!dealing) await sleep(Math.max(600, Math.random() * 3600))

    // TODO: Handle aces (may need two different tallies)
    // Assume we want to hit if we're below the player's ideal max/ceil
    if (score < ceil) {
      const hit = await hand.draw()

      console.log('[turn:hit]\t', player, score, score + hit[0].card.weight, '\t', hit.map(h => h.card.face))

      return turn(player)
    }

    console.log('[turn:yield]\t', player, score, '\t\t', cards.map(h => h.card.face))

    return { score, cards, player }
  }

  const round = await play()

  console.log('\n[play:round]\t', round)
}

blackjack().then(() => process.exit(0))
