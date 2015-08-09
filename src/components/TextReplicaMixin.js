export default {
  createTextReplica() {
    let Text = this.swarmClient.Swarm.Text
    this.replica = new Text('/Text#' + this.props.id)
  },

  registerCb(initCb, updateCb) {
    this.replica.on('.init', initCb)
    this.replica.on('.insert', updateCb)
    this.replica.on('.remove', updateCb)
    this.replica.on('.setAttributes', updateCb)
  }
}
