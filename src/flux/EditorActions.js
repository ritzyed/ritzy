import alt from '../core/alt'

class EditorActions {
  constructor() {
  }

  initialize(config, replica) {
    this.dispatch({config, replica})
  }

  initializeCursorModel(cursorSet, cursorModel) {
    this.dispatch({cursorSet, cursorModel})
  }

  replicaInitialized() {
    this.dispatch()
  }

  replicaUpdated() {
    this.dispatch()
  }

  focusInput() {
    this.dispatch()
  }

  inputFocusLost() {
    this.dispatch()
  }

  reflow() {
    this.dispatch()
  }

  setRemoteCursorPosition(remoteCursor) {
    this.dispatch(remoteCursor)
  }

  unsetRemoteCursorPosition(remoteCursor) {
    this.dispatch(remoteCursor)
  }

  revealRemoteCursorName(remoteCursor) {
    this.dispatch(remoteCursor)
  }

  // navigation actions
  navigateLeft() {
    this.dispatch()
  }

  navigateRight() {
    this.dispatch()
  }

  navigateUp() {
    this.dispatch()
  }

  navigateDown() {
    this.dispatch()
  }

  navigatePageUp() {
    this.dispatch()
  }

  navigatePageDown() {
    this.dispatch()
  }

  navigateStart() {
    this.dispatch()
  }

  navigateStartLine() {
    this.dispatch()
  }

  navigateEnd() {
    this.dispatch()
  }

  navigateEndLine() {
    this.dispatch()
  }

  navigateWordLeft() {
    this.dispatch()
  }

  navigateWordRight() {
    this.dispatch()
  }

  navigateToCoordinates(coordinates) {
    this.dispatch(coordinates)
  }

  // selection actions
  selectionLeft() {
    this.dispatch()
  }

  selectionRight() {
    this.dispatch()
  }

  selectionUp() {
    this.dispatch()
  }

  selectionDown() {
    this.dispatch()
  }

  selectionPageUp() {
    this.dispatch()
  }

  selectionPageDown() {
    this.dispatch()
  }

  selectionStart() {
    this.dispatch()
  }

  selectionStartLine() {
    this.dispatch()
  }

  selectionEnd() {
    this.dispatch()
  }

  selectionEndLine() {
    this.dispatch()
  }

  selectionWordLeft() {
    this.dispatch()
  }

  selectionWordRight() {
    this.dispatch()
  }

  selectionAll() {
    this.dispatch()
  }

  selectToCoordinates(coordinates) {
    this.dispatch(coordinates)
  }

  selectWordAtCurrentPosition() {
    this.dispatch()
  }

  copySelection(copyHandler) {
    this.dispatch(copyHandler)
  }

  insertChars(value, attributes, atPosition) {
    this.dispatch({value, attributes, atPosition})
  }

  insertCharsBatch(chunks) {
    this.dispatch(chunks)
  }

  eraseCharBack() {
    this.dispatch()
  }

  eraseCharForward() {
    this.dispatch()
  }

  eraseWordBack() {
    this.dispatch()
  }

  eraseWordForward() {
    this.dispatch()
  }

  eraseSelection() {
    this.dispatch()
  }

  // toggle attribute actions
  toggleBold() {
    this.dispatch()
  }

  toggleItalics() {
    this.dispatch()
  }

  toggleUnderline() {
    this.dispatch()
  }

  toggleStrikethrough() {
    this.dispatch()
  }

  toggleSuperscript() {
    this.dispatch()
  }

  toggleSubscript() {
    this.dispatch()
  }

  setActiveAttributes() {
    this.dispatch()
  }

  registerEditorError(error) {
    this.dispatch(error)
  }

  dismissEditorError() {
    this.dispatch()
  }
}

export default alt.createActions(EditorActions)
