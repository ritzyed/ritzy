import SwarmBase from 'swarm/lib/NodeServer'
import swarmFactory from './swarmfactory'

let Swarm = swarmFactory(SwarmBase)

let fileStorage = new Swarm.FileStorage('.swarm')

Swarm.host = new Swarm.Host('swarm~nodejs', 0, fileStorage)
Swarm.env.localhost = Swarm.host

export default Swarm
