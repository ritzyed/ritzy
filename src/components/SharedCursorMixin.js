import EditorActions from '../flux/EditorActions'
import { extractInternal } from '../core/CursorModel'

export default {
  createSharedCursor() {
    let Swarm = this.swarmClient.Swarm

    this.cursorId = this.props.id + '_' + this.swarmClient.id
    let cursorSet = new Swarm.CursorSet(this.props.id)

    this.trackedCursors = {}

    cursorSet.on('.init', this.onCursorSetInitialize)
    cursorSet.on('.change', this.onCursorSetChange)
  },

  onCursorSetInitialize(spec, value, source) {   // eslint-disable-line no-unused-vars
    let Swarm = this.swarmClient.Swarm

    this.cursorModel = new Swarm.CursorModel(this.cursorId)
    this.cursorModel.set({
      name: this.props.userName
    })

    source.addObject(this.cursorModel)
    // if we lose connection to the server and then gain it again, add the cursor model to the cursor set again
    this.swarmClient.addReonHook(() => {
      source.addObject(this.cursorModel)
    })
    this.swarmClient.addUnloadHook(() => {
      clearInterval(this.cursorSetVerificationInterval)
      source.removeObject(this.cursorModel)
      Object.keys(this.trackedCursors).forEach(cursorId => this.unSubscribeRemoteCursor(this.trackedCursors[cursorId]))
      source.off('.init', this.onCursorSetInitialize)
      source.off('.change', this.onCursorSetChange)
    })

    EditorActions.initializeCursorModel(source, this.cursorModel)

    // setup the initial remote cursors
    this._foreignCursorSet(source).forEach(remoteCursorModel => {
      this.subscribeRemoteCursor(remoteCursorModel)
    })

    // sometimes the set of remote cursors can get out of sync e.g. maybe events are missed for some reason?
    this.cursorSetVerificationInterval = setInterval(() => {
      let trackedCursorIds = new Set(Object.keys(this.trackedCursors))
      this._foreignCursorSet(source).forEach(remoteCursorModel => {
        if(!trackedCursorIds.has(remoteCursorModel._id)) {
          this.subscribeRemoteCursor(remoteCursorModel)
        } else {
          trackedCursorIds.delete(remoteCursorModel._id)
        }
      })
      // ids do not exist any more in the set
      trackedCursorIds.forEach(id => {
        this.unSubscribeRemoteCursor(this.trackedCursors[id])
      })
    }, 5000)
  },

  onCursorSetChange(spec, value, source) {   // eslint-disable-line no-unused-vars
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
  },

  subscribeRemoteCursor(remoteCursorModel) {
    remoteCursorModel.on('.init', this.onRemoteCursorInit)
    remoteCursorModel.on('.set', this.onRemoteCursorUpdate)
  },

  unSubscribeRemoteCursor(remoteCursor) {
    let id = remoteCursor.swarmModel._id
    // TODO this doesn't work because swarm.js is looking for the function in listener.sink but it is found in listener.sink.sink
    // see https://github.com/gritzko/swarm/blob/master/lib/Syncable.js#L673
    remoteCursor.swarmModel.off('.init', this.onRemoteCursorInit)
    remoteCursor.swarmModel.off('.set', this.onRemoteCursorUpdate)
    let internalModel = this.trackedCursors[id].internalModel
    delete this.trackedCursors[id]
    EditorActions.unsetRemoteCursorPosition(internalModel)
  },

  onRemoteCursorInit(spec, value, source) {   // eslint-disable-line no-unused-vars
    let id = source._id
    let remoteCursor
    // if already subscribed, unsubscribe first (but keep the local color info) --> shouldn't happen but check for it anyway
    if(this.trackedCursors[id]) {
      remoteCursor = this.trackedCursors[id]
      remoteCursor.swarmModel.off('.set', this.onRemoteCursorUpdate)
      remoteCursor.swarmModel = source
      remoteCursor.internalModel = this._internalModelFromSwarmModel(source, remoteCursor.internalModel.color)
    } else {
      let usedColors = new Set(Object.values(this.trackedCursors).map(c => c.internalModel.color))
      let possibleColors = this.props.cursorColorSpace.filter(c => !usedColors.has(c))
      // re-use colors if none are left (should be by oldest idle time)
      let color = possibleColors.length > 0 ? possibleColors[0] : usedColors[0]
      let internalModel = this._internalModelFromSwarmModel(source, color)
      remoteCursor = {
        swarmModel: source,
        internalModel: internalModel
      }
      this.trackedCursors[id] = remoteCursor
    }
    EditorActions.setRemoteCursorPosition(remoteCursor.internalModel)
  },

  onRemoteCursorUpdate(spec, value, source) {   // eslint-disable-line no-unused-vars
    let id = source._id
    if(!id || !this.trackedCursors[id]) return

    let internalModel = this._internalModelFromSwarmModel(this.trackedCursors[id].swarmModel,
      this.trackedCursors[id].internalModel.color)

    EditorActions.setRemoteCursorPosition(internalModel)
  },

  _foreignCursorSet(cursorSet) {
    return cursorSet.list().filter(c => c._id && c._id !== this.cursorId)
  },

  _internalModelFromSwarmModel(swarmModel, color) {
    let internalModel = extractInternal(swarmModel)
    internalModel.color = color
    return internalModel
  }
}
