# Aerostatik des Gasballons – Grundlagen für die Fahrtplanung

Fahrtbriefing · Konzept 0.12 · Stand 05.10.2026

Dieses Dokument hält fest, nach welchen physikalischen Gesetzen das Höhenprofil-Werkzeug
(0.12) den Ballastbedarf einer Gasfahrt rechnet, und korrigiert die Annahme der ersten Skizze
(«Ballast pro Stunde»). Grundlage sind die beiden Standardwerke, die der Pilot zur Verfügung
gestellt hat, dazu die Zustandsgleichung idealer Gase:

* **Emden, R.: Grundlagen der Ballonführung** (1910), Neuausgabe als Kapitel 2.10 des
  «Handbuch für Freiballonführer» des Deutschen Freiballonsport-Verbandes (DFSV), mit
  Ergänzung 1990 – zitiert als *Emden, Kap. n / Tab. n*.
* **Gerhardt, Müller, Hurck, Cuneo: Gone with the Wind – Der Gasballon / The Gas Balloon**,
  2. Auflage 2016, Kapitel 4 «Führung des Gasballons – Theorie und Praxis» – zitiert als
  *GWTW 4.x*.

Alle Zahlen beziehen sich, wo nichts anderes steht, auf den «Standardballon» beider Werke:
1000 m³, Wasserstoff, ISA auf Meereshöhe. Für die Ballone des Betreibers werden die Werte
im Werkzeug aus Volumen, Füllgas, Füllungsgrad und Temperaturprofil gerechnet.

## 1 Fundamentalgleichung und Tragfähigkeit

Die Tragfähigkeit (Tragkraft, in kg ausgedrückt) einer Gasfüllung ist

    Tragfähigkeit L = Auftrieb − Gasmasse = V_Gas · (ρ_Luft − ρ_Gas)        (Emden Kap. 6, GWTW 4.3.1)

Für 1000 m³ Wasserstoff bei ISA NN: L = 1225 kg − 85 kg = **1140 kg**; Helium 1056 kg
(GWTW 4.8.3). Die Tragfähigkeit hängt nur von Luftdichte und Gasdichte ab – also von Druck
(Höhe), Temperatur und Feuchte:

| Luft- = Gastemperatur | H₂ kg/1000 m³ (prall) | He | Quelle |
|---|---|---|---|
| −15 °C | 1272 | 1178 | GWTW 4.8.2 |
| 0 °C | 1202 | 1114 | |
| +15 °C | 1140 | 1056 | |
| +25 °C | 1102 | 1020 | |

Je 5 K wärmer verliert der pralle 1000-m³-Ballon rund 22 kg (H₂). Vollständig gesättigte
Luft (100 % rel. Feuchte) kostet rund 10 kg je 1000 m³ (GWTW 4.3.3 D).

## 2 Die zwei Zustandsklassen – der Kern der Ballonführung

| | **Praller Ballon** (Hülle voll) | **Unpraller Ballon** (Hülle nicht voll) |
|---|---|---|
| konstant ist | das Gasvolumen | die Gasmasse |
| beim Steigen | Gas bläst ab: Tragfähigkeit **−1 % je 80 m** | Gas dehnt sich aus, Tragfähigkeit **bleibt gleich** bis zur Prallhöhe |
| beim Sinken | wird ab dem ersten Meter unprall | bleibt unprall, Tragfähigkeit bleibt gleich |
| Gleichgewicht | nach oben labil (Abblasen), nach unten indifferent | **indifferent** in jeder Höhe: «Die geringste Steig- oder Sinkkraft führt ihn … durch das ganze Höhenintervall» |

(Emden Kap. 8 und 14; GWTW 4.6.1–4.6.3)

Folgerung für die Planung: **Unterhalb der Prallhöhe kostet die Höhe als solche keinen
Ballast.** Ballast wird gebraucht, um (a) eine Vertikalbewegung einzuleiten oder abzufangen
und (b) Tragfähigkeitsverluste durch Temperatur auszugleichen. Nur oberhalb der Prallhöhe
(praller Ballon) kostet jeder Meter Höhe Gas und damit Tragfähigkeit.

## 3 Fundamentalsatz, Höhenzahl, Prallhöhe

* **Fundamentalsatz** (Emden Kap. 3, GWTW 4.3.4 A): Luftdruck und Luftdichte ändern sich um
  **1 % je 80 m** (bei 15 °C: 85 m). Gültig bis etwa 2 km Höhendifferenz; darüber Höhenzahl.
* **Höhenzahl** n = p_unten / p_oben (GWTW 4.3.4 B, Emden Tab. 3): Verhältnis der Luftdrücke,
  der Luftdichten, der Tragfähigkeiten oder – umgekehrt – der Gasvolumina und Füllungsgrade
  zweier Höhen. Je Grad mittlerer Temperatur über 0 °C um 0,4 % korrigieren.
* **Prallhöhe aus dem Füllungsgrad**: n = 1 / Füllungsgrad. Beispiel 80 % → n = 1,25 →
  **1782 m** über dem Startplatz (Emden Kap. 14 B); 65 % → n = 1,538 → 3440 m (GWTW).
  Emden Tab. 11 (0 °C): 1000 m ↔ 88,3 %, 2000 m ↔ 77,9 %, 3000 m ↔ 68,7 %, 4000 m ↔ 60,6 %,
  5000 m ↔ 53,5 % Füllungsgrad; bei Gasabkühlung 0,5 K/100 m: 90,1 / 81,1 / 72,6 / 65,9 / 59,4 %.
* **Normalhöhe**: Gleichgewichtshöhe des prallen Ballons (isotherme Atmosphäre 0 °C); je
  K gemeinsamer Temperatur ±30 m (Emden Kap. 12).

## 4 Gesetz der Ballastwirkung

> «Jeder pralle Ballon erhöht seine Normalhöhe um 80 m, so oft wir seine Belastung um 1 %
> verringern, unabhängig von seinem Volumen, seinem Gesamtgewicht, der Art seiner Füllung und
> der Höhe, in welcher diese Gewichtsverringerung erfolgt.» (Emden Kap. 10)

Beispiel Standardballon 1140 kg: 1 % = 11,4 kg → 80 m; Aufstieg um 304 m (1000 ft) aus der
Gleichgewichtslage = 3,85 × 11,4 = **43 kg ≈ 3 Sack à 15 kg** (GWTW 4.3.4). Genauer mit der
mittleren Gesamtmasse (Hälfte des Ballasts abziehen) oder mit der Höhenzahl.

Beim **unprallen** Ballon gilt das Gesetz nicht als Höhenmass: Jede Ballastabgabe erzeugt eine
konstante Steigkraft, der Ballon steigt mit konstanter Geschwindigkeit bis zur Prallhöhe und
dann nach dem Gesetz des prallen Ballons weiter bis zur Gleichgewichtshöhe (Emden Kap. 17 B,
GWTW 4.6.4). Er schiesst dabei rund 20 m über die Gleichgewichtshöhe hinaus und braucht
anschliessend 1,5–3 kg «Nachballast», sonst sinkt er als unpraller Ballon weiter (Emden Kap.
17 A). Wichtig für die Planung: **Start unprall** (z. B. 80 %) erreicht die Fahrthöhe mit einem
Sack, Start prall braucht für dieselbe Höhe 17 Sack während des Aufstiegs (GWTW 4.6.4,
Anhang 14).

## 5 Die vier Temperaturgesetze (Emden Kap. 11, GWTW 4.7/4.8)

| | Unpraller Ballon (konst. Gasmasse) | Praller Ballon (konst. Volumen) |
|---|---|---|
| Luft und Gas ändern sich **gemeinsam** um ΔT | **Satz 1:** Tragfähigkeit bleibt gleich | **Satz 2:** −0,4 % je K Erwärmung; Normalhöhe −30 m/K (Abkühlung macht ihn unprall → Satz 1) |
| Nur das **Gas** ändert seine Differenz zur Luft um ΔT | **Satz 4:** ±0,4 % des **Auftriebs** je K ≈ **±5 kg je K je 1000 m³** (unabhängig vom Füllgas) | **Satz 3:** ±0,4 % der **Gasmasse** je K ≈ +0,03 % der Tragfähigkeit (H₂), +2,5 m Höhe je K |

Emden Tab. 9 gibt die Sinkkraft je K Gasabkühlung nach Prallhöhe (kg, 945 / 1050 m³):
0 m 4,2 / 4,6 · 1000 m 3,8 / 4,2 · 2000 m 3,4 / 3,8 · 3000 m 3,1 / 3,4 · 4000 m 2,8 / 3,1 ·
5000 m 2,5 / 2,8. Aus der Zustandsgleichung: ΔL/ΔT = Auftrieb/T_Luft, d. h. 1225 kg / 288 K
= 4,3 kg/K am Boden (15 °C) – die Tabellen bestätigen die Formel.

Asymmetrie (Emden Kap. 14 C): Abkühlung des Gases eines prallen Ballons wirkt mit dem Auftrieb
(Satz 4, 5 kg/K), Erwärmung nur mit der Gasmasse (Satz 3, 0,35 kg/K bei H₂) – «rund 13-mal
grösser». Darum steigt ein praller H₂-Ballon in der Sonne nur wenig (2,5 m/K), sinkt aber bei
Abkühlung stark.

## 6 Strahlung: Tag, Nacht und der Übergang

* Temperaturdifferenz Gas – Luft: bei ungehinderter Sonne **+30 K und mehr**, bei Nacht unter
  klarem Himmel **bis −10 K und mehr** (GWTW 4.8.2 B 3a). Reflektierende Hülle halbiert beide
  Wirkungen ungefähr (Emden Kap. 14 C).
* **Übergang Tag → Nacht** (Emden Kap. 14 E): Das Gas kühlt ab, der Ballon wird unprall,
  Satz 4 greift mit vollem Auftrieb. «Je höher die Gastemperatur bei Tage war und je tiefer sie
  bei Nacht wird, desto grösser wird die notwendige Ballastausgabe.» Kosten = ΔT(Tag→Nacht)
  × ~5 kg je 1000 m³ (höhenabhängig nach Tab. 9). Beispiel: +15 K nachmittags → −3 K nachts =
  18 K × 4,2 kg = **≈ 75 kg** für den 1000-m³-Ballon in 1000 m – einmalig in den Abendstunden,
  nicht «pro Stunde».
* Danach: «Die konstanteren Strahlungsverhältnisse während einer Nachtfahrt lassen bei
  geringerem Ballastverbrauch den Ballon in wenig wachsender Höhe schweben» – die Nacht
  selbst ist billig, der Ballon fährt stundenlang «mit minimalem Ballastverbrauch». Trifft
  er auf eine kältere Bodenschicht, schwimmt er auf (Satz 4 umgekehrt).
* **Morgen**: Die Sonne gibt dem Gas die Tagestemperatur zurück; die nächtliche Ballastabgabe
  war «ein grosses, notgedrungenes Überwerfen» – der Ballon steigt bis zur neuen Prallhöhe
  und bläst ab, oder der Pilot ventiliert. Emdens Rat: **Fahrt erst zu später Stunde mit
  schon kühlem Ballon antreten**, um die nächtliche Ballastabgabe klein zu halten.
* Jede Ballastabgabe ist in der Summe ein «Überwerfen»: «Die ganze während der Fahrt
  ausgegebene Ballastmenge hat schliesslich nur dazu gedient, den Ballon … in seine
  schliessliche Maximalhöhe emporzutreiben.» (Emden Kap. 14 D) – deshalb wächst die
  Fahrtkurve über Tage stufenweise an.

## 7 Dynamik: Steigen, Sinken, Abfangen

* Luftwiderstand wächst mit v²; die Vertikalgeschwindigkeit stellt sich so ein, dass
  Widerstand = Treibkraft. **Sinkkraft (kg) ≈ WZ · v²** mit der Widerstandszahl WZ (Emden
  Tab. 10, ISA NN): 630 m³ 2,7 · 780 m³ 3,1 · 945 m³ 3,5 · 1050 m³ 3,8 · 1260 m³ 4,3 · 1680 m³
  5,2 kg bei 1 m/s. Bei 2 m/s rund das Vierfache (1050 m³: 15 kg), 3 m/s 34 kg, 4 m/s 61 kg.
  Je 80 m Höhe nimmt die nötige Kraft für gleiche Geschwindigkeit um 1 % ab.
* **Steigen einleiten** (unprall): Ballast = WZ · v_soll² (1 m/s ≈ 4 kg, 2 m/s ≈ 15 kg für
  1000 m³). Der Ballon beschleunigt in 60–80 m auf diese Geschwindigkeit und hält sie bis zur
  Prallhöhe (+2 % je 1000 m).
* **Abfangen**: Ballast = Sinkkraft (WZ · v²) hebt die Sinkkraft auf; der Ballon fällt durch
  seine Trägheit noch **60–80 m** weiter. Kürzer nur durch Überwerfen: +30 % → 30 m, +50 % →
  20 m, +150 % → 10 m (GWTW 4.5.3, Beispiel 3 m/s: 34 kg → 45 / 51 / 85 kg). Nach Emden
  Kap. 17 C: Überwerfen um 50 % → noch 15–20 m, um 100 % → rund 13 m.
* Ein steigender Ballon schiesst immer über die Gleichgewichtshöhe hinaus (rund 20 m); das
  oberste Viertel der Steigstrecke braucht die Hälfte der Steigzeit (Emden Kap. 17 A).
* **Adiabatik** (GWTW 4.3.5, Emden Kap. 17 A): Beim schnellen Steigen kühlt das Gas durch
  Ausdehnung ab (≈ 1 K je 100 m ohne Wärmeaustausch, zweiatomige Gase), die Luft im Mittel
  nur um 0,65 K je 100 m – die Differenz von ≈ 0,35 K je 100 m kostet nach Satz 4 rund
  1,5–2 kg Tragfähigkeit je 100 m, solange der Ausgleich durch die Hülle (Minuten) nicht
  nachgekommen ist; nach dem Stillstand «bessert sich seine Temperatur rasch etwas auf».
  Beim Sinken umgekehrt: Kompression erwärmt das Gas, die Sinkkraft nimmt ab (Selbstabfangen
  in «gut tragenden» stabilen Schichten, GWTW 4.9.3 Fall 3), in labilen Schichten nimmt sie
  zu (Fall 2).
* **Inversion** (GWTW 4.9.5, Emden Kap. 12): Beim Steigen in eine wärmere Schicht wird die
  Differenz Gas – Luft kleiner (Satz 4) und die Luftdichte nimmt sprunghaft ab (Satz 2) –
  «Sperrwirkung», der Ballon bleibt unter der Inversion. Beim Sinken in eine kalte
  Bodenschicht schwimmt er auf; beim Sinken in eine **warme Bodenschicht** (Thermik, Sommer,
  Mittag) fällt er durch: +10 K ↔ +4 % des Auftriebs ≈ 45 kg Sinkkraft beim Standardballon
  mit 90 % Füllung, plus Überwerfen zum Abbremsen (GWTW 4.9.4 C) – 50–100 kg Abfangballast.

## 8 Das Ballastmodell für das Höhenprofil-Werkzeug (0.12)

Das Werkzeug rechnet je Profilabschnitt (Punkt i → i+1) mit dem Zustand des Ballons
(Gasmasse, Füllungsgrad, Prallhöhe, Temperaturdifferenz Gas – Luft) und summiert vier
Posten; die Nacht ist kein Posten «pro Stunde» mehr:

1. **Manöver** (Dynamik): Steigen einleiten WZ·v², Sinken abfangen WZ·v² (+ Überwerfen je
   nach gewünschter Abfangstrecke); ein geplanter Höhenwechsel kostet also beide Enden.
   Sinken wird mit dem Ventil eingeleitet (Gasverlust = Tragfähigkeitsverlust, der am Ende
   mit Ballast abgefangen wird) – daher kostet auch ein geplanter Abstieg Ballast.
2. **Prallhöhe/Abblasen**: Für den Teil eines Steigens oberhalb der aktuellen Prallhöhe −1 %
   der Tragfähigkeit je 80 m (Gesetz der Ballastwirkung); die Prallhöhe wandert dabei mit
   (nach dem Abstieg ist der Ballon wieder unprall und die neue Prallhöhe liegt bei der
   früheren Maximalhöhe, korrigiert um 30 m je K Gastemperatur).
3. **Temperatur Gas – Luft** (Satz 4, 5 kg/K je 1000 m³, höhenabhängig): Die Differenz
   ΔT(t) folgt einem Strahlungsverlauf (Sonnenhöhe, Bewölkung, Hüllenfarbe): Tag +ΔT_Tag
   (Vorgabe +15 K bei klarem Himmel, +5 K bedeckt), Nacht −ΔT_Nacht (−3 K klar, −1 K bedeckt),
   Übergänge über rund 2 h um ECET bzw. ab BCMT. Nur **Abnahmen** von ΔT kosten Ballast;
   Zunahmen bringen Auftrieb (Steigen bis Prallhöhe, Abblasen oder Ventil).
4. **Adiabatik** beim Steigen: (Γ_Luft − 1,0 K/100 m) × Δh × 5 kg/K, gewichtet mit der
   Steigrate (voll ab 1,5 m/s, halb bei 0,5 m/s, null bei sehr langsamem Steigen) – Γ_Luft
   aus dem Modellprofil des jeweiligen Orts (Inversion: starke Kosten → Warnung «Sperrschicht»).

Dazu kommen **Landeballast** (Reserve, Vorgabe 3 Sack + Bremsballast für 2 m/s) und
**Nässe** (Tau, Regen, Schnee: Gewichtszunahme, nur grob als Zuschlag). Verfügbar ist der
Ballast aus dem Korb-Stammdatensatz (Säcke à 15 kg, Wasserballast).

Nicht modelliert: Böen/Thermik (dynamisch), Gasverlust durch Diffusion und Ventilzüge im
Detail, Hüllenüberdruck/Platzhöhe (Emden Kap. 4) – diese bleiben Sache des Piloten.

### Kalibrierung ohne Dauermessung

Der Ballastverbrauch wird in der Praxis nicht laufend gemessen, sondern nur periodisch
inventarisiert. Das genügt: Das Modell liefert kumulierte Posten je Abschnitt; verglichen wird
an den Inventurpunkten (Start, nach dem Abendübergang, Morgen, Landung) – die Summe zwischen
zwei Inventuren gegen die Modellsumme desselben Zeitraums. Zusätzlich liefert das Barogramm
(Höhe/Zeit) die Prallhöhen-Stufen und die Vertikalgeschwindigkeiten, aus denen sich WZ und
die Temperaturannahmen prüfen lassen. Drei bis vier Fahrten mit Inventurzeiten und Barogramm
reichen für brauchbare Hüllenfaktoren (ΔT_Tag, ΔT_Nacht je Hüllenfarbe).

## 9 Zahlenbeispiel (1000 m³ H₂, 85 % Füllung, Start 16:00 LT, 16 h, Landung 08:00 LT)

| Posten | Rechnung | kg |
|---|---|---|
| Start unprall, Steigen 1 m/s | WZ 3,8 × 1² | 4 |
| Abendübergang 18–21 LT: +12 K → −3 K in 1500 m | 15 K × 3,9 kg/K | 59 |
| Nachtfahrt 21–06 LT, Höhe halten | nur Korrekturen (Überwerfen) | ~10 |
| Abstieg 06 LT (Ventil) und Abfangen 2 m/s | WZ × 2² = 15, +50 % Überwerfen | 23 |
| Landeballast (Reserve) | 3 Sack + Brems­ballast | 60 |
| **Summe** | | **≈ 155 kg** |

Die Posten «Steigen je 100 m» und «Nacht je Stunde» der ersten Skizze (2,5 kg/100 m, 0,6 kg/h)
entfallen; an ihre Stelle treten Manöver-, Temperatur- und Prallhöhenposten mit den oben
belegten Koeffizienten.

## Quellen

* Emden, R.: Grundlagen der Ballonführung (1910). In: Handbuch für Freiballonführer des
  Deutschen Freiballonsport-Verbandes e. V. (DFSV), Kap. 2.10, mit Ergänzung 1990 – Kap. 3
  (Höhenzahl), 6–10 (Tragkraft, Zustandsklassen, Normalhöhe, Ballastwirkung), 11–14
  (Temperaturgesetze, Überwerfen, Tag/Nacht), 17 (Steigen und Fallen); Tab. 3, 9, 10, 11.
* Gerhardt, A.; Müller, W.; Hurck, G.; Cuneo, P.: Gone with the Wind – Der Gasballon /
  The Gas Balloon, 2. Aufl. 2016, Kap. 4.3 (Aerostatik), 4.5 (Luftwiderstand, Sinken und
  Abfangen), 4.6 (Verhalten im Luftraum), 4.7/4.8 (Temperaturgesetze), 4.9 (Fahrtpraxis).
* Zustandsgleichung idealer Gase und ICAO-Standardatmosphäre (Herleitung der Koeffizienten
  Auftrieb/T und der adiabatischen Abkühlung).
