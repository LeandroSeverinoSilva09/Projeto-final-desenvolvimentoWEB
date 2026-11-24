// Dashboard convenience: preserve external npm imports, inline the local modules.
import { readFile, writeFile } from 'node:fs/promises'
const modulePath = new URL('../supabase/functions/dispatch-reminders/', import.meta.url)
const timing = await readFile(new URL('../_shared/reminderTiming.ts', modulePath), 'utf8')
const implementation = (await readFile(new URL('dispatch.ts', modulePath), 'utf8'))
  .replace(/^import .*from '\.\.\/_shared\/reminderTiming\.ts'\n/m, '')
  .replace(/^export \{ localParts \} from '\.\.\/_shared\/reminderTiming\.ts'\n/m, '')
const entry = (await readFile(new URL('index.ts', modulePath), 'utf8')).replace("import { dispatchReminders } from './dispatch.ts'\n", '')
const destination = process.argv[2] || '/tmp/medcontrol-dispatch-reminders.ts'
await writeFile(destination, `${timing}\n${implementation}\n${entry}`)
console.log(destination)
