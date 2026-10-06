import { ElMessageBox, type ElMessageBoxOptions } from 'element-plus'

function isUserDismissal(error: unknown) {
  if (error === 'cancel' || error === 'close') return true
  if (!error || typeof error !== 'object' || !('action' in error)) return false
  return error.action === 'cancel' || error.action === 'close'
}

export async function confirmAction(message: string, title: string, options?: ElMessageBoxOptions) {
  try {
    await ElMessageBox.confirm(message, title, options)
    return true
  } catch (error) {
    if (isUserDismissal(error)) return false
    throw error
  }
}

export async function promptRequired(
  message: string,
  title: string,
  options?: ElMessageBoxOptions,
) {
  try {
    const result = await ElMessageBox.prompt(message, title, options)
    return result.value.trim() || null
  } catch (error) {
    if (isUserDismissal(error)) return null
    throw error
  }
}
