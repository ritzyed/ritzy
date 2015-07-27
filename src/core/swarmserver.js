import SwarmBase from 'swarm/lib/NodeServer'
import swarmFactory from './swarmfactory'
import redis from 'redis'
import RedisStorage from '../vendor/swarm/RedisStorage'

let Swarm = swarmFactory(SwarmBase)

//let storage = new Swarm.FileStorage('.swarm')
let storage = new RedisStorage({
  redis: redis,
  redisConnectParams: {
    port: 6379,
    host: '127.0.0.1',
    options: {}
  }
})
storage.open()

Swarm.host = new Swarm.Host('swarm~nodejs', 0, storage)
Swarm.env.localhost = Swarm.host

export default Swarm
