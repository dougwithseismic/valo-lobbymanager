import 'dotenv/config'
import express, { response } from 'express'
import cors from 'cors'
import 'babel-polyfill'

// import "./app";

import { LobbyManager } from './lobbyManager'
import './discordBot'

// Import like so. Is this the right place for it?
LobbyManager() // Init first to get the snapshots running.

let port = process.env.PORT || 3000

const app = express()

app.use(cors())
app.use(express.urlencoded({ extended: true }))

app.get('/stream', (req, res) => {
  res.status(200).set({
    connection: 'keep-alive',
    'cache-control': 'no-cache',
    'content-type': 'application/json'
  })
  setInterval(() => {
    res.write(JSON.stringify({ status: 'start lobby' }))
  }, 5000)
})

app.post('/transactions', async (req, res) => {})

app.listen(port, () => console.log(`Server Live on port ${process.env.PORT}! 🚀`))
