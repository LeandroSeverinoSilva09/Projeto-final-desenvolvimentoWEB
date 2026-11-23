import * as webpush from 'web-push'
import { randomBytes } from 'node:crypto'
const keys = webpush.generateVAPIDKeys()
console.log(JSON.stringify({ VAPID_PUBLIC_KEY: keys.publicKey, VAPID_PRIVATE_KEY: keys.privateKey, CRON_SECRET: randomBytes(32).toString('hex') }, null, 2))
