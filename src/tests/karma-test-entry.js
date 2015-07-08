// require all modules ending in "-testb" from the current directory and all subdirectories
var context = require.context("..", true, /-testb$/)
context.keys().forEach(context)
