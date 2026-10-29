<script lang="ts">
import { energyFlow } from '@/lib/solar/energy-display';
import { currency, number, percent } from '@/lib/solar/format';
import type { calculate, Inputs } from '@/lib/solar/model';
import {
  balanceSpec,
  billBreakdown,
  billSpec,
  coverSpec,
  dayMonths,
  daySpec,
  financeRows,
  monthlyRows,
  monthlySpec,
  priceScenarios,
  scenarioSpec,
} from '@/lib/solar/result-display';
import SolarChart from './SolarChart.svelte';
import SolarTable from './SolarTable.svelte';

interface Props {
  result: ReturnType<typeof calculate>;
  /** Inputs of the shown calculation, after the debounce. */
  applied: Inputs;
  /** Whether the shown case is the one with storage. */
  withBattery: boolean;
}
let { result, applied, withBattery }: Props = $props();

const current = $derived(withBattery ? result.with : result.without);
const energy = $derived(current.energy);
const bill = $derived(billBreakdown(current, applied, withBattery));
let dayMonth = $state<number>(5);
const scenarios = $derived(priceScenarios(current.cashflows, applied));
</script>

<section class="chart-section">
  <div class="section-heading">
    <h2>Wohin dein Strom fließt</h2>
    <span>Chartlet · Sankey · kWh im ersten Jahr</span>
  </div>
  <SolarChart id="flow" spec={energyFlow(energy)} scrollable />
  <div class="energy-totals flow-totals">
    <span>
      Direkt genutzt <strong>{number(energy.direct)} kWh</strong>
    </span>
    <span>
      Aus dem Speicher <strong>{number(energy.battery)} kWh</strong>
    </span>
    <span>
      Aus dem Netz <strong>{number(energy.grid)} kWh</strong>
    </span>
  </div>
  <p class="field-hint">
    Links die Quellen, in der Mitte die Stromwege, rechts die Ziele. Gelb: Solarstrom, Grün:
    Speicherabgabe, Blau: Netzbezug; Zielbalken sind neutral. Bandbreite = Strommenge im ersten
    Jahr. Werte sind gerundet; kleine Summenabweichungen sind möglich.
  </p>
  <p class="field-hint">
    Die Speicherladung beträgt {number(energy.charge)} kWh im Jahr, nicht seine Kapazität. Änderungen
    des Ladezustands am Jahresrand werden bei Bedarf separat gezeigt. Der Bedarf von
    {number(energy.load + energy.standby)} kWh umfasst Haushalt und gewählte Großverbraucher sowie
    {number(energy.standby)} kWh Speicher-Standby. Speicherverluste ({number(energy.losses)} kWh) sind
    separat ausgewiesen. „Solarpotenzial“ enthält auch den durch Wechselrichter- oder Einspeiselimit
    nicht genutzten Anteil.
  </p>
</section>

<section class="chart-section">
  <div class="section-heading">
    <h2>Deine Stromkosten mit und ohne Anlage</h2>
    <span>Chartlet · Wasserfall · Euro im ersten Betriebsjahr</span>
  </div>
  <p class="bill-summary">
    Ohne Anlage zahlst du <strong>{currency(bill.without)}</strong>
    für Strom im Jahr, mit Anlage
    <strong>{currency(bill.with)}</strong>{bill.with < bill.without
      ? `, also ${currency(bill.without - bill.with)} weniger`
      : ''}.
  </p>
  <SolarChart id="bill" spec={billSpec(bill, applied.price)} />
  <p class="field-hint">
    Grün senkt deine Kosten, Rot erhöht sie. Links steht, was du ohne Anlage für Netzstrom zahlst,
    rechts, was mit Anlage übrig bleibt. Ein negativer Endwert bedeutet einen Überschuss.
  </p>
  <p class="field-hint">
    <strong>Erstes Betriebsjahr</strong>
     heißt: die ersten zwölf Monate ab Inbetriebnahme, nicht das Kalenderjahr. Es ist ein volles Jahr
    mit Sommer und Winter, bevor Alterung, Preisänderungen und spätere Erlösphasen wirken. Wie es danach
    weitergeht, zeigt „Der Weg zur Amortisation“. Nicht enthalten sind Grundpreis, Anschaffung, Kredit
    und Ersatzgeräte.
  </p>
</section>

<section class="chart-section">
  <div class="section-heading">
    <h2>Ein typischer Tag</h2>
    <span>Chartlet · kW, Mittel je Stunde</span>
  </div>
  <div class="segmented day-toggle" role="group" aria-label="Monat für den typischen Tag">
    {#each dayMonths as m}
      <button
        type="button"
        class:active={dayMonth === m.index}
        aria-pressed={dayMonth === m.index}
        onclick={() => (dayMonth = m.index)}
      >
        {m.label}
      </button>
    {/each}
  </div>
  <SolarChart id="day" spec={daySpec(energy, dayMonth)} />
  <p class="field-hint">
    Mittelwert aller Tage des gewählten Monats, kein konkreter Tagesverlauf. Solarpotenzial liegt
    vor Leistungsbegrenzung; der Bedarf enthält Speicher-Standby. „Aus dem Speicher“ zeigt die
    Entladeleistung, nicht den Ladezustand; einzelne Tage können deutlich abweichen.
  </p>
</section>

<section class="chart-section">
  <div class="section-heading">
    <h2>Woher dein Strom kommt</h2>
    <span>Chartlet · kWh pro Monat</span>
  </div>
  <SolarChart id="energy" spec={monthlySpec(energy)} />
  <p class="field-hint">
    Die Säulen zeigen die Versorgung des Bedarfs inklusive Speicher-Standby, nicht den gesamten
    Solarertrag. Die Monatssummen entstehen nach dem stündlichen Abgleich; Winterdefizite werden
    nicht durch Sommerüberschüsse ausgeglichen.
  </p>
</section>

<section class="chart-section">
  <div class="section-heading">
    <h2>Wann die Sonne deinen Bedarf deckt</h2>
    <span>Chartlet · Heatmap · % gedeckt</span>
  </div>
  <SolarChart id="cover" spec={coverSpec(energy)} />
  <p class="field-hint">
    Je dunkler, desto größer ist der Anteil aus Solarstrom und Speicher am Bedarf inklusive Standby.
    Es sind Mittelwerte je Monat und Tageszeit, keine Zusage für einen bestimmten Tag.
  </p>
</section>

<section class="chart-section">
  <div class="section-heading">
    <h2>Der Weg zur Amortisation</h2>
    <span>Chartlet · Euro</span>
  </div>
  <SolarChart id="balance" spec={balanceSpec(result)} />
  <p class="field-hint">
    Projekt-Cashflow ohne Kreditraten und Zinsen, mit {applied.priceChange === 0
      ? 'gleichbleibendem Strompreis'
      : `einer Strompreisänderung von ${percent(applied.priceChange)} pro Jahr`}, sonst ohne
    Inflationsannahme und ohne Restwert. Ersatzinvestitionen verursachen sichtbare Rückgänge. Erlöse
    folgen den kalendarischen Phasen aus Schritt 4; Markterlöse können nach einer Förderphase
    weiterlaufen. Eine Förderverlängerung wegen negativer Preise ist nicht automatisch eingerechnet.
  </p>
</section>

<section class="chart-section">
  <div class="section-heading">
    <h2>Was, wenn sich der Strompreis ändert?</h2>
    <span>Chartlet · {withBattery ? 'mit' : 'ohne'} Speicher</span>
  </div>
  <SolarChart id="price" spec={scenarioSpec(current.cashflows, scenarios)} />
  <ul class="scenario-list">
    {#each scenarios as s}
      <li class:current={s.change === applied.priceChange}>
        <span>{s.label}</span>
        <strong>
          {s.payback ? `positiv ab Jahr ${s.payback}` : `nicht in ${applied.years} Jahren`}
        </strong>
      </li>
    {/each}
  </ul>
  <p class="field-hint">
    Gleiche Anlage, gleiche Energiebilanz: Nur der Wert des selbst genutzten Stroms ändert sich. Die
    gewählten Einspeisephasen, Marktpreisannahmen und Vermarktungskosten bleiben gleich. Die
    hervorgehobene Zeile ist deine Annahme aus Schritt 4.
  </p>
</section>

{#if applied.loanPercent > 0}
  <section class="comparison">
    <h2>Deine Finanzierung</h2>
    <div class="comparison-line">
      <span>Monatliche Kreditrate</span>
      <strong>{currency(current.rate)}</strong>
    </div>
    <p>
      {currency(current.principal)} Darlehen über {applied.loanYears} Jahre. Jahresvorteil im ersten
      Jahr nach zwölf Raten:
      <strong>{currency(current.benefit - current.rate * 12)}</strong>.
    </p>
    <p>
      Kumulierter Eigenkapitalsaldo nach {applied.years} Jahren, nach Abzug verbleibender Restschuld:
      {currency(current.equityBalance)}. Restschuld: {currency(current.debt)}.
    </p>
  </section>
{/if}

<section class="table-section">
  <div class="section-heading">
    <h2>Die zwölf Monate im Detail</h2>
    <span>Open Grid · gerundete kWh</span>
  </div>
  <SolarTable label="Monatliche Energiebilanz" rows={monthlyRows(energy)} />
  <p class="field-hint">
    PV_kWh zeigt das Potenzial vor Begrenzung; die Bedarfsspalte enthält Standby. Speicherverluste:
    {number(energy.losses)} kWh, Standby: {number(energy.standby)} kWh, Abregelung:
    {number(energy.curtailed)} kWh, davon {number(energy.clipped)} kWh über der
    Wechselrichterleistung. Ladezustand am Jahresrand: {number(energy.startSoc, 2)} →
    {number(energy.endSoc, 2)} kWh.
  </p>
  {#if energy.unmetCar > 1}
    <p class="error">
      {number(energy.unmetCar)} kWh gewünschtes Heimladen passen nicht in das Ladefenster. Diese Energie
      wird als zusätzliche externe Ladung behandelt und ist nicht im Netzbezug des Hauses enthalten.
    </p>
  {/if}
</section>

<details class="annual-table">
  <summary>Jährliche Zahlungsströme ansehen</summary>
  <SolarTable label="Projekt- und Eigenkapitalcashflows" rows={financeRows(current.cashflows)} />
  <p>
    Kapitalwert der Anlage bei {number(applied.discount, 1)} %: {currency(current.npv)}. Tilgung
    verändert die Liquidität, nicht den technischen Ertrag.
  </p>
</details>
