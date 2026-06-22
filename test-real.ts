import { ensureSystemDefaultTemplate } from './src/lib/email-service'

async function test() {
  const userId = '5800dc08-ab78-41e8-ba3e-7131defe9009'
  console.log('Provisioning for:', userId)
  const id = await ensureSystemDefaultTemplate(userId)
  console.log('Result ID:', id)
}
test()
