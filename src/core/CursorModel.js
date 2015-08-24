import _ from 'lodash'
import Model from 'swarm/lib/Model'

export function extractInternal(swarmModel) {
  return _.pick(swarmModel, '_id', 'name', 'state', 'ms')
}

export default Model.extend('Cursor', {
  defaults: {
    name: '',
    state: {
      position: null,
      positionEolStart: false,
      selectionActive: false,
      selectionLeftChar: null,
      selectionRightChar: null
    },
    ms: Date.now() // activity timestamp
  }
})
