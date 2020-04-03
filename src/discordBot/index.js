import Discord from 'discord.js'
import { LobbyManager, lobbyListener } from '../lobbyManager'
import { initFirebase } from '../firebaseAuth.js'
import chalk from 'chalk'

const db = initFirebase()
const { getActiveLobby, addPlayerToLobby } = LobbyManager()
const { Client } = Discord

/*
DiscordBot() contains all the logic needed to interact with discord.js
Most of the logic reacts to emitters from lobbyListener (imported from the LobbyManager)

lobbyCreate - When a new lobby gets created, we generate new permissions & channels then update the lobby object 
lobbyStart - After a lobby gets 10 players and teams as split: Here we give permissions & Move Discord players to their right places

[x] !join - Adds a discord user to the queue TODO: Allow map votes with !join haven
[ ] !leave - Remove a discord user from the queue
[ ] think of a good way to do votes - typing is lame, can we do it in a more interactive way?

!GG - Nukes the server for when it gets messy (requires you to be Sentry ;)

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

    // Lets grab our server objects so we can create channels etc
    const guild = bot.guilds.cache.map((guild) => guild)[0]

    // Lobby Creator - Create channels / permissions and update Firebase lobby
    lobbyListener.on('lobbyCreate', (lobbyId) => {
      console.log(chalk.green('Creating Discord Lobby Actions for ', lobbyId))

      // Team 0 = everyone, team 1 = Team Hype, team 2 = Team Hazard
      const channels = [
        {
          name: `PREMATCH LOBBY`,
          role: 'voice-lobby',
          type: 'voice',
          team: 0,
          permissions: [
            { deny: [ 'CONNECT' ] },
            {
              allow: [ 'CONNECT', 'SPEAK' ]
            }
          ]
        },
        {
          name: `TEAM HYPE`,
          role: 'voice-team',
          team: 1,
          type: 'voice',
          permissions: [
            { deny: [ 'CONNECT' ] },
            {
              allow: [ 'CONNECT', 'SPEAK' ]
            }
          ]
        },
        {
          name: `TEAM HAZARD`,
          role: 'voice-team',
          team: 2,
          type: 'voice',
          permissions: [
            { deny: [ 'CONNECT' ] },
            {
              allow: [ 'CONNECT', 'SPEAK' ]
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
              allow: [ 'SEND_MESSAGES' ]
            }
          ]
        }
      ]

      // Create new role just for lobby, then create the categoryChannel, create text and voice channels (along with permissions), then add them to the category.

      guild.roles
        .create({
          data: {
            name: `Pickup Group #${lobbyId}`,
            color: 'BLUE'
          },
          reason: 'A Dynamic Pickup Group Role'
        })
        .then(async (role) => {
          console.log('Role Created', role.id)

          let category = await guild.channels.create(`${lobbyId} - LOBBY`, {
            type: 'category'
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
            .doc(lobbyId)
            .update({ discord: { channels: channelDetails, permissionRoleId: role.id } })

          db
            .collection('discordEntities')
            .doc(lobbyId)
            .set({ lobbyId: lobbyId, channels: channelDetails, permissionRoleId: role.id })
        })
        .catch(console.error)
    })

    lobbyListener.on('lobbyStart', (lobby) => {
      /* 
        Lobby has ten players and status is 1. Time to move players into their correct channels. 

        lobby = {
          created_at: Timestamp { seconds: 1585919121, nanoseconds: 460000000 },
          discord: {
            channels: [
              {
                id: '695620898962800690',
                name: 'PREMATCH LOBBY',
                role: 'voice-lobby',
                team: 0,
                type: 'voice'
              },
              {
                id: '695620900417962124',
                name: 'TEAM HYPE',
                role: 'voice-team',
                team: 1,
                type: 'voice'
              },
              {
                id: '695620901332451378',
                name: 'TEAM HAZARD',
                role: 'voice-team',
                team: 2,
                type: 'voice'
              },
              {
                id: '695620902456393739',
                name: 'MATCH DETAILS',
                role: 'text-lobby',
                team: 0,
                type: 'text'
              }
            ],
            permissionRoleId: '695620012425085028'
          },
          players: [
            { id: 842, source: 'web', username: 'PLAYER#337' },
            { id: 854, source: 'web', username: 'PLAYER#828' },
            { id: 600, source: 'web', username: 'PLAYER#514' },
            {
              avatar: null,
              bot: false,
              discriminator: '1053',
              id: '11112222233333344444',
              lastMessageChannelID: '695015685155192872',
              lastMessageID: '695256234374463520',
              source: 'discord',
              username: 'Sentry'
            }
          ],
          status: 1,
          team1: [
            { id: 600, source: 'web', username: 'PLAYER#514' },
            { id: 150, source: 'web', username: 'PLAYER#405' },
          ],
          team2: [
            { id: 944, source: 'web', username: 'PLAYER#738' },
            { id: 361, source: 'web', username: 'PLAYER#596' }
          ],
          uid: 'YqaKNi1VZgTpUTjl6qkb'
        }
      */

      // Iterate through each player and if their source is discord, add permissions and MOVE THEM.

      console.log(chalk.greenBright('Giving Permissions & Moving Chaps'))

      const givePermissions = async () => {
        for (const player of lobby.players) {
          if (player.source === 'discord') {
            await guild.members.fetch(player.id).then((user) => {
              user.roles.add(lobby.discord.permissionRoleId)
            })
          }
        }
      }

      givePermissions()
    })
  })

  // !join
  bot.on('message', (msg) => {
    if (msg.content === '!join') {
      //lobbyListener.emit('DISCORD_PLAYER_ADDED', { user: msg.author })
      //TODO : Somehow get active lobby. Done but so hackily.. I hate async await
      getActiveLobby().then((lobby) => {
        const userObj = { ...msg.author, source: 'discord' }
        addPlayerToLobby(lobby.uid, userObj).then(({ err, success }) => {
          if (success) {
            msg.reply(`Added you to the queue, ${msg.author.username}`)
            msg.channel.send(`${lobby.players.length + 1} / 10`)
          } else {
            console.log('err :', err)
          }
        })
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
