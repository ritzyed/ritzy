import _ from 'lodash'

function deepEquals(obj1, obj2, equalsFunc, propertyAccessors) {
  if(!obj1) {
    return Object.is(obj1, obj2)
  }

  if(!equalsFunc) {
    equalsFunc = _.isEqual
  }

  if(propertyAccessors) {
    for(let i = 0; i < propertyAccessors.length; i++) {
      let f = propertyAccessors[i]
      if(!equalsFunc(f(obj1), f(obj2))) return false
    }
    return true
  } else {
    return equalsFunc(obj1, obj2)
  }
}

export default {
  deepEquals: deepEquals
}
