import Discord, { GuildEmoji } from 'discord.js'
import { LobbyManager, lobbyListener } from '../lobbyManager'
import { initFirebase } from '../firebaseAuth.js'
import { generateEmbedMessage } from '../helpers/lobbyHelpers'
import chalk from 'chalk'

const db = initFirebase()
const { getActiveLobby, addPlayerToLobby, findPlayerInLobby } = LobbyManager()
const { Client } = Discord

/*
DiscordBot() contains all the logic needed to interact with discord.js
Most of the logic reacts to emitters from lobbyListener (imported from the LobbyManager)

lobbyCreate - When a new lobby gets created, we generate new permissions & channels then update the lobby object 
lobbyStart - After a lobby gets 10 players and teams as split: Here we give permissions & Move Discord players to their right places

[x] !join - Adds a discord user to the queue TODO: Allow map votes with !join haven
[ ] !leave - Remove a discord user from the queue
[ ] think of a good way to do votes - typing is lame, can we do it in a more interactive way?

!GG - Nukes the server for when it gets messy (requires you to be Sentry. Change name to acheive same effect;)

// TODO: Refactor lobbyListener logic to be handled by like a reducer, with one function and multiple switches.
*/

const DiscordBot = () => {
  const bot = new Client()
  bot.login('Njk1MDEyMzA0NjgwNTE3NjUy.XoT_OA.YvjXK5rTcIbCISJD5UnA4KOxNy8')

  db.collection('lobbies').orderBy('created_at', 'desc').onSnapshot((snapshot) => {
    if (snapshot.size) {
      // snapshot.docs.map((doc) => console.log('doc.data() :', doc.data()))
    }
  })

  bot.on('ready', () => {
    console.info(`Logged in as ${bot.user.tag}!`)

    lobbyListener.emit('botLoggedIn', bot.user) // In case we want to do something elsewhere. https://nodejs.org/api/events.html

    // References the server our bot is in. If we're in multiple servers, we need to update this logic.
    const guild = bot.guilds.cache.map((guild) => guild)[1]
    //const guild = bot.guilds.cache.get('694639382891855993') Creating roles seems fucked on this server for some reason

    // Lobby Creator - Create channels / permissions and update Firebase lobby
    lobbyListener.on('lobbyCreate', async (createdLobby) => {
      /* 
    
    - CREATES UNIQUE ROLE TO ACCESS CHANNELS
    - CREATES CATEGORY, TEXT AND VOICE CHANNELS
    - UPDATES LOBBY OBJECT IN FIREBASE
    
    TODO: Clean up old lobbies (maybe the oldest, using created_at) so that we don't run into max. channel or max. permissions issues
          - If #lobbies > 10? then get oldest lobby and.. 
          - Change it to status 3, (status 2 can be for when the lobby is still 'alive'... Let's not delete it outright?)
          - Delete permissions for that lobby (that should remove permissions from anyone we missed, too)
          - Delete those channels
    
    */

      // TODO: MESSAGE THE CHANNEL WITH UPDATES ON BOT BEHAVIOUR.

      const lobby = await db.collection('lobbies').doc(createdLobby.id).get().then((doc) => doc.data())

      console.log('lobby :', lobby)
      console.log(chalk.green('Creating Discord Lobby Actions for', lobby.name))

      // Team 0 = everyone, team 1 = Team Hype, team 2 = Team Hazard
      const channels = [
        {
          name: `TEAM ATTACKERS`,
          role: 'voice-team',
          team: 1,
          type: 'voice',
          permissions: [
            { deny: [ 'VIEW_CHANNEL' ] },
            {
              allow: [ 'VIEW_CHANNEL', 'CONNECT', 'SPEAK' ]
            }
          ]
        },
        {
          name: `TEAM DEFENDERS`,
          role: 'voice-team',
          team: 2,
          type: 'voice',
          permissions: [
            { deny: [ 'VIEW_CHANNEL' ] },
            {
              allow: [ 'VIEW_CHANNEL', 'CONNECT', 'SPEAK' ]
            }
          ]
        },
        {
          name: `MATCH DETAILS`,
          type: 'text',
          role: 'text-lobby',
          team: 0,
          permissions: [
            { deny: [ 'VIEW_CHANNEL' ] },
            {
              allow: [ 'VIEW_CHANNEL', 'SEND_MESSAGES' ]
            }
          ]
        }
      ]

      guild.roles
        .create({
          data: {
            name: `Pickup Group #${lobby.uid}`,
            color: 'BLUE'
          },
          reason: 'A Dynamic Pickup Group Role'
        })
        .then(async (role) => {
          console.log('Role Created', role.id)

          let category = await guild.channels.create(`${lobby.name} - LOBBY`, {
            type: 'category',
            permissionOverwrites: [
              { id: guild.id, deny: [ 'VIEW_CHANNEL' ] },
              { id: role.id, allow: [ 'VIEW_CHANNEL' ] }
            ]
          })
          return { role, category }
        })
        .then(async ({ role, category }) => {
          console.log('Category Channel Created', category.name)

          let channelCreation = async () => {
            let channelArray = []

            for (const channel of channels) {
              console.log('Child Channel Created', channel.name)
              await guild.channels
                .create(channel.name, {
                  type: channel.type,
                  permissionOverwrites: [
                    { id: guild.id, ...channel.permissions[0] },
                    { id: role.id, ...channel.permissions[1] }
                  ]
                })
                .then(async (response) => {
                  channelArray.push({ id: response.id, ...channel })
                  response.setParent(category.id)
                })
            }
            return channelArray
          }

          return { role, channelArray: await channelCreation() }
        })
        .then(({ role, channelArray }) => {
          console.log(chalk.blueBright('Finished: Discord Channels & Permissions Created'))
          console.log(chalk.greenBright('Updating Firebase with Discord Channel Details'))

          const channelDetails = channelArray.map((channel) => {
            return { id: channel.id, name: channel.name, team: channel.team, type: channel.type, role: channel.role }
          })

          // Here, we'll update our lobby with the discord details needed for later use.
          db
            .collection('lobbies')
            .doc(lobby.uid)
            .update({ discord: { channels: channelDetails, permissionRoleId: role.id } })

          db
            .collection('discordEntities')
            .doc(lobby.uid)
            .set({ lobbyId: lobby.uid, channels: channelDetails, permissionRoleId: role.id })
        })
        .then(() => console.log(chalk.green('LE FIN for', lobby.id)))

      // Create new role just for lobby, then create the categoryChannel, create text and voice channels (along with permissions), then add them to the category.
    })

    // Lobby Starter - Gives permissions to players so they can see / interact with lobby and notifies players of next actions.
    lobbyListener.on('lobbyStart', (lobby) => {
      /* 
    
    - ADDS PERMISSIONS TO SEE DISCORD CHANNELS
    - MESSAGES CORRESPONDING MATCH LOBBY CHANNEL WITH TEAM DETAILS - NAME, CAPTAIN (EVERYONE SHOULD ADD CAPTAIN TO FRIENDS OR SMT.)
    - DMs INDIVIDUAL PLAYERS WITH THEIR DETAILS

    
    */

      // Iterate through each player and if their source is discord, add permissions and MOVE THEM.

      const givePermissions = async () => {
        console.log(chalk.greenBright('Giving Permissions & Messaging Chaps'))

        for (const player of lobby.players) {
          if (player.source === 'discord') {
            await guild.members.fetch(player.id).then((user) => {
              user.roles
              user.roles.add(lobby.discord.permissionRoleId)
            })
          }
        }
      }

      givePermissions().then(() => {
        const lobbyChannel = lobby.discord.channels.find((channel) => channel.role === 'text-lobby')
        const voiceChannel = lobby.discord.channels.find((channel) => channel.role === 'voice-lobby')

        const messageEmbeds = generateEmbedMessage(lobby.team1, lobby.team2)

        messageEmbeds.map((embed) => {
          guild.channels.cache.get(lobbyChannel.id).send({ embed })
        })
      })
    })
  })

  //!setmode *
  bot.on('message', (msg) => {
    if (msg.content.includes('!setmode')) {
      const newMode = msg.content.substr(msg.content.indexOf(' ') + 1)
      lobbyListener.emit('setLobbyMode', newMode)
    }
  })

    //!startpug
    bot.on('message', (msg) => {
      if (msg.content.includes('!startpug')) {
        lobbyListener.emit('createLobby',msg)
      }
    })

  // !join
  bot.on('message', (msg) => {
    if (msg.content === '!join') {
      //lobbyListener.emit('DISCORD_PLAYER_ADDED', { user: msg.author })
      //TODO : Somehow get active lobby. Done but so hackily.. I hate async await
      getActiveLobby().then((lobby) => {
        if (lobby) {
          const userObj = { ...msg.author, source: 'discord' }
          addPlayerToLobby(lobby.uid, userObj)
            .then(({ success }) => {
              if (success) {
                msg.reply(
                  `Added you to the queue, ${msg.author.username} - Current Lobby: ${lobby.players.length + 1} / 10`
                )
              }
            })
            .catch((e) => console.log('e :', e))
        } else {
          console.log('No Lobby Active - Maybe the game mode is MODERATED?')
        }
      })
    }
  })

  // !remove
  bot.on('message', (msg) => {
    if (msg.content === '!remove') {
      //lobbyListener.emit('DISCORD_PLAYER_ADDED', { user: msg.author })
      //TODO : Somehow get active lobby. Done but so hackily.. I hate async await
      getActiveLobby().then((lobby) => {
        if (lobby) {
          const updatedPlayerList = lobby.players.filter((player) => player.id !== msg.author.id)

          findPlayerInLobby(lobby.uid, msg.author.id) &&
            db.collection('lobbies').doc(lobby.uid).update({ players: updatedPlayerList }).then(() => {
              console.log('Player Removed', msg.author.username)
            })
        } else {
          console.log('Couldnt remove player - Perhaps they arent in the active lobby')
        }
      })
    }
  })

  // !gg nukes the discord server. Only General chat remains.
  bot.on('message', (message) => {
    if (message.content === '!GG') {
      const safeRoles = [ 'valoBOT', '@everyone', 'Dev Team' ]

      if (message.author.username === 'Sentry') {
        console.log(chalk.bgBlackBright('DESTOYING DISCORD - WIPING ALL CHANNELS AND ROLES'))

        message.guild.roles.cache.forEach((role) => {
          console.log(
            'role.name :',
            role.name,
            safeRoles.find((element) => {
              console.log('element vs role:', element, role.name)

              element === role.name
            })
          )

          safeRoles.find((element) => element === role.name) === undefined && role.delete()
        })

        message.guild.channels.cache.forEach((channel) => {
          channel.name !== 'general' && channel.delete()
        })
      }
    }
  })

  return {}
}

DiscordBot()
