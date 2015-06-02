// http://stackoverflow.com/a/4156156/430128
export function pushArray(arr, arr2) {
  arr.push.apply(arr, arr2)
}
