import { initFirebase } from '../firebaseAuth.js'
import { defaultLobby, createPlayer, shuffleTeams, defaultLobbyGroup } from '../helpers/lobbyHelpers'
import { EventEmitter } from 'events'
import chalk from 'chalk'

const db = initFirebase()

export const lobbyListener = new EventEmitter()

// MAIN HOOK

export const LobbyManager = () => {
  let lobbyMode = 'auto'
  const modeTypes = [ 'auto', 'moderated' ]

  const init = async () => {
    console.log(chalk.bgBlack('##### Running Initial LobbyManager Setup #####'))

    // Subscribes to lobbyGroups collection, and creates a default one if it doesnt exist.
    db.collection('lobbyGroups').onSnapshot((snapshot) => {
      let lobbyGroupContainer = []
      if (snapshot.size) {
        lobbyGroupContainer = snapshot.docs.map((doc) => doc.data())
        snapshot.docChanges().forEach((change) => {
          lobbyListener.emit('lobbyGroupChange', {
            change: change.type,
            data: { ...change.doc.data(), uid: change.doc.id }
          })
        })
      } else {
        console.log(chalk.cyanBright('No Lobby Groups Found..'))
      }
      return lobbyGroupContainer
    })

    // Grab a snapshot of our current lobbies
    db.collection('lobbies').orderBy('createdAt', 'desc').onSnapshot((snapshot) => {
      // Listen for changes.
      snapshot.docChanges().forEach((change) => {
        lobbyListener.emit('lobbyChange', { change: change.type, data: { ...change.doc.data(), uid: change.doc.id } })
      })

      if (snapshot.size) {
        // let lobbyList = snapshot.docs.map((doc) => doc.data())
        // If there are no active lobbies, create one. HOW CAN WE SET UP DIFFERENT 'MODES'? THIS SHOULDNT LIVE HERE..
      } else {
        // No lobbies :( create one!
      }
    })

    lobbyListener.on('setLobbyMode', async (mode, msg) => {
      if (modeTypes.find((type) => type === mode)) {
        console.log(chalk.blueBright('Setting LobbyManager to', mode))
        // When a lobby mode is switched, we should load its own config (and remove all the listeners associated with other modes)
        switch (mode) {
          case 'auto':
            lobbyMode = mode
            // if we dont have an active lobby, lets create a new one.
            const activeLob = await getActiveLobby(msg.channel.id)
            !activeLob && lobbyListener.emit('createLobby', msg)
            break
          case 'moderated':
            lobbyMode = mode

          default:
            break
        }
      } else {
        console.log('Couldnt Set LobbyManager')
      }
    })

    lobbyListener.on('setupLobbyGroup', async (message) => {
      db
        .collection('lobbyGroups')
        .add({
          createdAt: new Date(),
          ruleset: { lobbySize: 10, type: 'moderated', mode: 'blind' },
          discord: { guildId: message.guild.id, channelId: message.channel.id }
        })
        .then((ref) => db.collection('lobbyGroups').doc(ref.id).update({ uid: ref.id }))
    })

    lobbyListener.on('lobbyChange', ({ change, data }) => {
      // console.log('lobbyChange :', change, data)
      // Do something every time a lobby updates.
      // For example, when the Lobby is ready with 10 players, START GAME!
      if (data.status === 0 && data.players.length === 10) {
        lobbyListener.emit('lobbyFull', { ...data, uid: data.uid })
      }

      // If a lobby is removed, let's remove the discord channels and permissions, too.

      switch (change) {
        case 'removed':
          lobbyListener.emit('cleanRemovedLobby', data)
          break

        case 'added':
          break

        default:
          break
      }

      // When a lobby is added, lets delete old, unused lobbies by looking at the createdAt timestamp.
    })

    lobbyListener.on('lobbyFull', async (lobby) => {
      const team1 = shuffleTeams(lobby.players)
      const team2 = team1.splice(0, team1.length / 2)

      console.log(chalk.blueBright('Lobby Full: Updating Status & Shuffling Teams'))

      await db
        .collection('lobbies')
        .doc(lobby.uid)
        .update({ team1, team2, status: 1 })
        .then(async () => {
          console.log(chalk.greenBright('...STARTING LOBBY'))
          return await db.collection('lobbies').doc(lobby.uid).get()
        })
        .then((response) => lobbyListener.emit('lobbyStart', response.data()))
    })

    lobbyListener.on('createLobby', async (msg) => {
      const lobbyGroupSearch = await db
        .collection('lobbyGroups')
        .where('discord.channelId', '==', msg.channel.id)
        .get()
        .then((ref) => ref.docs.map((doc) => doc.id))

      const foundLobbyGroupId = lobbyGroupSearch.length > 0 ? lobbyGroupSearch[0] : null

      // If we don't find a lobbyGroup, let's create one and use that.
      let options = foundLobbyGroupId ? { lobbyGroupId: foundLobbyGroupId } : {}
      console.log('foundLobbyGroupId :', foundLobbyGroupId)

      if (!foundLobbyGroupId) {
        console.log('didnt find - lts look')
        await db
          .collection('lobbyGroups')
          .add({
            createdAt: new Date(),
            ruleset: { lobbySize: 10, type: 'moderated', mode: 'blind' },
            discord: { guildId: msg.guild.id, channelId: msg.channel.id }
          })
          .then((ref) => {
            options.lobbyGroupId = ref.id
          })
      }

      console.log('options :', options)

      createLobby(options).then(() =>
        lobbyListener.emit(
          'sendMessage',
          msg,
          `<#${msg.channel
            .id}> Pickup Lobby Live! Type !join to get started, and !leave to leave the queue. If no players gathered in 10 minutes lobby will self delete.`
        )
      )
    })

    lobbyListener.on('removePlayerFromLobby', async (user, lobby) => {
      console.log('user :', user)
      console.log('lobby :', lobby)
      if (await findPlayerInLobby(lobby.uid, user)) {
        const updatedPlayerList = lobby.players.filter((player) => player.id !== user.id)
        db.collection('lobbies').doc(lobby.uid).update({ players: updatedPlayerList }).then(() => {
          console.log('Player removed from lobby: ', user.username, lobby.uid)
          return user
        })
      }
    })
  }

  // Creates a lobby then returns the new lobby uid
  const createLobby = async (options = options || {}) => {
    console.log(chalk.blueBright('CREATING NEW LOBBY..'))
    
    await db
      .collection('lobbies')
      .add(defaultLobby)
      .then(async (ref) => {
        await db.collection('lobbies').doc(ref.id).update({ createdAt: new Date(), uid: ref.id, name: 'VALOVALORANT PICKUP', ...options }) // Updates don't return an object.
        return ref
      })
      .then((ref) => {
        lobbyListener.emit('lobbyCreate', ref)
        lobbyListener.emit('removeOldLobbies', ref)
      })
      .catch((e) => console.log(e))
  }

  const createLobbyGroup = async () => {
    console.log(chalk.blueBright('CREATING NEW LOBBY GROUP..'))
    await db
      .collection('lobbyGroups')
      .add(defaultLobbyGroup)
      .then(async (ref) => {
        await db.collection('lobbyGroups').doc(ref.id).update({ createdAt: new Date(), uid: ref.id }) // Updates don't return an object.
        return ref
      })
      .then((ref) => {
        lobbyListener.emit('lobbyGroupCreated', ref)
      })
      .catch((e) => console.log(e))
  }

  // Grabs details on a lobby, taking a lobby uid as argument
  const getLobbyData = async (uid) => {
    return await db.collection('lobbies').doc(uid).get().then((doc) => {
      return doc.data()
    })
  }

  /**
 * @function addPlayerToLobby(uid, player)
 * @param {string} uid - The uid of the lobby the player should be added to.
 * @param {player} player - The player object createPlayer(player, source)
 */
  const addPlayerToLobby = async (uid, user) => {
    let response = null
    // If the lobby is still accepting players, lets add more players.
    const lobby = await getLobbyData(uid)

    if (lobby !== undefined && lobby.status === 0) {
      // First lets check whether the player already exists.
      const foundPlayer = await findPlayerInLobby(uid, user)
      if (!foundPlayer) {
        let obj = await getLobbyData(uid)
        const player = createPlayer(user)
        const updatedPlayers = [ ...obj.players, player ]

        await db.collection('lobbies').doc(uid).update({ players: updatedPlayers }).then((result) => {
          //   lobbyCheck(uid) // When we get 10 players in, we're full!
          response = { success: 'player Added', err: null }
        })
      } else {
        console.log('Player already in Lobby')
        response = { success: null, err: 'Player already in Lobby' }
      }
    } else {
      console.error('Lobby not accepting new players')
    }
    return response
  }

  // findPlayerInLobby returns whether a player is in a given lobby
  const findPlayerInLobby = async (uid, user) => {
    const obj = await getLobbyData(uid)
    console.log('user :', user)
    const foundPlayer = obj.players.find((player) => {
      console.log('player.id vs user.id :', player.id, user.id)
      return player.id === user.id
    })
    console.log('foundPlayer :', foundPlayer)

    return foundPlayer !== undefined ? foundPlayer : null
  }

  // Finds a player entity within the players collection
  const findPlayer = async (user) => {
    console.log('user :', user)
    const foundPlayer = await db
      .collection('players')
      .where('id', '==', user.id)
      .get()
      .then((snapshot) => snapshot.docs.map((doc) => doc.data()))

    return foundPlayer.length > 0 ? foundPlayer[0] : null
  }

  // Returns the newest
  const getActiveLobby = async (channelId) => {
    try {
      const foundLobbyGroup = await db
        .collection('lobbyGroups')
        .where('discord.channelId', '==', channelId)
        .get()
        .then((ref) => ref.docs.map((doc) => doc.id))

      if (foundLobbyGroup.length > 0) {
        const snapshot = await db
          .collection('lobbies')
          .where('status', '==', 0)
          .where('lobbyGroupId', '==', foundLobbyGroup[0])
          .get()

        return snapshot.docs.map((doc) => {
          return doc.data()
        })[0]
      }
    } catch (e) {
      console.log(e)
      throw e // let caller know the promise was rejected with this reason
    }
  }

  return { init, lobbyMode, getActiveLobby, addPlayerToLobby, findPlayerInLobby, findPlayer, getLobbyData }
}

// addPlayerToLobby('WIeztTgnggQHwS1tFEJu', {
//   avatar: null,
//   bot: false,
//   discriminator: '1053',
//   id: '154615361537310722',
//   lastMessageChannelID: '695015685155192872',
//   lastMessageID: '695256234374463520',
//   source: 'discord',
//   username: 'Sentry'
// })

export default LobbyManager
