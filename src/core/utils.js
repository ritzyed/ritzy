import invariant from 'react/lib/invariant'

// http://stackoverflow.com/a/4156156/430128
export function pushArray(arr, arr2) {
  arr.push.apply(arr, arr2)
}

export function pushSet(set1, set2) {
  invariant(set2, 'Set to push into must be defined.')
  if(!set1) return
  for(let value of set1) {
    set2.add(value)
  }
}

export function setIntersection(set1, set2) {
  if(!set1 || !set2) return []
  return [...set1].filter(x => set2.has(x))
}

export function logInGroup(group, f) {
  if(console.group) console.group(group)
  try {
    f()
  } finally {
    if(console.groupEnd) console.groupEnd()
  }
}
