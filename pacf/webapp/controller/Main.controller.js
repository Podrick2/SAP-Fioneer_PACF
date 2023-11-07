sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/viz/ui5/controls/common/feeds/FeedItem"
],
/**
 * @param {typeof sap.ui.core.mvc.Controller} Controller
 */
function (Controller, FeedItem) {
  "use strict";

  const API_Key = "VGX1ISKM8RPF2SJ4"; //LJAULEGVN57ATKTW

  return Controller.extend("pacf.controller.Main", {
    onInit: async function () {
      this.oDataModel = this.getOwnerComponent().getModel("dataModel");
			this.getView().setModel(this.oDataModel, "dataModel");

      this.oSplitContainer = this.getView().byId("idSplitContainer");

      this.initModelData();
      this.oDataModel.setProperty("/selectedOverviewCompany", this.getDefaultCompanyData());
      
      //console.log(await this.createRequest("/alphavantage/query?function=OVERVIEW&symbol=IBM&apikey=demo"));
    },
    
    async createRequest(sUrl) {
      try {
        const response = await fetch(sUrl, {});
        return response.json();
      } catch (error) {}
    },

    initModelData() {
      const that = this;
      const aTradeSymbols = ["AAPL", "MSFT", "GOOGL", "INTC", "ORCL", "CSCO", "NVDA", "AMD", "CRM"];
      Promise.all(aTradeSymbols.map(tS => {
        //return that.createRequest(`https://www.alphavantage.co/query?function=OVERVIEW&symbol=${tS}&apikey=${API_Key}`)
        return that.createRequest(`/alphavantage/query?function=OVERVIEW&symbol=${tS}`)
      })).then(aData => {
        that.oDataModel.setProperty("/overviewSet", aData);
        that.oDataModel.setProperty("/selectedOverviewCompany", that.getDefaultCompanyData());
      });
    },

    async loadCashFlowData() {
      const that = this;
      const aCompanyData = this.oDataModel.getProperty("/selectedCompareData");
      const aExistingCashFlowData = this.oDataModel.getProperty("/cashFlowData");
      const aExistingCashFlowSymbols = aExistingCashFlowData.map(eC => eC.symbol);
      const aFilteredSymbols = aCompanyData.map(cD => cD.Symbol).filter(sSymbol => !aExistingCashFlowSymbols.includes(sSymbol));
      
      const aData = await Promise.all(aFilteredSymbols.map(s => {
        //return that.createRequest(`https://www.alphavantage.co/query?function=CASH_FLOW&symbol=${s}&apikey=${API_Key}`);
        return that.createRequest(`/alphavantage/query?function=CASH_FLOW&symbol=${s}`);
      }));
      
      that.oDataModel.setProperty("/cashFlowData", [...aExistingCashFlowData, ...aData]);
    },

    async onPressCompare() {
      const oOtherPage = this.oSplitContainer.getDetailPages().find(p => p !== this.oSplitContainer.getCurrentDetailPage());
      await this.prepareCompareData();
      this.oSplitContainer.toDetail(oOtherPage);
    },

    async prepareCompareData() {
      await this.loadCashFlowData();
      const defaultSymbol = "AAPL";
      const oCompare = this.oDataModel.getProperty("/selectedCompareData").find(c => c.Symbol !== defaultSymbol);

      const cashFlowDataCompanyA = this.oDataModel.getProperty("/cashFlowData").find(cF => cF.symbol == defaultSymbol);
      const cashFlowDataCompanyB = this.oDataModel.getProperty("/cashFlowData").find(cF => cF.symbol == oCompare.Symbol);

      this.oDataModel.setProperty("/cashFlowDataCompanyA", cashFlowDataCompanyA);
      this.oDataModel.setProperty("/cashFlowDataCompanyB", cashFlowDataCompanyB);
     
      ["A", "B"].forEach(s => {
        const oSelect = this.getView().byId(`idAnnualDateSelect${s}`);
        oSelect.bindElement(`dataModel>/cashFlowDataCompany${s}/annualReports`)
      });
      this.filterTables();
      this.prepareVizFrameData();
    },

    filterTables() {
      const sTimeScale = this.oDataModel.getProperty("/currentTimeScale");

      ["A", "B"].forEach(aOrB => {
        const oSelect = this.getView().byId(`idAnnualDateSelect${aOrB}`);
        if (oSelect.getSelectedItem()) {
          const sDateValue = oSelect.getSelectedItem().getBinding("text").getValue();
          const oCompanyData = this.oDataModel.getProperty(`/cashFlowDataCompany${aOrB}`);
          const oTimeScaleCompanyData = filterCashFlowData(oCompanyData, sDateValue);
          
          oTimeScaleCompanyData.freeCashflow = oTimeScaleCompanyData.operatingCashflow - oTimeScaleCompanyData.capitalExpenditures;

          calculateTrendData(oTimeScaleCompanyData, oCompanyData)
          
          this.oDataModel.setProperty(`/filteredCashFlowData${aOrB}`, oTimeScaleCompanyData);
        }
      });
     
      function filterCashFlowData(oCompanyData, sDateValue) {
        return Object.keys(oCompanyData).reduce((acc, k) => {
          if (k.startsWith(sTimeScale) && Array.isArray(oCompanyData[k]))
              acc = Object.assign(acc, oCompanyData[k].find(d => d.fiscalDateEnding == sDateValue));
          if (k == "symbol") acc[k] = oCompanyData[k];
          return acc;
        }, {});
      }

      function calculateTrendData(oCurrentData, oAllCompanyData) {
        const oPreData = oAllCompanyData[sTimeScale].filter(d => d.fiscalDateEnding < oCurrentData.fiscalDateEnding).reduce((prev, current) => {
            return (prev && prev.fiscalDateEnding > current.fiscalDateEnding) ? prev : current;
        }, null);
        
        const aTrendSources = ["operatingCashflow", "cashflowFromInvestment", "cashflowFromFinancing", "freeCashflow"];
          
        aTrendSources.forEach(t => {
          if (oPreData && oCurrentData[t] && oPreData[t])
            oCurrentData[`${t}Trend`] = calcDifference(oCurrentData[t], oPreData[t]);
          else oCurrentData[`${t}Trend`] = 0;
        });

        oCurrentData.preDate = oPreData ? oPreData.fiscalDateEnding : "";

        function calcDifference(newVal, oldVal) {
          return (((newVal / oldVal) - 1) * 100).toFixed(2);
        }
      }
    },

    prepareVizFrameData() {
      const sTimeScale = this.oDataModel.getProperty("/currentTimeScale");
      const oTimeScaleLevelsMap = {
        annualReports: ["year"],
        quarterlyReports: ["month", "year"]
      };
      const [oPropsA, oPropsB] = ["A", "B"].map(aOrB => {
        const oCfData = this.oDataModel.getProperty(`/cashFlowDataCompany${aOrB}`);
        const aCfTimeScaleData = oCfData[sTimeScale];

        const aCfData = aCfTimeScaleData.map(data => {
          const oDate = new Date(data["fiscalDateEnding"]);
          data.date = oDate.getTime();
          data.freeCashflow = data.operatingCashflow - data.capitalExpenditures;

          return data;
        });

        this.oDataModel.setProperty(`/vizChartDataCompany${aOrB}`, sortByDateProperty2(aCfData));

        return {
          title: oCfData.symbol,
          levels: oTimeScaleLevelsMap[sTimeScale]
        };
      });

      this.setVizFrameProperties(oPropsA, oPropsB);

      function sortByDateProperty2(a) {
        return a.sort(({date: date1}, {date: date2}) => date1 - date2);
      }
    },

    setVizFrameProperties(oPropsA, oPropsB) {
      const oVizA = this.getView().byId("idLineVizFrameA");
      oVizA.setVizProperties({
        plotArea: {
          dataLabel: {
            //formatString:formatPattern.SHORTFLOAT_MFD2,
            visible: false
          },
          window: {
            start: 'firstDataPoint',
            end: 'lastDataPoint' 
          },
          marker:{
            visible : false
          }
        },
        valueAxis: {
          title: {
            visible: false
          }
        },
        timeAxis: {
          levels: oPropsA.levels
        },
        title: {
          visible: true,
          text: oPropsA.title
        },
        legendGroup: {
          layout: {
            position: "bottom"
          }
        }
      });

      const oVizB = this.getView().byId("idLineVizFrameB");
      oVizB.setVizProperties({
        plotArea: {
          dataLabel: {
            //formatString:formatPattern.SHORTFLOAT_MFD2,
            visible: false
          },
          window: {
            start: 'firstDataPoint',
            end: 'lastDataPoint' 
          },
          marker:{
            visible : false
          }
        },
        valueAxis: {
          title: {
            visible: false
          }
        },
        timeAxis: {
          levels: oPropsB.levels
        },
        title: {
          visible: true,
          text: oPropsB.title
        },
        legendGroup: {
          layout: {
            position: "bottom"
          }
        }
      });
    },

    onPressDetailBack() {
      this.oSplitContainer.backDetail();
    },

    onCompanySelect(oEvt) {
      const aData = oEvt.getSource().getSelectedContextPaths().map(p => this.oDataModel.getProperty(p));
      const defaultCompany = this.getDefaultCompanyData();
      this.oDataModel.setProperty("/selectedCompareData", [defaultCompany, ...aData]);
      this.prepareCompareData();
    },

    getDefaultCompanyData() {
      return this.oDataModel.getProperty("/overviewSet").find(o => o.Symbol == "AAPL");
    },

    onCompanyItemPress(oEvt) {
      const oData = this.oDataModel.getProperty(oEvt.getSource().getBindingContextPath());
      this.oDataModel.setProperty("/selectedOverviewCompany", oData);
      this.onPressDetailBack();
    },

    onChangeTimeScale(oEvt) {
      const sKey = oEvt.getParameter("item").getKey();
      ["A", "B"].forEach(aOrB => {
        const oSelect = this.getView().byId(`idAnnualDateSelect${aOrB}`);
        oSelect.getBinding("items").sPath = `/cashFlowDataCompany${aOrB}/${sKey}`;
      });
      this.filterTables();
      this.prepareVizFrameData();
    }, 

    onChangeDate(oEvt) {
      const aPath = ["annualReports", "quarterlyReports"];
      const sPath = oEvt.getSource().getBinding("items").getPath();
      this.filterTables(aPath.find(p => sPath.endsWith(p)));
    },

    onChangeVizChartLines(oEvt) {
      const oSwitchData = oEvt.getSource().getBinding("state").getContext().getObject();
      ["A", "B"].forEach(aOrB => { 
        const oViz = this.getView().byId(`idLineVizFrame${aOrB}`);
        const aFeeds = oViz.getFeeds();
        const oExistingFeedItem = aFeeds.filter(f => f.getType() == "Measure").find(f => f.getValues().includes(oSwitchData.name));
        if (oSwitchData.visible && !oExistingFeedItem) {
          oViz.addFeed(new FeedItem({
            uid: "valueAxis",
            type: "Measure",
            values: [oSwitchData.name]
          }));
        } else {
          oViz.removeFeed(oExistingFeedItem);
        }
      });      
    }
  });
});
