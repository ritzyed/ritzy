import Text from './RichText'

let SwarmFactory = function SwarmFactory(Swarm) {
  Swarm.Text = Text

  let env = Swarm.env
  env.debug = true
  env.log = function css_log(spec, value, replica, host) { } // eslint-disable-line camelcase, no-unused-vars

  return Swarm
}

export default SwarmFactory
