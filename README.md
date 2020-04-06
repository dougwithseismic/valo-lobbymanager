# ValoBOT - The Pickup Game Lobby Manager
Valo helps to match players together to competitive 5v5 games on Discord / Web. Build with Node, Discord.js & Firebase.


## Getting Started



```bash
yarn develop
```

## Example .env 
Create a .env file and include the token from your discord bot, and your firebase API key. See below for full setup instructions.

```bash
DISCORD_BOT_TOKEN=XXXX
FIREBASE_API_KEY=XXXX

```

## Setting up the Discord Bot
1. Sign up and create an application through the Discord Developers Panel [https://discordapp.com/developers/applications](https://discordapp.com/developers/applications)
2. Generate a token and add it to a .env in the projects root folder.
3. Add your bot (with Admin scope) to your discord server.

## Setting Up Firebase
1. Create a Firestore and grab your Firebase SDK snippet (Firebase CP - Click the Gear next to Project Overview > Project Settings > Config
Add your object to src/firebaseAuth.js 

```javascript
// Example Firebase SDK snippet
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: 'valovalorant-000.firebaseapp.com',
  databaseURL: 'https://valovalorant-0007.firebaseio.com',
  projectId: 'valovalorant-000',
  storageBucket: 'valovalorant-000.appspot.com',
  messagingSenderId: '737303209890',
  appId: '1:737303209890:web:b74e7f43c3cd00034fb',
  measurementId: 'G-FGVH9B000'
}
```
## Bot Commands

```markdown
!startmix- Starts a mix lobby within a channel (and generates voice/text channels on discord)
!stopmix - Closes lobby and deletes associated discord channels

!setmode auto|moderated - Sets the bot to auto or moderated mode; auto mode creates a new lobby 
when the previous one is filled whilst moderated waits for a !startmix command

!join - Adds the discord user to join the lobby
!leave - Removes the discord player from the active lobby

```

