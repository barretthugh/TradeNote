const tradesMixin = {
    methods: {
        inputAccounts() {
            this.dashboardChartsMounted = false
            this.eCharts("clear")
            this.getAllTrades(true)
        },

        inputDateRange(param) {
            this.dashboardChartsMounted = false
            this.spinnerSetupsUpdate = true
            this.eCharts("clear")

            var filterJson = this.dateRange.filter(element => element.value == param)[0]
            this.selectedDateRange = filterJson

            /*Now we update selectedDateRangeCal*/
            let temp = {}
            temp.start = this.selectedDateRange.start
            temp.end = this.selectedDateRange.end
            this.selectedDateRangeCal = temp
            console.log("selectedDateRangeCal " + JSON.stringify(this.selectedDateRangeCal))
            localStorage.setItem('selectedDateRangeCal', JSON.stringify(this.selectedDateRangeCal))

            this.getAllTrades(true)
        },

        inputDateRangeCal(param1, param2) {
            console.log("param1 "+param1+", param2 "+param2)
            let dateUnix = null
            if (param1 == "start") {
                dateUnix = dayjs.tz(param2, this.tradeTimeZone).unix()
            }
            if (param1 == "end") {
                dateUnix = dayjs.tz(param2, this.tradeTimeZone).endOf("day").unix()
            }

            let dateLocalStorage = JSON.parse(localStorage.getItem('selectedDateRangeCal'))

            const refresh = () => {
                this.dashboardChartsMounted = false
                this.spinnerSetupsUpdate = true
                this.eCharts("clear")
                localStorage.setItem('selectedDateRangeCal', JSON.stringify(dateLocalStorage))
                this.getAllTrades(true)
            }

            /* Check if start date before end date and vice versa */
            if (dateLocalStorage && param1 == "start" && dateLocalStorage.end > dateUnix) {
                dateLocalStorage.start = dateUnix
                this.selectedDateRangeCal = dateLocalStorage
                console.log("selectedDateRangeCal " + JSON.stringify(this.selectedDateRangeCal))
                refresh()
            }

            if (dateLocalStorage && param1 == "end" && dateLocalStorage.start < dateUnix) {
                dateLocalStorage.end = dateUnix
                this.selectedDateRangeCal = dateLocalStorage
                refresh()
            }

            /* Update selectedDateRange */
            let tempFilter = this.dateRange.filter(element => element.start == this.selectedDateRangeCal.start && element.end == this.selectedDateRangeCal.end)
            if (tempFilter.length > 0) {
                this.selectedDateRange = tempFilter[0]
            } else {
                this.selectedDateRange = this.dateRange.filter(element => element.start == -1)[0]
            }
        },

        inputPositions() {
            if (this.currentPage.id == "dashboard") {
                this.dashboardChartsMounted = false
                this.spinnerSetupsUpdate = true
                this.eCharts("clear")
            }
            this.getAllTrades(true)
        },

        inputTimeFrame(param) {
            this.selectedTimeFrame = param
            localStorage.setItem('selectedTimeFrame', this.selectedTimeFrame)
            console.log(" -> Building charts")
            this.lineChart("lineChart1")
            this.lineBarChart("lineBarChart1")
            this.barChart("barChart1")
            this.barChart("barChart2")
        },

        inputRatio(param) {
            this.selectedRatio = param
            localStorage.setItem('selectedRatio', param)
            if (param = !"profitRatio") {
                this.eCharts("barChart")
            }
            this.eCharts("barChartNegative")

        },

        inputGrossNet(param) {
            if (this.currentPage.id == "dashboard") {
                this.dashboardChartsMounted = false
                this.spinnerSetupsUpdate = true
                this.eCharts("clear")
            }

            this.selectedGrossNet = param
            localStorage.setItem('selectedGrossNet', this.selectedGrossNet)
            this.amountCase = param
            this.amountCapital = param.charAt(0).toUpperCase() + param.slice(1)
            this.getAllTrades(true)
        },

        getAllTrades: async function(param) {
            console.log("\nGETTING TRADES")
                //console.log("this.selectedDateRange "+this.selectedDateRange)
            this.dashboardChartsMounted = false
            this.spinnerSetupsUpdate = true
            this.dashboardIdMounted = false
            this.spinnerSetupsUpdateText = "Getting trades"
                //console.log("filtered "+JSON.stringify(this.filteredTrades))

            let selectedRange
                /* If true, getting all trades. Else juste the graphs */
            if (param) {

                /*============= 1- Get selected date range =============*/

                if (!localStorage.getItem('selectedCalRange')) {
                    localStorage.setItem('selectedCalRange', JSON.stringify(this.selectedCalRange))
                }

                if (this.currentPage.id == "dashboard") {
                    selectedRange = this.selectedDateRangeCal
                } else {
                    selectedRange = this.selectedCalRange
                }



                /*============= 2 - Check last date in parse db =============

                 * If there is a new date we will update indexedDB
                 ***************************************************/

                let lastDateParse

                    (async() => {
                    return new Promise(async(resolve, reject) => { //put return is very important or else it was not waiting for the promise
                        console.log(" -> Getting last date from ParseDB");
                        const Object = Parse.Object.extend("trades");
                        const query = new Parse.Query(Object);
                        query.equalTo("user", Parse.User.current());
                        query.descending("dateUnix");
                        const results = await query.first()
                        if (results) {
                            lastDateParse = JSON.parse(JSON.stringify(results)).dateUnix
                            console.log("  --> Last date parse " + lastDateParse)
                        }
                        resolve()
                    })
                })()

                /*============= 3 - Check if trades data exists in variable =============

                 * I've put it in variable for quicker extract
                 * If does not exist in variable, check IndexedDB
                 * If not in IndexedDB, then get from Parse
                 ***************************************************/

                console.log(" -> Checking local storage");
                this.spinnerSetupsUpdateText = "Getting trades - Checking local storage"
                let lastDateLocal
                if (this.threeMonthsBack <= selectedRange.start) {

                    /*Check if variable exists*/
                    if (this.threeMonthsTrades.length > 0) {
                        console.log("  --> 3 Months trades already exists")
                        console.log("  --> Size of this.threeMonths: " + this.formatBytes(new Blob([JSON.stringify(this.threeMonthsTrades)]).size))
                        this.spinnerSetupsUpdateText = "Getting trades - 3 Months trades already exists"

                        /*Compare last dateUnix with last date from #2*/
                        lastDateLocal = this.threeMonthsTrades[this.threeMonthsTrades.length - 1].dateUnix
                            //console.log("  --> Checking for updates: last date local " + lastDateLocal + " vs last date parse " + lastDateParse)

                        /*If new date, we update IndexedDB by getting trades from Parse*/
                        if (lastDateLocal < lastDateParse) {
                            this.spinnerSetupsUpdateText = "New data. Updating IndexedDB"
                            await this.getTradesFromDb(6)
                        }

                        /* If variable does not exist, we check IndexedDB or get from Parse */
                    } else {
                        console.log("  --> 3 months trades is null. Getting data")
                        this.spinnerSetupsUpdateText = "Getting trades - 3 months trades is null. Getting data"

                        /* Check if data exists in indexed db */
                        let dataExistsInIndexedDB = await this.checkTradesInIndexedDB(6)
                            //console.log("dataExistsInIndexedDB "+dataExistsInIndexedDB)
                            //this.spinnerSetupsUpdateText = "Getting trades - data exists is "+dataExistsInIndexedDB

                        if (dataExistsInIndexedDB) {
                            lastDateLocal = this.threeMonthsTrades[this.threeMonthsTrades.length - 1].dateUnix
                            console.log("  --> threeMonthsBack size in indexedDB: " + this.formatBytes(new Blob([JSON.stringify(this.threeMonthsTrades)]).size))
                        }
                        //this.spinnerSetupsUpdateText = "Getting trades - last date is "+lastDateLocal +" and last date parse "+lastDateParse
                        //console.log("  --> Checking for updates: last date local " + lastDateLocal + " vs last date parse " + lastDateParse)

                        /* Get from parse db if not exist in indexed db (resolve returns false in checkTradesInIndexedDB) or if there is a new date in parse db */
                        if (!dataExistsInIndexedDB || lastDateLocal < lastDateParse) {
                            await this.getTradesFromDb(6)
                        }

                    }
                } else {
                    if (this.allTrades.length > 0) {
                        console.log("  --> All trades already exists")
                        console.log("  --> Size of this.allTrades: " + this.formatBytes(new Blob([JSON.stringify(this.allTrades)]).size))
                        this.spinnerSetupsUpdateText = "Getting trades - All trades already exists"

                        lastDateLocal = this.allTrades[this.allTrades.length - 1].dateUnix
                        if (lastDateLocal < lastDateParse) {
                            this.spinnerSetupsUpdateText = "New data. Updating IndexedDB"
                            await this.getTradesFromDb(0)
                        }

                    } else {
                        console.log("  --> All trades is null. Getting data")

                        this.spinnerSetupsUpdateText = "Getting trades - All trades is null. Getting data"
                        let dataExistsInIndexedDB = await this.checkTradesInIndexedDB(0)
                        this.spinnerSetupsUpdateText = "Getting trades - data exists is " + dataExistsInIndexedDB

                        if (dataExistsInIndexedDB) {
                            lastDateLocal = this.allTrades[this.allTrades.length - 1].dateUnix
                            console.log("  --> allTrades size in indexedDB: " + this.formatBytes(new Blob([JSON.stringify(this.allTrades)]).size))
                        }
                        //this.spinnerSetupsUpdateText = "Getting trades - lastDateLocal is "+lastDateLocal

                        if (!dataExistsInIndexedDB || lastDateLocal < lastDateParse) {
                            this.spinnerSetupsUpdateText = "New data. Updating IndexedDB"
                            await this.getTradesFromDb(0)
                        }
                    }
                }

                /*============= 4 - Apply filter to trades =============
                 
                * We filter by date range, position, account by looping/creating trades column
                * New variable will be called filteredTrades
                ***************************************************/

                //console.log(" -> Getting trades from " + dayjs.unix(selectedRange.start).format("DD/MM/YY") + " to " + dayjs.unix(selectedRange.end).format("DD/MM/YY"))
                console.log(" -> Filtering trades")
                this.spinnerSetupsUpdateText = "Getting trades - Filtering trades"
                console.log("Range (Date or Call) start " + selectedRange.start + " Range (Date or Call) end " + selectedRange.end)

                this.filteredTrades = []
                let loopTrades = (param1) => {
                    param1.forEach(element => {
                        let temp = _.omit(element, ["trades"])
                        temp.trades = []
                        element.trades.forEach(element => {
                            /* Here we do not .tz because it's done at source, in dateRange variable (vue.js) */

                            /* For specific pages, we only show per month, so we limit end date */
                            if (this.currentPage.id == "daily" || this.currentPage.id == "videos" ||  this.currentPage.id == "calendar") {
                                selectedRange.end = dayjs(selectedRange.start * 1000).add(1, "month").unix()
                            }

                            /* We use if here but then conditional inside to check all possibilities */
                            if ((selectedRange.start === 0 && selectedRange.end === 0 ? element.entryTime >= selectedRange.start : element.entryTime >= selectedRange.start && element.entryTime < selectedRange.end) && this.selectedPositions.includes(element.strategy) /*(this.selectedPosition != "all" ? element.strategy == this.selectedPosition : element.strategy)*/ && /*(this.selectedAccount != "all" ? element.account == this.selectedAccount : element.account)*/ this.selectedAccounts.includes(element.account)) {
                                temp.trades.push(element)
                            }
                        });
                        /* Just use the once that have recreated trades (or else daily was showing last 3 months and only one month with trades data) */
                        if (temp.trades.length > 0) {
                            this.filteredTrades.push(temp)
                        }
                    });
                }

                /* If all dates selected, we use allTrades */
                if (selectedRange.start == 0 && selectedRange.end == 0) {
                    loopTrades(this.allTrades)
                }

                /* If not, we per selected range */
                else {
                    /* We must check if we are in in 3 months range or full range */
                    if (this.threeMonthsBack <= selectedRange.start) {
                        console.log(" -> Using 3 months")
                        loopTrades(this.threeMonthsTrades)
                    } else {
                        console.log(" -> Using all trades")
                        loopTrades(this.allTrades)
                    }
                }
            }

            /*============= 5 - Render data, charts, totals =============*/

            if (this.currentPage.id == "dashboard") {
                this.spinnerSetupsUpdateText = "Rendering data, charts and totals"
                await Promise.all([this.getPatterns(), this.getMistakes()])
                await this.prepareTrades()
                await (this.spinnerSetupsUpdate = false)
                console.log(" -> Building charts")
                await (this.renderData += 1)
                await this.eCharts("init")
                await (this.dashboardChartsMounted = true)

            }
            if (this.currentPage.id == "daily" || this.currentPage.id == "calendar") {
                this.spinnerSetupsUpdateText = "Getting Daily Data"
                if (this.currentPage.id == "daily") await this.dailyModal()
                await Promise.all([this.addVideoStartEnd(), this.getJournals(), this.getPatterns(), this.getMistakes()])

                this.spinnerSetupsUpdateText = "Loading Calendar"

                /*In dashboard, filter is dependant on the filter input on top of page
                 * In daily, filter is dependant on the calendar -> charts are loaded after and inside calendar in this case
                 */
                this.loadCalendar(undefined, selectedRange)

            }


        },

        /***************************************
         * CHECKING AND GETTING DATA FROM DB 
         * (see #3)
         ***************************************/

        checkTradesInIndexedDB: async function(param) {
            return new Promise((resolve, reject) => {
                this.spinnerSetupsUpdateText = "Getting trades - Checking data in IndexedDB"
                let transaction = this.indexedDB.transaction(["trades"], "readwrite");

                if (param == 6) {
                    var objectToGet = transaction.objectStore("trades").get("2")
                }
                if (param == 0) {
                    var objectToGet = transaction.objectStore("trades").get("1")
                }
                objectToGet.onsuccess = (event) => {
                    if (event.target.result != undefined) {
                        console.log("  --> Data exists in IndexedDB. Retreiving trades")
                        this.spinnerSetupsUpdateText = "Getting trades - Data exists in IndexedDB. Retreiving trades"
                        if (param == 6) {
                            this.threeMonthsTrades = event.target.result.data;
                        }
                        if (param == 0) {
                            this.allTrades = event.target.result.data;
                        }
                        //console.log("all trades " + JSON.stringify(this.allTrades))
                        (async() => {
                            if (!navigator.storage) return;

                            const
                                estimate = await navigator.storage.estimate(),
                                // calculate remaining storage in MB
                                quota = this.formatBytes(estimate.quota)
                            let usage = this.formatBytes(estimate.usage)
                                //console.log("Local storage quota " + quota + " and usage " + usage);
                        })();
                        resolve(true)
                    } else {
                        console.log("  --> Data does not exist in IndexedDB. Retreiving from DB")
                        this.spinnerSetupsUpdateText = "Getting trades - Data does not exist in IndexedDB. Retreiving from DB"
                        resolve(false)
                    }

                }
                objectToGet.onerror = (event) => {
                    console.log("  --> There was an error getting trades from IndexedDB")
                    this.spinnerSetupsUpdateText = "Getting trades - There was an error getting trades from IndexedDB"
                    return
                }
            })
        },

        /***************************************
         * GETTING DATA FROM PARSE DB 
         * (see #3)
         * We get the data and save it to IndexedDB
         ***************************************/

        getTradesFromDb: async function(param) {
            return new Promise((resolve, reject) => {
                (async() => {
                    console.log(" -> Getting trades from ParseDB");
                    console.time("  --> Execution time");
                    this.spinnerSetupsUpdateText = "Getting trades from ParseDB"
                    const Object = Parse.Object.extend("trades");
                    const query = new Parse.Query(Object)
                    query.equalTo("user", Parse.User.current());
                    query.ascending("dateUnix");
                    query.exclude("executions") // we omit to make it lighter
                    query.limit(1000000); // limit to at most 10 results
                    const results = await query.find();
                    console.timeEnd("  --> Execution time");

                    if (results.length > 0) {//here results is an array so we use lenght. Sometimees results is not array then we use if results simply
                        console.log("  --> Size: " + this.formatBytes(JSON.stringify(results).length))
                        this.allTrades = []
                        this.threeMonthsTrades = []
                            //this.allTrades = JSON.parse(JSON.stringify(results))
                            //this.allTrades = JSON.parse(JSON.stringify(results))
                        console.log(" -> Parsing data from ParseDB");
                        this.spinnerSetupsUpdateText = "Parsing data from ParseDB"

                        JSON.parse(JSON.stringify(results)).forEach(element => {
                            if (element.dateUnix >= this.threeMonthsBack) {
                                this.threeMonthsTrades.push(element)
                            }
                            this.allTrades.push(element)
                        });
                        //console.log("3 months back " + JSON.stringify(this.threeMonthsTrades))
                        //console.log("all trades before "+JSON.stringify(this.allTrades))
                        this.threeMonthsTrades.sort(function(a, b) {
                            return a.dateUnix - b.dateUnix
                        })

                        if (param == 0 || param == 6) {
                            console.log("has param")
                            await this.saveAllTradesToIndexedDb(param)
                        } else {
                            console.log("no param")
                            await Promise.all([this.saveAllTradesToIndexedDb(0), this.saveAllTradesToIndexedDb(6)])
                        }
                    }
                    resolve()
                })()
            })
        },

        saveAllTradesToIndexedDb(param) {
            return new Promise((resolve, reject) => {
                console.log(" -> Saving trades to IndexedDB (param: " + param + ")");
                // Open a transaction to the database
                let transaction = this.indexedDB.transaction(["trades"], "readwrite");
                //console.log("all trades after "+JSON.stringify(this.allTrades))
                let data = {}
                if (param == 0) {
                    data = {
                        id: "1",
                        data: this.allTrades
                    };
                }
                if (param == 6) {
                    data = {
                        id: "2",
                        data: this.threeMonthsTrades
                    };
                }

                var objectToAdd = transaction.objectStore("trades").put(data)

                objectToAdd.onsuccess = (event) => {
                    console.log(" -> Success saving to IndexedDB")

                }
                objectToAdd.onserror = (event) => {
                    console.log(" -> Error saving to IndexedDB")
                    return
                }

                //Resolve on transaction complete because when adding the page redirects to dashboard and the indexeddb object did not have time to update when I was putting resolve in onsuccess
                transaction.oncomplete = function(event) {
                    resolve()
                };
            })
        },


        /*============= Prepare Trades (#4) =============

        * Here we are going to create general totals
        * Create a list of all trades needed for grouping by date but also by strategy, price, etc.
        * Create totals per date needed for grouping monthly, weekly and daily
        ***************************************/

        prepareTrades: async function() {
            console.log(" -> Creating totals")

            /* Variables */
            var totalQuantity = 0

            var totalCommission = 0
            var totalOtherCommission = 0
            var totalFees = 0
            var totalLocateFees = 0
            var totalSoftwareFees = 0
            var totalBankingFees = 0

            var totalGrossProceeds = 0
            var totalGrossWins = 0
            var totalGrossLoss = 0
            var totalGrossSharePL = 0
            var totalGrossSharePLWins = 0
            var totalGrossSharePLLoss = 0
            var highGrossSharePLWin = 0
            var highGrossSharePLLoss = 0

            var totalNetProceeds = 0
            var totalNetWins = 0
            var totalNetLoss = 0
            var totalNetSharePL = 0
            var totalNetSharePLWins = 0
            var totalNetSharePLLoss = 0
            var highNetSharePLWin = 0
            var highNetSharePLLoss = 0

            var totalExecutions = 0
            var totalTrades = 0

            var totalGrossWinsQuantity = 0
            var totalGrossLossQuantity = 0
            var totalGrossWinsCount = 0
            var totalGrossLossCount = 0

            var totalNetWinsQuantity = 0
            var totalNetLossQuantity = 0
            var totalNetWinsCount = 0
            var totalNetLossCount = 0
            var financials = {}

            //console.log("filtered trades "+JSON.stringify(this.filteredTrades[0].trades))

            /* List of all trades inside trades column (needed for grouping) */
            var temp1 = []

            /*============= 1- CREATING GENERAL TOTALS =============

            * needed for dashboard
            * we start by iterating trades to created totals
            * Note: during iteration, we will also push to create a list of trades needed for grouping
            * Then we prepare a json that we push to this.totals
            */

            /* 1a - In each filtered trade, we will iterate trade to create totals */
            this.filteredTrades.forEach((element, index) => {

                // Other fees
                if (element.cashJournal != undefined) {
                    //console.log("cash journal " + JSON.stringify(element.cashJournal))
                    totalLocateFees += element.cashJournal.locate
                    totalSoftwareFees += element.cashJournal.software
                    totalBankingFees += element.cashJournal.banking.fee
                        //console.log("totalLocateFees" + totalLocateFees)
                }

                element.trades.forEach(el => {

                    totalQuantity += el.buyQuantity + el.sellQuantity
                    totalCommission += el.commission
                    totalOtherCommission += el.sec + el.taf + el.nscc + el.nasdaq
                    totalFees += el.commission + el.sec + el.taf + el.nscc + el.nasdaq

                    totalGrossProceeds += el.grossProceeds //Total amount of proceeds
                    totalGrossWins += el.grossWins
                    totalGrossLoss += el.grossLoss
                    totalGrossSharePL += el.grossSharePL
                    totalGrossSharePLWins += el.grossSharePLWins
                    totalGrossSharePLLoss += el.grossSharePLLoss

                    if (el.grossSharePL >= 0) {
                        if (el.grossSharePL > highGrossSharePLWin) {
                            highGrossSharePLWin = el.grossSharePL
                        }
                    }
                    if (el.grossSharePL < 0) {
                        if (el.grossSharePL < highGrossSharePLLoss) {
                            highGrossSharePLLoss = el.grossSharePL
                        }

                    }

                    totalNetProceeds += el.netProceeds
                    totalNetWins += el.netWins
                    totalNetLoss += el.netLoss
                    totalNetSharePL += el.netSharePL
                    totalNetSharePLWins += el.netSharePLWins
                    totalNetSharePLLoss += el.netSharePLLoss
                        //el.highNetSharePLWin > highNetSharePLWin ? highNetSharePLWin = el.highNetSharePLWin : highNetSharePLWin = highNetSharePLWin
                        //el.highNetSharePLLoss < highNetSharePLLoss ? highNetSharePLLoss = el.highNetSharePLLoss : highNetSharePLLoss = highNetSharePLLoss
                    if (el.netSharePL >= 0) {
                        if (el.netSharePL > highNetSharePLWin) {
                            highNetSharePLWin = el.netSharePL
                        }

                    }
                    if (el.netSharePL < 0) {
                        if (el.netSharePL < highNetSharePLLoss) {
                            highNetSharePLLoss = el.netSharePL
                        }

                    }

                    totalExecutions += el.executionsCount
                    totalTrades += el.tradesCount
                    totalGrossWinsQuantity += el.grossWinsQuantity
                    totalGrossLossQuantity += el.grossLossQuantity
                    totalGrossWinsCount += el.grossWinsCount //Total number/count of gross winning trades
                    totalGrossLossCount += el.grossLossCount //Total number/count of gross losing trades

                    totalNetWinsQuantity += el.netWinsQuantity
                    totalNetLossQuantity += el.netLossQuantity
                    totalNetWinsCount += el.netWinsCount //Total number/count of net winning trades
                    totalNetLossCount += el.netLossCount //Total number/count of net losing trades
                    financials += el.financials //Total number/count of net losing trades

                    /*============= NOTE - Creating list of trades =============

                    * at the same time, we will push each trade inside trades
                    * This way we have a list of trades that we can group 
                    * according to grouping need (per date but also entry, strategy, etc.)
                    */
                    temp1.push(el)
                })


            })

            /* 1b - Create a json that we push to this.totals */
            let temp2 = {}

            /*******************
             * Info
             *******************/
            temp2.quantity = totalQuantity

            /*******************
             * Commissions and fees
             *******************/
            temp2.commission = totalCommission
            temp2.otherCommission = totalOtherCommission
            temp2.fees = totalFees
            temp2.locateFees = totalLocateFees
            temp2.softwareFees = totalSoftwareFees
            temp2.bankingFees = totalBankingFees
            temp2.otherFees = totalLocateFees + totalSoftwareFees + totalBankingFees

            /*******************
             * Gross proceeds and P&L
             *******************/
            temp2.grossProceeds = totalGrossProceeds
            temp2.grossWins = totalGrossWins
            temp2.grossLoss = totalGrossLoss
            temp2.grossSharePL = totalGrossSharePL
                /*totalGrossWinsQuantity == 0 ? temp2.grossSharePLWins = 0 : temp2.grossSharePLWins = (totalGrossWins / totalGrossWinsQuantity)
                totalGrossLossQuantity == 0 ? temp2.grossSharePLLoss = 0 : temp2.grossSharePLLoss = totalGrossLoss / totalGrossLossQuantity*/
            temp2.grossSharePLWins = totalGrossSharePLWins
            temp2.grossSharePLLoss = totalGrossSharePLLoss
            temp2.highGrossSharePLWin = highGrossSharePLWin
            temp2.highGrossSharePLLoss = highGrossSharePLLoss


            /*******************
             * Net proceeds and P&L
             *******************/
            temp2.netProceeds = totalNetProceeds
            temp2.netFeesProceeds = totalNetProceeds - temp2.otherFees
            temp2.netWins = totalNetWins
            temp2.netLoss = totalNetLoss
            temp2.netSharePL = totalNetSharePL
                /*totalNetWinsQuantity == 0 ? temp2.netSharePLWins = 0 : temp2.netSharePLWins = totalNetWins / totalNetWinsQuantity
                totalNetLossQuantity == 0 ? temp2.netSharePLLoss = 0 : temp2.netSharePLLoss = totalNetLoss / totalNetLossQuantity*/
            temp2.netSharePLWins = totalNetSharePLWins
            temp2.netSharePLLoss = totalNetSharePLLoss
            temp2.highNetSharePLWin = highNetSharePLWin
            temp2.highNetSharePLLoss = highNetSharePLLoss
            temp2.netProceedsEstimations = temp2.grossProceedsEstimations - temp2.feesEstimations
            temp2.netWinsEstimations = temp2.grossWinsEstimations - temp2.feesEstimations
            temp2.netLossEstimations = temp2.grossLossEstimations - temp2.feesEstimations


            /*******************
             * Counts
             *******************/
            temp2.executions = totalExecutions
            temp2.trades = totalTrades

            temp2.grossWinsQuantity = totalGrossWinsQuantity
            temp2.grossLossQuantity = totalGrossLossQuantity
            temp2.grossWinsCount = totalGrossWinsCount
            temp2.grossLossCount = totalGrossLossCount

            temp2.netWinsQuantity = totalNetWinsQuantity
            temp2.netLossQuantity = totalNetLossQuantity
            temp2.netWinsCount = totalNetWinsCount
            temp2.netLossCount = totalNetLossCount

            //temp2.netSharePLWins = totalNetSharePLWins
            //temp2.netSharePLLoss = totalNetSharePLLoss




            //Needed for Dashboard
            var numPL = this.filteredTrades.length
            temp2.probGrossWins = (totalGrossWinsCount / totalTrades)
            temp2.probGrossLoss = (totalGrossLossCount / totalTrades)
            temp2.probNetWins = (totalNetWinsCount / totalTrades)
            temp2.probNetLoss = (totalNetLossCount / totalTrades)
                //console.log("prob net win "+temp2.probNetWins+" and loss "+temp2.probNetLoss)

            temp2.avgGrossWins = (totalGrossWins / totalGrossWinsCount)
            temp2.avgGrossLoss = -(totalGrossLoss / totalGrossLossCount)
            temp2.avgNetWins = (totalNetWins / totalNetWinsCount)
            temp2.avgNetLoss = -(totalNetLoss / totalNetLossCount)

            temp2.avgGrossSharePLWins = (totalGrossSharePLWins / totalGrossWinsCount)
            temp2.avgGrossSharePLLoss = -(totalGrossSharePLLoss / totalGrossLossCount)
            temp2.avgNetSharePLWins = (totalNetSharePLWins / totalNetWinsCount)
            temp2.avgNetSharePLLoss = -(totalNetSharePLLoss / totalNetLossCount)

            this.totals = temp2
                //console.log(" -> TOTALS " + JSON.stringify(this.totals))
            this.dashboardIdMounted = true


            /*============= 2- RECREATING TOTALS BY DATE =============
             *
             * Create totals per date needed for grouping monthly, weekly and daily
             */
            let temp3 = {}
                //console.log("temp2 "+JSON.stringify(temp2))
            var z = _
                .chain(temp1)
                .orderBy(["td"], ["asc"])
                .groupBy("td")

            let objectY = JSON.parse(JSON.stringify(z))
            const keys3 = Object.keys(objectY);
            for (const key3 of keys3) {
                //console.log("key 3 " + key3)
                //console.log("z "+JSON.stringify(z))
                var tempTrades = objectY[key3]
                    //console.log("tempTrades " + JSON.stringify(tempTrades));
                temp3[key3] = {};

                /*******************
                 * Info
                 *******************/
                var sumBuyQuantity = 0
                var sumSellQuantity = 0

                /*******************
                 * Commissions and fees
                 *******************/
                var sumCommission = 0
                var sumSec = 0
                var sumTaf = 0
                var sumNscc = 0
                var sumNasdaq = 0
                var sumOtherCommission = 0
                var sumFees = 0

                /*******************
                 * Gross proceeds and P&L
                 *******************/
                var sumGrossProceeds = 0
                var sumGrossWins = 0
                var sumGrossLoss = 0
                var sumGrossSharePL = 0 //On a trade level, it's Proceeds per share traded. But as we blotter and create global P&L, it is a cumulative number (like proceeds). This way we can calculate estimations. If we need and average per share, it's a different calculation
                var sumGrossSharePLWins = 0
                var sumGrossSharePLLoss = 0
                var highGrossSharePLWin = 0
                var highGrossSharePLLoss = 0


                /*******************
                 * Net proceeds and P&L
                 *******************/
                var sumNetProceeds = 0
                var sumNetWins = 0
                var sumNetLoss = 0
                var sumNetSharePL = 0
                var sumNetSharePLWins = 0
                var sumNetSharePLLoss = 0
                var highNetSharePLWin = 0
                var highNetSharePLLoss = 0

                /*******************
                 * Counts
                 *******************/
                var sumExecutions = 0
                var sumTrades = 0
                var sumGrossWinsQuantity = 0
                var sumGrossLossQuantity = 0
                var sumGrossWinsCount = 0
                var sumGrossLossCount = 0
                var sumNetWinsQuantity = 0
                var sumNetLossQuantity = 0
                var sumNetWinsCount = 0
                var sumNetLossCount = 0



                tempTrades.forEach(element => {
                    sumBuyQuantity += element.buyQuantity
                    sumSellQuantity += element.sellQuantity
                    sumCommission += element.commission
                    sumSec += element.sec
                    sumTaf += element.taf
                    sumNscc += element.nscc
                    sumNasdaq += element.nasdaq
                    sumOtherCommission += element.sec + element.taf + element.nscc + element.nasdaq
                    sumFees += element.commission + element.sec + element.taf + element.nscc + element.nasdaq

                    sumGrossProceeds += element.grossProceeds
                    sumGrossWins += element.grossWins
                    sumGrossLoss += element.grossLoss
                    sumGrossSharePL += element.grossSharePL
                    sumGrossSharePLWins += element.grossSharePLWins
                    sumGrossSharePLLoss += element.grossSharePLLoss
                    if (element.grossSharePL >= 0) {
                        if (element.grossSharePL > highGrossSharePLWin) {
                            highGrossSharePLWin = element.grossSharePL
                        }
                    }
                    if (element.grossSharePL < 0) {
                        if (element.grossSharePL < highGrossSharePLLoss) {
                            highGrossSharePLLoss = element.grossSharePL
                        }

                    }

                    sumNetProceeds += element.netProceeds
                    sumNetWins += element.netWins
                    sumNetLoss += element.netLoss
                    sumNetSharePL += element.netSharePL
                    sumNetSharePLWins += element.netSharePLWins
                    sumNetSharePLLoss += element.netSharePLLoss
                    if (element.netSharePL >= 0) {
                        if (element.netSharePL > highNetSharePLWin) {
                            highNetSharePLWin = element.netSharePL
                        }

                    }
                    if (element.netSharePL < 0) {
                        if (element.netSharePL < highNetSharePLLoss) {
                            highNetSharePLLoss = element.netSharePL
                        }

                    }


                    sumExecutions += element.executionsCount
                    sumGrossWinsQuantity += element.grossWinsQuantity
                    sumGrossLossQuantity += element.grossLossQuantity
                    sumGrossWinsCount += element.grossWinsCount

                    sumNetWinsQuantity += element.netWinsQuantity
                    sumNetLossQuantity += element.netLossQuantity
                    sumNetWinsCount += element.netWinsCount
                    sumGrossLossCount += element.grossLossCount
                    sumNetLossCount += element.netLossCount
                    sumTrades += element.tradesCount

                })

                /*******************
                 * Info
                 *******************/
                //temp3[key3].symbol = key3;
                temp3[key3].buyQuantity = sumBuyQuantity
                temp3[key3].sellQuantity = sumSellQuantity

                /*******************
                 * Commissions and fees
                 *******************/
                temp3[key3].commission = sumCommission;
                temp3[key3].sec = sumSec
                temp3[key3].taf = sumTaf
                temp3[key3].nscc = sumNscc
                temp3[key3].nasdaq = sumNasdaq
                temp3[key3].otherCommission = sumOtherCommission;
                temp3[key3].fees = sumFees;
                //console.log("totalLocateFees" + JSON.stringify(temp2))

                /*******************
                 * Gross proceeds and P&L
                 *******************/
                temp3[key3].grossProceeds = sumGrossProceeds;
                temp3[key3].grossWins = sumGrossWins;
                temp3[key3].grossLoss = sumGrossLoss;
                temp3[key3].grossSharePL = sumGrossSharePL
                    //temp3[key3].grossSharePL = sumGrossProceeds / sumBuyQuantity

                /*sumGrossWinsQuantity == 0 ? temp3[key3].grossSharePLWins = 0 : temp3[key3].grossSharePLWins = sumGrossWins / sumGrossWinsQuantity
                sumGrossLossQuantity == 0 ? temp3[key3].grossSharePLLoss = 0 : temp3[key3].grossSharePLLoss = sumGrossLoss / sumGrossLossQuantity*/
                temp3[key3].grossSharePLWins = sumGrossSharePLWins
                temp3[key3].grossSharePLLoss = sumGrossSharePLLoss
                temp3[key3].highGrossSharePLWin = highGrossSharePLWin;
                temp3[key3].highGrossSharePLLoss = highGrossSharePLLoss;

                /*******************
                 * Net proceeds and P&L
                 *******************/
                temp3[key3].netProceeds = sumNetProceeds;
                temp3[key3].netWins = sumNetWins;
                temp3[key3].netLoss = sumNetLoss;
                temp3[key3].netSharePL = sumNetSharePL
                    //temp3[key3].netSharePL = sumNetProceeds / sumBuyQuantity

                /*sumNetWinsQuantity == 0 ? temp3[key3].netSharePLWins = 0 : temp3[key3].netSharePLWins = sumNetWins / sumNetWinsQuantity
                sumNetLossQuantity == 0 ? temp3[key3].netSharePLLoss = 0 : temp3[key3].netSharePLLoss = sumNetLoss / sumNetLossQuantity*/
                temp3[key3].netSharePLWins = sumNetSharePLWins
                temp3[key3].netSharePLLoss = sumNetSharePLLoss
                temp3[key3].highNetSharePLWin = highNetSharePLWin;
                temp3[key3].highNetSharePLLoss = highNetSharePLLoss;

                /*******************
                 * Counts
                 *******************/
                temp3[key3].executions = sumExecutions;
                temp3[key3].trades = sumTrades;

                temp3[key3].grossWinsQuantity = sumGrossWinsQuantity;
                temp3[key3].grossLossQuantity = sumGrossLossQuantity;
                temp3[key3].grossWinsCount = sumGrossWinsCount;
                temp3[key3].grossLossCount = sumGrossLossCount;

                temp3[key3].netWinsQuantity = sumNetWinsQuantity;
                temp3[key3].netLossQuantity = sumNetLossQuantity;
                temp3[key3].netWinsCount = sumNetWinsCount;
                temp3[key3].netLossCount = sumNetLossCount;

                /*******************
                 * Financials
                 *******************/
                temp3[key3].financials = tempTrades[0].financials



            }

            this.totalsByDate = temp3
                //console.log(" -> TOTALS BY DATE " + JSON.stringify(this.totalsByDate))



            /*============= 3- MISC GROUPING =============
            
            * Miscelanious grouping of trades by entry, price, etc.
            */
            var thousand = 1000
            var million = 1000000

            /*******************
             * GROUP BY DAY OF WEEK
             *******************/

            this.groups.day = _
                .groupBy(temp1, t => dayjs.unix(t.entryTime).day()); //temp1 is json array with trades and is created during totals
            //console.log("day  "+JSON.stringify(this.groups.day))

            /*******************
             * GROUP BY MONTH OF YEAR
             *******************/
            var b = _
                .groupBy(temp1, t => dayjs.unix(t.entryTime).month());
            //console.log("b "+JSON.stringify(b))

            /*******************
             * GROUP BY ENTRY TIMEFRAME
             *******************/
            this.groups.timeframe = _(temp1)
                .groupBy(x => {
                    var secondTimeFrame = 30
                    var msTimeFrame = secondTimeFrame * 60 * 1000; /*ms*/
                    //console.log("entry time " + dayjs.unix(x.entryTime).format("HH:mm"))
                    var entryTimeTF = dayjs(Math.floor((+dayjs.unix(x.entryTime)) / msTimeFrame) * msTimeFrame);
                    return entryTimeTF.format("HH:mm")
                })
                .toPairs()
                .sortBy(0)
                .fromPairs()
                .value()

            //console.log("timeframe " + JSON.stringify(this.groups.timeframe))

            /* ==== Group by trade duration ==== */
            this.groups.duration = _(temp1)
                .orderBy(x => x.exitTime - x.entryTime)
                .groupBy(t => {
                    // under 1mn, 1mn-2mn, 2-5mn, 5-10mn, 10-20mn, 20-40mn, 40-60mn, above 60mn
                    var tradeDuration = t.exitTime - t.entryTime // in seconds  
                    var tradeDurationDiv = tradeDuration / 60

                    var floorDurationSeconds
                    if (tradeDurationDiv < 1) {
                        floorDurationSeconds = 0 // 0-1mn
                    }
                    if (tradeDurationDiv >= 1 && tradeDurationDiv < 2) {
                        floorDurationSeconds = 1 // 1-2mn
                    }
                    if (tradeDurationDiv >= 2 && tradeDurationDiv < 5) {
                        floorDurationSeconds = 2 // 2-5mn
                    }
                    if (tradeDurationDiv >= 5 && tradeDurationDiv < 10) {
                        floorDurationSeconds = 5 // 5-10mn
                    }
                    if (tradeDurationDiv >= 10 && tradeDurationDiv < 20) {
                        floorDurationSeconds = 10 // 10-20mn
                    }
                    if (tradeDurationDiv >= 20 && tradeDurationDiv < 40) {
                        floorDurationSeconds = 20 // 20-40mn
                    }
                    if (tradeDurationDiv >= 40 && tradeDurationDiv < 60) {
                        floorDurationSeconds = 40 // 40-60mn
                    }
                    if (tradeDurationDiv >= 60) {
                        floorDurationSeconds = 60 // >60mn
                    }
                    //console.log(" -> duration " + dayjs.duration(tradeDuration * 1000).format('HH:mm:ss') + " - interval in seconds " + floorDurationSeconds + " - formated interval " + dayjs.duration(floorDurationSeconds * 1000).format('HH:mm:ss'))

                    return floorDurationSeconds
                })
                .toPairs()
                .sortBy(0)
                .fromPairs()
                .value()
                //console.log("d "+JSON.stringify(this.groups.duration))



            /*******************
             * GROUP BY NUMBER OF TRADES
             *******************/
            this.groups.trades = _(temp3)
                .groupBy(x => {
                    let ceilTrades
                        // under 5, 6-10, 11-15, 16-20, 21-30, above 30 trades
                    if (x.trades <= 30) {
                        var range = 5
                        ceilTrades = (Math.ceil(x.trades / range) * range);
                    }
                    if (x.trades > 30) {
                        ceilTrades = 30
                    }
                    //console.log(" -> trades " + x.trades +" and interval "+ceilTrades)

                    return ceilTrades
                })
                .value()

            //console.log("trades " + JSON.stringify(this.groups.trades))

            /*******************
             * GROUP BY NUMBER OF EXECUTIONS PER TRADE
             *******************/
            this.groups.executions = _(temp1)
                .groupBy('executionsCount')
                .value()

            //console.log("executions " + JSON.stringify(this.groups.executions))

            /*******************
             * GROUP BY PATTERN
             *******************/
            this.groups.patterns = _(temp1)
                .groupBy(x => {
                    //in my first version pattern was a string id. Now pattern is an object. So we need to check this
                    if (typeof(x.setup.pattern) == 'string') {
                        return x.setup.pattern
                    }
                    /*if (typeof(x.setup.pattern) == 'object' && x.setup.pattern != null) {
                        return x.setup.pattern
                    }*/
                })
                .value()
                //console.log("group by patterns " + JSON.stringify(this.groups.patterns))

            /*******************
             * GROUP BY PATTERN TYPE
             *******************/
            this.groups.patternTypes = _(temp1)
                .groupBy(x => {
                    //in my first version pattern was a string id. Now pattern is an object. So we need to check this
                    if (typeof(x.setup.pattern) == 'string') {
                        //console.log(" patterns "+JSON.stringify(this.patterns[0].objectId)+" setupid "+x.setup.pattern)
                        //console.log("patterns "+JSON.stringify(this.patterns))
                        let pattern = this.patterns.find(item => item.objectId === x.setup.pattern)
                        if (pattern != undefined && pattern.hasOwnProperty("type")) {
                            let patternType = pattern.type
                                //console.log("pattern type "+patternType)
                            return patternType
                        } else {
                            return null
                        }

                    }

                    /*if (typeof(x.setup.pattern) == 'object' && x.setup.pattern != null) {
                        console.log(" patterns "+JSON.stringify(this.patterns[0].objectId)+" setupid "+x.setup.pattern.id)
                        let pattern = this.patterns.find(item => item.objectId === x.setup.pattern)
                        let patternType = pattern
                        console.log("pattern type "+patternType)
                        //return patternType
                    }*/
                })
                .value()
                //console.log("group by pattern types " + JSON.stringify(this.groups.patternTypes))

            /*******************
             * GROUP BY MISTAKE
             *******************/
            this.groups.mistakes = _(temp1)
                .groupBy(x => {

                    if (typeof(x.setup.mistake) == 'string') {
                        //console.log(" mistake id "+x.setup.mistake)
                        return x.setup.mistake
                    }

                    /*if (typeof(x.setup.pattern) == 'object' && x.setup.pattern != null) {
                        console.log(" patterns "+JSON.stringify(this.patterns[0].objectId)+" setupid "+x.setup.pattern.id)
                        let pattern = this.patterns.find(item => item.objectId === x.setup.pattern)
                        let patternType = pattern
                        console.log("pattern type "+patternType)
                        //return patternType
                    }*/
                })
                .value()
                //console.log("group by mistakes " + JSON.stringify(this.groups.mistakes))

            /*******************
             * GROUP BY SYMBOL
             *******************/
            this.groups.symbols = _(temp1)
                .groupBy('symbol')
                .value()
                //console.log("symbols " + JSON.stringify(this.groups.symbols))

            /*******************
             * GROUP BY PUBLIC FLOAT
             *******************/
            let path = "financials.publicFloat";
            this.groups.shareFloat = _(temp1)
                .filter(object => _.has(object, path))
                .groupBy(x => {
                    let ceilFloor
                    var publicFloatFinviz = x.financials.publicFloat.finviz
                    if (publicFloatFinviz != "-") {
                        //console.log("public float (finviz) " + JSON.stringify(publicFloatFinviz))

                        // under 10M, 10-20M, 20-30, 30-50, above 50M float
                        if (publicFloatFinviz < 20 * million) {
                            var range = 5 * 1000000
                            ceilFloor = (Math.floor(publicFloatFinviz / range) * range);
                        }
                        if ((publicFloatFinviz >= 20 * million) && (publicFloatFinviz < 50 * million)) {
                            var range = 10 * 1000000
                            ceilFloor = (Math.floor(publicFloatFinviz / range) * range);
                        }
                        if (publicFloatFinviz >= 50 * million) {
                            ceilFloor = 50 * million
                        }
                        //console.log(" -> trades " + x.trades +" and interval "+ceilFloor)

                        return ceilFloor
                    }
                })
                .value()

            //console.log("group by share float " + JSON.stringify(this.groups.shareFloat))

            /*******************
             * GROUP BY MARKET CAP
             *******************/
            this.groups.mktCap = _(temp1)
                .filter(object => _.has(object, path))
                .groupBy(x => {
                    let ceilTrades
                    var mktCap = x.financials.mktCap
                    if (mktCap != null) {
                        //console.log("mktCap " + mktCap)
                        //Mega-cap: Market cap of $200 billion and greater
                        //Big-cap: $10 billion and greater
                        //Mid-cap: $2 billion to $10 billion
                        //Small-cap: $300 million to $2 billion
                        //Micro-cap: $50 million to $300 million
                        //Nano-cap: Under $50 million
                        if (mktCap <= 50 * 1000000) {
                            ceilTrades = 50 * 1000000
                        }
                        if (mktCap > 50 * 1000000 && mktCap <= 300 * 1000000) {
                            ceilTrades = 300 * 1000000
                        }
                        if (mktCap > 300 * 1000000 && mktCap <= 2000 * 1000000) {
                            ceilTrades = 2000 * 1000000
                        }
                        if (mktCap > 2000 * 1000000 && mktCap <= 10000 * 1000000) {
                            ceilTrades = 10000 * 1000000
                        }
                        if (mktCap > 10000 * 1000000) {
                            ceilTrades = 10001 * 1000000
                        }
                        //console.log(" -> interval "+ceilTrades)

                        return ceilTrades
                    }
                })
                .value()

            //console.log("group by mktCap " + JSON.stringify(this.groups.mktCap))


            /*******************
             * GROUP BY ENTRYPRICE
             *******************/
            this.groups.entryPrice = _(temp1)
                .groupBy(x => {
                    // under 5, 5-9.99, 10-14.99, 15-19.99, 20-29.99, above 30 trades
                    if (x.entryPrice < 30) {
                        var range = 5
                        floor = (Math.floor(x.entryPrice / range) * range);
                    }
                    if (x.entryPrice >= 30) {
                        floor = 30
                    }
                    //console.log(" -> Entry price "+x.entryPrice+" and interval "+floor)

                    return floor
                })
                .value()
                //console.log("group by entryprice " + JSON.stringify(this.groups.entryPrice))

        },

        eCharts(param) {
            console.log(" -> eCharts " + param)

            for (let index = 1; index <= 1; index++) {
                var chartId = 'pieChart' + index
                console.log("chartId " + chartId)
                if (param == "clear") {
                    echarts.init(document.getElementById(chartId)).clear()
                }
                if (param == "init" ||  "pieChart") {
                    //console.log("totals "+JSON.stringify(this.totals))
                    var probWins = (this.totals[this.amountCase + 'WinsCount'] / this.totals.trades)
                    var probLoss = (this.totals[this.amountCase + 'LossCount'] / this.totals.trades)
                    this.pieChart(chartId, probWins, probLoss)
                }
            }

            for (let index = 1; index <= 1; index++) {
                var chartId = 'lineChart' + index
                if (param == "clear") {
                    echarts.init(document.getElementById(chartId)).clear()
                }
                if (param == "init") {
                    this.lineChart(chartId)
                }
            }

            for (let index = 1; index <= 1; index++) {
                var chartId = 'lineBarChart' + index
                if (param == "clear") {
                    echarts.init(document.getElementById(chartId)).clear()
                }
                if (param == "init" ||  param == "lineBarChart") {
                    this.lineBarChart(chartId)
                }
            }

            for (let index = 1; index <= 2; index++) {
                var chartId = 'barChart' + index
                if (param == "clear") {
                    echarts.init(document.getElementById(chartId)).clear()
                }
                if (param == "init"  ||  param == "barChart") {
                    this.barChart(chartId)
                }
            }

            var indexes = [1, 2, 3, 4, 7, 13, 16, 10, 11, 15] // This way here because I took out some charts
            indexes.forEach(index => {
                var chartId = 'barChartNegative' + index
                if (param == "clear") {
                    echarts.init(document.getElementById(chartId)).clear()
                }
                if (param == "init" || param == "barChartNegative") {
                    this.barChartNegative(chartId)
                }
            });

            /*for (let index = 1; index <= 1; index++) {
                echarts.init(document.getElementById('boxPlotChart' + index)).clear()
            }*/
        }


    }
}