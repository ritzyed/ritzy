import { assert } from 'chai'
import _ from 'lodash'
import ReactUtils from '../ReactUtils'

describe('React utils', () => {
  it('deep equals compares nulls, Nans, and undefined', () => {
    let nullVar = null
    let undefinedVar
    let nanVar = NaN

    assert.isTrue(ReactUtils.deepEquals(nullVar, nullVar))
    assert.isTrue(ReactUtils.deepEquals(undefinedVar, undefinedVar))
    assert.isTrue(ReactUtils.deepEquals(nanVar, nanVar))
    assert.isFalse(ReactUtils.deepEquals(nullVar, undefinedVar))
    assert.isFalse(ReactUtils.deepEquals(nullVar, nanVar))
    assert.isFalse(ReactUtils.deepEquals(undefinedVar, nanVar))
  })

  it('compares the same object instances', () => {
    let foo1 = {bar: 0}
    //noinspection UnnecessaryLocalVariableJS
    let foo2 = foo1

    assert.isTrue(ReactUtils.deepEquals(foo1, foo2))
  })

  it('compares mutated object instances', () => {
    let foo1 = {bar: 0}
    let foo2 = foo1
    foo2.bar = 1

    assert.isTrue(ReactUtils.deepEquals(foo1, foo2))
  })

  it('compares specific properties that are primitives', () => {
    let foo1 = {
      a: 0,
      b: 1,
      c: 2
    }
    let foo2 = {
      a: 1,
      b: 1,
      c: 3
    }

    assert.isFalse(ReactUtils.deepEquals(foo1, foo2))
    assert.isFalse(ReactUtils.deepEquals(foo1, foo2, _.isEqual, [o => o.a, o => o.b]))
    assert.isTrue(ReactUtils.deepEquals(foo1, foo2, _.isEqual, [o => o.b]))
  })

  it('compares specific properties that are objects', () => {
    let foo1 = {
      a: { x: 0, y: 0 },
      b: { x: 0, y: 1 },
      c: { x: 1, y: 0 }
    }
    let foo2 = {
      a: { x: 0, y: 1 },
      b: { x: 0, y: 1 },
      c: { x: 1, y: 0 }
    }

    assert.isFalse(ReactUtils.deepEquals(foo1, foo2))
    assert.isFalse(ReactUtils.deepEquals(foo1, foo2, _.isEqual, [o => o.a, o => o.b]))
    assert.isTrue(ReactUtils.deepEquals(foo1, foo2, _.isEqual, [o => o.b]))
    assert.isTrue(ReactUtils.deepEquals(foo1, foo2, _.isEqual, [o => o.a.x, o => o.b.x]))
  })

  it('compares objects using a provided equality function', () => {
    let foo1 = 'bar'
    let foo2 = 'baz'
    let foo3 = 'gaz'

    assert.isFalse(ReactUtils.deepEquals(foo1, foo2))
    assert.isFalse(ReactUtils.deepEquals(foo2, foo3))
    assert.isFalse(ReactUtils.deepEquals(foo1, foo3))


    let compareIgnoreFirst = (o1, o2) => o1.substring(1) === o2.substring(1)
    assert.isFalse(ReactUtils.deepEquals(foo1, foo2, compareIgnoreFirst))
    assert.isFalse(ReactUtils.deepEquals(foo1, foo3, compareIgnoreFirst))
    assert.isTrue(ReactUtils.deepEquals(foo2, foo2, compareIgnoreFirst))
  })

})
