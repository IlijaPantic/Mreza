import { NetworkIcon } from "@/components/survey/NetworkIcon";
import { SOCIAL_NETWORKS } from "@/data/social-networks";
import type { SocialNetwork } from "@/gen/mreza/v1/survey_pb";
import { cn } from "@/lib/cn";

type NetworkPickerProps = {
  selected: SocialNetwork[];
  onToggle: (network: SocialNetwork, checked: boolean) => void;
  disabled?: boolean;
};

/**
 * Drustvene mreze — cipovi sa ikonicom.
 *
 * Cekboks je `sr-only`, a stanje nosi izgled cipa; `peer-focus-visible` vraca
 * fokus prsten koji bi se sakrivanjem inputa inace izgubio.
 */
export function NetworkPicker({
  selected,
  onToggle,
  disabled,
}: NetworkPickerProps) {
  return (
    <fieldset>
      <legend className="font-display text-lg font-semibold text-slate-900">
        Koje društvene mreže imaš?
      </legend>
      <p className="mt-1 text-sm text-slate-600">
        Označi one koje si spreman/na da dobrovoljno koristiš u ovoj kampanji.
        Možeš i da preskočiš ovaj deo.
      </p>

      <div className="mt-4 flex flex-wrap gap-2.5">
        {SOCIAL_NETWORKS.map((def) => {
          const isChecked = selected.includes(def.network);
          return (
            <label key={def.network} className="inline-flex">
              <input
                type="checkbox"
                className="peer sr-only"
                checked={isChecked}
                disabled={disabled}
                onChange={(e) => onToggle(def.network, e.target.checked)}
              />
              <span
                className={cn(
                  "inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border px-3.5 py-2 text-sm font-medium transition",
                  "peer-focus-visible:ring-2 peer-focus-visible:ring-mreza-500/50 peer-focus-visible:ring-offset-1",
                  isChecked
                    ? "border-mreza-500 bg-mreza-500 text-white shadow-sm"
                    : "border-slate-200 bg-white text-slate-700 hover:border-mreza-300 hover:bg-mreza-50",
                  disabled && "cursor-not-allowed opacity-60",
                )}
              >
                <NetworkIcon network={def.network} />
                {def.label}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
