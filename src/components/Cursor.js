import React from 'react/addons'
import classNames from 'classnames'

import EditorActions from '../flux/EditorActions'
import { ATTR } from '../core/attributes'
import { scrollByToVisible } from '../core/dom'

const T = React.PropTypes

export default React.createClass({
  propTypes: {
    cursorPosition: T.object.isRequired,
    lineHeight: T.number.isRequired,
    cursorMotion: T.bool,
    activeAttributes: T.object,
    selectionActive: T.bool,
    focus: T.bool,
    remoteNameReveal: T.bool,
    remote: T.object
  },

  //mixins: [React.addons.PureRenderMixin],

  getDefaultProps() {
    return {
      remoteNameReveal: false,
      remote: null
    }
  },

  componentDidUpdate() {
    if(!this.caret) {
      this.caret = React.findDOMNode(this.refs.caret)
    }
    if(this.caret) {
      let scrollByToCursor = scrollByToVisible(this.caret, 5, 30)
      if(scrollByToCursor.xDelta !== 0 || scrollByToCursor.yDelta !== 0) {
        window.scrollBy(scrollByToCursor.xDelta, scrollByToCursor.yDelta)
      }
    }
  },

  _remoteCursorHover(e) {
    EditorActions.revealRemoteCursorName(this.props.remote)

    e.preventDefault()
    e.stopPropagation()
  },

  render() {
    //console.trace('render Cursor', this.props)
    let cursorPosition = this.props.cursorPosition
    let remote = this.props.remote

    // the initial render before the component is mounted has no position
    if (!cursorPosition) {
      return null
    }

    let cursorClasses = classNames('ritzy-internal-text-cursor text-cursor', 'ritzy-internal-ui-unprintable', {
      'ritzy-internal-text-cursor-blink': !this.props.cursorMotion && !remote
    })

    let italicAtPosition = cursorPosition.position.attributes && cursorPosition.position.attributes[ATTR.ITALIC] && !remote
    let italicActive = this.props.activeAttributes && this.props.activeAttributes[ATTR.ITALIC] && !remote
    let italicInactive = this.props.activeAttributes && !this.props.activeAttributes[ATTR.ITALIC] && !remote

    let caretClasses = classNames('ritzy-internal-text-cursor-caret text-cursor-caret', {
      'ritzy-internal-text-cursor-italic': italicActive || (italicAtPosition && !italicInactive)
    })

    let cursorStyle = {
      left: cursorPosition.left,
      top: cursorPosition.top
    }

    if (!remote && (this.props.selectionActive || !this.props.focus)) {
      cursorStyle.opacity = 0
      cursorStyle.visibility = 'hidden'
    } else {
      cursorStyle.opacity = 1
    }

    let cursorHeight = Math.round(this.props.lineHeight * 10) / 10

    if(remote) {
      let cursorTopStyle = {
        backgroundColor: remote.color,
        opacity: 1
      }
      let cursorNameStyle = {
        backgroundColor: remote.color
      }
      if(this.props.remoteNameReveal) {
        cursorTopStyle.display = 'none'
        cursorNameStyle.opacity = 1
      } else {
        cursorNameStyle.opacity = 0
        cursorNameStyle.display = 'none'
      }

      return (
        <div className={cursorClasses} style={cursorStyle}>
          <div className={caretClasses} style={{borderColor: remote.color, height: cursorHeight}} onMouseOver={this._remoteCursorHover}></div>
          <div className="ritzy-internal-text-cursor-top text-cursor-top" style={cursorTopStyle} onMouseOver={this._remoteCursorHover}></div>
          <div className="ritzy-internal-text-cursor-name text-cursor-name" style={cursorNameStyle}>{remote.model.name}</div>
        </div>
      )
    } else {
      return (
        <div className={cursorClasses} style={cursorStyle}>
          <div className={caretClasses} style={{borderColor: 'black', height: cursorHeight}} ref="caret"></div>
          <div className="ritzy-internal-text-cursor-top text-cursor-top" style={{opacity: 1}}></div>
          <div className="ritzy-internal-text-cursor-name text-cursor-name" style={{opacity: 1}}></div>
        </div>
      )
    }
  }

})
