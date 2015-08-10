import SwarmClient from 'swarmclient'

export default {
  componentWillMount() {
    this.swarmClient = new SwarmClient(this.props.userId)
  }
}
