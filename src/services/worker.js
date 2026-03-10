import { supabase } from './supabase.js'

// ─── Find an available worker (active, alive, not busy) ────────────────────
// Kept for backward-compatible exports used by admin.js and prompts.js
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

// ─── Queue Processor — assign pending prompts to ALL free workers in parallel
//
// HOW IT WORKS:
// 1. Runs every 10s from server.js as a background safety net
// 2. Also runs immediately when: new prompt created, task completes, task retried
// 3. Fetches ALL free alive workers ONCE
// 4. Fetches ALL pending unassigned prompts ONCE (limited to free worker count)
// 5. Pre-pairs each prompt with a unique compatible worker IN MEMORY
//    — this prevents any two prompts from being paired with the same worker
//    — worker_type is checked here: IMAGE/VIDEO/ALL matched correctly
// 6. Then assigns ALL pairs simultaneously using Promise.all (true parallel)
// 7. Each DB update has .is('assigned_tab_id', null) as atomic guard
//    — if two server processes race, only the first wins, second skips safely
// ─────────────────────────────────────────────────────────────────────────────
export async function assignPendingPrompts() {
  const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString()

  // Step 1: Fetch ALL free alive workers at once
  const { data: freeWorkers, error: workerError } = await supabase
    .from('workers')
    .select('*')
    .eq('status', 'active')
    .gte('last_ping', twoMinutesAgo)
    .eq('current_load', 0)
    .order('created_at', { ascending: true })

  if (workerError || !freeWorkers || freeWorkers.length === 0) {
    console.log('[Queue] No free workers available right now')
    return
  }

  // Step 2: Fetch pending unassigned prompts — limit to free worker count
  const { data: pendingPrompts, error: promptError } = await supabase
    .from('prompts')
    .select('id, mode')
    .eq('status', 'pending')
    .is('assigned_tab_id', null)
    .order('created_at', { ascending: true })
    .limit(freeWorkers.length)

  if (promptError || !pendingPrompts || pendingPrompts.length === 0) {
    return
  }

  // Step 3: Pre-pair each prompt with a unique compatible worker IN MEMORY
  // This is done BEFORE going parallel so no two prompts ever get the same worker
  // worker_type matching:
  //   IMAGE prompt → needs worker_type = 'IMAGE' or 'ALL'
  //   VIDEO prompt → needs worker_type = 'VIDEO' or 'ALL'
  const usedWorkerIds = new Set()
  const pairs = []

  for (const prompt of pendingPrompts) {
    // IMAGE_EDIT is treated the same as IMAGE for worker matching
    // So IMAGE and ALL workers can handle IMAGE_EDIT prompts, but VIDEO workers cannot
    const effectiveMode = prompt.mode === 'IMAGE_EDIT' ? 'IMAGE' : prompt.mode
    const worker = freeWorkers.find(w =>
      !usedWorkerIds.has(w.id) &&
      (w.worker_type === effectiveMode || w.worker_type === 'ALL')
    )
    if (!worker) {
      console.log(`[Queue] No compatible free worker for prompt ${prompt.id} (${prompt.mode})`)
      continue
    }
    usedWorkerIds.add(worker.id) // lock this worker — no other prompt can take it
    pairs.push({ prompt, worker })
  }

  if (pairs.length === 0) return

  console.log(`[Queue] ${freeWorkers.length} free workers, ${pendingPrompts.length} pending — assigning ${pairs.length} pairs in parallel`)

  // Step 4: Assign ALL pairs simultaneously — true parallel
  await Promise.all(
    pairs.map(async ({ prompt, worker }) => {
      // Atomic guard: .is('assigned_tab_id', null) ensures if two server
      // processes race, only the first one wins — second does nothing safely
      const { error } = await supabase
        .from('prompts')
        .update({
          assigned_tab_id: worker.tab_id,
          machine_id: worker.machine_id,
          updated_at: new Date().toISOString()
        })
        .eq('id', prompt.id)
        .eq('status', 'pending')
        .is('assigned_tab_id', null)

      if (!error) {
        await markWorkerBusy(worker.id)
        console.log(`[Queue] ✅ prompt ${prompt.id} (${prompt.mode}) → tab ${worker.tab_id}`)
      } else {
        console.log(`[Queue] ⚠️ prompt ${prompt.id} skipped — already assigned`)
      }
    })
  )
}

// ─── Complete a task — update prompt with results and release worker ───────
export async function completeTask({ tab_id, prompt_id, status, output_urls, failure_reason }) {
  const finalStatus = status || 'completed'

  const updateData = {
    status: finalStatus,
    updated_at: new Date().toISOString()
  }

  if (finalStatus === 'completed') {
    updateData.output_urls = output_urls || []
    updateData.download_status = 'not_downloaded'
    updateData.failure_reason = null
  } else if (finalStatus === 'failed') {
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