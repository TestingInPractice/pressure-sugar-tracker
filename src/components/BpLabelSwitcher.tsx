import { useBpLabelVariant } from '../hooks/useBpLabelVariant';
import { BP_LABEL_VARIANTS_LIST } from '../logic/bp-labels';

export default function BpLabelSwitcher() {
  const { variant, setVariant } = useBpLabelVariant();
  const currentIndex = BP_LABEL_VARIANTS_LIST.findIndex(item => item.id === variant);

  const handleClick = (k: number) => {
    if (k === currentIndex) return;
    if (Math.abs(k - currentIndex) === 1) {
      setVariant(BP_LABEL_VARIANTS_LIST[k].id);
      return;
    }
    setVariant(BP_LABEL_VARIANTS_LIST[currentIndex + Math.sign(k - currentIndex)].id);
  };

  return (
    <div className="segmented" role="group" aria-label="Обозначения давления">
      <span className="segmented-hint">Обозначения:</span>
      {BP_LABEL_VARIANTS_LIST.map((item, k) => (
        <button
          key={item.id}
          type="button"
          aria-pressed={variant === item.id}
          onClick={() => handleClick(k)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}