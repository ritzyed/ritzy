import Swarm from 'swarmclient'

export default {
  createTextReplica(id) {
    this.replica = new Swarm.Text('/Text#' + id)
  },

  registerCb(initCb, updateCb) {
    this.replica.on('.init', initCb)
    this.replica.on('.insert', updateCb)
    this.replica.on('.remove', updateCb)
    this.replica.on('.setAttributes', updateCb)
  },

  sourceOf(spec) {
    // spec seems to have some internal parsing state "index" which prevents accessing it consistently
    // https://github.com/gritzko/swarm/issues/53
    let oldIndex = spec.index
    spec.index = 0
    let source
    try {
      source = spec.source()
    } catch (e) {
      return null
    }
    spec.index = oldIndex
    return source
  },

  relativeChar(charOrId, relative, wrap) {
    return this.replica.getCharRelativeTo(charOrId, relative, wrap)
  }
}
