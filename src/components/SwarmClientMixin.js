import SwarmClient from '../core/swarmclient'

export default {
  componentWillMount() {
    let swarmClientConfig = {
      wsPort: this.props.wsPort
    }
    this.swarmClient = new SwarmClient(this.props.userId, swarmClientConfig)
  }
}
