import React from 'react/addons'
import classNames from 'classnames'

import {ATTR, hasAttributeFor} from '../core/attributes'
import TextFontMetrics from '../core/TextFontMetrics'

const T = React.PropTypes
const nbsp = String.fromCharCode(160)

export default React.createClass({
  propTypes: {
    line: T.object,
    lineHeight: T.number.isRequired,
    fontSize: T.number.isRequired,
    selection: T.object,
    remoteSelections: T.arrayOf(T.object)
  },

  //mixins: [React.addons.PureRenderMixin],

  _renderSelectionOverlay(selection) {
    if(!selection) {
      return null
    }

    let selectionStyle = {
      top: 0,
      left: selection.left,
      width: selection.width,
      height: selection.height
    }

    let key

    if(selection.color) {
      selectionStyle.borderTopColor = selection.color
      selectionStyle.borderBottomColor = selection.color
      selectionStyle.backgroundColor = selection.color
      selectionStyle.opacity = 0.15
      selectionStyle.color = selection.color
      key = selection.color
    } else {
      key = 'local'
    }

    return (
      <div key={key} className="ritzy-internal-text-selection-overlay text-selection-overlay ritzy-internal-text-htmloverlay ritzy-internal-text-htmloverlay-under-text ritzy-internal-ui-unprintable"
        style={selectionStyle}></div>
    )
  },

  _renderRemoteSelectionOverlays(remoteSelections) {
    return remoteSelections.map(s => this._renderSelectionOverlay(s))
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

  _splitIntoChunks(line) {
    if(!line) return []

    return line.chunks.map(chunk => {
      let chars = line.chars.slice(chunk.start, chunk.end)
      return this._renderStyledText(chars[0].id, chars.map(c => c.char === ' ' ? nbsp : c.char).join(''), chunk.attributes)
    })
  },

  render() {
    //console.trace('render EditorLine')
    let lineHeight = this.props.lineHeight
    let line = this.props.line
    let selection = this.props.selection
    let remoteSelections = this.props.remoteSelections

    let blockHeight = 10000
    let blockTop = TextFontMetrics.top(this.props.fontSize) - blockHeight

    return (
      <div className="ritzy-internal-text-lineview text-lineview" style={{height: lineHeight, direction: 'ltr', textAlign: 'left'}}>
        {this._renderSelectionOverlay(selection)}
        {this._renderRemoteSelectionOverlays(remoteSelections)}
        <div className="ritzy-internal-text-lineview-content text-lineview-content" style={{marginLeft: 0, paddingTop: 0}}>
          <span style={{display: 'inline-block', height: blockHeight}}></span>
          <span style={{display: 'inline-block', position: 'relative', top: blockTop}}>
            <span key="text" className="ritzy-internal-editor-inline-block ritzy-internal-text-lineview-text-block">{this._splitIntoChunks(line)}</span>
          </span>
        </div>
      </div>
    )
  }

})
