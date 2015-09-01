import React from 'react/addons'

import EditorActions from '../flux/EditorActions'
import EditorStore from '../flux/EditorStore'
import { BASE_CHAR } from '../core/RichText'
import { lineContainingChar } from '../core/EditorCommon'
import { logInGroup } from '../core/utils'

const T = React.PropTypes

export default React.createClass({
  propTypes: {
    editorState: T.object,
    replica: T.object,
    searchLinesWithSelection: T.func,
    setRenderOptimizations: T.func
  },

  getInitialState() {
    return {
      autotypeText: ''
    }
  },

  componentWillReceiveProps(nextProps) {
    this.edState = nextProps.editorState
    this.replica = nextProps.replica
  },

  shouldComponentUpdate(nextProps, nextState) {
    return this.state.autotypeSeconds !== nextState.autotypeSeconds
      || this.state.autotypeMinutes !== nextState.autotypeMinutes
      || this.state.autotypeText !== nextState.autotypeText
  },

  _dumpState() {
    console.debug('Current state contents (Use React Devtools 0.14+ for real-time state view/edit):')
    console.dir(this.edState)
    EditorActions.focusInput()
  },

  _dumpReplica() {
    let text = this.replica.getTextRange(BASE_CHAR)
    console.debug('Current replica text: [' + text.map(c => c.char).join('') + ']')
    console.debug('BASE_CHAR:')
    console.dir(this.replica.getCharAt(0))
    console.debug('Current replica contents:')
    console.dir(text)
    EditorActions.focusInput()
  },

  _dumpPosition() {
    if(this.edState.position) {
      console.debug('Current position:', this.edState.position, 'positionEolStart:', this.edState.positionEolStart)
    } else {
      console.debug('No active position')
    }
    EditorActions.focusInput()
  },

  _dumpCurrentLine() {
    logInGroup('Line debug', () => {
      if(this.edState.lines) {
        let printLine = l => console.debug(l.toString())

        let currentLine = lineContainingChar(this.edState.lines, this.edState.position, this.edState.positionEolStart)
        if(!currentLine) {
          console.log(null)
        } else {
          if (currentLine.index > 0) {
            logInGroup('Before', () => {
              printLine(this.edState.lines[currentLine.index - 1])
            })
          }
          logInGroup('Current', () => {
            console.debug('index', currentLine.index, 'endOfLine', currentLine.endOfLine)
            printLine(currentLine.line)
          })
          if (currentLine.index < this.edState.lines.length - 1) {
            logInGroup('After', () => {
              printLine(this.edState.lines[currentLine.index + 1])
            })
          }
        }
      } else {
        console.debug('No lines')
      }
    })
    EditorActions.focusInput()
  },

  _dumpLines() {
    if(this.edState.lines) {
      console.debug('Lines as Objects:', this.edState.lines)
      this._dumpLinesFormatted('Lines', this.edState.lines)
    } else {
      console.debug('No lines')
    }
    EditorActions.focusInput()
  },

  _dumpSelection() {
    if(this.edState.selectionActive) {
      console.debug('Current selection contents (rich chunks): [' + JSON.stringify(EditorStore.getSelectionRich()) + ']')
      console.debug('Current selection contents (plain): [' + EditorStore.getSelectionText() + ']')
      console.debug('Current selection contents (html): [' + EditorStore.getSelectionHtml() + ']')
      console.debug('Left=', this.edState.selectionLeftChar)
      console.debug('Right=', this.edState.selectionRightChar)
      console.debug('Anchor=', this.edState.selectionAnchorChar)
      console.debug('Chars=', EditorStore.getSelection())
    } else {
      console.debug('No active selection')
    }
    EditorActions.focusInput()
  },

  _dumpLinesWithSelection() {
    let linesWithSelection = this.props.searchLinesWithSelection()
    if(linesWithSelection) {
      let lines = this.edState.lines.slice(linesWithSelection.left, linesWithSelection.right + 1)
      console.debug('Lines with selection as Objects:', lines)
      this._dumpLinesFormatted('Lines with selection', lines)
    } else {
      console.debug('No selected lines')
    }
    EditorActions.focusInput()
  },

  _dumpLinesFormatted(logText, lines) {
    logInGroup(logText, () => {
      for(let i = 0; i < lines.length; i++) {
        logInGroup(`Index ${i}`, () => {  // eslint-disable-line no-loop-func
          console.debug(lines[i].toString())
        })
      }
    })
  },

  _forceFlow() {
    EditorActions.replicaUpdated()
    EditorActions.focusInput()
  },

  _forceRender() {
    this.forceUpdate(() => console.debug('Render done.'))
    EditorActions.focusInput()
  },

  _togglePositionEolStart() {
    // state should only be set from the store, but for debugging this is fine
    this.setState(previousState => {
      let previous = previousState.positionEolStart
      console.debug('Toggling positionEolStart from ' + previous + ' to ' + !previous)
      return { positionEolStart: !previous }
    })
    EditorActions.focusInput()
  },

  _testError() {
    let err = new Error('A test error from DebugEditor')
    EditorActions.registerEditorError(err)
  },

  _renderOptimizationsEnable() {
    this.props.setRenderOptimizations(true)
  },

  _renderOptimizationsDisable() {
    this.props.setRenderOptimizations(false)
  },

  _scheduleAutotype() {
    function at(minutes, seconds, cb) {
      (function loop() {
        let now = new Date()
        if (now.getMinutes() === minutes) {
          if(now.getSeconds() >= seconds) {
            cb()
          } else {
            let delay = 1000 - (new Date() % 1000)
            setTimeout(loop, delay)
          }
        } else {
          let delay = 60000 - (new Date() % 60000)
          setTimeout(loop, delay)
        }
      })()
    }

    let text = this.state.autotypeText.split('')
    if(text.length === 0 || !this.state.autotypeMinutes || !this.state.autotypeSeconds) {
      console.debug('No autotype, invalid input.')
      return
    }
    console.debug(`Scheduling autotype of chars [${text}] @ ${this.state.autotypeMinutes} minutes, ${this.state.autotypeSeconds} seconds.`)
    at(this.state.autotypeMinutes, this.state.autotypeSeconds, () => {
      // if there is any debug logging it will be grouped
      logInGroup(`Autotyping text ${text}`, () => {
        // auto-type one char at a time for the hardest concurrency test possible
        for(let i = 0; i < text.length; i++) {
          EditorActions.insertChars(text[i])
        }
      })
    })
    EditorActions.focusInput()
  },

  _onChangeAutotypeText(e) {
    this.setState({autotypeText: e.target.value})
  },

  _onChangeAutotypeMinutes(e) {
    let value = parseInt(e.target.value)
    if(!Number.isNaN(value)) {
      this.setState({autotypeMinutes: parseInt(e.target.value)})
    }
  },

  _onChangeAutotypeSeconds(e) {
    let value = parseInt(e.target.value)
    if(!Number.isNaN(value)) {
      this.setState({autotypeSeconds: parseInt(e.target.value)})
    }
  },

  render() {
    return (
      <div style={{position: 'relative', zIndex: 100, paddingTop: 30}}>
        <p>Debugging tools:</p>
        <span>Dump:&nbsp;</span>
        <button onClick={this._dumpState}>State</button>&nbsp;
        <button onClick={this._dumpReplica}>Replica</button>&nbsp;
        <button onClick={this._dumpPosition}>Position</button>&nbsp;
        <button onClick={this._dumpCurrentLine}>Line</button>&nbsp;
        <button onClick={this._dumpLines}>All Lines</button>&nbsp;
        <button onClick={this._dumpSelection}>Selection</button>&nbsp;
        <button onClick={this._dumpLinesWithSelection}>Lines with Selection</button><br/>
        <span>Force:&nbsp;</span>
        <button onClick={this._forceRender}>Render</button>&nbsp;
        <button onClick={this._forceFlow}>Flow</button><br/>
        <span>Action:&nbsp;</span>
        <button onClick={this._togglePositionEolStart}>Toggle Position EOL Start</button>&nbsp;
        <button onClick={this._testError}>Raise an Error</button><br/>
        <span>Autotype:&nbsp;</span>
          <input type='text' value={this.state.autotypeText} size='30' onChange={this._onChangeAutotypeText}/><span>&nbsp;@&nbsp;</span>
          <input type='text' value={this.state.autotypeMinutes} size='3' onChange={this._onChangeAutotypeMinutes}/><span>:</span>
          <input type='text' value={this.state.autotypeSeconds} size='3' onChange={this._onChangeAutotypeSeconds}/><span>&nbsp;(min:sec)&nbsp;</span>
          <button onClick={this._scheduleAutotype}>Schedule It!</button><br/>
        <span>Render Optimizations:&nbsp;</span>
        <button onClick={this._renderOptimizationsEnable}>Enable</button>&nbsp;
        <button onClick={this._renderOptimizationsDisable}>Disable</button><br/>
      </div>
    )
  }

})
