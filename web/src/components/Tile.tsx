import Icon, { type IconName } from "./Icon";

export default function Tile({ icon, label, value, note, tone }: { icon: IconName; label: string; value: string; note: string; tone?: "good" }) {
  return (
    <div className={`tile ${tone ?? ""}`}>
      <span className="tile-icon">
        <Icon name={icon} size={18} />
      </span>
      <div className="tile-label">{label}</div>
      <div className="tile-value">{value}</div>
      <div className="tile-note">{note}</div>
    </div>
  );
}
