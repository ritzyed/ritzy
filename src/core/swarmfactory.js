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
  env.log = function css_log(spec, value, replica, host) { } // eslint-disable-line camelcase, no-unused-vars

  return Swarm
}

export default SwarmFactory
