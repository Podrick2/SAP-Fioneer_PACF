sap.ui.define([
    "sap/ui/model/json/JSONModel",
    "sap/ui/Device"
], 
/**
 * provide app-view type models (as in the first "V" in MVVC)
 * 
 * @param {typeof sap.ui.model.json.JSONModel} JSONModel
 * @param {typeof sap.ui.Device} Device
 * 
 * @returns {Function} createDeviceModel() for providing runtime info for the device the UI5 app is running on
 */
  function (JSONModel, Device) {
    "use strict";

    return {
      createDeviceModel: function () {
        const oModel = new JSONModel(Device);
        oModel.setDefaultBindingMode("OneWay");
        return oModel;
      },

      createDataModel: function () {
        const oData = {
          currentTimeScale: "annualReports",
          selectedOverviewCompany: {},
          selectedCompareData: [],
          cashFlowData: [],
          overviewSet: [],
          vizChartData: [],
          vizChartLineVisibility1: [
            {
                line: "operatingCashflow",
                visible: true,
                name: "Operating cash flow"
            },
            {
                line: "cashflowFromInvestment",
                visible: true,
                name: "Cash flow from Investment"
            },
            {
                line: "cashflowFromFinancing",
                visible: true,
                name: "Cash flow from Financing"
            }
          ],
          vizChartLineVisibility2: [
            {
              line: "freeCashflow",
              visible: false,
              name: "Free cash flow"
            },
            {
              line: "netIncome",
              visible: false,
              name: "Net Income"
            }
          ]
        };
        return new JSONModel(oData);
      }
    };
});