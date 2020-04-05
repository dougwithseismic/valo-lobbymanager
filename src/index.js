import 'dotenv/config'
import express, { response } from 'express'
import cors from 'cors'
import 'babel-polyfill'

// import "./app";

import './discordBot'
import LobbyManager from './lobbyManager'

LobbyManager().init()


let port = process.env.PORT || 3001

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

app.listen(port, () => {})
