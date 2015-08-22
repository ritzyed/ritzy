import _ from 'lodash'
import React from 'react/addons'

import EditorLineContent from './EditorLineContent'
import SelectionOverlay from './SelectionOverlay'
import { linesEq } from '../core/EditorCommon'
import ReactUtils from '../core/ReactUtils'

const T = React.PropTypes

export default React.createClass({
  propTypes: {
    line: T.object,
    lineHeight: T.number.isRequired,
    fontSize: T.number.isRequired,
    selection: T.object,
    remoteSelections: T.arrayOf(T.object)
  },

  shouldComponentUpdate(nextProps) {
    // for better performance make sure objects are immutable so that we can do reference equality checks
    let propsEqual = this.props.lineHeight === nextProps.lineHeight
      && this.props.fontSize === nextProps.fontSize
      && ReactUtils.deepEquals(this.props.selection, nextProps.selection)
      && ReactUtils.deepEquals(this.props.remoteSelections, nextProps.remoteSelections)
      && ReactUtils.deepEquals(this.props.line, nextProps.line, linesEq)

    return !propsEqual
  },

  _renderSelectionOverlay(selection) {
    if(!selection) {
      return null
    }
    return (
      <SelectionOverlay key={selection && selection.color ? selection.color : 'local'} selection={selection}/>
    )
  },

  _renderRemoteSelectionOverlays(remoteSelections) {
    if(!remoteSelections) {
      return null
    }
    return remoteSelections.map(s => this._renderSelectionOverlay(s))
  },

  render() {
    //console.trace('render EditorLine')
    return (
      <div className="ritzy-internal-text-lineview text-lineview" style={{height: this.props.lineHeight, direction: 'ltr', textAlign: 'left'}}>
        {this._renderSelectionOverlay(this.props.selection)}
        {this._renderRemoteSelectionOverlays(this.props.remoteSelections)}
        <EditorLineContent fontSize={this.props.fontSize} line={this.props.line}/>
      </div>
    )
  }

})
