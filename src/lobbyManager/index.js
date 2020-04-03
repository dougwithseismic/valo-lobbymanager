import { initFirebase } from '../firebaseAuth.js'
import { defaultLobby, createPlayer, shuffleTeams } from '../helpers/lobbyHelpers'
import { EventEmitter } from 'events'

const db = initFirebase()

export const lobbyListener = new EventEmitter()

// MAIN HOOK
// MAIN HOOK
// MAIN HOOK
// MAIN HOOK
// MAIN HOOK

export const LobbyManager = () => {
  // NOTE: Emmiters can live here, but not listeners? Loading LobbyManager in multiple places creates multiple listeners (that repeat their actions)

  let activeLobby = null

  // Listens for changes on lobbyChange
  lobbyListener.on('lobbyChange', ({ change, data }) => {
    // console.log('lobbyChange :', change, data)

    // Do something every time a lobby updates.
    // For example, when the Lobby is ready with 10 players, START GAME!
    if (data.status === 0 && data.players.length === 10) {
      db.collection('lobbies').doc(data.uid).update({ status: 1 }).then((result) => {
        lobbyListener.emit('lobbyStart', { ...data, uid: data.uid }) // Example of emit
      })
    }
  })

  lobbyListener.on('lobbyCreate', (lobbyUid) => {
    /*
    When a lobby is created, we should..
    - Set the active lobby to lobbyUid (Assuming we'll only ever have one active lobby?)
    - 
    
    DISCORD
    - Open the lobby up for !joins (valo messages channel and starts accepting joins)  
    - Procure a pregame lobby (text + voice) https://discord.js.org/#/docs/main/stable/class/GuildChannelManager
    - Create permissions for those channels (and somehow revoke at end of game, meaning we need to define a game end..
    
    WEB
    - Open the lobby up for clients to join

    */

    console.log('Lobby Created', lobbyUid)
  })

  lobbyListener.on('lobbyStart', (lobby) => {
    /*
    - Change lobby status to 1
    - Shuffle and update teams
    
    DISCORD
    - DM Players to tell them team name, teammates, connection info  
    - 
    
    */
    startGame(lobby.uid) // Starts the team splitting and other game methods.
  })

  const startGame = async (uid) => {
    let lobby = await getLobbyData(uid)
    const team1 = shuffleTeams(lobby.players)
    const team2 = team1.splice(0, team1.length / 2)

    db.collection('lobbies').doc(uid).update({ team1, team2 }).then((response) => {
      console.log(response)
    })
  }

  /* 

  When lobby manager initialises, we should..

    - Get the last X lobbies (we dont need all of them)
    - If there's an open lobby waiting for players, (status 0) set that as the active lobby
    - If there are no lobbies, or there are only closed lobbies (status > 0) , create a new one and set as active lobby, as above.

  */

  const init = async () => {
    // Grab a snapshot of our current lobbies
    db.collection('lobbies').orderBy('created_at', 'desc').onSnapshot((snapshot) => {
      if (snapshot.size) {
        // let lobbyList = snapshot.docs.map((doc) => doc.data())

        // If there are no active lobbies, create one.
        snapshot.docs.map((doc) => doc.data()).filter((lobby) => lobby.status === 0).length === 0 && createLobby()

        // Listen for changes.
        snapshot.docChanges().forEach((change) => {
          lobbyListener.emit('lobbyChange', { change: change.type, data: { ...change.doc.data(), uid: change.doc.id } })
        })
      } else {
        // it's empty so create our first lobby and set it as our active lobby.
        console.log('No Lobbies Found - Creating New Lobby')
        createLobby()
      }
    })
  }

  // Creates a lobby then returns the new lobby uid
  const createLobby = () => {
    db.collection('lobbies').add(defaultLobby).then((ref) => {
      lobbyListener.emit('lobbyCreate', ref.id)
      activeLobby = ref.id
      db.collection('lobbies').doc(ref.id).update({ uid: ref.id })
    })
  }

  // Grabs details on a lobby, taking a lobby uid as argument
  const getLobbyData = async (uid) => {
    return await db.collection('lobbies').doc(uid).get().then((doc) => {
      console.log('doc :', doc.data())
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

        console.log('updatedPlayers :', updatedPlayers)
        await db.collection('lobbies').doc(uid).update({ players: updatedPlayers }).then((result) => {
          console.log('result :', result)
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
    console.log('Searching for user :', user.id)
    let obj = await getLobbyData(uid)
    let foundPlayer = obj.players.find((player) => player.id === user.id)
    console.log('foundPlayer :', foundPlayer)
    return foundPlayer
  }

  const getActiveLobby = async () => {
    if (!activeLobby) {
      try {
        const snapshot = await db.collection('lobbies').orderBy('created_at', 'desc').get()
        return snapshot.docs.map((doc) => doc.data())[0]
      } catch (e) {
        console.log(e)
        throw e // let caller know the promise was rejected with this reason
      }
    } else {
      return activeLobby
    }
  }

  init()

  return { init, getActiveLobby, addPlayerToLobby, findPlayerInLobby, getLobbyData }
}

// let activeLobby = getActiveLobby().then((result) => result)

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
