/**
 * A little module that extracts the API information from doc comments.
 * @type {exports|module.exports}
 */

var fs = require('fs')
var path = require('path')
var espree = require('espree')

var code = fs.readFileSync('./src/ritzy.js', {encode: 'utf8'}).toString()

var ast = espree.parse(code, {
  attachComment: true,
  loc: true,
  ecmaFeatures: {
    arrowFunctions: true,
    blockBindings: true,
    destructuring: true,
    regexYFlag: true,
    regexUFlag: true,
    templateStrings: true,
    binaryLiterals: true,
    octalLiterals: true,
    unicodeCodePointEscapes: true,
    defaultParams: true,
    restParams: true,
    forOf: true,
    objectLiteralComputedProperties: true,
    objectLiteralShorthandMethods: true,
    objectLiteralShorthandProperties: true,
    objectLiteralDuplicateProperties: true,
    generators: true,
    spread: true,
    classes: true,
    modules: true,
    jsx: true,
    globalReturn: true
  }
})

var parseComment = function(comment) {
  // from esdoc (https://github.com/esdoc/esdoc/blob/master/src/Parser/CommentParser.js)
  comment = comment.replace(/\r\n/gm, '\n') // for windows
  comment = comment.replace(/^\t*\s?/gm, '') // remove trailing tab
  comment = comment.replace(/^\*\s?/, '') // remove first '*'
  comment = comment.replace(/ $/, '') // remove last ' '
  comment = comment.replace(/^ *\* ?/gm, '') // remove line head '*'
  if (comment.charAt(0) !== '@')  comment = '@desc ' + comment // auto insert @desc
  comment = comment.replace(/\s*$/, '') // remove tail space.
  comment = comment.replace(/^(@\w+)$/gm, '$1 \\TRUE') // auto insert tag text to non-text tag (e.g. @interface)
  comment = comment.replace(/^(@\w+)\s(.*)/gm, '\\Z$1\\Z$2') // insert separator (\\Z@tag\\Ztext)
  var lines = comment.split('\\Z')

  var tagName = ''
  var tagValue = ''
  var tags = []
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i]
    if (line.charAt(0) === '@') {
      tagName = line
      var nextLine = lines[i + 1]
      if (nextLine.charAt(0) === '@') {
        tagValue = ''
      } else {
        tagValue = nextLine
        i++
      }
      tagValue = tagValue.replace('\\TRUE', '').replace(/^\n/, '').replace(/\n*$/, '')
      var tag = {}
      tag[tagName] = tagValue
      tags.push(tag)
    }
  }
  return tags
}

var apiInfo = ast.body.filter(function(node) {
  return node.type === 'ExportDefaultDeclaration' && node.declaration.id.name === 'RitzyFactory'
})[0].declaration.body.body.filter(function(node) {
  return node.type === 'ClassDeclaration' && node.id.name === 'Ritzy'
})[0].body.body.filter(function(node) {
  return node.type === 'MethodDefinition' && node.leadingComments
}).map(function(node) {
  return {
    name: node.key.name,
    line: node.key.loc.start.line,
    comments: parseComment(node.leadingComments[0].value)
  }
})

var printApiMethod = function(apiMethod) {
  //console.log(metadata)
  //console.log(metadata.comments)
  var docString = '====\n' +
    'https://github.com/ritzyed/ritzy/blob/master/src/ritzy.js#L' + apiMethod.line + '[Ritzy.' + apiMethod.name + ']::\n' +
    apiMethod.comments.filter(function(c) { return c.hasOwnProperty('@desc') })[0]['@desc'] + '\n'

  var params = apiMethod.comments.filter(function(c) { return c.hasOwnProperty('@param') })
  if(params.length > 0) {
    docString += '\nParameters:::\n'
    params.map(function(p) { return p['@param'] }).forEach(function(p) {
      docString += '* ' + p + '\n'
    })
  }

  docString += '====\n'
  return docString
}

var byApiMethod = function(apiDocString) {
  return function(apiMethod) {
    return apiMethod.comments.filter(function(c) {
      return c.hasOwnProperty('@apidoc') && c['@apidoc'] === apiDocString
    }).length > 0
  }
}

var writeSection = function(section, sectionRef, sectionDescription) {
  process.stdout.write('[[' + sectionRef + ']]\n== ' + section + '\n\n' + sectionDescription + '\n\n')
  apiInfo.filter(byApiMethod(section)).map(printApiMethod).forEach(function(apiDoc) {
    process.stdout.write(apiDoc + '\n')
  })
}

process.stdout.write('= Ritzy Editor Client API\n\n')
writeSection('Contents', 'contents', 'The content of the editor can be retrieved by one of the following methods:')
writeSection('Selection', 'selection', 'The current selection can be retrieved by one of the following methods:')
writeSection('Cursors', 'cursor', 'Information about local and remote cursors is available:')
writeSection('Events', 'events', 'The following methods can be used to register listeners for events:')
writeSection('Configuration', 'configuration', 'The following methods can be used to configure the editor after load time:')
