import 'dotenv/config'
import express, { response } from 'express'
import cors from 'cors'
import 'babel-polyfill'

// import "./app";

import './lobbyManager'

let port = process.env.PORT || 3000

const app = express()

app.use(cors())
app.use(express.urlencoded({ extended: true }))

app.get('/stream', (req, res) => {
  res.status(200).set({
    'connection': 'keep-alive',
    'cache-control': 'no-cache',
    'content-type': 'application/json'
  })

})

app.post('/transactions', async (req, res) => {})

app.listen(port, () => console.log(`Server Live on port ${process.env.PORT}! 🚀`))
