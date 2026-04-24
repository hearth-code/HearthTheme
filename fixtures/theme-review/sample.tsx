type VaultRecord = {
  id: number
  label: string
  status: "stable" | "warning" | "offline"
}

const records: VaultRecord[] = [
  { id: 101, label: "Hydroponics", status: "stable" },
  { id: 204, label: "Relay tower", status: "warning" },
]

export function SignalPanel({ selectedId }: { selectedId: number }) {
  const selected = records.find((record) => record.id === selectedId)

  if (!selected) {
    return <p data-status="offline">No signal</p>
  }

  return (
    <section className="signal-panel">
      <h2>{selected.label}</h2>
      <button type="button" onClick={() => console.log(selected.status)}>
        Inspect {selected.id}
      </button>
    </section>
  )
}
