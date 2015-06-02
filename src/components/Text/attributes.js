import _ from 'lodash'

export const ATTR = {
  BOLD: 'bold',
  ITALIC: 'italic',
  UNDERLINE: 'underline',
  STRIKETHROUGH: 'strikethrough',
  SUPERSCRIPT: 'superscript',
  SUBSCRIPT: 'subscript'
}

function hasAttribute(attributes, attr) {
  return attributes && attributes[attr]
}

export function hasAttributeFor(attributes) {
  return _.partial(hasAttribute, attributes)
}

export function attributesEqual(attr1, attr2) {
  let normalize = a => _.pick(a, value => value) // pick entries where value exists and is truthy
  return _.isEqual(normalize(attr1), normalize(attr2))
}
