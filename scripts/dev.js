const { spawn } = require('node:child_process')
const path = require('node:path')

const projectRoot = path.resolve(__dirname, '..')
const node = process.execPath
const services = [
  {
    name: 'API',
    cwd: path.join(projectRoot, 'server'),
    args: [path.join(projectRoot, 'server', 'src', 'index.js')],
  },
  {
    name: 'Storefront',
    cwd: path.join(projectRoot, 'client'),
    args: [
      path.join(projectRoot, 'client', 'node_modules', 'vite', 'bin', 'vite.js'),
      '--host', '127.0.0.1', '--strictPort', '--port', '5174',
    ],
  },
]

let stopping = false
const children = services.map((service) => {
  const child = spawn(node, service.args, {
    cwd: service.cwd,
    stdio: 'inherit',
    env: process.env,
  })

  child.once('error', (error) => {
    console.error(`[${service.name}] could not start: ${error.message}`)
    stop(1)
  })
  child.once('exit', (code, signal) => {
    if (stopping) return
    const reason = signal ? `signal ${signal}` : `exit code ${code}`
    console.error(`[${service.name}] stopped unexpectedly (${reason}); stopping the other service.`)
    stop(code || 1)
  })
  return child
})

function stop(exitCode = 0) {
  if (stopping) return
  stopping = true
  process.exitCode = exitCode
  for (const child of children) {
    if (child.exitCode === null && child.signalCode === null) child.kill()
  }
}

process.on('SIGINT', () => stop(0))
process.on('SIGTERM', () => stop(0))

console.log('Starting TECHWISE API on port 4000 and storefront on port 5174.')
console.log('Press Ctrl+C once to stop both services.')
