interface Props { on: boolean; disabled?: boolean; label?: string; onToggle: (v: boolean) => void }

export default function MasterSwitch({ on, disabled, label = 'Напоминания', onToggle }: Props) {
  return (
    <label className="master-switch">
      <span>{label}</span>
      <input
        type="checkbox"
        role="switch"
        checked={on}
        disabled={disabled}
        onChange={e => onToggle(e.target.checked)}
      />
      <b>{on ? 'вкл' : 'выкл'}</b>
    </label>
  );
}
