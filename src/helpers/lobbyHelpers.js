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
  created_at: new Date(),
  creator: null
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

const generateEmbedMessage = (team1, team2) => {
  console.log('Generating Embed Message')

  const getTeamTags = (team) => {
    return team.map((player) => {
      return `<@!${player.id}>`
    })
  }

  const getSubteamTags = (team) => {
    if (team.length === 1) {
      return `<@!${team[0].id}>`
    }

    const teamMinusCaptain = team.filter((player, i) => i !== 0)
    return teamMinusCaptain.length > 1 ? getTeamTags(teamMinusCaptain).join(', ') : getTeamTags(teamMinusCaptain)
    return
  }

  // If there are only two players (one team in each)

  const message1 = {
    title: 'Team ATTACKERS',
    description: `Send your team Captain, ${getTeamTags(
      team1
    )[0]} a friend request on VALORANT and join the match. ${getTeamTags(
      team1
    )[0]}, as your teams captain, add the opposing team's captain on VALORANT and arrange a custom lobby.`,
    color: 16711680,
    fields: [
      {
        name: 'Captain',
        value: `${getTeamTags(team1)[0]}`
      },
      {
        name: 'Team',
        value: `${getSubteamTags(team1)}`
      }
    ]
  }

  const message2 = {
    title: 'Team DEFENDERS',
    description: `Send your team Captain, ${getTeamTags(team2)[0]} a friend request and join the match. ${getTeamTags(
      team2
    )[0]}, as your teams captain, add the opposing team's captain on VALORANT and arrange a custom lobby.`,
    color: 31487,
    fields: [
      {
        name: 'Captain',
        value: `${getTeamTags(team2)[0]}`
      },
      {
        name: 'Team',
        value: `${getSubteamTags(team2)}`
      }
    ]
  }

  const message3 = {
    description: '**!!!** IF YOUR DISCORD NAME IS DIFFERENT TO YOUR RIOT ID, TYPE YOUR RIOT ID IN LOBBY NOW *!!!*'
  }

  return [ message1, message2, message3 ]
}

export { examplePlayer, defaultLobby, createPlayer, shuffleTeams, generateEmbedMessage }
