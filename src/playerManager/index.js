import { lobbyListener } from '../lobbyManager'
import { initFirebase } from '../firebaseAuth.js'
import chalk from 'chalk'

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

export const PlayerManager = () => {
  const db = initFirebase()
  const PlayerCollection = db.collection('players')

  const registerPlayer = async (player, riotId) => {
    console.log('Registering Player', player.username)

    // do logic for checking riotId
    if (!riotId.includes('#')) {
      console.log('RiotId missing #')
      lobbyListener.emit(
        'sendUserDM',
        player,
        ` **ERROR** - ${player.username}, Your RiotID should be in the format NAME#TAG - Make sure to include the whole ID. Please try again! `
      )
    }

    // Check for whether the player exists in db alreadyu
    let foundPlayer = await PlayerCollection.where('id', '==', player.id)
      .get()
      .then((snapshot) => snapshot.docs.map((doc) => doc.data()))

    // If found, return that player. If not, create.
    const registeredPlayer = foundPlayer.length > 0 ? foundPlayer[0] : await createPlayer(player, riotId)

    // If a user !registers multiple times, lets just override their riotId for now.
    // Seems kinda redundant.

    PlayerCollection.doc(foundPlayer[0].uid).update({ riotId }).then(() => {
      // DM THEM with a success.

      lobbyListener.emit(
        'sendUserDM',
        player,
        ` *UPDATE* - Thanks, ${player.username}, Your RiotID has been updated to **${riotId}**`
      )
      lobbyListener.emit('giveUserRole', player, '697048258437971968')
    })
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

  return { getPlayer, registerPlayer }
}
