import Text from './RichText'
import CursorModel from './CursorModel'
import CursorSet from './CursorSet'

let SwarmFactory = function SwarmFactory(Swarm) {
  Swarm.debug = false

  Swarm.Text = Text
  Swarm.CursorModel = CursorModel
  Swarm.CursorSet = CursorSet

  let env = Swarm.env
  env.debug = false
  env.log = (spec, value, source, host) => { // no-unused-vars
    //console.log('spec=', spec, 'value=', value, 'source=', source, 'host=', host)
  }

  return Swarm
}

export default SwarmFactory
