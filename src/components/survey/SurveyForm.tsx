import { useMutation } from "@connectrpc/connect-query";
import { useForm } from "@tanstack/react-form";
import { useRef, useState } from "react";
import { useNavigate } from "react-router";

import { NetworkPicker } from "@/components/survey/NetworkPicker";
import { RolePicker } from "@/components/survey/RolePicker";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { FieldError } from "@/components/ui/field-error";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { submit } from "@/gen/mreza/v1/survey-SurveyService_connectquery";
import type { ParticipationRole, SocialNetwork } from "@/gen/mreza/v1/survey_pb";
import { cn } from "@/lib/cn";
import {
  COPY,
  getSubmitErrorMessage,
  isDuplicateEmailError,
  isNetworkError,
} from "@/lib/survey-errors";
import {
  LIMITS,
  normalizePhone,
  trimField,
  validateEmail,
  validateGdpr,
  validateLargeReachUrl,
  validateName,
  validatePhone,
  validateProfileLinks,
  validateRoles,
  type SurveyFormValues,
} from "@/validators/survey";

const defaultValues: SurveyFormValues = {
  name: "",
  surname: "",
  email: "",
  phone: "",
  roles: [],
  networks: [],
  hasLargeReach: false,
  largeReachUrl: "",
  profileLinks: "",
  gdprConsent: false,
};

type SurveyFormProps = {
  onToast?: (message: string) => void;
};

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-4 border-b border-slate-200 pb-2 font-display text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
      {children}
    </h2>
  );
}

export function SurveyForm({ onToast }: SurveyFormProps) {
  const navigate = useNavigate();
  const emailRef = useRef<HTMLInputElement>(null);
  const [serverEmailError, setServerEmailError] = useState<string | undefined>();
  const [rolesError, setRolesError] = useState<string | undefined>();

  const submitMut = useMutation(submit);

  const form = useForm({
    defaultValues,
    onSubmit: async ({ value, formApi }) => {
      setServerEmailError(undefined);

      await formApi.validateAllFields("submit");

      // Uloge nisu obicno polje (lista cekboksa), pa im validaciju vodimo
      // odvojeno od form.Field mehanizma.
      const roleError = validateRoles(value.roles);
      setRolesError(roleError);

      if (!formApi.state.isFormValid || roleError) {
        return;
      }

      try {
        await submitMut.mutateAsync({
          name: trimField(value.name),
          surname: trimField(value.surname),
          email: trimField(value.email).toLowerCase(),
          phone: normalizePhone(value.phone),
          roles: value.roles,
          networks: value.networks,
          hasLargeReach: value.hasLargeReach,
          // Link se salje samo uz cekiranu opciju — backend bi ga ionako
          // odbacio, ali ovako ne saljemo ni podatak koji ne vazi.
          largeReachUrl: value.hasLargeReach
            ? trimField(value.largeReachUrl) || undefined
            : undefined,
          profileLinks: trimField(value.profileLinks) || undefined,
          gdprConsent: value.gdprConsent,
        });

        void navigate("/hvala");
      } catch (err) {
        if (isDuplicateEmailError(err)) {
          setServerEmailError(COPY.duplicateEmail);
          emailRef.current?.focus();
          return;
        }
        onToast?.(isNetworkError(err) ? COPY.network : getSubmitErrorMessage(err));
      }
    },
  });

  const isSubmitting = submitMut.isPending;

  function toggleRole(role: ParticipationRole, checked: boolean) {
    const current = form.getFieldValue("roles");
    const next = checked
      ? [...current, role]
      : current.filter((r) => r !== role);
    form.setFieldValue("roles", next);
    // Greska nestaje cim korisnik ispravi uzrok, bez cekanja na sledeci submit.
    if (next.length > 0) setRolesError(undefined);
  }

  function toggleNetwork(network: SocialNetwork, checked: boolean) {
    const current = form.getFieldValue("networks");
    form.setFieldValue(
      "networks",
      checked ? [...current, network] : current.filter((n) => n !== network),
    );
  }

  // Enter u tekstualnom polju ne sme slucajno da posalje formu.
  function handleFormKeyDown(e: React.KeyboardEvent<HTMLFormElement>) {
    const target = e.target as HTMLElement;
    if (
      e.key === "Enter" &&
      target.tagName !== "BUTTON" &&
      target.tagName !== "TEXTAREA"
    ) {
      e.preventDefault();
    }
  }

  return (
    <form
      className={cn(isSubmitting && "pointer-events-none opacity-80")}
      onSubmit={(e) => {
        e.preventDefault();
        void form.handleSubmit();
      }}
      onKeyDown={handleFormKeyDown}
      noValidate
    >
      <fieldset disabled={isSubmitting} className="space-y-10">
        <section>
          <SectionHeading>Kontakt</SectionHeading>
          <div className="grid gap-4 sm:grid-cols-2">
            <form.Field
              name="name"
              validators={{
                onBlur: ({ value }) => validateName(value),
                onSubmit: ({ value }) => validateName(value),
              }}
            >
              {(field) => (
                <div>
                  <Label htmlFor="name">
                    Ime <span className="text-red-600">*</span>
                  </Label>
                  <Input
                    id="name"
                    autoComplete="given-name"
                    placeholder="Marko"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                  <FieldError message={field.state.meta.errors[0]} />
                </div>
              )}
            </form.Field>

            <form.Field
              name="surname"
              validators={{
                onBlur: ({ value }) => validateName(value),
                onSubmit: ({ value }) => validateName(value),
              }}
            >
              {(field) => (
                <div>
                  <Label htmlFor="surname">
                    Prezime <span className="text-red-600">*</span>
                  </Label>
                  <Input
                    id="surname"
                    autoComplete="family-name"
                    placeholder="Marković"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                  <FieldError message={field.state.meta.errors[0]} />
                </div>
              )}
            </form.Field>

            <form.Field
              name="email"
              validators={{
                onBlur: ({ value }) => validateEmail(value),
                onSubmit: ({ value }) => validateEmail(value),
              }}
            >
              {(field) => (
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    ref={emailRef}
                    type="email"
                    autoComplete="email"
                    placeholder="marko.markovic@gmail.com"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => {
                      setServerEmailError(undefined);
                      field.handleChange(e.target.value);
                    }}
                  />
                  <FieldError
                    message={serverEmailError ?? field.state.meta.errors[0]}
                  />
                </div>
              )}
            </form.Field>

            <form.Field
              name="phone"
              validators={{
                onBlur: ({ value }) => validatePhone(value),
                onSubmit: ({ value }) => validatePhone(value),
              }}
            >
              {(field) => (
                <div>
                  <Label htmlFor="phone">
                    Telefon / WhatsApp <span className="text-red-600">*</span>
                  </Label>
                  <Input
                    id="phone"
                    type="tel"
                    autoComplete="tel"
                    placeholder="+381641234567"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                  <p className="mt-1 text-xs text-slate-500">
                    Srpski broj (06…) ili međunarodni za Balkan (+381, +382,
                    +385, +387, +389…)
                  </p>
                  <FieldError message={field.state.meta.errors[0]} />
                </div>
              )}
            </form.Field>
          </div>
        </section>

        <section>
          <form.Subscribe selector={(s) => s.values.roles}>
            {(roles) => (
              <RolePicker
                selected={roles}
                error={rolesError}
                disabled={isSubmitting}
                onToggle={toggleRole}
              />
            )}
          </form.Subscribe>
        </section>

        <section className="space-y-6">
          <form.Subscribe selector={(s) => s.values.networks}>
            {(networks) => (
              <NetworkPicker
                selected={networks}
                disabled={isSubmitting}
                onToggle={toggleNetwork}
              />
            )}
          </form.Subscribe>

          <form.Field name="hasLargeReach">
            {(reachField) => (
              <div
                className={cn(
                  "rounded-2xl border p-4 transition",
                  reachField.state.value
                    ? "border-node-400 bg-node-500/5"
                    : "border-slate-200 bg-white",
                )}
              >
                <label className="flex min-h-11 cursor-pointer items-center gap-3 font-medium text-slate-900">
                  <Checkbox
                    checked={reachField.state.value}
                    disabled={isSubmitting}
                    onChange={(e) => {
                      reachField.handleChange(e.target.checked);
                      // Odcekiranje brise i link — inace bi ostao sakriven u
                      // stanju forme i nikad ne bi bio poslat.
                      if (!e.target.checked) {
                        form.setFieldValue("largeReachUrl", "");
                      }
                    }}
                  />
                  Imam medij ili profil sa većim dometom
                </label>

                {reachField.state.value && (
                  <div className="mt-4 pl-8">
                    <form.Field
                      name="largeReachUrl"
                      validators={{
                        onBlur: ({ value }) => validateLargeReachUrl(value, true),
                        onSubmit: ({ value }) =>
                          validateLargeReachUrl(value, true),
                      }}
                    >
                      {(field) => (
                        <div>
                          <Label htmlFor="largeReachUrl">
                            Link ka tom mediju/profilu{" "}
                            <span className="text-red-600">*</span>
                          </Label>
                          <Input
                            id="largeReachUrl"
                            inputMode="url"
                            maxLength={LIMITS.largeReachUrl}
                            placeholder="instagram.com/tvoj-profil"
                            value={field.state.value}
                            onBlur={field.handleBlur}
                            onChange={(e) => field.handleChange(e.target.value)}
                          />
                          <FieldError message={field.state.meta.errors[0]} />
                        </div>
                      )}
                    </form.Field>
                  </div>
                )}
              </div>
            )}
          </form.Field>

          <form.Field
            name="profileLinks"
            validators={{
              onBlur: ({ value }) => validateProfileLinks(value),
              onSubmit: ({ value }) => validateProfileLinks(value),
            }}
          >
            {(field) => (
              <div>
                <Label htmlFor="profileLinks">
                  Linkovi ka profilima i stranicama
                </Label>
                <Textarea
                  id="profileLinks"
                  rows={4}
                  maxLength={LIMITS.profileLinks}
                  placeholder={"facebook.com/tvoja-stranica\ninstagram.com/tvoj-profil"}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                />
                <p className="mt-1 text-xs text-slate-500">
                  Po jedan link u redu. Opciono.
                </p>
                <FieldError message={field.state.meta.errors[0]} />
              </div>
            )}
          </form.Field>
        </section>

        <section>
          <SectionHeading>Saglasnost</SectionHeading>
          <form.Field
            name="gdprConsent"
            validators={{
              onChange: ({ value }) => validateGdpr(value),
              onSubmit: ({ value }) => validateGdpr(value),
            }}
          >
            {(field) => (
              <div>
                <label className="flex min-h-11 cursor-pointer gap-3 text-sm leading-relaxed text-slate-800">
                  <Checkbox
                    checked={field.state.value}
                    disabled={isSubmitting}
                    onChange={(e) => field.handleChange(e.target.checked)}
                    onBlur={field.handleBlur}
                  />
                  <span>
                    Dajem saglasnost, u skladu sa Zakonom o zaštiti podataka o
                    ličnosti, da se moji podaci obrađuju radi organizovanja i
                    sprovođenja opisane javne kampanje, i da mogu biti
                    prosleđeni drugom rukovaocu, obrađivaču i trećim licima
                    uključenim u kampanju.{" "}
                    <a
                      href="/privatnost"
                      className="text-mreza-700 underline-offset-2 hover:underline"
                    >
                      Politika privatnosti
                    </a>
                  </span>
                </label>
                <FieldError message={field.state.meta.errors[0]} />
              </div>
            )}
          </form.Field>
        </section>
      </fieldset>

      <form.Subscribe selector={(s) => s.values.gdprConsent}>
        {(gdprConsent) => (
          <div className="mt-8 flex flex-col items-stretch gap-2 sm:items-end">
            {!gdprConsent && (
              <p className="text-center text-sm text-slate-500 sm:text-right">
                Morate dati saglasnost da biste poslali prijavu.
              </p>
            )}
            <Button
              type="submit"
              className="w-full sm:w-auto sm:min-w-52"
              disabled={!gdprConsent || isSubmitting}
            >
              {isSubmitting ? "Šaljemo…" : "Pošalji prijavu"}
            </Button>
          </div>
        )}
      </form.Subscribe>
    </form>
  );
}
