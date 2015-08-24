import EditorActions from '../flux/EditorActions'

export default {
  createSharedCursor() {
    let Swarm = this.swarmClient.Swarm

    this.cursorId = this.props.id + '_' + this.swarmClient.id
    this.cursorSet = new Swarm.CursorSet('/CursorSet#' + this.props.id)

    this.trackedCursors = {}

    this.cursorSet.on('.init', this.onCursorSetInitialize)
    this.cursorSet.on('.change', this.onCursorSet)
  },

  onCursorSetInitialize(spec, value, source) {   // eslint-disable-line no-unused-vars
    let Swarm = this.swarmClient.Swarm

    this.cursorModel = new Swarm.CursorModel(this.cursorId)
    this.cursorModel.set({
      name: this.props.userName
    })

    this.cursorSet.addObject(this.cursorModel)
    // if we lose connection to the server and then gain it again, add the cursor model to the cursor set again
    this.swarmClient.addReonHook(() => {
      this.cursorSet.addObject(this.cursorModel)
    })
    this.swarmClient.addUnloadHook(() => {
      this.cursorSet.removeObject(this.cursorModel)
      Object.keys(this.trackedCursors).forEach(cursorId => this.unSubscribeRemoteCursor(this.trackedCursors[cursorId]))
      this.cursorSet.off('.init', this.onCursorSetInitialize)
      this.cursorSet.off('.change', this.onCursorSet)
    })

    EditorActions.initializeCursorModel(this.cursorSet, this.cursorModel)

    // setup the initial remote cursors
    this.onCursorSet(spec, value, source)
  },

  onCursorSet(spec, value, source) {   // eslint-disable-line no-unused-vars
    if(spec.op() === 'init') {
      this.foreignCursorSet().forEach(remoteCursorModel => {
        this.subscribeRemoteCursor(remoteCursorModel)
      })
    } else if(spec.op() === 'change') {
      Object.keys(value).forEach(objectSpec => {
        let op = value[objectSpec]
        let remoteCursorModel = this.swarmClient.host.get(objectSpec)
        // ignore set changes to our own cursor
        if(remoteCursorModel._id !== this.cursorId) {
          if(op === 0 && this.trackedCursors[remoteCursorModel._id]) { // delete
            this.unSubscribeRemoteCursor(this.trackedCursors[remoteCursorModel._id])
          } else if(op === 1) { // add
            this.subscribeRemoteCursor(remoteCursorModel)
          }
        }
      })
    }
  },

  subscribeRemoteCursor(remoteCursorModel) {
    let id = remoteCursorModel._id
    let remoteCursor
    // if already subscribed, unsubscribe first (but keep the local color info) --> shouldn't happen but check for it anyway
    if(this.trackedCursors[id]) {
      remoteCursor = this.trackedCursors[id]
      remoteCursor.swarmModel.off('.set', this.onRemoteCursorUpdate)
      remoteCursor.swarmModel = remoteCursorModel
      remoteCursor.internalModel = this._internalModelFromSwarmModel(remoteCursorModel, remoteCursor.internalModel.color)
    } else {
      let usedColors = new Set(Object.keys(this.trackedCursors).map(cursorId => this.trackedCursors[cursorId].color))
      let possibleColors = this.props.cursorColorSpace.filter(c => !usedColors.has(c))
      // re-use colors if none are left
      let color = possibleColors.length > 0 ? possibleColors[0] : usedColors[0]
      let internalModel = this._internalModelFromSwarmModel(remoteCursorModel, color)
      remoteCursor = {
        swarmModel: remoteCursorModel,
        internalModel: internalModel
      }
      this.trackedCursors[id] = remoteCursor
    }
    EditorActions.setRemoteCursorPosition(remoteCursor.internalModel)
    remoteCursorModel.on('.set', this.onRemoteCursorUpdate)
  },

  unSubscribeRemoteCursor(remoteCursor) {
    let id = remoteCursor.swarmModel._id
    // TODO this doesn't work because swarm.js is looking for the function in listener.sink but it is found in listener.sink.sink
    // see https://github.com/gritzko/swarm/blob/master/lib/Syncable.js#L673
    remoteCursor.swarmModel.off('.set', this.onRemoteCursorUpdate)
    let internalModel = this.trackedCursors[id].internalModel
    delete this.trackedCursors[id]
    EditorActions.unsetRemoteCursorPosition(internalModel)
  },

  onRemoteCursorUpdate(spec, value, source) {   // eslint-disable-line no-unused-vars
    let id = source._id
    if(!id || !this.trackedCursors[id]) return

    let internalModel = this._internalModelFromSwarmModel(this.trackedCursors[id].swarmModel,
      this.trackedCursors[id].internalModel.color)

    EditorActions.setRemoteCursorPosition(internalModel)
  },

  foreignCursorSet() {
    return this.cursorSet.list().filter(c => c._id && c._id !== this.cursorId)
  },

  _internalModelFromSwarmModel(swarmModel, color) {
    let internalModel = _.pick(swarmModel, '_id', 'name', 'data', 'ms')
    internalModel.color = color
    return internalModel
  }
}
