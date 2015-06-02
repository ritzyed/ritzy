import jsdom from 'jsdom'

export default function(markup) {
  if (typeof document !== 'undefined') return
  let doc = jsdom.jsdom(markup || '<html><body></body></html>')
  let window = doc.defaultView

  // forward window console output to the NodeJS console
  jsdom.getVirtualConsole(window).sendTo(console)

  // setup some references our tests might need
  global.document = doc
  global.window = window
  global.navigator = {
    userAgent: 'node.js'
  }
}
