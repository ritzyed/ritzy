import React from 'react/addons'
import classNames from 'classnames'
import Spinner from 'react-spinkit'
import _ from 'lodash'

import EditorActions from '../flux/EditorActions'
import EditorStore from '../flux/EditorStore'
import DebugEditor from './DebugEditor'
import { BASE_CHAR, EOF } from 'RichText'
import { elementPosition, scrollByToVisible } from 'dom'
import SwarmClientMixin from './SwarmClientMixin'
import TextReplicaMixin from './TextReplicaMixin'
import SharedCursorMixin from './SharedCursorMixin'
import TextInput from './TextInput'
import {ATTR, hasAttributeFor} from '../core/attributes'
import { charEq, lineContainingChar } from '../core/EditorCommon'
import { sourceOf } from '../core/replica'
import TextFontMetrics from '../core/TextFontMetrics'

require('internal.less')

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
    userId: T.string.isRequired,
    userName: T.string,
    cursorColorSpace: T.arrayOf(T.string), // TODO allow it to be a function as well
    initialFocus: T.bool
  },

  mixins: [SwarmClientMixin, TextReplicaMixin, SharedCursorMixin],

  getDefaultProps() {
    return {
      initialFocus: true,
      // The default cursor color space is a less harsh variation of the 11 Boynton colors:
      // http://alumni.media.mit.edu/~wad/color/palette.html
      // See also:
      // http://stackoverflow.com/a/4382138/430128
      // https://eleanormaclure.files.wordpress.com/2011/03/colour-coding.pdf
      cursorColorSpace: [
        'rgb(29, 105, 20)',   // green
        'rgb(129, 38, 192)',  // purple,
        'rgb(42, 75, 215)',   // blue
        'rgb(41, 208, 208)',  // cyan
        'rgb(173, 35, 35)',   // red
        'rgb(255, 146, 51)',  // orange
        'rgb(129, 197, 122)', // light green
        'rgb(157, 175, 255)', // light blue
        'rgb(255, 205, 243)', // pink
        'rgb(255, 238, 51)',  // yellow
        'rgb(129, 74, 25)'    // brown
      ]
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

  _createReplica() {
    this.createTextReplica()
    this.registerCb(this._replicaInitCb, this._replicaUpdateCb)
  },

  _replicaInitCb(spec, op, replica) {  // eslint-disable-line no-unused-vars
    // set our own replica for future use
    this.replicaSource = sourceOf(spec)
    EditorActions.replicaInitialized()
    this.createSharedCursor()
  },

  _replicaUpdateCb(spec, op, replica) {  // eslint-disable-line no-unused-vars
    if(this.replicaSource === sourceOf(spec)) return
    EditorActions.replicaUpdated()
  },

  _mouseEventToCoordinates(e) {
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
    if(e.buttons !== 1) return

    if(!this.state.focus) {
      EditorActions.focusInput()
    }

    let coordinates = this._mouseEventToCoordinates(e)
    if(!coordinates) return

    EditorActions.selectToCoordinates(coordinates)

    e.preventDefault()
    e.stopPropagation()
  },

  _remoteCursorHover(id, e) {
    EditorActions.revealRemoteCursorName(this.state.remoteCursors[id])

    e.preventDefault()
    e.stopPropagation()
  },

  // RENDERING ---------------------------------------------------------------------------------------------------------

  _searchLinesWithSelection(selection) {
    if(!selection) {
      selection = {
        selectionActive: this.state.selectionActive,
        selectionLeftChar: this.state.selectionLeftChar,
        selectionRightChar: this.state.selectionRightChar
      }
    }

    if(!this.state.lines || this.state.lines.length === 0 || !selection.selectionActive) {
      return null
    }

    let left = lineContainingChar(this.state.lines, this.replica.getCharRelativeTo(selection.selectionLeftChar, 1, 'eof'))
    let right = lineContainingChar(this.state.lines.slice(left.index), selection.selectionRightChar, null)

    return {
      left: left.index,
      right: right.index + left.index
    }
  },

  _renderSelectionOverlay(lineIndex, lineHeight, selection, remote) {
    if(!selection.selectionActive) {
      return null
    }

    let linesWithSelection = this._searchLinesWithSelection(selection)

    // lines outside the selection range
    if(linesWithSelection && (lineIndex < linesWithSelection.left || lineIndex > linesWithSelection.right)) {
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

      // named selection border and bg colors same as cursor, opacity somewhere around 0.15 (then keeps reducing about every second by 0.001), no color attribute
      let setColor
      if(remote) {
        setColor = remote.color
      } else if(!this.state.focus) {
        setColor = 'rgb(0, 0, 0)'
      }

      if(setColor) {
        selectionStyle.borderTopColor = setColor
        selectionStyle.borderBottomColor = setColor
        selectionStyle.backgroundColor = setColor
        selectionStyle.opacity = 0.15
        selectionStyle.color = setColor
      }

      let key
      if(remote) {
        let id = remote.model._id
        key = `selection-${lineIndex}-${id}`
      } else {
        key = `selection-${lineIndex}`
      }

      return (
        <div className="ritzy-internal-text-selection-overlay text-selection-overlay ritzy-internal-text-htmloverlay ritzy-internal-text-htmloverlay-under-text ritzy-internal-ui-unprintable"
          style={selectionStyle} key={key}></div>
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
    if(line && line.isEof() && selection.selectionRightChar === EOF) {
      return selectionDiv(0, TextFontMetrics.advanceXForSpace(this.props.fontSize))
    }

    // empty editor (no line and selection is from BASE_CHAR to EOF)
    if(!line
      && charEq(selection.selectionLeftChar, BASE_CHAR)
      && charEq(selection.selectionRightChar, EOF)) {
      return selectionDiv(0, TextFontMetrics.advanceXForSpace(this.props.fontSize))
    }

    let selectionLeftX = 0
    let selectionWidthX
    let selectionAddSpace

    if(lineIndex === linesWithSelection.left) {
      // TODO change selection height and font size dynamically
      selectionLeftX = TextFontMetrics.advanceXForChars(this.props.fontSize, line.charsTo(selection.selectionLeftChar))
    }

    if(lineIndex === linesWithSelection.right) {
      let selectionChars = selectionLeftX > 0 ?
        line.charsBetween(selection.selectionLeftChar, selection.selectionRightChar) :
        line.charsTo(selection.selectionRightChar)

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

  _renderRemoteSelectionOverlays(lineIndex, lineHeight) {
    return Object.keys(this.state.remoteCursors).filter(id => this.state.remoteCursors[id].model.selectionActive).map(id => {
      let remoteCursor = this.state.remoteCursors[id]
      let remoteSelection = {
        selectionActive: remoteCursor.model.selectionActive,
        selectionLeftChar: remoteCursor.model.selectionLeftChar,
        selectionRightChar: remoteCursor.model.selectionRightChar
      }
      return this._renderSelectionOverlay(lineIndex, lineHeight, remoteSelection, remoteCursor)
    })
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

  _renderLine(line, index, lineHeight) {
    let blockHeight = 10000
    let blockTop = TextFontMetrics.top(this.props.fontSize) - blockHeight
    let selection = {
      selectionActive: this.state.selectionActive,
      selectionLeftChar: this.state.selectionLeftChar,
      selectionRightChar: this.state.selectionRightChar
    }

    // TODO set lineHeight based on font sizes used in line chunks
    // the span wrapper around the text is required so that the text does not shift up/down when using superscript/subscript
    return (
      <div className="ritzy-internal-text-lineview text-lineview" style={{height: lineHeight, direction: 'ltr', textAlign: 'left'}} key={index}>
        {this._renderSelectionOverlay(index, lineHeight, selection)}
        {this._renderRemoteSelectionOverlays(index, lineHeight)}
        <div className="ritzy-internal-text-lineview-content text-lineview-content" style={{marginLeft: 0, paddingTop: 0}}>
          <span style={{display: 'inline-block', height: blockHeight}}></span>
          <span style={{display: 'inline-block', position: 'relative', top: blockTop}}>
            <span key="text" className="ritzy-internal-editor-inline-block ritzy-internal-text-lineview-text-block">{line}</span>
          </span>
        </div>
      </div>
    )
  },

  _cursorPosition(lineHeight, position, positionEolStart) {
    // the initial render before the component is mounted has no position or lines
    if (!position || !this.state.lines) {
      return null
    }

    if(charEq(BASE_CHAR, position) || this.state.lines.length === 0) {
      return {
        position: position,
        positionEolStart: positionEolStart,
        left: this.props.marginH,
        top: this.props.marginV
      }
    }

    let result = lineContainingChar(this.state.lines, position, positionEolStart)
    if(!result) {
      return null
    }
    let {line, index, endOfLine} = result
    let previousLineHeights = line ? lineHeight * index : 0

    let cursorAdvanceX

    if(!line || (endOfLine && positionEolStart && index < this.state.lines.length - 1)) {
      cursorAdvanceX = 0
    } else {
      let positionChars = line.charsTo(position)
      cursorAdvanceX = TextFontMetrics.advanceXForChars(this.props.fontSize, positionChars)
    }

    return {
      position: position,
      positionEolStart: positionEolStart,
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

  _renderCursor(cursorPosition, lineHeight, remote) {
    // the initial render before the component is mounted has no position
    if (!cursorPosition) {
      return null
    }

    let cursorClasses = classNames('ritzy-internal-text-cursor text-cursor', 'ritzy-internal-ui-unprintable', {
      'ritzy-internal-text-cursor-blink': !this.state.cursorMotion && !remote
    })

    let italicAtPosition = cursorPosition.position.attributes && cursorPosition.position.attributes[ATTR.ITALIC]
    let italicActive = this.state.activeAttributes && this.state.activeAttributes[ATTR.ITALIC] && !remote
    let italicInactive = this.state.activeAttributes && !this.state.activeAttributes[ATTR.ITALIC] && !remote

    let caretClasses = classNames('ritzy-internal-text-cursor-caret text-cursor-caret', {
      'ritzy-internal-text-cursor-italic': italicActive || (italicAtPosition && !italicInactive)
    })

    let cursorStyle = {
      left: cursorPosition.left,
      top: cursorPosition.top
    }

    if (!remote && (this.state.selectionActive || !this.state.focus)) {
      cursorStyle.opacity = 0
      cursorStyle.visibility = 'hidden'
    } else {
      cursorStyle.opacity = 1
    }

    let cursorHeight = Math.round(lineHeight * 10) / 10

    if(remote) {
      let id = remote.model._id
      let key = `cursor-${id}`
      let remoteCursorHover = _.partial(this._remoteCursorHover, id)
      let revealName = this.state.remoteNameReveal.indexOf(id) > -1
      let cursorTopStyle = {
        backgroundColor: remote.color,
        opacity: 1
      }
      let cursorNameStyle = {
        backgroundColor: remote.color
      }
      if(revealName) {
        cursorTopStyle.display = 'none'
        cursorNameStyle.opacity = 1
      } else {
        cursorNameStyle.opacity = 0
        cursorNameStyle.display = 'none'
      }

      return (
        <div className={cursorClasses} style={cursorStyle} key={key}>
          <div className={caretClasses} style={{borderColor: remote.color, height: cursorHeight}} onMouseOver={remoteCursorHover}></div>
          <div className="ritzy-internal-text-cursor-top text-cursor-top" style={cursorTopStyle} onMouseOver={remoteCursorHover}></div>
          <div className="ritzy-internal-text-cursor-name text-cursor-name" style={cursorNameStyle}>{remote.model.name}</div>
        </div>
      )
    } else {
      return (
        <div className={cursorClasses} style={cursorStyle} key="cursor" ref="cursor">
          <div className={caretClasses} style={{borderColor: 'black', height: cursorHeight}} key="caret" ref="caret"></div>
          <div className="ritzy-internal-text-cursor-top text-cursor-top" style={{opacity: 1}}></div>
          <div className="ritzy-internal-text-cursor-name text-cursor-name" style={{opacity: 1}}></div>
        </div>
      )
    }
  },

  _renderRemoteCursors(lineHeight) {
    return Object.keys(this.state.remoteCursors).filter(id => this.state.remoteCursors[id].model.position).map(id => {
      let remoteCursor = this.state.remoteCursors[id]
      let remotePosition
      try {
        remotePosition = this.replica.getChar(remoteCursor.model.position)
      } catch (e) {
        console.warn('Error obtaining remote position, ignoring.', e)
        return null
      }
      let cursorPosition = this._cursorPosition(lineHeight, remotePosition, remoteCursor.model.positionEolStart)
      return this._renderCursor(cursorPosition, lineHeight, remoteCursor)
    })
  },

  _renderEditorContents() {
    if(this.state.loaded) {
      let lines = this._splitIntoLines()
      let lineHeight = TextFontMetrics.lineHeight(this.props.fontSize)
      let cursorPosition = this._cursorPosition(lineHeight, this.state.position, this.state.positionEolStart)

      return (
        <div>
          {this._renderInput(cursorPosition)}
          <div className="ritzy-internal-text-contents text-contents" style={{position: 'relative'}}>
            { lines.length > 0 ?
              lines.map((line, index) => this._renderLine(line, index, lineHeight) ) :
              this._renderLine(nbsp, 0, lineHeight)}
          </div>
          {this._renderCursor(cursorPosition, lineHeight)}
          {this._renderRemoteCursors(lineHeight)}
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
        <div className="ritzy-internal-text-content-wrapper text-content-wrapper"
          style={wrapperStyle} onMouseDown={this._onMouseDown} onMouseMove={this._onMouseMove}>
          {this._renderEditorContents()}
        </div>
        {/*<DebugEditor editorState={this.state} replica={this.replica} searchLinesWithSelection={this._searchLinesWithSelection}/>*/}
        <DebugEditor editorState={this.state} replica={this.replica} searchLinesWithSelection={this._searchLinesWithSelection}/>
      </div>
    )
  }

})
