'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function createCampaign(data: { name: string; template_id?: string }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false as const, error: 'Not authenticated', data: null }

  const { data: campaign, error } = await supabase
    .from('campaigns')
    .insert({ ...data, user_id: user.id })
    .select()
    .single()

  if (error) return { success: false as const, error: error.message, data: null }

  await supabase.from('activity_logs').insert({
    action: 'campaign_created',
    user_id: user.id,
    details: `Campaign "${data.name}" created`
  })

  revalidatePath('/dashboard/campaigns')
  return { success: true as const, error: null, data: campaign }
}

export async function updateCampaign(id: string, data: { name?: string; template_id?: string | null; status?: string }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false as const, error: 'Not authenticated' }

  const { error } = await supabase
    .from('campaigns')
    .update(data)
    .eq('id', id)

  if (error) return { success: false as const, error: error.message }

  if (data.status === 'running') {
    await supabase.from('activity_logs').insert({
      action: 'campaign_started',
      user_id: user.id,
      details: `Campaign started`
    })
  } else if (data.status === 'paused') {
    await supabase.from('activity_logs').insert({
      action: 'campaign_paused',
      user_id: user.id,
      details: `Campaign paused`
    })
  }

  revalidatePath('/dashboard/campaigns')
  revalidatePath(`/dashboard/campaigns/${id}`)
  return { success: true as const, error: null }
}

export async function deleteCampaign(id: string, name: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false as const, error: 'Not authenticated' }

  const { error } = await supabase
    .from('campaigns')
    .delete()
    .eq('id', id)

  if (error) return { success: false as const, error: error.message }

  revalidatePath('/dashboard/campaigns')
  return { success: true as const, error: null }
}

export async function addContactsToCampaign(campaignId: string, contactIds: string[] | 'all') {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false as const, error: 'Not authenticated' }

  let idsToAdd: string[] = []

  if (contactIds === 'all') {
    const { data: contacts, error: fetchErr } = await supabase
      .from('contacts')
      .select('id')
    if (fetchErr) return { success: false as const, error: fetchErr.message }
    idsToAdd = contacts.map((c: { id: string }) => c.id)
  } else {
    idsToAdd = contactIds
  }

  if (idsToAdd.length === 0) {
    return { success: false as const, error: 'No contacts selected' }
  }

  // 1. Fetch existing contacts in the campaign to avoid duplicate inserts
  const { data: existing, error: fetchErr } = await supabase
    .from('campaign_contacts')
    .select('contact_id')
    .eq('campaign_id', campaignId)

  if (fetchErr) return { success: false as const, error: fetchErr.message }

  const existingIds = new Set((existing || []).map(c => c.contact_id))

  // 2. Filter ids to add that are not already present
  const idsToInsert = idsToAdd.filter(id => !existingIds.has(id))

  if (idsToInsert.length === 0) {
    // If all contacts were duplicates, return success directly
    return { success: true as const, error: null }
  }

  const inserts = idsToInsert.map(id => ({
    campaign_id: campaignId,
    contact_id: id,
    status: 'pending' as const,
    attempts: 0
  }))

  const { error } = await supabase
    .from('campaign_contacts')
    .insert(inserts)

  if (error) return { success: false as const, error: error.message }

  revalidatePath(`/dashboard/campaigns/${campaignId}`)
  return { success: true as const, error: null }
}

export async function removeContactFromCampaign(campaignId: string, contactId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false as const, error: 'Not authenticated' }

  const { error } = await supabase
    .from('campaign_contacts')
    .delete()
    .eq('campaign_id', campaignId)
    .eq('contact_id', contactId)

  if (error) return { success: false as const, error: error.message }

  revalidatePath(`/dashboard/campaigns/${campaignId}`)
  return { success: true as const, error: null }
}
