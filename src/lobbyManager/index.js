import { initFirebase } from '../firebaseAuth.js'
import { defaultLobby, createPlayer, shuffleTeams } from '../helpers/lobbyHelpers'
import { EventEmitter } from 'events'
import chalk from 'chalk'
import { create } from 'domain'

const db = initFirebase()

export const lobbyListener = new EventEmitter()

// MAIN HOOK
// MAIN HOOK
// MAIN HOOK
// MAIN HOOK
// MAIN HOOK

export const LobbyManager = () => {
  // NOTE: Emmiters can live here, but not listeners? Loading LobbyManager in multiple places creates multiple listeners (that repeat their actions)

  /* 

  When lobby manager initialises, we should..

    - Get the last X lobbies (we dont need all of them)
    - If there's an open lobby waiting for players, (status 0) set that as the active lobby
    - If there are no lobbies, or there are only closed lobbies (status > 0) , create a new one and set as active lobby, as above.

  */

  let lobbyMode = 'MODERATED'
  const modeTypes = [ 'AUTO_LOBBY', 'MODERATED' ]

  const init = async () => {
    lobbyListener.on('setLobbyMode', async (mode) => {
      if (modeTypes.find((type) => type === mode)) {
        console.log(chalk.blueBright('Setting LobbyManager to', mode))
        // When a lobby mode is switched, we should load its own config (and remove all the listeners associated with other modes)
        switch (mode) {
          case 'AUTO_LOBBY':
            lobbyMode = mode
            // if we dont have an active lobby, lets create a new one.
            ;(await getActiveLobby()) === null && createLobby()
            break
          case 'MODERATED':
            lobbyMode = mode

          default:
            break
        }
      } else {
        console.log('Couldnt Set LobbyManager')
      }
    })

    console.log('INITIALISING')
    // Grab a snapshot of our current lobbies
    db.collection('lobbies').orderBy('created_at', 'desc').onSnapshot((snapshot) => {
      if (snapshot.size) {
        // let lobbyList = snapshot.docs.map((doc) => doc.data())

        // If there are no active lobbies, create one. HOW CAN WE SET UP DIFFERENT 'MODES'? THIS SHOULDNT LIVE HERE..
        if (lobbyMode === 'AUTO_LOBBY') {
          snapshot.docs.map((doc) => doc.data()).filter((lobby) => lobby.status === 0).length === 0 && createLobby()
        }

        // Listen for changes.
        snapshot.docChanges().forEach((change) => {
          lobbyListener.emit('lobbyChange', { change: change.type, data: { ...change.doc.data(), uid: change.doc.id } })
        })
      } else {
        // No lobbies :(
        if (lobbyMode === 'AUTO_LOBBY') {
          createLobby()
        }
      }
    })

    // listeners need to live in here and we should only init ONCE.
    // TODO: make sure shit only gets init one time

    // Listens for changes on lobbyChange
    lobbyListener.on('lobbyChange', ({ change, data }) => {
      // console.log('lobbyChange :', change, data)

      // Do something every time a lobby updates.
      // For example, when the Lobby is ready with 10 players, START GAME!
      if (data.status === 0 && data.players.length === 10) {
        lobbyListener.emit('lobbyFull', { ...data, uid: data.uid })
      }
    })

    lobbyListener.on('lobbyFull', async (lobby) => {
      /*
      - Change lobby status to 1
      - Shuffle and update teams
      
      DISCORD
      - DM Players to tell them team name, teammates, connection info  
      - 
      
      */
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
          //
        })
        .then((response) => lobbyListener.emit('lobbyStart', response.data()))
    })

    lobbyListener.on('createLobby', (msg) => {
      createLobby().then(() =>
        msg.reply('Pickup Lobby Live! Type !join to get started, and !remove to leave the queue.')
      )
    })
  }

  // Creates a lobby then returns the new lobby uid
  const createLobby = async () => {
    console.log(chalk.blueBright('CREATING NEW LOBBY..'))
    await db
      .collection('lobbies')
      .add(defaultLobby)
      .then(async (ref) => {
        await db.collection('lobbies').doc(ref.id).update({ uid: ref.id, name: 'VALOVALORANT PICKUP' })
        return ref
      })
      .then((ref) => {
        lobbyListener.emit('lobbyCreate', ref)
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

  const findPlayerInLobby = async (uid, user) => {
    let obj = await getLobbyData(uid)
    let foundPlayer = obj.players.find((player) => player.id === user.id)
    return foundPlayer
  }

  const getActiveLobby = async () => {
    try {
      const snapshot = await db.collection('lobbies').where('status', '==', 0).get()
      return snapshot.docs.map((doc) => doc.data())[0] || null
    } catch (e) {
      console.log(e)
      throw e // let caller know the promise was rejected with this reason
    }
  }

  return { init, lobbyMode, getActiveLobby, addPlayerToLobby, findPlayerInLobby, getLobbyData }
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
