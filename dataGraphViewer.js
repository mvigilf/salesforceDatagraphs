import { LightningElement, api, track } from 'lwc';
import getIndividualData from '@salesforce/apex/DataGraphService.getIndividualGraph';

const COLUMNS = [
    {
        label: 'Fecha encargo',
        fieldName: 'fechaEncargo',
        type: 'date-local',
        typeAttributes: { year: 'numeric', month: '2-digit', day: '2-digit' },
        sortable: true
    },
    { label: 'N.º de encargo', fieldName: 'numeroEncargo', type: 'text', sortable: true },
    { 
        label: 'Importe', 
        fieldName: 'importe', 
        type: 'currency',
        typeAttributes: { currencyCode: 'EUR', step: '0.01' },
        sortable: true
    }
];

export default class DataGraphViewer extends LightningElement {
    @api recordId;

    loading = true;
    error;

    columns = COLUMNS;
    @track rows = [];
    sortBy = 'fechaEncargo';
    sortDirection = 'desc';

    connectedCallback() {
        this.fetchData();
    }

    async fetchData() {
        this.loading = true;
        this.error = null;
        this.rows = [];
        try {
            const result = await getIndividualData({ contactId: this.recordId });

            // 1) Parseo del JSON principal (puede venir string)
            const graph = typeof result === 'string' ? JSON.parse(result) : result;

            // 2) Extraer y parsear cada json_blob__c (viene con &quot;)
            const encargos = this.extractEncargos(graph);

            // 3) Orden por fecha (desc)
            encargos.sort((a, b) => new Date(b.fechaEncargo) - new Date(a.fechaEncargo));

            // 4) Dejar en this.rows
            this.rows = encargos.map((e, idx) => ({
                id: `${e.numeroEncargo}-${e.fechaEncargo}-${idx}`,
                fechaEncargo: e.fechaEncargo,            // ISO yyyy-mm-dd (date-local lo formatea)
                numeroEncargo: e.numeroEncargo,
                importe: Number(e.importe)
            }));
        } catch (err) {
            this.error = err?.body?.message || err?.message || 'Error desconocido al leer datos.';
        } finally {
            this.loading = false;
        }
    }

    extractEncargos(graph) {
        const out = [];
        const dataArr = graph?.data || [];
        for (const rec of dataArr) {
            const blobRaw = rec?.json_blob__c;
            if (!blobRaw) continue;

            // Decodificar &quot; y demás entidades HTML
            const blobDecoded = this.decodeHtml(blobRaw);

            let inner;
            try {
                inner = JSON.parse(blobDecoded);
            } catch (e) {
                // Si no parsea, saltamos este registro
                // (puedes hacer console.error si quieres)
                continue;
            }

            const lista = inner?.extract_contacts_Affeliu_Encargoscsv__dlm || [];
            for (const it of lista) {
                const fecha = it?.FechaEncargo__c;           // "2025-02-17"
                const numero = it?.N_meroEncargo__c;         // "E03048"
                const importe = it?.Importe__c;              // 478.54

                if (fecha && numero && (importe !== undefined && importe !== null)) {
                    out.push({
                        fechaEncargo: fecha,
                        numeroEncargo: numero,
                        importe: importe
                    });
                }
            }
        }
        return out;
    }

    decodeHtml(htmlString) {
        const txt = document.createElement('textarea');
        txt.innerHTML = htmlString;
        return txt.value;
    }

    // ——— ordenación en la tabla (por si el usuario pulsa cabeceras) ———
    handleSort(event) {
        const { fieldName: sortBy, sortDirection } = event.detail;
        const parse = (v) => (sortBy === 'fechaEncargo' ? new Date(v) : v);
        const dir = sortDirection === 'asc' ? 1 : -1;

        const sorted = [...this.rows].sort((a, b) => {
            const va = parse(a[sortBy]);
            const vb = parse(b[sortBy]);
            if (va < vb) return -1 * dir;
            if (va > vb) return 1 * dir;
            return 0;
        });

        this.sortBy = sortBy;
        this.sortDirection = sortDirection;
        this.rows = sorted;
    }

    handleRefresh() {
        this.fetchData();
    }
}
