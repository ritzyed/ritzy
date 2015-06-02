import SwarmBase from 'swarm'
import swarmFactory from './swarmfactory'

let Swarm = swarmFactory(SwarmBase)

// TODO get rid of this and use the logged in user's name and session id
let app = {}
app.id = window.localStorage.getItem('localuser') || 'A' + Swarm.Spec.int2base((Math.random() * 10000) | 0)
window.localStorage.setItem('localuser', app.id)

// server host uri
app.wsServerUri = 'ws://' + window.location.host

var hash = window.location.hash || '#0'

// create Host
app.host = Swarm.env.localhost = new Swarm.Host(app.id + hash.replace('#', '~'))

// connect to server
app.host.connect(app.wsServerUri, {delay: 50})

//catch online/offline status changes
app.host.on('reon', function(spec, val) {  // eslint-disable-line no-unused-vars
  document.body.setAttribute('connected', app.host.isUplinked())
})
app.host.on('reoff', function(spec, val) { // eslint-disable-line no-unused-vars
  document.body.setAttribute('connected', app.host.isUplinked())
})
app.host.on('off', function(spec, val) { // eslint-disable-line no-unused-vars
  document.body.setAttribute('connected', app.host.isUplinked())
})

window.onbeforeunload = function() {
  // close host
  app.host.close()
}

export default Swarm
