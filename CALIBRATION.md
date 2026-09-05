# Bolt SDR Kalibratie Procedure

Deze procedure beschrijft hoe je Bolt SDR kunt kalibreren zonder testapparatuur.

---

## 1. Frequentiekalibratie

**Doel:** De ontvangen frequentie klopt met de werkelijke frequentie.

**Methode:**
1. Stem af op een bekende tijdsignaalzender:
   - **WWV** 2.5, 5, 10, 15, 20 MHz (USA)
   - **DCF77** 77.5 kHz (Duitsland)
   - **MSF** 60 kHz (Groot-Brittannië)
2. Open Settings → GENERAL → FREQ CAL
3. Vul bij REF Hz de bekende frequentie in (bijv. 10000000 voor WWV op 10 MHz)
4. Lees de afwijking af: als de draaggolf niet exact op de aangetuinde frequentie staat, vul dan de gemeten frequentie in bij MEAS Hz
5. Klik BEREKEN en dan TOEPASSEN
6. Controleer door opnieuw af te stemmen op WWV

**Tip:** Gebruik USB mode op WWV voor een duidelijke marker. De draaggolf moet exact op de VFO frequentie staan.

---

## 2. S-meter Kalibratie

**Doel:** De S-meter klopt met de werkelijke signaalsterkte (S9 = -73 dBm bij HF).

**Methode zonder signaalgenerator:**
1. Zoek een bekend DX baken in de bakkenlijst (bijv. IARU beacon netwerk op 14.1 MHz)
2. Vergelijk de Bolt S-meter met een online SDR op dezelfde frequentie (bijv. websdr.org of kiwisdr.com) of met een tweede ontvanger
3. Noteer het verschil in dB
4. Open Settings → GENERAL → S-METER OFFSET dB
5. Pas de offset aan totdat de waarden overeenkomen

**Alternatief:**
- Een S9 signaal = -73 dBm bij HF (bovenband)
- Een sterke lokale AM zender kan als referentie dienen als je de zendsterkte kent

---

## 3. RF Gain / ADC instelling

**Doel:** Optimale gevoeligheid zonder overload.

**Methode:**
1. Gebruik de Auto RF Gain functie (AUTO knop naast RF slider in RX controls)
2. De auto RF gain streeft naar 6-30 dB ADC headroom
3. Controleer de ADC av/pk indicator in de meterbalk:
   - **Groen**: goede ADC level
   - **Oranje**: signaal sterk, bijna overload
   - **Rood**: overload, meer attenuatie nodig
4. Op een rustige band (bijv. 's nachts op 40m): ADC piek typisch -60 tot -90 dBFS
5. Op een drukke band: ADC piek hoeft maar -10 tot -20 dBFS te zijn

**Handmatig:**
- Verhoog RF gain totdat sterke signalen beginnen te vervormen
- Verlaag dan 6-10 dB als veiligheidsmarge

---

## 4. TX Drive Kalibratie

**Doel:** Juiste uitgangssterkte zonder overmodulatie.

**Methode:**
1. Verbind een dummy load of antenne
2. Druk TUNE in (carrier)
3. Stel Drive in op 50% als startpunt
4. Kijk naar de ALC meter: ALC moet niet aan het maximum zitten (dan overgestuurd)
5. Verhoog Drive totdat ALC begint te bewegen (net onder de limiet)
6. Bij SSB spraak: spreek normaal en controleer dat ALC sporadisch beweegt, niet constant

**Zonder wattmeter:**
- De ADC av/pk indicator laat "TX" zien tijdens zenden
- ALC = 0 dB: te weinig drive
- ALC > -3 dB: bijna overmodulatie
- Doel: ALC tussen -10 en -3 dB tijdens piek modulatie

---

## 5. Audio Kalibratie

### AF Gain (RX Volume)
- Stel in op aangenaam luistervolume
- -10 tot 0 dB is typisch een goed bereik

### Mic Gain
- Spreek normaal en controleer de mic peak meter in de TxPanel
- Doel: piekwaarde net onder 0 dB
- Pas MIC BOOST aan in Settings als het bereik van de Mic Gain slider niet voldoende is

### MIC BOOST (Settings → GENERAL)
- Softwarematige versterking voor zwakke microfoons
- Standaard: 8x
- Verhoog als de microfoon te zwak is, verlaag als te sterk

---

## 6. CFC TX EQ (optioneel)

**Doel:** Betere verstaanbaarheid van de TX audio.

**Methode:**
1. Open Settings → TX EQ
2. Zet CFC aan
3. Laat iemand je signaal beoordelen op een tweede ontvanger of via websdr.org
4. Pas de banden aan:
   - Verlaag lage frequenties (50-200 Hz) als je te basachtig klinkt
   - Verhoog mid-frequenties (1000-2000 Hz) voor betere verstaanbaarheid
   - De compressie per band helpt bij consistente audio

---

## 7. RX Buffer Latency

**Doel:** Balans tussen audio stabiliteit en latency.

**Methode:**
1. Open Settings → GENERAL → RX BUFFER
2. Begin met 140ms (standaard)
3. Verlaag stapsgewijs (bijv. naar 80ms, 60ms, 40ms)
4. Als je ratel/klik geluiden hoort: verhoog de buffer
5. Voor lokaal gebruik: 60-80ms is comfortabel
6. Voor remote gebruik via internet: 140-300ms voor stabielere audio

---

## Diagnostics

Gebruik de Bolt diagnostics pagina voor monitoring:
- Open `https://<server-ip>:6443/diagnostics.html`
- **Audio drops = 0**: geen audio problemen
- **ADC headroom**: ideaal 6-30 dB

Voor volledige DSP diagnostics:
- `http://<server-ip>:6061/api/station/dsp-diagnostics`
