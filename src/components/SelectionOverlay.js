import _ from 'lodash'
import React from 'react/addons'

const T = React.PropTypes

export default React.createClass({
  propTypes: {
    selection: T.object
  },

  shouldComponentUpdate(nextProps) {
    let propsEqual = Object.is(this.props.selection, nextProps.selection) || _.isEqual(this.props.selection, nextProps.selection)
    return !propsEqual
  },

  render() {
    //console.trace('render SelectionOverlay')
    let selection = this.props.selection
    if(!selection) {
      return null
    }

    let selectionStyle = {
      top: 0,
      left: selection.left,
      width: selection.width,
      height: selection.height
    }

    if(selection.color) {
      selectionStyle.borderTopColor = selection.color
      selectionStyle.borderBottomColor = selection.color
      selectionStyle.backgroundColor = selection.color
      selectionStyle.opacity = 0.15
      selectionStyle.color = selection.color
    }

    return (
      <div className="ritzy-internal-text-selection-overlay text-selection-overlay ritzy-internal-text-htmloverlay ritzy-internal-text-htmloverlay-under-text ritzy-internal-ui-unprintable"
        style={selectionStyle}></div>
    )
  }

})
