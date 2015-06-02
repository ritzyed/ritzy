'use strict'

require('babel/register')

var noop = function(module, file) {
  module._compile('', file)
}

require.extensions['.css'] = noop
require.extensions['.gif'] = noop
require.extensions['.jpg'] = noop
require.extensions['.less'] = noop
require.extensions['.png'] = noop
require.extensions['.svg'] = noop
