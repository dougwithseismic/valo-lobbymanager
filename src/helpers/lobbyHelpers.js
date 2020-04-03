const examplePlayer = {
  avatar: null,
  bot: false,
  discriminator: '1053',
  id: '11112222233333344444',
  lastMessageChannelID: '695015685155192872',
  lastMessageID: '695256234374463520',
  source: 'discord',
  username: 'Sentry'
}
const defaultLobby = {
  players: [],
  team1: [],
  team2: [],
  status: 0,
  created_at: new Date()
}

const createPlayer = (player) => {
  return {
    ...player
  }
}

const shuffleTeams = (array) => {
  let m = array.length,
    t,
    i
  // While there remain elements to shuffle…
  while (m) {
    // Pick a remaining element…
    i = Math.floor(Math.random() * m--)

    // And swap it with the current element.
    t = array[m]
    array[m] = array[i]
    array[i] = t
  }
  return array
}

export { examplePlayer, defaultLobby, createPlayer, shuffleTeams }
