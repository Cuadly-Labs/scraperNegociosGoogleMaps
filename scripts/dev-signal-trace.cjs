// Diagnóstico local: Next.js sale con código 0 cuando recibe SIGINT/SIGTERM.
// Este preload deja constancia de la señal sin cambiar el comportamiento de Next.
for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
  process.on(signal, () => {
    process.stderr.write(
      `[scrapcrm] ${signal} recibido (pid=${process.pid}, ppid=${process.ppid})\n`,
    )
  })
}

// Next.js ejecuta el servidor HTTP en un proceso hijo. Si ese worker termina
// con código 0, el proceso `next dev` también sale con código 0.
const childProcess = require('node:child_process')
const originalFork = childProcess.fork
const originalKill = childProcess.ChildProcess.prototype.kill
childProcess.ChildProcess.prototype.kill = function (signal) {
  process.stderr.write(
    `[scrapcrm] proceso ${process.pid} llama a child.kill(${signal || 'default'}) sobre pid=${this.pid}\n`,
  )
  return originalKill.call(this, signal)
}

childProcess.fork = function (...args) {
  const child = originalFork.apply(this, args)
  child.on('exit', (code, signal) => {
    process.stderr.write(
      `[scrapcrm] worker next-server terminó (pid=${child.pid}, code=${code}, signal=${signal || 'none'})\n`,
    )
  })
  return child
}

process.on('exit', code => {
  process.stderr.write(`[scrapcrm] proceso dev sale (pid=${process.pid}, code=${code})\n`)
})
