import {app} from './app'
import {config} from './config'
import {ready} from './db'

await ready()
Bun.serve({port:config.PORT,fetch:app.fetch})
console.info(JSON.stringify({event:'server.start',port:config.PORT}))
