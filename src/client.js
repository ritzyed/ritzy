import 'babel/polyfill'
import Ritzy from './ritzy'

// font support is baking (so configuration is left at the OpenSans default)
// the most often used config values are shown below

const config = {
  id: '10',
  fontSize: 18,
  width: 600,
  margin: {horizontal: 30, vertical: 35},
  // userId: ...,
  // userName: ...,
  //renderOptimizations: false,
  debugButtons: true
}

const renderTarget = document.getElementById('content')

let ritzy = new Ritzy(config, renderTarget)

ritzy.on('position-change', function(position) {
  console.log('event: position-change = ', position)
})

ritzy.on('selection-change', function(selection) {
  console.log('event: selection-change = ', selection)
})

ritzy.on('focus-gained', function() {
  console.log('event: focus-gained')
})

ritzy.on('focus-lost', function() {
  console.log('event: focus-lost')
})

ritzy.on('remote-cursor-add', function(remoteCursor) {
  console.log('event: remote-cursor-add', remoteCursor)

ritzy.on('remote-cursor-remove', function(remoteCursor) {
  console.log('event: remote-cursor-remove', remoteCursor)
})

ritzy.on('text-insert', function(atPosition, value, attributes, newPosition) {
  console.log('event: text-insert atPosition=', atPosition, 'value=', value, 'attributes=', attributes, 'newPosition=', newPosition)
})

ritzy.on('text-delete', function(from, to, newPosition) {
  console.log('event: text-delete from=', from, 'to=', to, 'newPosition=', newPosition)
})

ritzy.load((err) => {
  document.getElementById('content').innerHTML = 'Oops, I couldn\'t load the editor:\n\n' + err
})

