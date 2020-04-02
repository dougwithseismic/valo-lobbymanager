import firebase from 'firebase/app'
import 'firebase/firestore'
import 'firebase/auth'

const firebaseConfig = {
  apiKey: 'AIzaSyCqPn5N0CO7OdHCclWa8wIH6pJGahEYszQ',
  authDomain: 'valovalorant-3a547.firebaseapp.com',
  databaseURL: 'https://valovalorant-3a547.firebaseio.com',
  projectId: 'valovalorant-3a547',
  storageBucket: 'valovalorant-3a547.appspot.com',
  messagingSenderId: '737303209890',
  appId: '1:737303209890:web:b74e7f43c3cd1e530034fb',
  measurementId: 'G-FGVH9BS241'
}

// Initialize Firebase
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig)
}

// Make a reference to Firestore (the db)
const db = firebase.firestore()

const createPlayer = (player) => {
  return {
    ...player
  }
}

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

import { EventEmitter } from 'events'
const lobbyManager = new EventEmitter()

let lobbyList = []
// Listens for changes to lobbies
lobbyManager.on('lobbyChange', ({ change, data }) => {
  console.log('lobbyChange :', change, data)
  // Do something every time a lobby updates.

  // For example, when the Lobby is ready with 10 players, START GAME!
  if (data.status === 0 && data.players.length === 10) {
    db.collection('lobbies').doc(data.uid).update({ status: 1 }).then((result) => {
      startGame(data.uid) // Starts the team splitting and other game methods.
    })
  }
})

const startGame = async (uid) => {
  let lobby = await getLobbyData(uid)
  const team1 = shuffle(lobby.players)
  const team2 = team1.splice(0, team1.length / 2)

  console.log('teams :', team1, team2)
  db.collection('lobbies').doc(uid).update({ team1, team2 }).then((response) => console.log(response))
}

const shuffle = (array) => {
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

const defaultLobby = {
  players: [],
  team1: [],
  team2: [],
  status: 0
}

// Emits event when lobbies are changed.

// MAIN HOOK
const LobbyManager = () => {
  const init = () =>
    db.collection('lobbies').onSnapshot((snapshot) => {
      if (snapshot.size) {
        // lobbyList = snapshot.docs.map((doc) => doc)
        snapshot.docChanges().forEach((change) => {
          //   if (change.type === 'added') {
          lobbyManager.emit('lobbyChange', { change: change.type, data: { ...change.doc.data(), uid: change.doc.id } })
          //  }
        })
        // we have something
      } else {
        // it's empty so create our first lobby.
        console.log('No Lobbies Found - Creating New Lobby')
        createLobby()
      }
    })

  const createLobby = () => {
    db.collection('lobbies').add(defaultLobby).then((ref) => {
      // db.collection('lobbies').doc(ref.id).update({ uid: ref.id })
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
 * 
 */
  const addPlayerToLobby = async (uid, user) => {
    let response = null
    // If the lobby is still accepting players, lets add more players.
    const lobbyStatus = await getLobbyData(uid)

    if (lobbyStatus !== undefined && lobbystatus === 0) {
      // First lets check whether the player already exists.
      const foundPlayer = await findPlayerInLobby(uid, user)
      if (!foundPlayer) {
        let obj = await getLobbyData(uid)
        const player = createPlayer(user)
        const updatedPlayers = [ ...obj.players, player ]

        console.log('updatedPlayers :', updatedPlayers)
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
    console.log('Searching for user :', user.id)
    let obj = await getLobbyData(uid)
    let foundPlayer = obj.players.find((player) => player.id === user.id)
    console.log('foundPlayer :', foundPlayer)
    return foundPlayer
  }

  return { init, addPlayerToLobby, findPlayerInLobby, getLobbyData }
}

// Import like so.
const { addPlayerToLobby, findPlayerInLobby, getLobbyData } = LobbyManager()
LobbyManager().init() // Init first to get the snapshots running.

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
