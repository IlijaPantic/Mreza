import { Checkbox } from "@/components/ui/checkbox";
import { ROLES } from "@/data/roles";
import type { ParticipationRole } from "@/gen/mreza/v1/survey_pb";
import { cn } from "@/lib/cn";

type RolePickerProps = {
  selected: ParticipationRole[];
  onToggle: (role: ParticipationRole, checked: boolean) => void;
  error?: string;
  disabled?: boolean;
};

/**
 * Nacini ucesca u kampanji — kartice sa cekboksom.
 *
 * Kartica, a ne gola lista: svaka uloga nosi objasnjenje koje odlucuje da li
 * je neko bira, pa opis mora biti vidljiv bez dodatnog klika.
 */
export function RolePicker({
  selected,
  onToggle,
  error,
  disabled,
}: RolePickerProps) {
  const errorId = error ? "roles-error" : undefined;

  return (
    <fieldset aria-describedby={errorId}>
      <legend className="font-display text-lg font-semibold text-slate-900">
        Kako želite da učestvujete u javnoj kampanji?
      </legend>
      <p className="mt-1 text-sm text-slate-600">
        Izaberi jedno ili više — možeš da se uključiš na više načina.
      </p>

      {error && (
        <p id={errorId} role="alert" className="mt-3 text-sm text-red-600">
          {error}
        </p>
      )}

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {ROLES.map((def) => {
          const isChecked = selected.includes(def.role);
          return (
            <label
              key={def.role}
              className={cn(
                "flex cursor-pointer gap-3 rounded-2xl border p-4 transition",
                "focus-within:ring-2 focus-within:ring-mreza-500/40",
                isChecked
                  ? "border-mreza-400 bg-mreza-50 shadow-sm"
                  : "border-slate-200 bg-white hover:border-mreza-300 hover:bg-mreza-50/40",
                disabled && "cursor-not-allowed opacity-60",
              )}
            >
              <span className="mt-0.5 flex h-5 items-center">
                <Checkbox
                  checked={isChecked}
                  disabled={disabled}
                  onChange={(e) => onToggle(def.role, e.target.checked)}
                />
              </span>
              <span className="flex flex-col gap-1">
                <span
                  className={cn(
                    "font-medium",
                    isChecked ? "text-mreza-900" : "text-slate-900",
                  )}
                >
                  {def.label}
                </span>
                <span className="text-xs leading-relaxed text-slate-600">
                  {def.description}
                </span>
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
