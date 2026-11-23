// Dashboard convenience: preserve external npm imports, inline the local module.
import { readFile, writeFile } from 'node:fs/promises'
const modulePath = new URL('../supabase/functions/dispatch-reminders/', import.meta.url)
const implementation = await readFile(new URL('dispatch.ts', modulePath), 'utf8')
const entry = (await readFile(new URL('index.ts', modulePath), 'utf8')).replace("import { dispatchReminders } from './dispatch.ts'\n", '')
const destination = process.argv[2] || '/tmp/medcontrol-dispatch-reminders.ts'
await writeFile(destination, `${implementation}\n${entry}`)
console.log(destination)
