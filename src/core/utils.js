// http://stackoverflow.com/a/4156156/430128
export function pushArray(arr, arr2) {
  arr.push.apply(arr, arr2)
}

export function logInGroup(group, f) {
  if(console.group) console.group(group)
  try {
    f()
  } finally {
    if(console.groupEnd) console.groupEnd()
  }
}
