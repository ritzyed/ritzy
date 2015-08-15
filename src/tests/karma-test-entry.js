// require all modules ending in "-testb" from the current directory and all subdirectories
let context = require.context('..', true, /-testb$/)
context.keys().forEach(context)
