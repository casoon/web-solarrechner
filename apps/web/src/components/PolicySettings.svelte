<script lang="ts">
import type { Inputs } from '@/lib/solar/model';
import {
  type PolicyPlan,
  type PolicyProfile,
  policyChecked,
  policyExportLimit,
  policySource,
  type PolicySettings as Settings,
} from '@/lib/solar/policy';
import NumberField from './NumberField.svelte';

let {
  settings = $bindable(),
  input = $bindable(),
  plan,
}: { settings: Settings; input: Inputs; plan: PolicyPlan } = $props();
const ct = (n: number) => (n * 100).toLocaleString('de-DE', { maximumFractionDigits: 2 });
const before = (date: string) =>
  new Date(Date.parse(date) - 86400000).toLocaleDateString('de-DE', { timeZone: 'UTC' });
</script>

<label for="policy-profile">Regel- und Erlösszenario</label>
<select
  id="policy-profile"
  value={settings.profile}
  onchange={(event) => {
    settings.profile = event.currentTarget.value as PolicyProfile;
    if (settings.profile !== 'manual') input.tariff = 0;
  }}
>
  <option value="draft">EEG-2027-Entwurf (nicht beschlossen)</option>
  <option value="current">Veröffentlichte Regeln / bisheriges EEG fortgeschrieben</option>
  <option value="zero">Nullerlös: keine Einnahmen aus Einspeisung</option>
  <option value="manual">Eigener fester Vergütungssatz</option>
</select>
<p class="tariff-line"><strong>{plan.name}</strong></p>
{#if plan.effective === 'draft'}
  {#if plan.eligible && settings.directMode === 'after'}
    <p class="field-hint">
      Übergangszahlung {ct(plan.rate)} ct/kWh bis {before(plan.transitionEnd)}, Direktvermarktung im
      Modell ab {plan.marketStart} (frühestens mit betriebsbereiter Technik). Frist: Ende des 36. Folgemonats
      der Inbetriebnahme.
    </p>
  {:else}<p class="field-hint">
      Direktvermarktung im Modell ab {plan.marketStart}, frühestens mit betriebsbereiter Technik. {plan.eligible
        ? 'Der Übergang wird bewusst übersprungen.'
        : 'Für diese Kombination aus Leistung und Datum sieht der Entwurf keine Übergangszahlung vor.'}
    </p>{/if}
  <p class="field-hint">
    {#if input.kwp < 25}In der sonstigen Direktvermarktung zusätzlich 1,5 ct/kWh Bonus bis {before(
        plan.bonusEnd,
      )} (48. Folgemonat der ersten Direktvermarktung).{:else}Ab 25 kW: vereinfachte Marktprämie auf
      Basis von {ct(plan.premium)} ct/kWh anzulegendem Wert bis {before(plan.supportEnd)};
      jährlicher Marktwert als Annahme.{/if} Markterlöse und Entgelte sind veränderbare Annahmen.
  </p>
{:else if plan.effective === 'current'}
  <p class="field-hint">
    {ct(plan.rate)} ct/kWh bis {before(plan.supportEnd)}. {plan.published
      ? 'Veröffentlichte Sätze für Inbetriebnahmen 01.08.–31.12.2026; spätere Reformen setzen diese Modell-Bestandsanlage nicht auf null.'
      : 'Ab 2027 nur ein Fortführungsszenario mit halbjährlicher Degression. Kein veröffentlichter oder garantierter künftiger Satz.'}
  </p>
{:else if plan.effective === 'zero'}<p class="field-hint">
    Bewusstes Vergleichsszenario ohne Einspeiseerlös. Für Neuanlagen ab 2027 gelten hier dieselben
    technischen Entwurfsannahmen (50-%-Limit), damit sich der Erlöseinfluss vergleichen lässt.
  </p>
{:else}<NumberField
    label="Eigener Einspeisetarif"
    bind:value={input.tariff}
    unit="€/kWh"
    max={0.3}
    step={0.0001}
    hint="Fester Modellwert bis Ende des 20. Kalenderjahres nach Inbetriebnahme, keine Rechtsprognose."
  />{/if}
<p class="field-hint">
  Exportlimit im ersten Betriebsjahr: <strong>{policyExportLimit(plan, input, 1)} %</strong>. {plan.draft
    ? 'Im Entwurf dauerhaft 50 % der installierten PV-Leistung am Netzanschluss, auch mit Mess-/Steuertechnik.'
    : 'Im bisherigen EEG-Szenario 60 % bis zur hier angenommenen betriebsbereiten Mess-/Steuertechnik, danach 100 %.'}
  Das ist kein pauschaler Jahresertragsabschlag.
</p>
{#if !settings.automaticLimit}<p class="field-hint">
    Eigenes Exportlimit als Sensitivität gewählt; es kann vom Regelprofil abweichen und ist keine
    Bestätigung der Anschlusszulässigkeit.
  </p>{/if}
<details>
  <summary>Genauer: Erlösphasen, Marktpreise und Technikbudgets</summary>
  {#if plan.effective === 'draft'}
    <label for="direct-mode">Start der Direktvermarktung</label>
    <select id="direct-mode" bind:value={settings.directMode}>
      <option value="after">Nach der möglichen Übergangszahlung</option>
      <option value="immediate">Sofort ab Inbetriebnahme</option>
    </select>
    <NumberField
      label="Angenommener Marktpreis in vergüteten Zeiten"
      bind:value={settings.marketPrice}
      unit="€/kWh"
      max={0.3}
      step={0.005}
      hint="Beispiel 0,04 = 4 ct/kWh. Kein garantierter Marktpreis; für unbezahlte Zeiten wird 0 angesetzt."
    />
    {#if input.kwp >= 25}<NumberField
        label="Angenommener Solar-Jahresmarktwert"
        bind:value={settings.solarMarketValue}
        unit="€/kWh"
        max={0.3}
        step={0.005}
        hint="Referenz für die vereinfachte Marktprämie, getrennt vom eigenen Verkaufspreis. Kein garantierter Mindest-Verkaufspreis."
      />{/if}
    <NumberField
      label="Variables Direktvermarktungsentgelt"
      bind:value={settings.marketingFee}
      unit="€/kWh"
      max={0.1}
      step={0.001}
      hint="Wird für jede vermarktete kWh abgezogen, auch in unbezahlten Zeiten."
    />
    <NumberField
      label="Fixkosten Direktvermarktung"
      bind:value={settings.marketingCost}
      unit="€/Jahr"
      max={2000}
      hint="Eigenes Budget nur ab Beginn der Direktvermarktung. Kein Lieferantenangebot."
    />
  {/if}
  <NumberField
    label="Mess-/Steuertechnik betriebsbereit ab Betriebsjahr"
    bind:value={settings.technologyYear}
    unit="Jahr"
    min={1}
    max={26}
    hint="1 = ab Inbetriebnahme, 26 = außerhalb der maximal 25 Jahre. Messsystem, Steuerung und erfolgreiche Inbetriebnahme werden hier gemeinsam angenommen."
  />
  <p class="field-hint">
    {plan.technologyNeeded
      ? 'Zusatzbudgets werden berücksichtigt: im Entwurf grundsätzlich über 2 kW bzw. für Direktvermarktung; im bisherigen Szenario über 7 kW.'
      : 'Für diesen Fall sind hier keine zusätzlichen Pflicht-Technikbudgets angesetzt.'} Alle folgenden
    Preise sind eigene Schätzungen. Bereits vorhandene oder im Angebot enthaltene Leistungen auf 0 setzen;
    Zählerschrankkosten sind separat.
  </p>
  <NumberField
    label="Zusätzliche Mess-/Steuertechnik einmalig"
    bind:value={settings.technologyCost}
    unit="€"
    max={5000}
    hint="Budget im angenommenen Einbaujahr; bei Einbau im ersten Jahr Teil der Investition und Finanzierung."
  />
  <NumberField
    label="Zusätzlicher Messstellenbetrieb"
    bind:value={settings.meterAnnual}
    unit="€/Jahr"
    max={1000}
  />
  <NumberField
    label="Zusätzlicher Steuerungsbetrieb"
    bind:value={settings.controlAnnual}
    unit="€/Jahr"
    max={1000}
  />
  <label class="check">
    <input
      type="checkbox"
      bind:checked={settings.automaticLimit}
      onchange={(event) => {
        if (event.currentTarget.checked) input.exportLimit = 60;
      }}
    />
     Exportlimit aus dem Regelszenario übernehmen
  </label>
  <NumberField
    label="Unvergüteter Export als Sensitivität"
    bind:value={input.negativeShare}
    unit="%"
    max={100}
    hint="Kein gesetzlicher Pauschalabzug. Anteil unbezahlter Einspeisung: bei Übergangs-/Festvergütung im Modell ab Kalenderjahr nach Technik-Einbau, bei Direktvermarktung ab Start. Unter 2 kW ist keine BNetzA-Auslösefestlegung modelliert."
  />
  <p class="field-hint">
    Die Erlösphasen werden kalendarisch über Monatsmittel gerechnet. Innerhalb eines Monats wird
    gleichmäßig verteilt. Keine Viertelstundenabrechnung, keine automatische Förderverlängerung nach
    § 51a. MiSpeL-Netzladen, dynamische Speichervermarktung und bidirektionales Laden sind nicht
    modelliert.
  </p>
  <p class="field-hint">
    Prüfstand {policyChecked}:
    <a href={policySource}>Regierungsentwurf 21/7867</a>. Die Reform ist noch nicht beschlossen; Änderungen und EU-Genehmigung bleiben offen.
    <a href="/de/about/">Quellen und Modellgrenzen</a>
  </p>
</details>
