import Model from 'swarm/lib/Model'

export default Model.extend('Cursor', {
  defaults: {
    name: '',
    data: {
      position: null,
      positionEolStart: false,
      selectionActive: false,
      selectionLeftChar: null,
      selectionRightChar: null
    },
    ms: Date.now() // activity timestamp
  }
})
