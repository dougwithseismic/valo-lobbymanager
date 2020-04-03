import Discord from 'discord.js'
import { LobbyManager, lobbyListener } from '../lobbyManager'
import { initFirebase } from '../firebaseAuth.js'

const db = initFirebase()

const { Client } = Discord
import chalk from 'chalk'

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

    // Proof of concept - Create channels, permissions, and add them to user.

    lobbyListener.on('lobbyCreate', (lobbyId) => {
      console.log(chalk.green('Creating Discord Lobby Actions for ', lobbyId))
      const channels = [
        {
          name: `PREMATCH LOBBY`,
          role: 'voice-lobby',
          type: 'voice',
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
          team: 0,
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
          name: `MATCH DETAILS`,
          type: 'text',
          role: 'text-lobby',
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
            return { id: channel.id, name: channel.name }
          })

          // Here, we'll update our lobby with the discord details needed for later use.
          db
            .collection('lobbies')
            .doc(lobbyId)
            .update({ discord: { channels: channelDetails, permissionRoleId: role.id } })

          db
            .collection('discordEntities')
            .add({ lobbyId: lobbyId, channels: channelDetails, permissionRoleId: role.id })
        })
        .catch(console.error)
    })
  })

  // !join
  bot.on('message', (msg) => {
    if (msg.content === '!createChannel') {
      lobbyListener.emit('DISCORD_PLAYER_ADDED', { user: msg.author })
      //TODO : Somehow get active lobby. Done but so hackily.. I hate async await
      //   getActiveLobby().then((lobby) =>
      //     addPlayerToLobby(lobby.uid, msg.author).then(({ err, success }) => {
      //       if (success) {
      //         console.log('success :', success)
      //         msg.reply(`Added you to the queue, ${msg.author.username}`)
      //         msg.channel.send(`${lobby.players.length + 1} / 10`)
      //       } else {
      //       }
      //     })
      //   )
    }
  })

  // !gg nukes the discord server. Only General chat remains.
  bot.on('message', (message) => {
    if (message.content === '!GG') {
      if (message.author.username === 'Sentry') {
        console.log(chalk.bgBlackBright('DESTOYING DISCORD - WIPING ALL CHANNELS'))
        message.guild.channels.cache.forEach((channel) => {
          channel.name !== 'general' && channel.delete()
        })
      }
    }
  })

  return {}
}

DiscordBot()
