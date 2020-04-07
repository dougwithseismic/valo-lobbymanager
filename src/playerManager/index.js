import { lobbyListener, LobbyManager } from '../lobbyManager'
import { initFirebase } from '../firebaseAuth.js'
import chalk from 'chalk'

const db = initFirebase()

const defaultPlayer = {
  uid: null,
  discordId: null,
  discordName: null,
  riotId: null,
  activeLobbies: []
}

const exampleDiscordplayer = {
  avatar: null,
  bot: false,
  discriminator: '1053',
  id: '154615361537310722',
  lastMessageChannelID: '696466174376017960',
  lastMessageID: '696994590535974924',
  source: 'discord',
  username: 'Sentry'
}

export const PlayerManager = async () => {
  const PlayerCollection = db.collection('players')

  /* 
  
  When user !registers, create a player document for them including their discordId, discordName and riotId
  // !register... > player exists in db ? return player : createPlayer

  

  */

  const registerPlayer = async (player, riotId) => {
    // player object will come from a discord message so we'll have id etcetc.
    console.log('Registering Player', player.username)

    // search for player in db
    let foundPlayer = await PlayerCollection.where('id', '==', player.id)
      .get()
      .then((snapshot) => snapshot.docs.map((doc) => doc.data()))

    // If found, return that player. If not, create and return.
    return foundPlayer.length > 0 ? foundPlayer[0] : await createPlayer(exampleDiscordplayer, riotId)
  }

  // Creates a player
  const createPlayer = async (player, riotId = null) => {
    PlayerCollection.add({ ...player, ...defaultPlayer, createdAt: new Date(), riotId }).then((ref) => {
      ref.update({ uid: ref.id })
      console.log(chalk.blueBright('Added Player To Database: ', ref.id))
      return ref.id
    })
  }

  const getPlayer = async (uid) => {
    try {
      return db.collection('players').doc(uid).get().then((doc) => doc.data())
    } catch (error) {
      console.log('Couldnt find player :', error)
    }
  }

  //   registerPlayer(exampleDiscordplayer, 'SENTRY#0000').then((response) =>
  //     console.log('Register PLayer Reponse: ', response)
  //   )

  return { getPlayer }
}

PlayerManager()
