import SwarmBase from 'swarm'
import swarmFactory from './swarmfactory'

export default class SwarmClient {
  constructor(localUser) {
    let Swarm = swarmFactory(SwarmBase)
    this.Swarm = Swarm

    this.id = localUser

    // server host uri (/websocket is appended because https://github.com/websockets/ws/issues/131)
    this.wsServerUri = 'ws://' + window.location.host + '/websocket'

    let hash = window.location.hash || '#0'

    // create Host
    this.host = Swarm.env.localhost = new Swarm.Host(this.id + hash.replace('#', '~'))

    // connect to server
    this.pipe = this.host.connect(this.wsServerUri, {delay: -1})

    this.reonHooks = []
    this.unloadHooks = []

    //catch online/offline status changes
    this.host.on('reon', (spec, val) => {  // eslint-disable-line no-unused-vars
      document.body.setAttribute('connected', this.host.isUplinked())
      for(let i = 0; i < this.reonHooks.length; i++) {
        try {
          this.reonHooks[i]()
        } catch (e) {
          console.warn('Swarm reon hook failed.', e)
        }
      }
    })
    this.host.on('reoff', (spec, val) => { // eslint-disable-line no-unused-vars
      document.body.setAttribute('connected', this.host.isUplinked())
    })
    this.host.on('off', (spec, val) => { // eslint-disable-line no-unused-vars
      document.body.setAttribute('connected', this.host.isUplinked())
    })

    let unloaded = false
    let unload = () => {
      if(unloaded) {
        return
      }
      unloaded = true
      // bug, Swarm.js does not close the Websocket because Pipe.close() expects stream.close() to exist, get a ref and do it manually
      let ws = this.pipe && this.pipe.stream && this.pipe.stream.ws ? this.pipe.stream.ws : null
      for(let i = 0; i < this.unloadHooks.length; i++) {
        try {
          this.unloadHooks[i]()
        } catch (e) {
          console.warn('Swarm unload hook failed.', e)
        }
      }
      this.host.close(() => {
        // bug, Swarm.js does not close the Websocket because Pipe.close() expects stream.close() to exist
        this.pipe.close()
        if(ws) {
          ws.close()
        }
      })
    }

    // hopefully one of these events works, doesn't seem to be consistent
    window.addEventListener('beforeunload', function() {
      unload()
    })
    window.addEventListener('pagehide', () => {
      unload()
    })
    window.addEventListener('unload', () => {
      unload()
    })
  }

  addReonHook(f) {
    this.reonHooks.push(f)
  }

  addUnloadHook(f) {
    this.unloadHooks.push(f)
  }
}
