export function StatusBadge({ status }) {
  const colors = {
    pending:    { bg: 'bg-yellow-100', text: 'text-yellow-900' },
    processing: { bg: 'bg-blue-100', text: 'text-blue-900' },
    completed:  { bg: 'bg-green-100', text: 'text-green-900' },
    failed:     { bg: 'bg-red-100', text: 'text-red-900' }
  }

  const color = colors[status] || colors.pending

  return (
    <span className={`px-2 py-1 rounded-full text-xs font-bold ${color.bg} ${color.text} inline-block`}>
      {status?.toUpperCase()}
    </span>
  )
}
