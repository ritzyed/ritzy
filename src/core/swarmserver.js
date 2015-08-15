import SwarmBase from 'swarm/lib/NodeServer'
import swarmFactory from './swarmfactory'
import Spec from 'swarm/lib/Spec'
import redis from 'redis'
import RedisStorage from '../vendor/swarm/RedisStorage'

export default class SwarmServer {
  constructor(redisConfig) {
    let Swarm = swarmFactory(SwarmBase)
    this.Swarm = Swarm

    //let storage = new Swarm.FileStorage('.swarm')
    let storage = new RedisStorage({
      redis: redis,
      redisConnectParams: redisConfig,
      debug: false
    })
    storage.open()

    Swarm.host = new Swarm.Host('swarm~nodejs', 0, storage)
    Swarm.env.localhost = Swarm.host

    setInterval(() => {
      this.cleanCursorSets()
    }, 5000)
  }

  cleanCursorSet(cursorSet) {
    let online = {}
    let Swarm = this.Swarm
    for (let src in Swarm.host.sources) {
      if(!Swarm.host.sources.hasOwnProperty(src)) continue
      let m = src.match(/([A-Za-z0-9_\~]+)(\~[A-Za-z0-9_\~]+)/)
      if (!m) {
        console.error('Unknown Swarm source', src)
        continue
      }
      online[m[1]] = true
    }

    if (!cursorSet._version) {
      return
    }

    let cursorSetMoribund = {}
    let cursors = cursorSet.list()
    for (let s of cursors) {
      let spec = s.spec()
      if (spec.type() !== 'Cursor') {
        continue
      }
      let id = spec.id()
      cursorSetMoribund[id] = s.ms
    }
    //console.log('cursorSet:', cursorSet._id, 'cursors:', cursorSetMoribund)
    // cursors live for 10 minutes after last use and then disappear (recreated by client if user resumes editing)
    let ancient = Date.now() - 60 * 60 * 1000
    for (let id in cursorSetMoribund) {
      if(!cursorSetMoribund.hasOwnProperty(id)) continue
      let ts = cursorSetMoribund[id]
      if (ts < ancient) {
        cursorSet.removeObject('/Cursor#' + id)
        delete cursorSetMoribund[id]
      }
    }
  }

  cleanCursorSets() {
    let Swarm = this.Swarm
    Object.keys(Swarm.host.objects).map(s => new Spec(s)).filter(s => s.type() === 'CursorSet').forEach(s => {
      this.cleanCursorSet(Swarm.host.get(s))
    })
  }
}
