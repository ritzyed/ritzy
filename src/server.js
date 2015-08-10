import _ from 'lodash'
import fs from 'fs'
import path from 'path'
import express from 'express'
import http from 'http'
import url from 'url'
import WebSocket from 'ws'

//import compression from 'compression'

//import React from 'react'
import Swarm from './core/swarmserver'

let server = express()

server.set('port', (process.env.PORT || 5000))
//server.use(compression())
server.use(express.static(path.join(__dirname)))

// html page template containing placeholders for title and body
const pageTemplateFile = path.join(__dirname, 'templates/index.html')
const pageTemplate = _.template(fs.readFileSync(pageTemplateFile, 'utf8'))

server.get('/', (req, res) => {
  let data = {
    description: '',
    title: 'Ritzy Editor'
  }

  data.content = ''

  let html = pageTemplate(data)
  res.send(html)
})

// example of calling this:
// http://localhost:5000/sapi/Text%2310 to return a Text replica 10
// http://localhost:5000/sapi/CursorSet%2310 to return a set of Cursors for editor 10
// http://localhost:5000/sapi/Cursor%2310_A0017r to return the state of Cursor for user id A0017r in editor 10
let apiHandler = require('swarm-restapi').createHandler({
  route: '/sapi',
  host: Swarm.host,
  authenticate: function(req, cb) {cb(null, null)} // no auth, to implement see sample auth function in swarm-restapi/index.js
})
server.get(/^\/sapi\//, apiHandler)
server.post(/^\/sapi\//, apiHandler)
server.put(/^\/sapi\//, apiHandler)

let httpServer = http.createServer(server)

httpServer.listen(server.get('port'), function(err) {
  if (err) {
    console.warn('Can\'t start HTTP server. Error: ', err, err.stack)
    return
  }

  // integration with gulp and browsersync -- if we have a browsersync process (yuck that we need to do this)
  // process.send is available if we are a child process (https://nodejs.org/api/child_process.html)
  if (process.send) {
    process.send('online')
  } else {
    console.log('The HTTP server is listening on port ' + server.get('port'))
  }
})

// start WebSocket server
let wsServer = new WebSocket.Server({
  server: httpServer
})

// accept pipes on connection
wsServer.on('connection', function(ws) {
  let params = url.parse(ws.upgradeReq.url, true)
  console.log('Incoming websocket %s', params.path, ws.upgradeReq.connection.remoteAddress)
  if (!Swarm.host) {
    return ws.close()
  }
  Swarm.host.accept(new Swarm.EinarosWSStream(ws), {delay: 50})
})

/* eslint-disable no-process-exit */
function onExit(exitCode) {
  console.log('Shutting down http-server...')
  httpServer.close(function(err) {
    if(err) console.warn('HTTP server close failed: %s', err)
    else console.log('HTTP server closed.')
  })

  if (!Swarm.host) {
    console.log('Swarm host not created yet...')
    return process.exit(exitCode)
  }

  console.log('Closing swarm host...')
  let forcedExit = setTimeout(function() {
    console.log('Swarm host close timeout, forcing exit.')
    process.exit(exitCode)
  }, 5000)

  Swarm.host.close(function() {
    console.log('Swarm host closed.')
    clearTimeout(forcedExit)
    process.exit(exitCode)
  })
}
/* eslint-enable no-process-exit */

process.on('SIGTERM', onExit)
process.on('SIGINT', onExit)
process.on('SIGQUIT', onExit)

process.on('uncaughtException', function(err) {
  console.error('Uncaught Exception: ', err, err.stack)
  onExit(2)
})
