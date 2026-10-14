/**
 * @typedef {'werk'|'school'|'gezin'|'sport'|'vrienden'|'vrije-tijd'|'reis'|'overig'} Soort
 *
 * @typedef {object} Blok
 * @property {string} id
 * @property {string} titel
 * @property {Soort} soort
 * @property {number} start       minuten sinds middernacht
 * @property {number} einde
 * @property {boolean} [vast]         LIFE verschuift of schrapt dit nooit
 * @property {boolean} [persoon]      afspraak met een mens: nooit stilzwijgend wijzigen
 * @property {boolean} [uitstelbaar]  kan zonder gevolgen wachten
 * @property {boolean} [zwaar]        kost veel energie
 * @property {string} [plek]          voor het meten van overgangen
 * @property {number} [reisNa]        minuten reistijd naar het volgende blok
 * @property {{titel:string, duur:number}} [lichter]  lichtere vorm van dit blok
 *
 * @typedef {{datum:string, blokken:Blok[]}} Dag
 *
 * @typedef {object} Profiel
 * @property {number} wakkerVan
 * @property {number} wakkerTot
 * @property {number} slaapDoel
 * @property {number} slaapGisteren
 * @property {1|2|3|4|5} energie
 */
export {};
