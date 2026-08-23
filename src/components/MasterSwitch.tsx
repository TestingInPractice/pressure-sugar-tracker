interface Props { on: boolean; disabled?: boolean; onToggle: (v: boolean) => void }

export default function MasterSwitch({ on, disabled, onToggle }: Props) {
  return (
    <label className="master-switch">
      <span>Напоминания</span>
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
