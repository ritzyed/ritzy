import React from 'react/addons'

import EditorLineContent from './EditorLineContent'
import SelectionOverlay from './SelectionOverlay'

const T = React.PropTypes

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
    return (
      <SelectionOverlay key={selection && selection.color ? selection.color : 'local'} selection={selection}/>
    )
  },

  _renderRemoteSelectionOverlays(remoteSelections) {
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
