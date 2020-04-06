import Discord from 'discord.js'
import { LobbyManager, lobbyListener } from '../lobbyManager'
import { initFirebase } from '../firebaseAuth.js'
import { generateEmbedMessage } from '../helpers/lobbyHelpers'
import chalk from 'chalk'

require('dotenv').config()

const db = initFirebase()
const { getActiveLobby, addPlayerToLobby, findPlayerInLobby, findPlayer, lobbyMode } = LobbyManager()
const { Client } = Discord

/*
DiscordBot() contains all the logic needed to interact with discord.js
Most of the logic reacts to emitters from lobbyListener (imported from the LobbyManager)

lobbyCreate - When a new lobby gets created, we generate new permissions & channels then update the lobby object 
lobbyStart - After a lobby gets 10 players and teams as split: Here we give permissions & Move Discord players to their right places

[x] !join - Adds a discord user to the queue TODO: Allow map votes with !join haven
[x] !leave - Remove a discord user from the queue
[ ] think of a good way to do votes - typing is lame, can we do it in a more interactive way?

!GG - Nukes the server for when it gets messy (requires you to be Sentry. Change name to acheive same effect;)

// TODO: Refactor lobbyListener logic to be handled by like a reducer, with one function and multiple switches.
*/

const DiscordBot = () => {
  const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN
  console.log('DISCORD_BOT_TOKEN :', BOT_TOKEN)

  const bot = new Client()
  bot.login(BOT_TOKEN)

  bot.on('ready', async () => {
    console.info(`Logged in as ${bot.user.tag}!`)

    lobbyListener.emit('botLoggedIn', bot.user) // Event Emitters - Callbacks, anywhere.. https://nodejs.org/api/events.html

    const guild = bot.guilds.cache.get('695962481277009971') // THIS ONE IS BROKEN?!
    // const guild = bot.guilds.cache.get('696685308271525918')

    // Lobby Creator - Create channels / permissions and update Firebase lobby
    lobbyListener.on('lobbyCreate', async (createdLobby) => {
      /* 
    
    - CREATES UNIQUE ROLE TO ACCESS CHANNELS
    - CREATES CATEGORY, TEXT AND VOICE CHANNELS
    - UPDATES LOBBY OBJECT IN FIREBASE
    
    TODO: Clean up old lobbies (maybe the oldest, using createdAt) so that we don't run into max. channel or max. permissions issues
          - If #lobbies > 10? then get oldest lobby and.. 
          - Change it to status 3, (status 2 can be for when the lobby is still 'alive'... Let's not delete it outright?)
          - Delete permissions for that lobby (that should remove permissions from anyone we missed, too)
          - Delete those channels
    
    */

      const lobby = await db.collection('lobbies').doc(createdLobby.id).get().then((doc) => doc.data())
      const lobbyGroup = await db.collection('lobbyGroups').doc(lobby.lobbyGroupId).get().then((doc) => doc.data())

      const guild = bot.guilds.cache.get(lobbyGroup.discord.guildId)

      console.log(chalk.green('Creating Discord Lobby Actions for', lobby.name))

      // Team 0 = everyone, team 1 = Team Attackers, team 2 = Team Hazard
      const channels = [
        {
          name: `TEAM HYPE`,
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
          name: `TEAM HAZARD`,
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

          // DELETE THIS NORMALLY. THIS STOPS CATEGORY CREATE
          // let category = []
          return { role, category }
        })
        .then(async ({ role, category }) => {
          console.log('Category Channel Created', category.name)

          let channelCreation = async () => {
            let channelArray = []

            channelArray.push({ id: category.id, name: category.name, team: 0, type: category.type, role: 'category' })

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

                  //response.setParent('695989724032008262') // for VALORANTPRO parent
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
        .then(() => console.log(chalk.green('LE FIN for', lobby.uid)))
    })

    lobbyListener.on('sendMessage', async (discordMessage, message) => {
      const lobbyGroup = await db
        .collection('lobbyGroups')
        .where('discord.channelId', '==', discordMessage.channel.id)
        .get()
        .then((ref) => ref.docs.map((doc) => doc.data()))

      const guild = await bot.guilds.cache.get(lobbyGroup[0].discord.guildId)

      guild.channels.cache.get(lobbyGroup[0].discord.channelId).send(message)
    })

    lobbyListener.on('lobbyStart', (lobby) => {
      /* 
    
    - ADDS PERMISSIONS TO SEE DISCORD CHANNELS
    - MESSAGES CORRESPONDING MATCH LOBBY CHANNEL WITH TEAM DETAILS - NAME, CAPTAIN (EVERYONE SHOULD ADD CAPTAIN TO FRIENDS OR SMT.)
    - DMs INDIVIDUAL PLAYERS WITH THEIR DETAILS

    
    */
      const lobbyChannel = lobby.discord.channels.find((channel) => channel.role === 'text-lobby')

      // Iterate through each player and if their source is discord, add permissions and MOVE THEM.

      const givePermissions = async () => {
        console.log(chalk.greenBright('Giving Permissions & Messaging Chaps'))

        for (const player of lobby.players) {
          if (player.source === 'discord') {
            await guild.members
              .fetch(player.id)
              .then((user) => {
                user.roles.add(lobby.discord.permissionRoleId)
                return user
              })
              .then((user) => {
                user.send(
                  `**VALORANT MIX READY!** - Check <#${lobbyChannel.id}> for teams and details on joining up. *GLHF*`
                )
              })
          }
        }
      }

      givePermissions().then(async () => {
        const messageEmbeds = generateEmbedMessage(lobby.team1, lobby.team2)

        const lobbyGroup = await db
          .collection('lobbyGroups')
          .doc(lobby.lobbyGroupId)
          .get()
          .then((snapshot) => snapshot.data())

        // Game starting Lobby Message
        guild.channels.cache
          .get(lobbyGroup.discord.channelId)
          .send(`**Lobby Full 10/10** - **GAME STARTING!** - Players, check your DMs for details!`)

        lobbyMode === 'auto' &&
          lobbyListener.emit('createLobby', {
            guild: { id: lobbyGroup.discord.guildId },
            channel: { id: lobbyGroup.discord.channelId }
          })

        // ${lobby.players.map((player) => `<@!${player.id}>`).join(', ')}

        // Send to each player.
        messageEmbeds.map((embed) => {
          guild.channels.cache.get(lobbyChannel.id).send({ embed })
        })
      })
    })

    lobbyListener.on('removeOldLobbies', async (lobbyRef) => {
      console.log(chalk.blueBright('Checking for old lobbies to clean'))
      // Loop through started lobbies (status 1) that are older than one hour..

      const getLobby = await db.collection('lobbies').doc(lobbyRef.id).get().then((doc) => doc.data())

      const lobbyToCheckArray = await db
        .collection('lobbies')
        .where('lobbyGroupId', '==', getLobby.lobbyGroupId)
        .where('status', '==', 1)
        .get()
        .then((snapshot) => {
          return snapshot.docs.map((doc) => doc.data())
        })

      console.log('lobbyToCheckArray :', lobbyToCheckArray)

      const filtered = lobbyToCheckArray.filter((lobby) => {
        const timeNow = new Date()
        console.log('timeNow :', timeNow)
        console.log('lobby.createdAt :', lobby.createdAt)

        const createdTime = lobby.createdAt.toDate()
        console.log('createdTime :', createdTime)
        let checkTime = new Date(createdTime.setHours(createdTime.getHours() + 1))
        console.log('checkTime :', checkTime)

        return timeNow > checkTime
      })

      console.log('filtered', filtered)

      for (const lobby of filtered) {
        // Right now we're deleting but we should really be checking to see if the voice channels are empty first. If they are, go deleting
        const voiceChannels = lobby.discord.channels.filter((channel) => channel.role == 'voice-team')

        let hasPlayersInVoice = false

        // Checks for players in voice.
        for (const channel of voiceChannels) {
          hasPlayersInVoice = bot.channels.cache.get(channel.id).members.size > 0 ? true : false
        }

        // If none, nuke it.
        if (!hasPlayersInVoice) {
          db.collection('lobbies').doc(lobby.uid).delete().then(() => {
            console.log(`Lobby Deleted`)
          })
        }
      }

      // Use discord to check whether those channels are empty - Because our server moves users to afk channel after 30 minutes, we can assume that lobby is dead (or not using!) if there are no players in chat. Maybe.

      // If discord reports no users, send the channel to the bin.
    })

    lobbyListener.on('cleanRemovedLobby', (data) => {
      //console.log('data :', data)
      /* 
      data : {
        createdAt: Timestamp { seconds: 1586073297, nanoseconds: 958000000 },
        creator: null,
        discord: {
          channels: [ [Object], [Object], [Object], [Object] ],
          permissionRoleId: '696266851369484298'
        },
        lobbyGroupId: 'Nfl5RDqfJltj1PYlVSDz',
        name: 'VALOVALORANT PICKUP',
        players: [],
        status: 0,
        team1: [],
        team2: [],
        uid: '2D8EKzbhLqq05BQuRBKT'
      }
*/

      console.log(chalk.redBright('CLEANING ALL TRACE'))
      try {
        data.discord.channels.map((channel) => {
          guild.channels.cache.get(channel.id).delete().then(() => {
            console.log('Channel Deleted: ', data.uid, channel.name)
          })
        })

        guild.roles.cache.get(data.discord.permissionRoleId).delete().then(() => {
          console.log('Role Deleted: ', data.uid, data.discord.permissionRoleId)
        })
      } catch (e) {
        console.log('e', e)
      }
    })
  })

  // CHAT COMMAND : !setup <name> <mode>
  bot.on('message', (msg) => {
    if (msg.author.username === 'Sentry' && msg.content.includes('!setup')) {
      lobbyListener.emit('setupLobbyGroup', msg)
    }
  })

  // CHAT COMMAND : !setmode *
  bot.on('message', (msg) => {
    if (msg.content.includes('!setmode')) {
      const newMode = msg.content.substr(msg.content.indexOf(' ') + 1)
      lobbyListener.emit('setLobbyMode', newMode, msg)
    }
  })

  // CHAT COMMAND : !startmix
  bot.on('message', (msg) => {
    if (msg.content === '!startmix') {
      lobbyListener.emit('createLobby', msg)
    }
  })

  // CHAT COMMAND : !join
  bot.on('message', async (msg) => {
    if (msg.content === '!join') {
      //lobbyListener.emit('DISCORD_PLAYER_ADDED', { user: msg.author })

      //TODO : CHECK WHETHER PLAYER IS ALREADY IN A CURRENT LOBBY
      getActiveLobby(msg.channel.id).then((lobby) => {
        console.log('lobby :', lobby)
        if (lobby) {
          console.log('found lobby!')
          const userObj = { ...msg.author, source: 'discord' }
          addPlayerToLobby(lobby.uid, userObj)
            .then(({ success }) => {
              if (success) {
                msg.reply(
                  `Added you to the queue, ${msg.author.username} - Current Lobby: ${lobby.players.length +
                    1} / 10 - Waiting on ${10 - (lobby.players.length + 1)} more.`
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

  // CHAT COMMAND : !leave
  bot.on('message', (msg) => {
    if (msg.content === '!leave') {
      //lobbyListener.emit('DISCORD_PLAYER_ADDED', { user: msg.author })
      //TODO : Somehow get active lobby. Done but so hackily.. I hate async await
      getActiveLobby(msg.channel.id).then(async (lobby) => {
        if (lobby) {
          const updatedPlayerList = lobby.players.filter((player) => player.id !== msg.author.id)

          console.log('msg.author :', msg.author)

          // console.log('findPlayerInLobby(lobby.uid, msg.author.id) :', await findPlayerInLobby(lobby.uid, msg.author.id));
          if (await findPlayerInLobby(lobby.uid, msg.author)) {
            db.collection('lobbies').doc(lobby.uid).update({ players: updatedPlayerList }).then(() => {
              console.log('Player Removed', msg.author.username)
              msg.reply(` - You've left the lobby. Current Lobby: ${updatedPlayerList.length} / 10`)
            })
          }
        } else {
          console.log('Couldnt remove player - Perhaps they arent in the active lobby. ')
        }
      })
    }
  })
  // CHAT COMMAND : !stopmix
  bot.on('message', (msg) => {
    if (msg.content === '!stopmix') {
      getActiveLobby(msg.channel.id).then(async (lobby) => {
        if (lobby) {
          db.collection('lobbies').doc(lobby.uid).delete().then(() => {
            console.log(`Lobby Deleted`)
            msg.reply('Pickup Lobby Closed.')
          })
        } else {
          console.log(`No active lobby to close - Maybe a player needs to start one first`)
        }
      })
    }
  })

  // CHAT COMMAND : !GG nukes the discord server. Only General chat remains.
  // bot.on('message', (message) => {
  //   if (message.content === '!GG') {
  //     const safeRoles = [ 'valoBOT', '@everyone', 'Dev Team' ]

  //     if (message.author.username === 'Sentry') {
  //       console.log(chalk.bgBlackBright('DESTOYING DISCORD - WIPING ALL CHANNELS AND ROLES'))

  //       message.guild.roles.cache.forEach((role) => {
  //         console.log(
  //           'role.name :',
  //           role.name,
  //           safeRoles.find((element) => {
  //             console.log('element vs role:', element, role.name)

  //             element === role.name
  //           })
  //         )

  //         safeRoles.find((element) => element === role.name) === undefined && role.delete()
  //       })

  //       message.guild.channels.cache.forEach((channel) => {
  //         channel.name !== 'general' && channel.delete()
  //       })
  //     }
  //   }
  // })

  return {}
}

DiscordBot()
