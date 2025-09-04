import { LightningElement, api, wire } from 'lwc';
import getIndividualData from '@salesforce/apex/DataGraphService.getIndividualGraph';

export default class dataGraphViewer extends LightningElement {
    @api recordId; // Contact record ID from the page
    graphData;
    error;
    loading = true;

    connectedCallback() {
        this.fetchData();
    }

    fetchData() {
        this.loading = true;
        getIndividualData({ contactId: this.recordId })
            .then(result => {
                this.graphData = JSON.stringify(JSON.parse(result), null, 2); // pretty print
                this.error = null;
            })
            .catch(err => {
                this.error = err.body ? err.body.message : err.message;
                this.graphData = null;
            })
            .finally(() => {
                this.loading = false;
            });
    }
}
