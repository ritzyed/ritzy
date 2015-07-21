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
  }
}
