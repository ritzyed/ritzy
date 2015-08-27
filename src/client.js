import 'babel/polyfill'
import Ritzy from './ritzy'

// font support is baking (so configuration is left at the OpenSans default)
// the most often used config values are shown below

const config = {
  id: '10',
  fontSize: 18,
  width: 600,
  marginH: 30,
  marginV: 35,
  // userId: ...,
  // userName: ...,
  //renderOptimizations: false,
  debugButtons: true
}

const renderTarget = document.getElementById('content')

let ritzy = new Ritzy(config, renderTarget)
ritzy.load((err) => {
  document.getElementById('content').innerHTML = 'Oops, I couldn\'t load the editor:\n\n' + err
})
