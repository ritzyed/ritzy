import React from 'react/addons'
import EditorContents from './EditorContents'

const T = React.PropTypes

// TODO most of these props this should go away, EditorContents should go away and become Editor
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
    margin: T.number.isRequired,
    initialFocus: T.bool
  },

  //mixins: [React.addons.PureRenderMixin],

  render() {
    // TODO make padding a prop?
    return (
      <div className="text-content-wrapper" style={{width: this.props.width, backgroundColor: 'rgb(255, 255, 255)', padding: `0px ${this.props.margin}px`}}>
        <EditorContents {...this.props} />
      </div>
    )
  }

})
