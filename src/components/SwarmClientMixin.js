import SwarmClient from '../core/swarmclient'

export default {
  componentWillMount() {
    this.swarmClient = new SwarmClient(this.props.userId)
  }
}
