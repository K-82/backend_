import { supabase } from './supabase.js'

// ─── Find an available worker (active, alive, not busy) ────────────────────
export async function findAvailableWorker(mode = 'IMAGE') {
  const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString()

  const { data: workers, error } = await supabase
    .from('workers')
    .select('*')
    .eq('status', 'active')
    .gte('last_ping', twoMinutesAgo)
    .in('worker_type', [mode, 'ALL'])
    .eq('current_load', 0)
    .order('created_at', { ascending: true })
    .limit(1)

  if (error || !workers || workers.length === 0) {
    return null
  }

  return workers[0]
}

// ─── Mark a worker as busy (current_load = 1) ─────────────────────────────
export async function markWorkerBusy(workerId) {
  await supabase
    .from('workers')
    .update({ current_load: 1 })
    .eq('id', workerId)
}

// ─── Release a worker after task completes, then process queue ─────────────
export async function releaseWorker(tabId) {
  await supabase
    .from('workers')
    .update({ current_load: 0 })
    .eq('tab_id', tabId)

  // Immediately try to assign next queued task
  await assignPendingPrompts()
}

// ─── Queue Processor — assign pending prompts to free workers ──────────────
export async function assignPendingPrompts() {
  // Get all unassigned pending prompts, oldest first
  const { data: pendingPrompts, error: promptError } = await supabase
    .from('prompts')
    .select('id, mode')
    .eq('status', 'pending')
    .is('assigned_tab_id', null)
    .order('created_at', { ascending: true })

  if (promptError || !pendingPrompts || pendingPrompts.length === 0) {
    return
  }

  for (const prompt of pendingPrompts) {
    const worker = await findAvailableWorker(prompt.mode)

    if (!worker) {
      // No more free workers, remaining prompts stay in queue
      console.log(`[Queue] No free workers available, ${pendingPrompts.length} prompts waiting`)
      break
    }

    // Assign the prompt to this worker
    const { error: updateError } = await supabase
      .from('prompts')
      .update({
        assigned_tab_id: worker.tab_id,
        machine_id: worker.machine_id,
        updated_at: new Date().toISOString()
      })
      .eq('id', prompt.id)
      .eq('status', 'pending')
      .is('assigned_tab_id', null)

    if (!updateError) {
      // Mark worker as busy
      await markWorkerBusy(worker.id)
      console.log(`[Queue] Assigned prompt ${prompt.id} to tab ${worker.tab_id}`)
    }
  }
}

// ─── Complete a task — update prompt with results and release worker ───────
export async function completeTask({ tab_id, prompt_id, status, output_urls, failure_reason }) {
  const finalStatus = status || 'completed'

  // Build the update object
  const updateData = {
    status: finalStatus,
    updated_at: new Date().toISOString()
  }

  if (finalStatus === 'completed') {
    updateData.output_urls = output_urls || []
    updateData.download_status = 'not_downloaded'
    updateData.failure_reason = null
  } else if (finalStatus === 'failed') {
    // Set failure reason message from the worker/DB
    updateData.failure_reason = failure_reason || 'Generation failed — unknown error'
    updateData.output_urls = []
  }

  const { data, error } = await supabase
    .from('prompts')
    .update(updateData)
    .eq('id', prompt_id)
    .eq('assigned_tab_id', tab_id)
    .select()
    .single()

  if (error) {
    console.error(`[Queue] Failed to complete prompt ${prompt_id}:`, error.message)
    return { success: false, error: error.message }
  }

  // Release the worker so it can pick up the next task
  await releaseWorker(tab_id)
  console.log(`[Queue] Prompt ${prompt_id} ${finalStatus} by tab ${tab_id}`)

  return { success: true, data }
}

// ─── Retry a failed prompt — reset it back into the queue ──────────────────
export async function retryPrompt(promptId) {
  const { data, error } = await supabase
    .from('prompts')
    .update({
      status: 'pending',
      assigned_tab_id: null,
      machine_id: null,
      failure_reason: null,
      output_urls: [],
      updated_at: new Date().toISOString()
    })
    .eq('id', promptId)
    .select()
    .single()

  if (error) {
    return { success: false, error: error.message }
  }

  // Try to assign immediately
  await assignPendingPrompts()

  return { success: true, data }
}

// ─── Keep backward-compatible exports ──────────────────────────────────────
// These are used by prompts.js and admin.js — kept so imports don't break
export const assignWorker = findAvailableWorker
export async function incrementWorkerLoad(workerId) {
  await markWorkerBusy(workerId)
}
