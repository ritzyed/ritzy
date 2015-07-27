import 'babel/polyfill'

import React from 'react/addons'
import classNames from 'classnames'
import Spinner from 'react-spinkit'

import EditorActions from '../flux/EditorActions'
import EditorStore from '../flux/EditorStore'
import DebugEditor from './DebugEditor'
import { BASE_CHAR, EOF } from 'RichText'
import { elementPosition, scrollByToVisible } from 'dom'
import TextReplicaMixin from './TextReplicaMixin'
import TextInput from './TextInput'
import {ATTR, hasAttributeFor} from '../core/attributes'
import { charEq, lineContainingChar } from '../core/EditorCommon'
import { sourceOf } from '../core/replica'
import TextFontMetrics from '../core/TextFontMetrics'

// TODO do this as a require or just make it part of the js or make it global?
require('text.less')

const T = React.PropTypes
const nbsp = String.fromCharCode(160)

export default React.createClass({
  propTypes: {
    id: T.number.isRequired,
    fonts: T.shape({
      regular: T.object,
      bold: T.object,
      boldItalic: T.object,
      italic: T.object
    }),
    fontSize: T.number.isRequired,
    minFontSize: T.number.isRequired,
    unitsPerEm: T.number.isRequired,
    width: T.number.isRequired,
    marginH: T.number.isRequired,
    marginV: T.number.isRequired,
    initialFocus: T.bool
  },

  mixins: [TextReplicaMixin],

  getDefaultProps() {
    return {
      initialFocus: true
    }
  },

  getInitialState() {
    return EditorStore.getState()
  },

  componentWillMount() {
    TextFontMetrics.setConfig(this.props)

    this._createReplica()
    EditorActions.initialize(this.props, this.replica)
  },

  componentWillReceiveProps(nextProps) {
    TextFontMetrics.setConfig(this.props)
    EditorActions.initialize(nextProps, this.replica)
  },

  componentDidMount() {
    this.clickCount = 0
    EditorStore.listen(this.onStateChange)
  },

  componentDidUpdate() {
    if(!this.caret) {
      this.caret = React.findDOMNode(this.refs.caret)
    }
    if(this.caret) {
      let scrollByToCursor = scrollByToVisible(this.caret, 5)
      if(scrollByToCursor.xDelta !== 0 || scrollByToCursor.yDelta !== 0) {
        window.scrollBy(scrollByToCursor.xDelta, scrollByToCursor.yDelta)
      }
    }
  },

  componentWillUnmount() {
    EditorStore.unlisten(this.onStateChange)
  },

  onStateChange(state) {
    this.setState(state)
  },

  // todo should the replica stuff be in the store?
  _createReplica() {
    this.createTextReplica(this.props.id)
    this.registerCb(this._replicaInitCb, this._replicaUpdateCb)
  },

  _replicaInitCb(spec, op, replica) {  // eslint-disable-line no-unused-vars
    // set our own replica for future use
    this.replicaSource = sourceOf(spec)
    EditorActions.replicaInitialized()
  },

  _replicaUpdateCb(spec, op, replica) {  // eslint-disable-line no-unused-vars
    if(this.replicaSource === sourceOf(spec)) return
    EditorActions.replicaUpdated()
  },

  _mouseEventToCoordinates(e) {
    // hack: if the user clicks or rolls over their own cursor sometimes that becomes the target element (in browsers
    // that don't support pointer-events: none, like IE < 11): BUT we know the cursor is the current position
    if(e.target.className.indexOf('text-cursor-caret') >= 0) {
      return null
    }

    // target is the particular element within the editor clicked on, current target is the entire editor div
    let targetPosition = elementPosition(e.currentTarget)

    return {
      x: e.pageX - targetPosition.x,
      y: e.pageY - targetPosition.y
    }
  },

  _doOnSingleClick(e) {
    let coordinates = this._mouseEventToCoordinates(e)
    if(!coordinates) {
      return
    }

    if(e.shiftKey) {
      EditorActions.selectToCoordinates(coordinates)
    } else {
      EditorActions.navigateToCoordinates(coordinates)
    }
  },

  _doOnDoubleClick() {
    EditorActions.selectWordAtCurrentPosition()
  },

  _onMouseDown(e) {
    if(!this.state.focus) {
      EditorActions.focusInput()
    }

    if(this.clickReset) {
      clearTimeout(this.clickReset)
      this.clickReset = null
    }
    let clickCount = this.clickCount
    this.clickCount += 1
    this.clickReset = setTimeout(() => {
      this.clickCount = 0
    }, 250)

    if(clickCount === 0) {
      this._doOnSingleClick(e)
    } else if (clickCount === 1) {
      // note that _doOnSingleClick has already executed here
      this._doOnDoubleClick(e)
    } //else if(this.clickCount === 2) // TODO handle triple-click

    e.preventDefault()
    e.stopPropagation()
  },

  _onMouseMove(e) {
    if(!this.state.focus) {
      EditorActions.focusInput()
    }

    if(e.buttons !== 1) return

    let coordinates = this._mouseEventToCoordinates(e)
    if(!coordinates) return

    EditorActions.selectToCoordinates(coordinates)

    e.preventDefault()
    e.stopPropagation()
  },

  // RENDERING ---------------------------------------------------------------------------------------------------------

  _searchLinesWithSelection() {
    if(!this.state.lines || this.state.lines.length === 0 || !this.state.selectionActive) {
      return null
    }

    let left = lineContainingChar(this.state.lines, this.replica.getCharRelativeTo(this.state.selectionLeftChar, 1, 'eof'))
    let right = lineContainingChar(this.state.lines.slice(left.index), this.state.selectionRightChar, null)

    return {
      left: left.index,
      right: right.index + left.index
    }
  },

  _renderSelectionOverlay(lineIndex, lineHeight, linesWithSelection) {
    // lines outside the selection range
    if(!this.state.selectionActive
      || (linesWithSelection && (lineIndex < linesWithSelection.left || lineIndex > linesWithSelection.right))) {
      return null
    }

    let selectionDiv = (leftX, widthX) => {
      let height = Math.round(lineHeight * 10) / 10
      let selectionStyle = {
        top: 0,
        left: leftX,
        width: widthX,
        height: height
      }

      if(!this.state.focus) {
        selectionStyle.borderTopColor = 'rgb(0, 0, 0)'
        selectionStyle.borderBottomColor = 'rgb(0, 0, 0)'
        selectionStyle.backgroundColor = 'rgb(0, 0, 0)'
        selectionStyle.opacity = 0.15
        selectionStyle.color = 'black'
      }

      return (
        <div className="text-selection-overlay text-htmloverlay ui-unprintable text-htmloverlay-under-text"
          style={selectionStyle}></div>
      )
    }

    let line = this.state.lines[lineIndex]

    // middle lines
    if(linesWithSelection && (lineIndex > linesWithSelection.left && lineIndex < linesWithSelection.right)) {
      let selectionWidthX = line.advance
      if(line.isEof() || line.end.char === '\n') {
        selectionWidthX += TextFontMetrics.advanceXForSpace(this.props.fontSize)
      }
      return selectionDiv(0, selectionWidthX)
    }

    // last line with EOF
    if(line && line.isEof() && this.state.selectionRightChar === EOF) {
      return selectionDiv(0, TextFontMetrics.advanceXForSpace(this.props.fontSize))
    }

    // empty editor (no line and selection is from BASE_CHAR to EOF)
    if(!line
      && charEq(this.state.selectionLeftChar, BASE_CHAR)
      && charEq(this.state.selectionRightChar, EOF)) {
      return selectionDiv(0, TextFontMetrics.advanceXForSpace(this.props.fontSize))
    }

    let selectionLeftX = 0
    let selectionWidthX
    let selectionAddSpace

    if(lineIndex === linesWithSelection.left) {
      // TODO change selection height and font size dynamically
      selectionLeftX = TextFontMetrics.advanceXForChars(this.props.fontSize, line.charsTo(this.state.selectionLeftChar))
    }

    if(lineIndex === linesWithSelection.right) {
      let selectionChars = selectionLeftX > 0 ?
        line.charsBetween(this.state.selectionLeftChar, this.state.selectionRightChar) :
        line.charsTo(this.state.selectionRightChar)

      if(selectionChars.length === 0) {
        return null
      }
      selectionWidthX = TextFontMetrics.advanceXForChars(this.props.fontSize, selectionChars)
      selectionAddSpace = selectionChars[selectionChars.length - 1].char === '\n'
    } else {
      selectionWidthX = line.advance - selectionLeftX
      selectionAddSpace = line.isEof() || line.end.char === '\n'
    }

    if(selectionAddSpace) {
      selectionWidthX += TextFontMetrics.advanceXForSpace(this.props.fontSize)
    }

    return selectionDiv(selectionLeftX, selectionWidthX)
  },

  _renderStyledText(id, text, attributes) {
    let hasAttribute = hasAttributeFor(attributes)

    // vertical alignment
    let superscript = hasAttribute(ATTR.SUPERSCRIPT)
    let subscript = hasAttribute(ATTR.SUBSCRIPT)
    let verticalAlign = classNames({
      super: superscript,
      sub: subscript,
      baseline: !(superscript || subscript)
    })

    // font size, weight, style
    let fontSize = TextFontMetrics.fontSizeFromAttributes(this.props.fontSize, attributes)
    let fontWeight = hasAttribute(ATTR.BOLD) ? 'bold' : 'normal'
    let fontStyle = hasAttribute(ATTR.ITALIC) ? 'italic' : 'normal'

    // text-decoration
    let underline = hasAttribute(ATTR.UNDERLINE)
    let strikethrough = hasAttribute(ATTR.STRIKETHROUGH)
    let textDecoration = classNames({
      none: !(underline || strikethrough),
      underline: underline,
      'line-through': strikethrough
    })

    let style = {
      color: '#000000',
      backgroundColor: 'transparent',
      fontFamily: 'Open Sans',  // TODO test other fonts, make the font selectable
      fontSize: fontSize,
      fontWeight: fontWeight,
      fontStyle: fontStyle,
      fontVariant: 'normal',
      textDecoration: textDecoration,
      verticalAlign: verticalAlign
    }

    return (
      <span style={style} key={id}>{text}</span>
    )
  },

  _splitIntoLines() {
    if(!this.state.lines) return []

    return this.state.lines.map(line => line.chunks.map(chunk => {
      let chars = line.chars.slice(chunk.start, chunk.end)
      return this._renderStyledText(chars[0].id, chars.map(c => c.char === ' ' ? nbsp : c.char).join(''), chunk.attributes)
    }))
  },

  _renderLine(line, index, lineHeight, linesWithSelection) {
    let blockHeight = 10000
    let blockTop = TextFontMetrics.top(this.props.fontSize) - blockHeight

    // TODO set lineHeight based on font sizes used in line chunks
    // the span wrapper around the text is required so that the text does not shift up/down when using superscript/subscript
    return (
      <div className="text-lineview" style={{height: lineHeight, direction: 'ltr', textAlign: 'left'}} key={index}>
        {this._renderSelectionOverlay(index, lineHeight, linesWithSelection)}
        <div className="text-lineview-content" style={{marginLeft: 0, paddingTop: 0}}>
          <span style={{display: 'inline-block', height: blockHeight}}></span>
          <span style={{display: 'inline-block', position: 'relative', top: blockTop}}>
            <span key="text" className="editor-inline-block text-lineview-text-block">{line}</span>
          </span>
        </div>
      </div>
    )
  },

  _cursorPosition(lineHeight) {
    // the initial render before the component is mounted has no position or lines
    if (!this.state.position || !this.state.lines) {
      return null
    }

    if(charEq(BASE_CHAR, this.state.position) || this.state.lines.length === 0) {
      return {
        left: this.props.marginH,
        top: this.props.marginV
      }
    }

    let {line, index, endOfLine} = lineContainingChar(this.state.lines, this.state.position, this.state.positionEolStart)
    let previousLineHeights = line ? lineHeight * index : 0

    let cursorAdvanceX

    if(!line || (endOfLine && this.state.positionEolStart && index < this.state.lines.length - 1)) {
      cursorAdvanceX = 0
    } else {
      let positionChars = line.charsTo(this.state.position)
      cursorAdvanceX = TextFontMetrics.advanceXForChars(this.props.fontSize, positionChars)
    }

    return {
      left: this.props.marginH + cursorAdvanceX,
      top: this.props.marginV + previousLineHeights
    }
  },

  _renderInput(cursorPosition) {
    let position = cursorPosition ? cursorPosition.top : 0

    return (
      <TextInput id={this.props.id} ref="input" position={position} focused={this.state.focus}/>
    )
  },

  _renderCursor(cursorPosition, lineHeight) {
    // the initial render before the component is mounted has no position
    if (!cursorPosition) {
      return null
    }

    let cursorClasses = classNames('text-cursor', 'ui-unprintable', {
      'text-cursor-blink': !this.state.cursorMotion
    })

    let italicAtPosition = this.state.position.attributes && this.state.position.attributes[ATTR.ITALIC]
    let italicActive = this.state.activeAttributes && this.state.activeAttributes[ATTR.ITALIC]
    let italicInactive = this.state.activeAttributes && !this.state.activeAttributes[ATTR.ITALIC]

    let caretClasses = classNames('text-cursor-caret', {
      'text-cursor-italic': italicActive || (italicAtPosition && !italicInactive)
    })

    let cursorStyle = {
      left: cursorPosition.left,
      top: cursorPosition.top
    }

    if (this.state.selectionActive || !this.state.focus) {
      cursorStyle.opacity = 0
      cursorStyle.visibility = 'hidden'
    } else {
      cursorStyle.opacity = 1
    }

    let cursorHeight = Math.round(lineHeight * 10) / 10

    return (
      <div className={cursorClasses} style={cursorStyle} key="cursor" ref="cursor">
        <div className={caretClasses} style={{borderColor: 'black', height: cursorHeight}} key="caret" ref="caret"></div>
        <div className="text-cursor-top" style={{opacity: 0, display: 'none'}}></div>
        <div className="text-cursor-name" style={{opacity: 0, display: 'none'}}></div>
      </div>
    )
  },

  _renderEditorContents() {
    if(this.state.loaded) {
      let lines = this._splitIntoLines()
      let lineHeight = TextFontMetrics.lineHeight(this.props.fontSize)
      let cursorPosition = this._cursorPosition(lineHeight)
      let linesWithSelection = this._searchLinesWithSelection()

      return (
        <div>
          {this._renderInput(cursorPosition)}
          <div className="text-contents">
            { lines.length > 0 ?
              lines.map((line, index) => this._renderLine(line, index, lineHeight, linesWithSelection) ) :
              this._renderLine(nbsp, 0, lineHeight)}
          </div>
          {this._renderCursor(cursorPosition, lineHeight)}
        </div>
      )
    } else {
      return (
        <Spinner spinnerName='three-bounce' noFadeIn/>
      )
    }
  },

  render() {
    //console.trace('render')
    let wrapperStyle = {
      width: this.props.width,
      padding: `${this.props.marginV}px ${this.props.marginH}px`
    }

    return (
      <div>
        <div className="text-content-wrapper" style={wrapperStyle} onMouseDown={this._onMouseDown} onMouseMove={this._onMouseMove}>
          {this._renderEditorContents()}
        </div>
        {/*<DebugEditor editorState={this.state} replica={this.replica} searchLinesWithSelection={this._searchLinesWithSelection}/>*/}
      </div>
    )
  }

})
