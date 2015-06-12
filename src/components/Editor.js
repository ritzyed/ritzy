import React from 'react/addons'
import EditorContents from './EditorContents'

const T = React.PropTypes

export default React.createClass({
  propTypes: {
    id: T.number.isRequired,
    fonts: T.shape({
      regular: T.object,
      bold: T.object,
      boldItalic: T.object,
      italic: T.object
    }),
    minFontSize: T.number.isRequired,
    unitsPerEm: T.number.isRequired
  },

  //mixins: [React.addons.PureRenderMixin],

  render() {
    // TODO make padding a prop?
    const { id, ...other } = this.props    // eslint-disable-line no-unused-vars
    const margin = 20
    const width = 600
    const height = 800

    return (
      <div className="text-content-wrapper" style={{width: width, height: height, backgroundColor: 'rgb(255, 255, 255)'}}>
        <div style={{padding: '0px ' + margin + 'px'}}>
          <EditorContents id={id} fontSize={18} margin={margin} width={width} {...other} />
        </div>
      </div>
    )
  }

})
