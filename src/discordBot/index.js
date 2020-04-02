import Discord from 'discord.js'
const { Client } = Discord

export const DiscordBot = () => {
  const bot = new Client()
  bot.login('Njk1MDEyMzA0NjgwNTE3NjUy.XoT_OA.YvjXK5rTcIbCISJD5UnA4KOxNy8')

  bot.on('ready', () => {
    console.info(`Logged in as ${bot.user.tag}!`)
  })

  bot.on('message', (msg) => {
    if (msg.content === '!join') {
      msg.reply('response')
      msg.channel.send('msg.channel.response')
    }
  })

  bot.on('message', (msg) => {
    if (msg.content === 'pinggg') {
      msg.reply('POOOOOOONG')
    }
  })

  const helloWorld = () => {
    console.log('helloWorld')
  }

  return { helloWorld }
}
